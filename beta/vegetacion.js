/* Torre Multiversal · Vangelium Dynamic Vegetation v1.0 (beta) · 15-11-2026
 *
 * Vegetación pixel art que se mueve y reacciona sin un sensor por planta:
 *  - Simulación por CELDAS (rejilla 48×48 de 0,5 u que sigue al jugador). Solo
 *    las celdas tocadas por algo reciben impulso; el resto lo recibe de sus
 *    vecinas con pérdida de energía y retraso (resorte + amortiguación +
 *    acoplamiento). Cuando la energía cae bajo un umbral, la simulación duerme.
 *  - El resultado se sube como una textura pequeña y el SHADER DEL TERRENO
 *    inclina solo la parte alta de cada planta (la raíz queda fija). No se
 *    cambia el renderizador: es el mismo material del mapa.
 *  - Tipos: pasto corto (matas del mapa), pasto alto y helechos (nuevos,
 *    pintados en una zona libre del atlas, en una zona controlada del valle),
 *    flores (del mapa) y arbustos (del mapa, oscilación pesada).
 *  - Reacciona a: jugador (posición, velocidad y dirección), criaturas y
 *    jefes al moverse (las grandes empujan más), ataques cercanos, ondas
 *    expansivas (las del Rey Slime) y viento ambiental con ráfagas.
 *  - Niveles de detalle por distancia: cercano reactivo, intermedio solo
 *    viento suave, lejano quieto.
 * Activación: /beta/?veg=1. Configuración: window.__TM_VEG_CONFIG__.
 */
(function (root) {
  'use strict';
  const DEF = Object.freeze({
    cells: 48, cell: 0.5, hz: 30,
    spring: 22, damping: 3.6, couple: 400, maxDisp: 1, sleep: 2e-5,
    player: { radius: 1.3, force: 20 }, creature: { force: 16 }, attack: { radius: 1.8, force: 30 },
    wind: { strength: 0.1, gust: 1 }, lod: { near: 8, far: 15 },
    zone: { radius: 26, max: 1000, spacing: 0.42, thickets: 16, thicketGap: 3.4, thicketMin: 0.6 },
    near: { player: 0.7, creature: 0.55, squash: 0.55 },
    regrow: { grass: 150, thicket: 300 }, pickup: 1.3
  });

  // ════════════════════════════════════════════════════════════════════
  // 1. Simulación por celdas (pura, probada con node --test)
  // ════════════════════════════════════════════════════════════════════
  class VegSim {
    constructor(cfg = DEF) {
      this.cfg = cfg; this.N = cfg.cells;
      const n = this.N * this.N;
      this.dx = new Float32Array(n); this.dy = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n);
      this.awake = false; this.energy = 0; this.box = null; this.x0 = 0; this.y0 = 0;
    }
    idx(i, j) { return j * this.N + i; }
    /** Coloca la ventana para que (x, y) quede al centro, desplazando el estado (sin perder la onda). */
    center(x, y) {
      const c = this.cfg.cell, N = this.N, nx0 = Math.floor(x / c) - (N >> 1), ny0 = Math.floor(y / c) - (N >> 1);
      const ox0 = Math.round(this.x0 / c), oy0 = Math.round(this.y0 / c), si = nx0 - ox0, sj = ny0 - oy0;
      if (si === 0 && sj === 0 && this._placed) return false;
      if (this._placed && (Math.abs(si) < N && Math.abs(sj) < N) && this.awake) {
        for (const arr of [this.dx, this.dy, this.vx, this.vy]) {
          const cp = arr.slice(); arr.fill(0);
          for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = i + si, b = j + sj; if (a >= 0 && b >= 0 && a < N && b < N) arr[j * N + i] = cp[b * N + a]; }
        }
        this.box = null;
      } else { this.dx.fill(0); this.dy.fill(0); this.vx.fill(0); this.vy.fill(0); this.awake = false; }
      this.x0 = nx0 * c; this.y0 = ny0 * c; this._placed = true;
      return true;
    }
    /** Impulso en un círculo: empuja hacia afuera del centro, mezclado con la dirección del movimiento. */
    impulse(x, y, r, force, dirx = 0, diry = 0) {
      const c = this.cfg.cell, N = this.N;
      const ci = (x - this.x0) / c, cj = (y - this.y0) / c, R = r / c;
      const i0 = Math.max(1, Math.floor(ci - R)), i1 = Math.min(N - 2, Math.ceil(ci + R)), j0 = Math.max(1, Math.floor(cj - R)), j1 = Math.min(N - 2, Math.ceil(cj + R));
      if (i0 > i1 || j0 > j1) return;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const ex = i + 0.5 - ci, ey = j + 0.5 - cj, d = Math.hypot(ex, ey) / R; if (d > 1) continue;
        const fall = (1 - d) * (1 - d), out = Math.hypot(ex, ey) || 1, k = this.idx(i, j);
        this.vx[k] += (ex / out * 0.6 + dirx * 0.8) * force * fall;
        this.vy[k] += (ey / out * 0.6 + diry * 0.8) * force * fall;
      }
      this.grow(i0, j0, i1, j1); this.awake = true;
    }
    grow(i0, j0, i1, j1) {
      const b = this.box;
      this.box = b ? [Math.min(b[0], i0), Math.min(b[1], j0), Math.max(b[2], i1), Math.max(b[3], j1)] : [i0, j0, i1, j1];
    }
    /** Un paso: resorte hacia el reposo, amortiguación y acoplamiento con las vecinas (propagación). */
    step(dt) {
      if (!this.awake) return 0;
      const N = this.N, { spring, damping, couple, maxDisp } = this.cfg, dx = this.dx, dy = this.dy, vx = this.vx, vy = this.vy;
      const b = this.box || [1, 1, N - 2, N - 2];
      const i0 = Math.max(1, b[0] - 2), j0 = Math.max(1, b[1] - 2), i1 = Math.min(N - 2, b[2] + 2), j1 = Math.min(N - 2, b[3] + 2);
      let energy = 0, ni0 = N, nj0 = N, ni1 = -1, nj1 = -1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        const lx = (dx[k - 1] + dx[k + 1] + dx[k - N] + dx[k + N]) * 0.25 - dx[k];
        const ly = (dy[k - 1] + dy[k + 1] + dy[k - N] + dy[k + N]) * 0.25 - dy[k];
        vx[k] += (-spring * dx[k] - damping * vx[k] + couple * lx) * dt;
        vy[k] += (-spring * dy[k] - damping * vy[k] + couple * ly) * dt;
      }
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        dx[k] = Math.max(-maxDisp, Math.min(maxDisp, dx[k] + vx[k] * dt));
        dy[k] = Math.max(-maxDisp, Math.min(maxDisp, dy[k] + vy[k] * dt));
        const e = dx[k] * dx[k] + dy[k] * dy[k] + (vx[k] * vx[k] + vy[k] * vy[k]) * 0.02;
        energy += e;
        if (e > 1e-9) { if (i < ni0) ni0 = i; if (j < nj0) nj0 = j; if (i > ni1) ni1 = i; if (j > nj1) nj1 = j; }
      }
      this.energy = energy;
      // Borde de la ventana fijo en 0: nunca se calcula, así que un valor que llegara ahí
      // (por la onda o al desplazar la ventana) quedaría congelado y no dejaría dormir.
      for (let i = 0; i < N; i++) for (const k of [i, (N - 1) * N + i, i * N, i * N + N - 1]) { dx[k] = 0; dy[k] = 0; vx[k] = 0; vy[k] = 0; }
      // Bajo el umbral se duerme: todo vuelve exacto al reposo (sin vibraciones residuales).
      if (ni1 < 0 || energy < this.cfg.sleep) { this.dx.fill(0); this.dy.fill(0); this.vx.fill(0); this.vy.fill(0); this.awake = false; this.box = null; this.energy = 0; return 0; }
      this.box = [ni0, nj0, ni1, nj1];
      return energy;
    }
    at(x, y) { const c = this.cfg.cell, i = Math.floor((x - this.x0) / c), j = Math.floor((y - this.y0) / c); if (i < 0 || j < 0 || i >= this.N || j >= this.N) return [0, 0]; const k = this.idx(i, j); return [this.dx[k], this.dy[k]]; }
  }

  // Pasto corto flexible; flores algo más rígidas; el matorral alto se mece como una masa.
  const AMP = { vegCorta: 0.26, vegFlor: 0.2, vegMatorral: 0.3 };
  // Paleta = la misma de los arbustos y árboles del juego (contorno, sombras, luz).
  // Nada de verdes nuevos: así las plantas quedan integradas con el terreno.
  const PAL = { O: '#0c241a', D: '#19472a', d: '#235e31', k: '#337838', m: '#4b9440', l: '#6fb14b', h: '#a3d064', s: '#d2ec8c',
    w: '#eeeadb', g: '#b9b3a2', y: '#e9c25e', p: '#ea94bc', q: '#b45f8c' };
  // Pixel art dibujado a mano (una letra = un píxel; '.' = transparente).
  const ART = {
    vegCorta0: ['.....h.....', '.....l.....', '...h.m.h...', '...l.m.l...', 'h..m.mlm..h', 'l..mlkmm..l', '.mlkmkdk.m.', '.kmkdddk.k.', '.dDdDdDd.d.', '.DDDDDDD.D.'],
    vegCorta1: ['...h.....', '...l.....', '...m.h...', 'h..m.l...', 'l..mlm..h', '.mlkmm..l', '.kmkdk.m.', '.dDdDd.k.', '.DDDDD.D.'],
    vegCorta2: ['.....h......', '.....l.h....', '...h.m.l....', '...l.mlm...h', 'h..m.mmml..l', 'l..mlkdkm.m.', '.m.kmkdkd.k.', '.k.dDdDdD.d.', '.D.DDDDDD.D.'],
    vegCorta3: ['...h....', '...l....', '...m..h.', 'h..ml.l.', 'l..kmmh.', '.mlkdkl.', '.kddDdk.', '.DDDDDD.'],
    vegFlor0: ['........w.', '..w....wyg', '.wyg.w.kg.', '..g.wygk..', '..k..g.k..', '..k..k.k..', '..kh.khk..', 'h.kl.klk.h', '.kkk.kkkk.', '.DDD.DDDD.'],
    vegFlor1: ['......p..', '..p..pyq.', '.pyq..q..', '..q...k..', '..k...k..', '..k.h.k..', 'h.k.l.k.h', '.kk.k.kk.', '.DD.D.DD.'],
    vegMatorral0: ['..........O...................', '.........OlO.....O............', '.........Om..O.O.lO.O.........', '.........Ok..l.l.m..lO........', '........Olk..m.m.k..mO........', '........Omk..k.k.k..kOO.......', '........OkkO.k.k.k..k.lO......', '.......OOkkl.k.kOk..k.mO......', '......Ol.kkm.kOklk..k.kO......', '......Om.ldk.khkmd..k.kO......', '......Ok.mdkOdldkd.Od.klO.....', '....O.Ok.kdkhdmdkh.ll.kmO.O...', '...Ol..k.kdkldmdkl.mm.hk..lO..', '...Om..l.h.dmdmdkm.kk.lk..mO..', '..ODkOOmOl.dmdmddmOdkOmkOOkO..', '.OldDlhDhmDdmdmddmddhdmdlDDO..', '.OdDDdlDlmDdmdmddmDdldmhDDdO..', '.ODDdDmdmmddmddkdmDdmdmlDddO..', '.ODddDmdmmdDkddkdkddmdkmhDdlO.', 'ODdhDdmdmkdDkDdkdkdDmkdmlddhO.', 'lldlddkdkDkDkDdkdkdDkkdmmdDlO.', 'dDDmddkDkDkDkDdkDkdkdkdkmdDmO.', 'DDdmddkDkDkDkDDkDkDkDkkDkddmDO', 'ddDdkDkDkDkDkDDkDkDkDkkDkDkddl', 'OdhDkDkDkDkDdDDdDdDkDdkDkDkdDD', 'OdlDkDdDdDdDdDDdDdDdDdkDkDkDDd', 'ODkDkDdDdDdDdDDdDdDdDddDdDkDdO', 'ODkDdDdDdDdDdDDdDdDdDddDdDdDDO', 'ODdDdDdDdDdDdDDdDdDdDddDdDdDDO', '.DDDDDDDDDDDDDDDDDDDDDDDDDDDD.'],
    vegMatorral1: ['.........O...............', '........OlO..............', '........OmOO.O...........', '........Ok.l.lOO.........', '.......OOk.m.m.lO........', '.....OOl.k.k.k.mO........', '....Ol.m.kOkOk.kOO.......', '....Om.k.klklk.k.lO......', '...OOk.l.dhkmk.k.mOO.....', '..Ol.kOm.dldkd.kOk.lO....', '..Om.khk.dmdkd.dlk.mO....', '..OkOllk.dmdkd.dmk.kO....', '..OkhmmkOhmdhdOdkdOkO....', '.ODDldmddlmdldddDdDDO....', 'OlDdmDmdDmkdmdDdhdDhDOO..', 'ODhdmdmddmdkmdDdlhdlldlO.', 'ODldmdkddmdkmdddmlDmdhDO.', 'OdmdkdkddkdkkDdDmmDmDldO.', 'OdmddkkDdkDkkDdDkmdkdmdO.', 'OdkDdkkDDkDkkDdkkDkDdmDDO', 'OdkDDkkDDkDdkDDkkDkDdkdll', 'ODkDDkdDDkDdkDDkkDkDdkDDd', 'ODkDDddDDdDddDDdkDdDDkdhO', 'ODdDDddDDdDddDDddDdDDddlO', 'ODdDDddDDdDddDDddDdDDdkDO', '.DDDDDDDDDDDDDDDDDDDDDDD.'],
  };
  // Lo que se recoge al cortar (va a la bolsa; servirá para craftear).
  const ITEM_ART = {
    itemFibra: ['..l.h..', '.lkmlh.', 'lkmlmkl', '.dkmkd.', 'lkmlmkl', '.lkmlh.', '..d.d..'],
    itemSemilla: ['..yy..', '.ywgy.', 'ygwwgy', 'yggggy', '.ygqy.', '..yy..'],
    itemCana: ['......hl', '.....lmk', '....lmkd', '...lmkd.', '..lmkd..', '.lmkd...', 'lmkd....', 'kdd.....']
  };
  const DROPS = {
    vegCorta: [['fibra', 0.55, 1], ['semilla', 0.12, 1]],
    vegFlor: [['semilla', 0.7, 1], ['fibra', 0.35, 1]],
    vegMatorral: [['cana', 1, 2], ['fibra', 1, 2], ['semilla', 0.35, 1]]
  };
  const MAT_ICON = { fibra: 'itemFibra', semilla: 'itemSemilla', cana: 'itemCana' };
  /** Rastrojo: la misma planta cortada a ras (las filas de abajo, con el corte más claro). */
  function stubble(rows, keep) {
    const h = rows.length, out = rows.map((r, y) => y < h - keep ? '.'.repeat(r.length) : r);
    const top = h - keep;
    out[top] = [...out[top]].map(c => c === '.' ? '.' : (c === 'O' || c === 'D' ? 'm' : 'l')).join('');
    return out;
  }
  // id, ancho, alto, amplitud de flexión (u), tipo
  const NEW_SPRITES = Object.keys(ART).map(id => { const k = id.replace(/\d+$/, ''); return [id, ART[id][0].length, ART[id].length, AMP[k], k.slice(3).toLowerCase()]; });
  /** Campo → textura RGBA8: rg = desplazamiento (−1..1), ba = velocidad (÷ VMAX, −1..1). 128 = reposo. */
  const VMAX = 12;
  function encodeField(S, d) {
    const q = v => Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)));
    for (let k = 0; k < S.dx.length; k++) {
      d[k * 4] = q(S.dx[k]); d[k * 4 + 1] = q(S.dy[k]);
      d[k * 4 + 2] = q(Math.max(-1, Math.min(1, S.vx[k] / VMAX))); d[k * 4 + 3] = q(Math.max(-1, Math.min(1, S.vy[k] / VMAX)));
    }
    return d;
  }
  const API = { DEF, VegSim, ART, PAL, NEW_SPRITES, encodeField, VMAX, DROPS, ITEM_ART, stubble };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root.document) return;

  // ════════════════════════════════════════════════════════════════════
  // 2. Arte de las especies nuevas (pintadas en la zona libre del atlas)
  // ════════════════════════════════════════════════════════════════════
  function paintSprite(g, x0, y0, id, rowsIn) {
    const rows = rowsIn || ART[id]; if (!rows) return;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const c = PAL[rows[y][x]]; if (c) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. Inyección en el shader del terreno (la raíz no se mueve)
  // ════════════════════════════════════════════════════════════════════
  const VS_HEAD = `
      attribute vec4 aVeg;
      uniform vec4 uVegWin; uniform vec4 uVegCam; uniform vec4 uVegWind; uniform vec2 uVegLod;
      uniform vec4 uVegNear[5];
      #ifdef TM_VEG_TEX
      uniform sampler2D uVegTex;
      #endif`;
  // aVeg = (peso: 1 punta → 0 raíz, amplitud, fase propia, largo de la planta en z).
  // Todo se calcula desde la RAÍZ de cada planta: la planta entera reacciona como una
  // pieza (la punta se mueve más que la base) y la raíz nunca se desplaza.
  const VS_BODY = `
        if (aVeg.x > 0.0 && uVegWin.w > 0.5) {
          float vw = aVeg.x, amp = aVeg.y, ph = fract(aVeg.z), thick = step(3.5, aVeg.z), up = step(1.5, aVeg.z - 4.0 * thick);
          float toRoot = pow(vw, 0.6667) * aVeg.w;                 // distancia de este vértice a la raíz
          // Plantas de la zona: de pie (up = 1; la raíz está en su mismo z y tapan lo que hay detrás).
          // Matas del mapa: planas sobre el suelo (la raíz está más adelante en z).
          vec2 root = vec2(wp.x, wp.z + toRoot * (1.0 - up));
          float dist = distance(root, uVegCam.xy);
          float lod = 1.0 - smoothstep(uVegLod.x, uVegLod.y, dist), mid = 1.0 - smoothstep(uVegLod.y, uVegLod.y + 4.0, dist);
          // Viento secundario: solo durante ráfagas (la mayor parte del tiempo, quieto).
          float freq = 2.4 - amp * 3.0;
          float wind = sin(uVegCam.z * freq + root.x * 0.5 + root.y * 0.3 + ph * 6.2831) * uVegWind.z;
          vec2 d = vec2(0.0), vel = vec2(0.0);
          #ifdef TM_VEG_TEX
          // Cada planta lee la onda en un punto propio cerca de su raíz (reacción desfasada).
          vec2 tuv = (root + vec2(ph - 0.5, fract(ph * 7.3) - 0.5) * 0.3 - uVegWin.xy) / uVegWin.z;
          if (tuv.x > 0.0 && tuv.y > 0.0 && tuv.x < 1.0 && tuv.y < 1.0) {
            vec4 tx = texture2D(uVegTex, tuv);
            d = (tx.rg * 2.0 - 1.0) * lod * (0.8 + 0.4 * ph);
            vel = (tx.ba * 2.0 - 1.0) * lod;
          }
          #endif
          // Flexión hacia donde empuja el contacto + la punta baja hacia la raíz (se aplasta).
          float push = min(1.0, length(d)), vw2 = vw * vw;
          // La punta se atrasa respecto del tallo (inercia, como un látigo) y aletea un instante:
          // la hoja se curva en vez de inclinarse rígida. Ambos son 0 en reposo.
          vec2 lag = clamp(-vel * (0.75 + 0.5 * ph), -0.8, 0.8);
          float flutter = sin(uVegCam.z * (11.0 + 5.0 * ph) + ph * 31.0) * push * 0.18;
          wp.x += (d.x * amp + wind * amp * 0.35 * mid) * vw + (lag.x * 0.9 + flutter) * amp * vw2;
          float squash = push * 0.5 * min(1.0, amp * 2.0) * toRoot;
          wp.z += (d.y * amp * 0.4) * vw + lag.y * amp * 0.35 * vw2 + squash * (1.0 - up);
          wp.y -= squash * up;
          // Profundidad legible: la hierba justo delante de un personaje se agacha y se abre,
          // así tapa los pies y parte de las piernas, nunca el cuerpo.
          for (int q = 0; q < 5; q++) {
            vec4 n = uVegNear[q];
            if (n.z <= 0.0 || amp < 0.08) continue;     // los arbustos sólidos no se agachan
            float ax = abs(root.x - n.x), dz = root.y - n.y;
            float f = (1.0 - smoothstep(n.z * 0.55, n.z, ax)) * step(-0.15, dz) * (1.0 - smoothstep(n.z * 0.7, n.z * 1.35, dz));
            // El matorral alto es un escondite: a las criaturas no las destapa; al jugador apenas.
            f *= (q == 0) ? mix(1.0, 0.35, thick) : (1.0 - thick);
            wp.z += f * n.w * toRoot * (1.0 - up);
            wp.y -= f * n.w * toRoot * up;
            wp.x += sign(root.x - n.x + 0.001) * f * amp * 0.6 * vw;
          }
        }`;

  class Veg {
    constructor(app, cfg) {
      this.app = app; this.cfg = cfg; this.sim = new VegSim(cfg);
      this.acc = 0; this.prev = null; this.ent = new Map(); this.stats = { simMs: 0, uploads: 0, active: 0, plants: 0, frames: 0, steps: 0, src: { jugador: 0, ataque: 0, criaturas: 0, ondas: 0 } };
      this.view = null; this.mat = null; this.tex = null; this.data = null; this.on = true; this.lastAtk = undefined;
      this.plants = []; this.drops = []; this.chips = []; this.gain = {}; this.cuts = 0; this._regT = 0;
      this.hook();
      root.__TM_VEG__ = this;
    }
    hook() {
      const a = this.app, self = this;
      const step = a._step;
      a._step = function (dt) { const r = step.call(a, dt); try { self.tick(dt); } catch (e) { self.fail(e); } return r; };
      const render = a._render;
      a._render = function () {
        const r = render.apply(a, arguments);
        if (a.pr && !a.pr.__tmVegPatched) {
          const pr = a.pr, fn = pr.render;
          pr.render = function () { try { self.before(); } catch (e) { self.fail(e); } return fn.apply(pr, arguments); };
          pr.__tmVegPatched = true;
        }
        return r;
      };
    }
    fail(e) { if (this._f) return; this._f = true; console.error('Vegetación beta:', e); setTimeout(() => { this._f = false; }, 4000); }
    /** Onda expansiva pública (la usan el Rey Slime y otros efectos). */
    blast(x, y, r = 3, force = 9) { if (this.on) { this.sim.impulse(x, y, r, force); this.stats.src.ondas++; } }

    // ── Simulación (30 Hz fijos) ──
    tick(dt) {
      const a = this.app, s = a.session, av = s && s.avatar;
      if (!this.on || !av || a.mode !== 'game' || !s.world) return;
      this.sim.center(av.x, av.y);
      const C = this.cfg;
      // Jugador: posición, velocidad y dirección.
      if (this.prev) {
        const vx = (av.x - this.prev.x) / Math.max(dt, 1e-3), vy = (av.y - this.prev.y) / Math.max(dt, 1e-3), sp = Math.hypot(vx, vy);
        if (sp > 0.4 && sp < 40) { this.sim.impulse(av.x, av.y + 0.1, C.player.radius, C.player.force * Math.min(1.6, sp / 4) * dt * 30, vx / sp, vy / sp); this.stats.src.jugador++; }
        // Ataque cuerpo a cuerpo: abanico al frente.
        const atk = (av.ac | 0) * 1000 + (av.atk | 0);   // «ac» cuenta las acciones de ataque del avatar
        if (this.lastAtk !== undefined && atk !== this.lastAtk) {
          // Mira hacia donde mira el personaje (8 direcciones: 0 abajo, 2 derecha, 4 arriba, 6 izquierda).
          const fa = Number.isFinite(av.facing) ? av.facing * Math.PI / 4 : null;
          const fx = fa !== null ? Math.sin(fa) : sp > 0.2 ? vx / sp : (this.face ? this.face[0] : 1);
          const fy = fa !== null ? Math.cos(fa) : sp > 0.2 ? vy / sp : (this.face ? this.face[1] : 0);
          this.sim.impulse(av.x + fx * 0.9, av.y + fy * 0.9, C.attack.radius, C.attack.force, fx, fy); this.stats.src.ataque++;
          this.slash(av.x, av.y, fx, fy);
        }
        this.lastAtk = atk;
        if (sp > 0.2) this.face = [vx / sp, vy / sp];
      }
      this.prev = { x: av.x, y: av.y };
      // Criaturas y jefes que se mueven (las grandes empujan más).
      const half = C.cells * C.cell * 0.5;
      for (const e of s.world.entities) {
        if (e.dead || Math.abs(e.x - av.x) > half || Math.abs(e.y - av.y) > half) continue;
        const p = this.ent.get(e.id); this.ent.set(e.id, { x: e.x, y: e.y });
        if (!p) continue;
        const mx = e.x - p.x, my = e.y - p.y, m = Math.hypot(mx, my);
        if (m > 0.01 && m < 2) { const r = Math.max(0.6, (e.r || 0.4) * 1.3); this.stats.src.criaturas++; this.sim.impulse(e.x, e.y, r, C.creature.force * Math.min(2, m / dt / 3) * (0.6 + r * 0.4) * dt * 30, mx / m, my / m); }
      }
      if (this.ent.size > 400) this.ent.clear();
      // Rebrote: el pasto cortado vuelve a crecer (comida para los animales, más adelante).
      this._regT += dt;
      if (this._regT > 1) { this._regT = 0; const now = performance.now() / 1000; for (const p of this.plants) if (p.cut && now >= p.regrowAt) this.setCut(p, false); }
      // Paso fijo.
      this.acc += Math.min(dt, 0.1);
      const h = 1 / C.hz, t0 = performance.now();
      while (this.acc >= h) { if (this.sim.awake) { this.sim.step(h); this.stats.steps++; this.dirty = true; } this.acc -= h; }
      this.stats.simMs = this.stats.simMs * 0.9 + (performance.now() - t0) * 0.1;
    }

    // ── Antes de dibujar: shader, geometrías, textura y uniformes ──
    before() {
      const a = this.app, v = a.view, s = a.session, av = s && s.avatar;
      if (!v || !av || !v.terrainMat) return;
      if (this.view !== v) this.setup(v);
      if (!this.mat || !this.mat.uniforms.uVegWin) return;
      this.tagChunks(v);
      const U = this.mat.uniforms, C = this.cfg, t = performance.now() / 1000;
      const inValley = a.terrain && a.terrain.id === 'valle-alba';
      U.uVegWin.value.set(this.sim.x0, this.sim.y0, C.cells * C.cell, this.on && inValley ? 1 : 0);
      U.uVegCam.value.set(av.x, av.y, t, 0);
      const g0 = Math.max(0, Math.sin(t * 0.17) * Math.sin(t * 0.071 + 1.3)), gust = Math.pow(g0, 3) * C.wind.gust;   // casi siempre 0
      U.uVegWind.value.set(1, 0, C.wind.strength * gust, 0);
      U.uVegLod.value.set(C.lod.near, C.lod.far);
      // Personajes cerca de los que la hierba se agacha (jugador + 4 criaturas más cercanas).
      const NR = U.uVegNear.value, NC = C.near; NR.forEach(q => q.set(0, 0, 0, 0));
      NR[0].set(av.x, av.y, NC.player, NC.squash);
      if (s.world && s.world.entities) {
        const near = [];
        for (const e of s.world.entities) { if (e.dead) continue; const dd = Math.abs(e.x - av.x) + Math.abs(e.y - av.y); if (dd < 9) near.push([dd, e]); }
        near.sort((p, q) => p[0] - q[0]);
        for (let i = 0; i < Math.min(4, near.length); i++) { const e = near[i][1]; NR[i + 1].set(e.x, e.y, Math.max(NC.creature, (e.r || 0.4) * 1.4), NC.squash); }
      }
      if (this.tex && (this.dirty || this.sim.awake)) {
        const N = C.cells, d = this.data, S = this.sim;
        encodeField(S, d);
        this.tex.needsUpdate = true; this.dirty = false; this.stats.uploads++;
      }
      this.stats.active = this.sim.awake ? 1 : 0; this.stats.frames++;
      const now = performance.now() / 1000, fdt = Math.min(0.05, now - (this._lastFx || now)); this._lastFx = now;
      if (this.chips.length || this.drops.length) this.updateFx(fdt, av);
    }
    // ════ Cortar plantas con el arma: rastrojo, recortes que saltan y lo que se recoge ════
    /** Golpe del arma: corta lo que está en el arco de enfrente (el matorral aguanta 3 golpes). */
    slash(x, y, fx, fy) {
      if (!this.plants.length || !this.zoneUV) return 0;
      const cx = x + fx * 0.75, cy = y + fy * 0.75; let n = 0;
      for (const p of this.plants) {
        if (p.cut) continue;
        const r = p.thick ? 1.45 : 1.0;
        const d1 = Math.hypot(p.x - cx, p.y - cy), d0 = Math.hypot(p.x - x, p.y - y);
        if (d1 > r && d0 > 0.55) continue;
        // detrás del personaje no corta
        if (d0 > 0.55 && ((p.x - x) * fx + (p.y - y) * fy) < -0.1) continue;
        if (--p.hp > 0) { this.sim.impulse(p.x, p.y, 1.1, 30, fx, fy); this.burst(p, 7); continue; }
        this.setCut(p, true); this.burst(p, p.thick ? 22 : 9); this.drop(p); n++;
      }
      return n;
    }
    /** Cambia la imagen de la planta a rastrojo (o de vuelta a la planta al rebrotar). */
    setCut(p, cut) {
      const at = this.view && this.view.atlas; if (!at) return;
      const r = at.regions[cut ? p.id + '_c' : p.id]; if (!r) return;
      const W = at.w || 512, H = at.h || 512, uv = this.zoneUV;
      const p0 = (p.flip ? r.x + r.w : r.x) / W, p1 = (p.flip ? r.x : r.x + r.w) / W, g0 = r.y / H, g1 = (r.y + r.h) / H;
      const SEG = p.seg || 5;
      for (let row = 0; row <= SEG; row++) { const v = g0 + (g1 - g0) * row / SEG; uv.setXY(p.base + row * 2, p0, v); uv.setXY(p.base + row * 2 + 1, p1, v); }
      uv.needsUpdate = true;
      p.cut = cut;
      if (cut) { p.regrowAt = performance.now() / 1000 + (p.thick ? this.cfg.regrow.thicket : this.cfg.regrow.grass) * (0.8 + Math.random() * 0.4); this.cuts++; this.stats.cuts = this.cuts; }
      else p.hp = p.thick ? 3 : 1;
      if (p.thick) { const t = this.thickets.find(q => q.x === p.x && q.y === p.y); if (t) t.cut = cut; }
    }
    fxMat(kind) {
      const v = this.view; this._fxm = this._fxm || {};
      if (!this._fxm[kind]) this._fxm[kind] = kind === 'icon'
        ? new THREE.MeshBasicMaterial({ map: v.atlasTex, alphaTest: 0.5, transparent: false })
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(kind) });
      return this._fxm[kind];
    }
    /** Recortes de pasto que saltan al cortar. */
    burst(p, n) {
      const v = this.view, T = this.app.terrain; if (!v || !v.scene || !T) return;
      const z = T.surfaceAt(p.x, p.y); if (z !== z) return;
      this._chipGeo = this._chipGeo || new THREE.PlaneGeometry(2 / 16, 2 / 16);   // trocitos de 2 px
      const cols = ['#6fb14b', '#a3d064', '#4b9440', '#337838'];
      for (let i = 0; i < n && this.chips.length < 120; i++) {
        const m = new THREE.Mesh(this._chipGeo, this.fxMat(cols[i % cols.length])); m.renderOrder = 3;
        const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6;
        m.position.set(p.x, z + 0.15 + Math.random() * (p.thick ? 0.9 : 0.25), p.y);
        v.scene.add(m); this.stats.chipsMade = (this.stats.chipsMade || 0) + 1;
        this.chips.push({ m, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp * 0.6, vy: 2.2 + Math.random() * 2.2, g: z, life: 0.8 + Math.random() * 0.4 });
      }
    }
    /** Lo que suelta la planta: cae al suelo y se recoge al pasar cerca (va a la bolsa). */
    drop(p) {
      const kind = p.id.replace(/\d+$/, ''), table = DROPS[kind]; if (!table) return;
      for (const [mat, chance, count] of table) {
        if (Math.random() > chance) continue;
        for (let k = 0; k < count; k++) this.spawnDrop(p.x, p.y, mat);
      }
    }
    spawnDrop(x, y, mat) {
      const v = this.view, T = this.app.terrain, at = v && v.atlas, r = at && at.regions[MAT_ICON[mat]]; if (!r || !T) return;
      const z = T.surfaceAt(x, y); if (z !== z) return;
      const W = at.w || 512, H = at.h || 512, geo = new THREE.PlaneGeometry(r.w / 16, r.h / 16);
      const uv = geo.attributes.uv, u0 = r.x / W, u1 = (r.x + r.w) / W, v0 = 1 - r.y / H, v1 = 1 - (r.y + r.h) / H;
      // PlaneGeometry: (0,1) arriba-izq, (1,1), (0,0), (1,0); el atlas usa flipY por defecto.
      const flipY = v.atlasTex.flipY !== false;
      const top = flipY ? v0 : r.y / H, bot = flipY ? v1 : (r.y + r.h) / H;
      uv.setXY(0, u0, top); uv.setXY(1, u1, top); uv.setXY(2, u0, bot); uv.setXY(3, u1, bot); uv.needsUpdate = true;
      const m = new THREE.Mesh(geo, this.fxMat('icon')); m.renderOrder = 3;
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 0.9;
      m.position.set(x, z + r.h / 32 + 0.05, y); v.scene.add(m); this.stats.dropsMade = (this.stats.dropsMade || 0) + 1;
      this.drops.push({ m, mat, x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, h: 0.05, vh: 2.2, t: 0, half: r.h / 32, state: 'cae' });
    }
    updateFx(dt, av) {
      const v = this.view;
      for (let i = this.chips.length - 1; i >= 0; i--) {
        const c = this.chips[i]; c.life -= dt; c.vy -= 9 * dt;
        c.m.position.x += c.vx * dt; c.m.position.z += c.vz * dt; c.m.position.y = Math.max(c.g + 0.02, c.m.position.y + c.vy * dt);
        if (c.life <= 0) { v.scene.remove(c.m); this.chips.splice(i, 1); }
      }
      const T = this.app.terrain;
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i]; d.t += dt;
        if (d.state === 'cae') {
          d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.9; d.vy *= 0.9; d.vh -= 9 * dt; d.h += d.vh * dt;
          if (d.h <= 0) { d.h = 0; d.vh = -d.vh * 0.35; if (Math.abs(d.vh) < 0.4) { d.vh = 0; if (d.t > 0.45) d.state = 'suelo'; } }
          const z = T.surfaceAt(d.x, d.y); if (z === z) d.z = z;
        } else if (d.state === 'suelo') {
          d.h = 0.04 + Math.sin(d.t * 4) * 0.03;                       // flota apenas: se nota que se puede recoger
          if (Math.hypot(av.x - d.x, av.y - d.y) < this.cfg.pickup) d.state = 'va';
          if (d.t > 90) { v.scene.remove(d.m); this.drops.splice(i, 1); continue; }
        } else {                                                       // vuela hacia el personaje
          const k = Math.min(1, dt * 12); d.x += (av.x - d.x) * k; d.y += (av.y - d.y) * k; d.z += ((av.z || d.z) - d.z) * k; d.h += (0.6 - d.h) * k;
          if (Math.hypot(av.x - d.x, av.y - d.y) < 0.2) { this.collect(d.mat); v.scene.remove(d.m); this.drops.splice(i, 1); continue; }
        }
        d.m.position.set(d.x, d.z + d.half + d.h, d.y);
      }
    }
    /** Suma a la bolsa (progress.materials) y avisa una sola vez por tanda. */
    collect(mat) {
      const a = this.app; if (a.trial || !a.data || !a.data.progress) return;
      const pr = a.data.progress, m = pr.materials || (pr.materials = {}); m[mat] = Math.min(99, (m[mat] | 0) + 1);
      this.gain[mat] = (this.gain[mat] || 0) + 1; this.stats.collected = (this.stats.collected || 0) + 1;
      try { a.saves && a.saves.markDirty && a.saves.markDirty(); } catch (_) { /* nada */ }
      clearTimeout(this._gainT);
      this._gainT = setTimeout(() => {
        const N = { fibra: 'fibra de pasto', semilla: 'semillas silvestres', cana: 'caña de matorral' };
        const txt = Object.entries(this.gain).map(([k, n]) => '+' + n + ' ' + (N[k] || k)).join(' · ');
        this.gain = {};
        try { a.ui && a.ui.toast && a.ui.toast(txt + ' (en tu bolsa)', 'gold', 2600); if (a.audio) a.audio.play('click'); } catch (_) { /* nada */ }
        try { if (a.gearScreen && a.gearScreen.refresh) a.gearScreen.refresh(); } catch (_) { /* nada */ }
      }, 700);
    }
    setup(v) {
      this.view = v; this.tagged = new WeakSet();
      const gl = this.app.pr && (this.app.pr.renderer || this.app.pr.r) && (this.app.pr.renderer || this.app.pr.r).getContext && (this.app.pr.renderer || this.app.pr.r).getContext();
      let vtf = true; try { vtf = !gl || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0; } catch (_) { vtf = true; }
      this.vtf = vtf;
      this.addSprites(v);
      this.mat = this.patch(v.terrainMat, vtf);
      if (vtf) {
        const N = this.cfg.cells; this.data = new Uint8Array(N * N * 4).fill(128);
        this.tex = new THREE.DataTexture(this.data, N, N, THREE.RGBAFormat);
        this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
        this.mat.uniforms.uVegTex = { value: this.tex };
      }
      this.buildZone(v);
    }
    patch(m, vtf) {
      if (m.__tmVeg) return m;
      const a1 = 'void main() {', a2 = 'vec4 wp = modelMatrix * vec4(position, 1.0);';
      if (m.vertexShader.indexOf(a1) < 0 || m.vertexShader.indexOf(a2) < 0) return null;
      m.__tmVegOrig = m.vertexShader;
      m.vertexShader = (vtf ? '#define TM_VEG_TEX\n' : '') + m.vertexShader.replace(a1, VS_HEAD + '\n      ' + a1).replace(a2, a2 + VS_BODY);
      Object.assign(m.uniforms, { uVegWin: { value: new THREE.Vector4() }, uVegCam: { value: new THREE.Vector4() }, uVegWind: { value: new THREE.Vector4() }, uVegLod: { value: new THREE.Vector2(8, 15) }, uVegNear: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector4()) } });
      m.needsUpdate = true; m.__tmVeg = true;
      // Si en algún celular no compila, vuelve solo al terreno original.
      const self = this, err = console.error;
      console.error = function () {
        try { if (String(arguments[0] || '').indexOf('THREE.WebGLProgram') >= 0 && m.__tmVegOrig) { m.vertexShader = m.__tmVegOrig; delete m.__tmVegOrig; m.needsUpdate = true; self.on = false; } } catch (_) { /* nunca romper la consola */ }
        return err.apply(console, arguments);
      };
      return m;
    }
    /** Regiones de vegetación del atlas → tipo (1 corto, 2 alto, 3 helecho, 4 flor, 5 arbusto). */
    regions(v) {
      if (this._regs) return this._regs;
      const at = v.atlas, W = at.w || 512, H = at.h || 512, out = [];
      for (const [k, r] of Object.entries(at.regions)) {
        const amp = /^tuft/.test(k) ? 0.18 : /^flowers/.test(k) ? 0.1 : /^bush/.test(k) ? 0.05 : 0;
        if (amp) out.push({ type: amp, len: r.h / 16, u0: r.x / W, v0: r.y / H, u1: (r.x + r.w) / W, v1: (r.y + r.h) / H });
      }
      this._regs = out; return out;
    }
    /** Marca cada vértice de planta: peso 1 arriba, 0 en la raíz (la raíz nunca se mueve). */
    tagGeometry(geo, regs, shift) {
      const uv = geo.attributes.uv, pos = geo.attributes.position; if (!uv || !pos) return 0;
      const n = uv.count, out = new Float32Array(n * 4); let plants = 0;
      for (let i = 0; i < n; i++) {
        let u = uv.getX(i), vv = uv.getY(i);
        for (let pass = 0; pass < 2; pass++) {
          const uu = pass ? u - shift : u; if (pass && !shift) break;
          const r = regs.find(q => uu >= q.u0 - 1e-4 && uu <= q.u1 + 1e-4 && vv >= q.v0 - 1e-4 && vv <= q.v1 + 1e-4);
          if (!r) continue;
          const w = 1 - (vv - r.v0) / Math.max(1e-6, r.v1 - r.v0);
          const ph = (Math.sin(pos.getX(i) * 12.9898 + pos.getZ(i) * 78.233) * 43758.5453) % 1;
          out[i * 4] = Math.max(0, Math.min(1, w)); out[i * 4 + 1] = r.type; out[i * 4 + 2] = Math.abs(ph); out[i * 4 + 3] = r.len * Math.cbrt(Math.max(0, Math.min(1, w)));   // en el shader: pow(w, 2/3) · esto = w · largo
          if (w > 0.5) plants++;
          break;
        }
      }
      geo.setAttribute('aVeg', new THREE.BufferAttribute(out, 4));
      return plants;
    }
    tagChunks(v) {
      const ch = v.chunks; if (!ch || !ch.live) return;
      const regs = this.regions(v), shift = (this.mat.uniforms.uShiftB && this.mat.uniforms.uShiftB.value) || 0;
      for (const entry of ch.live.values()) for (const g of entry.geos) {
        if (this.tagged.has(g)) continue;
        this.tagged.add(g);
        this.stats.plants += this.tagGeometry(g, regs, shift);
      }
    }
    /** Pinta pasto alto y helechos en la franja libre del atlas y los registra como regiones. */
    addSprites(v) {
      const at = v.atlas, img = v.atlasTex && v.atlasTex.image; if (!at || !img || !img.getContext) return;
      let maxY = 0; for (const r of Object.values(at.regions)) maxY = Math.max(maxY, r.y + r.h);
      let x = 2, y = maxY + 3; const g = img.getContext('2d');
      for (const [id, w, h] of NEW_SPRITES) {
        if (at.regions[id]) continue;
        if (y + h > img.height) return;
        g.clearRect(x, y, w, h); paintSprite(g, x, y, id);
        at.regions[id] = { x, y, w, h };
        x += w + 2;
      }
      // Rastrojo de cada planta (mismo tamaño: al cortar solo cambia la imagen) e íconos.
      const extra = NEW_SPRITES.map(([id]) => [id + '_c', stubble(ART[id], /Matorral/.test(id) ? 5 : 2)])
        .concat(Object.entries(ITEM_ART));
      for (const [id, rows] of extra) {
        if (at.regions[id]) continue;
        const w = rows[0].length, h = rows.length;
        if (x + w > img.width) { x = 2; y += 32; }
        if (y + h > img.height) break;
        g.clearRect(x, y, w, h); paintSprite(g, x, y, id, rows);
        at.regions[id] = { x, y, w, h };
        x += w + 2;
      }
      v.atlasTex.needsUpdate = true; this._regs = null;
    }
    /**
     * Zona controlada alrededor de la salida del valle: COLONIAS naturales (ruido
     * determinista) con claros, bordes suaves y mezcla de especies; caminos y
     * obstáculos despejados. Cada planta es un cuadro de 5 tramos: la flexión
     * crece hacia la punta (curva), la raíz no se mueve.
     */
    buildZone(v) {
      const a = this.app, T = a.terrain; if (!T || T.id !== 'valle-alba' || !v.scene) return;
      const at = v.atlas, W = at.w || 512, H = at.h || 512, sp = (T.spawns && T.spawns[0]) || { x: T.w / 2, y: T.h / 2 };
      const Z = this.cfg.zone, pts = [], pos = [], uvs = [], cols = [], vegs = [], idx = [];
      const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
      // Ruido de valor suave (colonias de varios tamaños).
      const vn = (x, y, sc) => {
        const X = x / sc, Y = y / sc, xi = Math.floor(X), yi = Math.floor(Y), fx = X - xi, fy = Y - yi, sm = q => q * q * (3 - 2 * q);
        const a00 = hash(xi, yi), a10 = hash(xi + 1, yi), a01 = hash(xi, yi + 1), a11 = hash(xi + 1, yi + 1);
        return (a00 + (a10 - a00) * sm(fx)) + ((a01 + (a11 - a01) * sm(fx)) - (a00 + (a10 - a00) * sm(fx))) * sm(fy);
      };
      const nearDirt = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const cx = Math.floor(x + dx * 0.8), cy = Math.floor(y + dy * 0.8); if (T.inBounds(cx, cy) && T.dirtAt && T.dirtAt(cx, cy)) return true; } return false; };
      const free = (x, y) => !(T.obstacles || []).some(o => Math.abs(o.x - x) < (o.r || 0.3) + 0.6 && Math.abs(o.y - y) < (o.r || 0.3) + 0.6);
      const pick = (list, r) => list[Math.floor(r * list.length) % list.length];
      // Cada planta ocupa un rectángulo en pantalla; ninguna se dibuja encima de otra
      // (antes se encimaban y parecían dos plantas pegadas).
      const placed = [], M = 0.04, plants = [];
      const box = (x, y, r) => ({ x0: x - r.w / 32 - M, x1: x + r.w / 32 + M, y0: y - r.h / 32 - M, y1: y + r.h / 32 + M });
      const fits = b => !placed.some(q => b.x0 < q.x1 && q.x0 < b.x1 && b.y0 < q.y1 && q.y0 < b.y1);
      let n = 0;
      const emit = (x, y, id, thick) => {
        const spr = NEW_SPRITES.find(q => q[0] === id), r = at.regions[id]; if (!spr || !r) return false;
        const z = T.surfaceAt(x, y); if (z !== z) return false;
        const bb = box(x, y, r); if (!fits(bb)) return false;
        const flip = hash(x * 9.1, y) < 0.5, amp = spr[3] * (0.85 + hash(x, y * 3) * 0.3);
        const l = z + 0.01, c = Math.round(x * 16) / 16, hh = l - Math.round((l - y) * 16) / 16, u = r.w / 32, f = r.h / 32;
        const p0 = (flip ? r.x + r.w : r.x) / W, p1 = (flip ? r.x : r.x + r.w) / W, g0 = r.y / H, g1 = (r.y + r.h) / H;
        const ph = hash(x * 2.3, y * 1.9) * 0.999 + 2 + (thick ? 4 : 0);  // +2 = de pie, +4 = matorral (el shader los distingue)
        const base = pos.length / 3; pts.push({ x, y, id }); placed.push(bb);
        plants.push({ id, x, y, base, flip, thick, seg: thick ? 5 : 2, hp: thick ? 3 : 1, cut: false, regrowAt: 0 });
        const SEG = thick ? 5 : 2;                       // matorral: 5 tramos (doblez curvo); pasto corto: 2 bastan
        for (let row = 0; row <= SEG; row++) {           // de la punta (atrás) a la raíz (adelante)
          // De pie, mirando a la cámara (inclinada 45°): mismo tamaño en pantalla que una mata plana,
          // pero con profundidad real: tapa a quien esté detrás y no a quien esté delante.
          const tf = row / SEG, yy = l + (1 - tf) * 2 * f, zr = hh + f, vv = g0 + (g1 - g0) * tf, wgt = Math.pow(1 - tf, 1.5);
          pos.push(c - u, yy, zr, c + u, yy, zr); uvs.push(p0, vv, p1, vv);
          cols.push(1, 0, 0, 1, 0, 0); vegs.push(wgt, amp, ph, 2 * f, wgt, amp, ph, 2 * f);
        }
        for (let row = 0; row < SEG; row++) { const q = base + row * 2; idx.push(q, q + 2, q + 3, q, q + 3, q + 1); }
        n++; return true;
      };
      const colony = (x, y) => vn(x, y, 3.2) * 0.65 + vn(x + 40, y - 17, 1.4) * 0.35;
      // 1) Matorrales altos: pocos, en el corazón de las colonias y separados entre sí.
      //    Son el escondite (refugio de animales y, más adelante, de acechadores).
      const cand = [];
      for (let j = -Z.radius; j <= Z.radius; j += 1.1) for (let i = -Z.radius; i <= Z.radius; i += 1.1) {
        const d = Math.hypot(i, j); if (d < 6 || d > Z.radius - 2) continue;
        const x = sp.x + i + (hash(i, j * 1.3) - 0.5) * 0.6, y = sp.y + j + (hash(j * 1.1, i) - 0.5) * 0.6, col = colony(x, y);
        if (col >= Z.thicketMin) cand.push({ x, y, col });
      }
      cand.sort((p, q) => q.col - p.col);
      const thickets = [];
      for (const t of cand) {
        if (thickets.length >= Z.thickets) break;
        if (thickets.some(o => Math.hypot(o.x - t.x, o.y - t.y) < Z.thicketGap)) continue;
        const id = pick(['vegMatorral0', 'vegMatorral1'], hash(t.x, t.y)), r = at.regions[id]; if (!r) continue;
        const half = r.w / 32 + 0.4;
        if (!free(t.x, t.y) || !free(t.x - half, t.y) || !free(t.x + half, t.y) || nearDirt(t.x - half, t.y) || nearDirt(t.x + half, t.y) || nearDirt(t.x, t.y)) continue;
        if (emit(t.x, t.y, id, true)) thickets.push({ x: t.x, y: t.y, r: r.w / 32, id });
      }
      // 2) Pasto corto (hojas hacia arriba) y algunas flores en colonias con claros.
      for (let j = -Z.radius; j <= Z.radius && n < Z.max; j += Z.spacing) for (let i = -Z.radius; i <= Z.radius && n < Z.max; i += Z.spacing) {
        const x = sp.x + i + (hash(i * 1.3, j) - 0.5) * Z.spacing * 0.9, y = sp.y + j + (hash(j, i * 1.7) - 0.5) * Z.spacing * 0.9;
        const d = Math.hypot(i, j); if (d < 4 || d > Z.radius) continue;
        const edge = 1 - Math.max(0, (d - Z.radius * 0.75) / (Z.radius * 0.25));      // se desvanece hacia afuera
        const dens = (colony(x, y) - 0.4) / 0.3 * edge;
        if (dens <= 0 || hash(x * 3.7, y * 2.9) > dens) continue;                     // claros y bordes suaves
        if (!free(x, y) || nearDirt(x, y)) continue;
        const r2 = hash(y * 5.1, x * 4.3);
        const id = r2 < 0.86 ? pick(['vegCorta0', 'vegCorta1', 'vegCorta2', 'vegCorta3'], hash(x, y)) : pick(['vegFlor0', 'vegFlor1'], hash(x, x));
        emit(x, y, id, false);
      }
      this.thickets = thickets; this.stats.thickets = thickets.length; this.plants = plants;
      if (!n) return;
      const vc = pos.length / 3, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(vc).fill(0).flatMap(() => [0, 1, 0]), 3));
      geo.setAttribute('aMask', new THREE.Float32BufferAttribute(new Array(vc * 2).fill(-1), 2));
      geo.setAttribute('aVeg', new THREE.Float32BufferAttribute(vegs, 4));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, v.terrainMat); mesh.frustumCulled = false; mesh.name = 'vegetacion-zona';
      v.scene.add(mesh); this.zone = mesh; this.zonePts = pts; this.tagged.add(geo); this.stats.zonePlants = n; this.zoneUV = geo.attributes.uv;
    }
  }

  root.__TM_VEG_API__ = API;
  /**
   * Telemetría en pantalla (?tel=1): FPS y tiempo de cuadro medidos dentro del juego, más el
   * estado de la vegetación. Funciona con la vegetación activada (?veg=1&tel=1) y desactivada
   * (?tel=1) para comparar en el mismo celular. No cambia nada del juego.
   */
  class Tel {
    constructor(app) {
      this.app = app; this.ms = []; this.last = 0; this.prev = null; this.t0 = performance.now();
      const el = this.el = document.createElement('div'); el.id = 'tm-veg-tel';
      el.style.cssText = 'position:fixed;left:4px;top:31%;z-index:9999;font:9px/1.3 ui-monospace,monospace;color:#e8ffe0;background:rgba(6,20,12,.6);padding:2px 5px;border-radius:4px;pointer-events:none;white-space:pre';
      document.body.appendChild(el);
      const self = this, tick = (now) => { try { self.frame(now); } catch (_) { /* nunca romper el juego */ } requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      root.__TM_VEG_TEL__ = this;
    }
    frame(now) {
      if (this.last) { const d = now - this.last; if (d > 0 && d < 1000) { this.ms.push(d); if (this.ms.length > 240) this.ms.shift(); } }
      this.last = now;
      if (now - this.t0 < 500) return;
      const dt = (now - this.t0) / 1000; this.t0 = now;
      const v = root.__TM_VEG__, a = this.app, st = v && v.stats;
      const srt = this.ms.slice().sort((p, q) => p - q), avg = srt.reduce((p, q) => p + q, 0) / Math.max(1, srt.length);
      const p95 = srt.length ? srt[Math.floor(srt.length * 0.95)] : 0;
      const cur = st ? { steps: st.steps, up: st.uploads } : null, pv = this.prev; this.prev = cur;
      const data = this.data = {
        vegetacion: v ? (v.on ? 'activada' : 'desactivada (error de shader)') : 'desactivada',
        fps: +(1000 / Math.max(1, avg)).toFixed(1), ms: +avg.toFixed(1), ms_p95: +p95.toFixed(1),
        sim: v ? (v.sim.awake ? 'activa' : 'dormida') : '—',
        pasos_s: v && pv ? Math.round((cur.steps - pv.steps) / dt) : 0,
        subidas_s: v && pv ? Math.round((cur.up - pv.up) / dt) : 0,
        plantas: v ? (st.zonePlants || 0) + ' + ' + st.plants : 0,
        texturas_en_vertices: v ? (v.vtf ? 'sí' : 'no') : '—',
        calidad: a.tier || '—'
      };
      // Compacta (2 líneas) para no tapar el juego; los datos completos quedan en window.__TM_VEG_TEL__.data.
      this.el.textContent = data.fps + ' FPS · ' + data.ms + ' ms (p95 ' + data.ms_p95 + ') · ' + data.calidad +
        '\n' + (v ? 'hierba ' + data.sim + ' · ' + data.pasos_s + ' pasos/s · ' + data.subidas_s + ' subidas/s' : 'sin vegetación');
    }
  }

  root.__TM_VEG_INSTALL__ = function (app) {
    const q = new URLSearchParams(root.location ? root.location.search : '');
    try {
      if (q.get('veg') === '1') {
        const cfg = Object.assign({}, DEF, root.__TM_VEG_CONFIG__ || {});
        new Veg(app, cfg);
      }
    } catch (e) { console.error('Vegetación beta:', e); }
    try { if (q.get('tel') === '1') new Tel(app); } catch (e) { console.error('Telemetría beta:', e); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
