/* Torre Multiversal · Vangelium Dynamic Vegetation v2.0 «Flora» (beta) · 16-11-2026
 *
 * Vegetación pixel art que se mueve y reacciona sin un sensor por planta:
 *  - Simulación por CELDAS (rejilla 48×48 de 0,5 u que sigue al jugador). Solo
 *    las celdas tocadas por algo reciben impulso; el resto lo recibe de sus
 *    vecinas con pérdida de energía y retraso (resorte + amortiguación +
 *    acoplamiento). Cuando la energía cae bajo un umbral, la simulación duerme.
 *  - El resultado se sube como una textura pequeña y el SHADER DEL TERRENO
 *    inclina solo la parte alta de cada planta (la raíz queda fija).
 *
 * v2.0 «Flora» (pedido del director, 16-11-2026):
 *  - La vegetación cubre TODO el mundo (Valle del Alba y cada piso de la
 *    Torre), por trozos de 16 × 16 que se crean y se quitan alrededor del
 *    jugador. El reparto es determinista: cada planta está siempre en el mismo
 *    sitio, aunque te vayas y vuelvas.
 *  - Cada bioma tiene sus propias plantas (6 biomas, 30 especies). Cada flor
 *    de otro color es otra especie, con nombre propio y su propia semilla,
 *    pensada para plantarla en la granja más adelante.
 *  - Las flores y matas fijas del mapa se reemplazan por estas plantas vivas:
 *    todo lo que parece planta se puede cortar.
 * Activación: /beta/?veg=1. Configuración: window.__TM_VEG_CONFIG__.
 */
(function (root) {
  'use strict';
  const DEF = Object.freeze({
    cells: 48, cell: 0.5, hz: 30,
    spring: 22, damping: 3.6, couple: 400, maxDisp: 1, sleep: 2e-5,
    player: { radius: 1.3, force: 20 }, creature: { force: 16 }, attack: { radius: 1.8, force: 30 },
    wind: { strength: 0.1, gust: 1 }, lod: { near: 8, far: 15 },
    // Reparto por el mundo: trozos de 16 u, rejilla de 0,42 u para matas y flores,
    // rejilla de 3 u para los matorrales; radio de trozos vivos alrededor del jugador.
    world: { chunk: 16, spacing: 0.42, thicketCell: 3, thicketGap: 3.2, radius: 24, keep: 40, budgetMs: 5, density: 1 },
    near: { player: 0.7, creature: 0.55, squash: 0.55 },
    regrow: { grass: 150, thicket: 300 }, pickup: 1.3,
    replaceMapPlants: true
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

  // ════════════════════════════════════════════════════════════════════
  // 2. Flora: biomas, plantillas de pixel art y catálogo de especies (puro)
  // ════════════════════════════════════════════════════════════════════
  // Paleta del Valle = la misma de los arbustos y árboles del juego.
  const PAL = { O: '#0c241a', D: '#19472a', d: '#235e31', k: '#337838', m: '#4b9440', l: '#6fb14b', h: '#a3d064', s: '#d2ec8c' };
  const FOLIAGE = ['O', 'D', 'd', 'k', 'm', 'l', 'h', 's'];   // de oscuro a claro
  const PETALS = ['a', 'b', 'c', 'y'];                          // pétalo claro, medio, oscuro y centro
  const ramp8 = arr => Object.fromEntries(FOLIAGE.map((k, i) => [k, arr[i]]));
  const ramp9 = arr => Object.fromEntries(FOLIAGE.map((k, i) => [k, arr[i === 7 ? 8 : i]]));
  // Colores tomados de los biomas del motor (pasto = suelo, hoja = árboles y arbustos).
  const BIOMES = Object.freeze({
    // En el valle el pasto lleva puntas algo más claras y base más oscura que el suelo: se lee como planta.
    pradera: { name: 'Pradera del Alba', grass: ramp8(['#0c241a', '#163f25', '#1f5a2e', '#2f7535', '#4b9440', '#7cc052', '#b4dc6e', '#e0f4a0']), leaf: PAL, veg: { flowers: 1, tufts: 1, bushes: 1 } },
    ambar: { name: 'Bosque de Ámbar',
      grass: ramp8(['#262410', '#3b3416', '#54451c', '#6f5822', '#8c6c29', '#aa8334', '#c9a14b', '#e3c272']),
      leaf: ramp9(['#260d0a', '#41140d', '#651e10', '#8a2b13', '#ad4018', '#cb6020', '#e28733', '#f2ae4f', '#fad682']),
      veg: { flowers: 0.8, tufts: 1, bushes: 1.3 } },
    tundra: { name: 'Tundra Helada',
      grass: ramp8(['#3a475b', '#526277', '#6e8096', '#8d9fb5', '#acbdd0', '#c9d7e6', '#e2ecf5', '#f8fbff']),
      leaf: ramp9(['#13232a', '#1d333d', '#294853', '#385f6b', '#4f7a86', '#6c97a2', '#93b8c1', '#c0d9df', '#e8f5f7']),
      veg: { flowers: 0.45, tufts: 0.6, bushes: 0.5 } },
    dunas: { name: 'Dunas de Ceniza',
      grass: ramp8(['#46311a', '#614423', '#7c582d', '#986e39', '#b38747', '#cba15b', '#e0bd7c', '#f1d9a6']),
      leaf: ramp9(['#191a0d', '#292a14', '#3c3b1a', '#514f20', '#686529', '#817e34', '#9b9845', '#b7b45f', '#d4d282']),
      veg: { flowers: 0.3, tufts: 0.5, bushes: 0.7 } },
    cienaga: { name: 'Ciénaga Sombría',
      grass: ramp8(['#0e1b13', '#15281a', '#1d3721', '#284727', '#34582e', '#466b36', '#5d8140', '#7a9852']),
      leaf: ramp9(['#081513', '#0c201c', '#122f26', '#193f30', '#23503a', '#316446', '#437955', '#5b9169', '#7cac84']),
      veg: { flowers: 0.7, tufts: 1.5, bushes: 1.6 } },
    cristal: { name: 'Bosque de Cristal',
      grass: ramp8(['#141533', '#1d2048', '#282d60', '#343d79', '#435193', '#576aaa', '#788cc3', '#a6b6dc']),
      leaf: ramp9(['#1b0a29', '#2c1041', '#42185c', '#5b2279', '#793096', '#9945b2', '#ba65cb', '#d892df', '#f1c5f1']),
      veg: { flowers: 1.2, tufts: 0.8, bushes: 0.9 } }
  });

  // Plantillas (una letra = un píxel; '.' = transparente). Follaje O D d k m l h s,
  // pétalos a b c y. Cada especie pone sus propios colores.
  const TPL = {
    // Pasto corto (cuatro matas distintas).
    G0: ['.....h.....', '.....l.....', '...h.m.h...', '...l.m.l...', 'h..m.mlm..h', 'l..mlkmm..l', '.mlkmkdk.m.', '.kmkdddk.k.', '.dDdDdDd.d.', '.DDDDDDD.D.'],
    G1: ['...h.....', '...l.....', '...m.h...', 'h..m.l...', 'l..mlm..h', '.mlkmm..l', '.kmkdk.m.', '.dDdDd.k.', '.DDDDD.D.'],
    G2: ['.....h......', '.....l.h....', '...h.m.l....', '...l.mlm...h', 'h..m.mmml..l', 'l..mlkdkm.m.', '.m.kmkdkd.k.', '.k.dDdDdD.d.', '.D.DDDDDD.D.'],
    G3: ['...h....', '...l....', '...m..h.', 'h..ml.l.', 'l..kmmh.', '.mlkdkl.', '.kddDdk.', '.DDDDDD.'],
    // Hierba alta (hojas largas que se arquean).
    H0: ['....h....', '....l..h.', '.h..m..l.', '.l..m.lm.', '.m.lk.m..', '..mkk.m..', 'h.mkkmk..', 'l.kmdmk.h', '.lkmdkk.l', '.mkddkkml', '..kdDdkm.', '.kdDdDdk.', '.dDdDdDd.', '..DdDdD..', '.DDDDDDD.'],
    H1: ['h..........', 'l.....h....', 'm.h...l...h', '.ml...m..l.', '.km..hm..m.', '..k..lk.mk.', '..km.mk.k..', 'h.kkmkdkk..', 'l..kdkdk..h', '.mkddkdkm.l', '.kdDdDdDkm.', '.dDdDdDdDd.', '.DDDDDDDDD.'],
    // Juncos de la ciénaga (con y sin espiga).
    R0: ['..a......', '.ab...a..', '.bc..ab..', '.bc..bc..', '..k..bc..', '..k...k..', '.hk...k.h', '.lk..hk.l', 'lmk..lkml', '.mkh.mk.m', '.kkl.kkk.', '.DDDDDDD.'],
    R1: ['...h...', '...l.h.', '.h.m.l.', '.l.m.m.', '.m.k.m.', 'hm.k.k.', 'lk.k.kh', '.k.kmkl', '.kdkdk.', '.DDDDD.'],
    // Flores: ramillete, dos cabezas, campanillas, espiga, estrella y copa.
    F0: ['........a.', '..a....ayb', '.ayb.a.kb.', '..b.aybk..', '..k..b.k..', '..k..k.k..', '..kh.khk..', 'h.kl.klk.h', '.kkk.kkkk.', '.DDD.DDDD.'],
    F1: ['......a..', '..a..ayb.', '.ayb..b..', '..b...k..', '..k...k..', '..k.h.k..', 'h.k.l.k.h', '.kk.k.kk.', '.DD.D.DD.'],
    F2: ['....kkk....', '...k.k.k...', '..k..k..k..', '.ab..k..ab.', 'abbc.k.abbc', 'b..c.k.b..c', '....hk.....', 'h...lk...h.', 'l..kmkk..l.', '.kkkkmkkkk.', '.DDDDDDDDD.'],
    F3: ['...a...', '..aba..', '..bab..', '.abcba.', '..bab..', '.abcba.', '..bcb..', '...k...', 'h..k..h', 'l.kmk.l', '.kmkmk.', '.DDDDD.'],
    F4: ['....a....', '...aba...', 'aabbybbaa', '.abbyybb.', '..bc.cb..', '.bc...cb.', '....k....', 'h...k..h.', 'l..kmk.l.', '.kkmkmkk.', '.DDDDDDD.'],
    F5: ['.a.a.a.', '.ababa.', '.babab.', '.bbbbc.', '..bcc..', 'h..k..h', 'l..k.hl', '.l.kml.', '.mlkmk.', '.DDDDD.'],
    // Matorrales altos (escondite).
    T0: ['..........O...................', '.........OlO.....O............', '.........Om..O.O.lO.O.........', '.........Ok..l.l.m..lO........', '........Olk..m.m.k..mO........', '........Omk..k.k.k..kOO.......', '........OkkO.k.k.k..k.lO......', '.......OOkkl.k.kOk..k.mO......', '......Ol.kkm.kOklk..k.kO......', '......Om.ldk.khkmd..k.kO......', '......Ok.mdkOdldkd.Od.klO.....', '....O.Ok.kdkhdmdkh.ll.kmO.O...', '...Ol..k.kdkldmdkl.mm.hk..lO..', '...Om..l.h.dmdmdkm.kk.lk..mO..', '..ODkOOmOl.dmdmddmOdkOmkOOkO..', '.OldDlhDhmDdmdmddmddhdmdlDDO..', '.OdDDdlDlmDdmdmddmDdldmhDDdO..', '.ODDdDmdmmddmddkdmDdmdmlDddO..', '.ODddDmdmmdDkddkdkddmdkmhDdlO.', 'ODdhDdmdmkdDkDdkdkdDmkdmlddhO.', 'lldlddkdkDkDkDdkdkdDkkdmmdDlO.', 'dDDmddkDkDkDkDdkDkdkdkdkmdDmO.', 'DDdmddkDkDkDkDDkDkDkDkkDkddmDO', 'ddDdkDkDkDkDkDDkDkDkDkkDkDkddl', 'OdhDkDkDkDkDdDDdDdDkDdkDkDkdDD', 'OdlDkDdDdDdDdDDdDdDdDdkDkDkDDd', 'ODkDkDdDdDdDdDDdDdDdDddDdDkDdO', 'ODkDdDdDdDdDdDDdDdDdDddDdDdDDO', 'ODdDdDdDdDdDdDDdDdDdDddDdDdDDO', '.DDDDDDDDDDDDDDDDDDDDDDDDDDDD.'],
    T1: ['.........O...............', '........OlO..............', '........OmOO.O...........', '........Ok.l.lOO.........', '.......OOk.m.m.lO........', '.....OOl.k.k.k.mO........', '....Ol.m.kOkOk.kOO.......', '....Om.k.klklk.k.lO......', '...OOk.l.dhkmk.k.mOO.....', '..Ol.kOm.dldkd.kOk.lO....', '..Om.khk.dmdkd.dlk.mO....', '..OkOllk.dmdkd.dmk.kO....', '..OkhmmkOhmdhdOdkdOkO....', '.ODDldmddlmdldddDdDDO....', 'OlDdmDmdDmkdmdDdhdDhDOO..', 'ODhdmdmddmdkmdDdlhdlldlO.', 'ODldmdkddmdkmdddmlDmdhDO.', 'OdmdkdkddkdkkDdDmmDmDldO.', 'OdmddkkDdkDkkDdDkmdkdmdO.', 'OdkDdkkDDkDkkDdkkDkDdmDDO', 'OdkDDkkDDkDdkDDkkDkDdkdll', 'ODkDDkdDDkDdkDDkkDkDdkDDd', 'ODkDDddDDdDddDDdkDdDDkdhO', 'ODdDDddDDdDddDDddDdDDddlO', 'ODdDDddDDdDddDDddDdDDdkDO', '.DDDDDDDDDDDDDDDDDDDDDDD.'],
    // Cactus de las dunas (con flor arriba).
    TC: ['......OaO......', '.....OabaO.....', '.....OhlmO.....', '.....OhlmO.....', '.....OhlmO..O..', '..O..OhlmO.OlO.', '.OlO.OhlmO.OlO.', '.OhO.OhlmO.OmO.', '.OhO.OhlmO.OmO.', '.OmO.OhlmO.OkO.', '.OlhhhhlmkkkkO.', '..OOOkhlmkOOO..', '.....OhlmO.....', '.....OhlmO.....', '.....OhlmO.....', '.....OhlmO.....', '....OkhlmkO....', '...DDDdddDDD...']
  };
  // Plantillas hechas por reglas (deterministas): cañaveral y arbusto de cristal.
  function rnd(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return (s >>> 8) / 16777216; }; }
  function grid(w, h) { return Array.from({ length: h }, () => Array(w).fill('.')); }
  function genReeds(w, h, seed) {
    const g = grid(w, h), r = rnd(seed), set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h - 1) g[y][x] = c; };
    const n = Math.round(w / 2.1);
    for (let s = 0; s < n; s++) {
      const x0 = Math.round(1 + (s + r() * 0.8) * (w - 2) / n), H = Math.round(h * (0.5 + r() * 0.45)), lean = r() < 0.5 ? -1 : 1, top = h - 1 - H;
      for (let y = h - 2; y >= top; y--) {
        const t = (h - 2 - y) / H, x = x0 + (t > 0.7 ? lean : 0);
        set(x, y, t > 0.85 ? 'h' : t > 0.6 ? 'l' : t > 0.3 ? 'm' : t > 0.12 ? 'k' : 'd');
        if (t < 0.25 && r() < 0.5) set(x + 1, y, 'D');
      }
      if (r() < 0.55) { const x = x0 + lean; for (let k = 0; k < 4; k++) set(x, top + 1 + k, k === 0 ? 'a' : k < 3 ? 'b' : 'c'); set(x + 1, top + 2, 'c'); }
      if (r() < 0.6) { const dir = r() < 0.5 ? -1 : 1; for (let k = 1; k <= 4; k++) set(x0 + dir * k, h - 3 - k, k > 2 ? 'l' : 'm'); }
    }
    g[h - 1] = g[h - 1].map((_, x) => (x > 0 && x < w - 1) ? 'D' : '.');
    return g.map(row => row.join(''));
  }
  function genCrystal(w, h, seed) {
    const g = grid(w, h), r = rnd(seed), set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h - 1) g[y][x] = c; };
    const shards = [];
    const n = 6;
    for (let s = 0; s < n; s++) {
      const mid = Math.abs(s - (n - 1) / 2) < 1;
      shards.push({ cx: w * (0.14 + s * 0.72 / (n - 1)) + (r() - 0.5) * 1.2, H: Math.round(h * (mid ? 0.8 + r() * 0.18 : 0.32 + r() * 0.36)), W: 2.2 + r() * 1.6, lean: (s - (n - 1) / 2) * 0.09 });
    }
    // Los altos al fondo y los bajos delante; cada fragmento termina en punta y se inclina hacia afuera.
    for (const { cx, H, W, lean } of shards.sort((p, q) => q.H - p.H)) {
      const top = h - 1 - H;
      for (let y = top; y < h - 1; y++) {
        const t = y - top, half = Math.min(W / 2, 0.35 + t * 0.42), c0 = cx + lean * (h - 1 - y) * 0.6;
        const xa = Math.round(c0 - half), xb = Math.round(c0 + half);
        for (let x = xa; x <= xb; x++) {
          const u = xb > xa ? (x - xa) / (xb - xa) : 0.5;
          set(x, y, x === xb && xb > xa ? 'c' : t < 2 || u < 0.34 ? 'a' : 'b');
        }
      }
    }
    for (let x = 1; x < w - 1; x++) { if (r() < 0.7) set(x, h - 2, r() < 0.5 ? 'k' : 'm'); if (r() < 0.25) set(x, h - 3, 'l'); }
    g[h - 1] = g[h - 1].map((_, x) => (x > 0 && x < w - 1) ? 'D' : '.');
    return g.map(row => row.join(''));
  }
  TPL.TR0 = genReeds(20, 24, 7); TPL.TR1 = genReeds(16, 21, 31);
  TPL.TX0 = genCrystal(19, 21, 11); TPL.TX1 = genCrystal(15, 17, 23);
  Object.freeze(TPL);

  // Tipo de cada plantilla: flexión (u), golpes que aguanta y filas que quedan al cortar.
  const SHAPE = { G: { amp: 0.26, hp: 1, keep: 2 }, H: { amp: 0.5, hp: 1, keep: 3 }, R: { amp: 0.32, hp: 1, keep: 3 }, F: { amp: 0.2, hp: 1, keep: 2 },
    T: { amp: 0.3, hp: 3, keep: 5 }, TC: { amp: 0.06, hp: 4, keep: 4 }, TR: { amp: 0.34, hp: 3, keep: 4 }, TX: { amp: 0.08, hp: 4, keep: 4 } };
  const shapeOf = t => SHAPE[t.replace(/\d+$/, '')] || SHAPE[t[0]];

  // Catálogo. kind: pasto · flor · matorral. Las semillas usan colores propios.
  const P = (a, b, c, y) => ({ a, b, c, y: y || '#f2d45e' });
  const FLORA = Object.freeze([
    // Pradera del Alba (Valle del Alba y pisos de pradera)
    { id: 'pasto-alba', name: 'Pasto del alba', biome: 'pradera', kind: 'pasto', art: ['G0', 'G1', 'G2', 'G3'], ramp: 'grass', seed: ['#c9a14b', '#f1dc9a', '#a07a34', '#6b4f22'] },
    { id: 'hierba-alta', name: 'Hierba alta del valle', biome: 'pradera', kind: 'pasto', art: ['H0', 'H1'], ramp: 'grass', seed: ['#8a7a3a', '#e8dc9a', '#b8a860', '#4a3e18'] },
    { id: 'margarita-alba', name: 'Margarita del alba', biome: 'pradera', kind: 'flor', art: ['F0'], petals: P('#f4f0e0', '#c9c2ad', '#8e8670', '#e9c25e'), seed: ['#8a6a3a', '#e9d6a0', '#b8925a', '#4e3a1c'] },
    { id: 'clavelina', name: 'Clavelina rosa', biome: 'pradera', kind: 'flor', art: ['F1'], petals: P('#f5aacb', '#c8628f', '#7c2f58', '#f6dc7a'), seed: ['#7a3a52', '#f0b6cc', '#b06080', '#4a1a30'] },
    { id: 'boton-oro', name: 'Botón de oro', biome: 'pradera', kind: 'flor', art: ['F4'], petals: P('#ffe27a', '#e8b232', '#9a6a12', '#d9661e'), seed: ['#9a6a12', '#ffe9a0', '#d0a040', '#5a3a0a'] },
    { id: 'campanilla-azul', name: 'Campanilla azul', biome: 'pradera', kind: 'flor', art: ['F2'], petals: P('#b4d0ff', '#5c86e0', '#2c4a9a'), seed: ['#3a4a7a', '#b8c8f0', '#6a80c0', '#1e2a4a'] },
    { id: 'zarzal', name: 'Zarzal del valle', biome: 'pradera', kind: 'matorral', art: ['T0', 'T1'], ramp: 'leaf', seed: ['#4a3020', '#c09070', '#7a5038', '#2a1a10'] },
    // Bosque de Ámbar
    { id: 'hierba-dorada', name: 'Hierba dorada', biome: 'ambar', kind: 'pasto', art: ['G0', 'G1', 'G2', 'H1', 'H0'], ramp: 'grass', seed: ['#aa8334', '#f2dc90', '#d0a84a', '#5a4010'] },
    { id: 'farolillo', name: 'Farolillo de ámbar', biome: 'ambar', kind: 'flor', art: ['F2'], petals: P('#ffd27a', '#f0902a', '#a04a12'), seed: ['#a04a12', '#ffd090', '#e07a2a', '#5a2408'] },
    { id: 'cardo-bermejo', name: 'Cardo bermejo', biome: 'ambar', kind: 'flor', art: ['F3'], petals: P('#f08ab0', '#c0446e', '#6e1a38'), seed: ['#6e1a38', '#f0a0c0', '#b04a70', '#3a0a1c'] },
    { id: 'estrella-miel', name: 'Estrella de miel', biome: 'ambar', kind: 'flor', art: ['F4'], petals: P('#fff4d6', '#e8cf96', '#a8864a', '#e7942a'), seed: ['#a8864a', '#fff0c8', '#d8b878', '#5a4420'] },
    { id: 'zarza-ambar', name: 'Zarza de ámbar', biome: 'ambar', kind: 'matorral', art: ['T0', 'T1'], ramp: 'leaf', seed: ['#651e10', '#f2ae4f', '#cb6020', '#2a0a06'] },
    // Tundra Helada
    { id: 'pasto-escarcha', name: 'Pasto de escarcha', biome: 'tundra', kind: 'pasto', art: ['G0', 'G1', 'G2', 'G3', 'H1'], ramp: 'leaf', seed: ['#526277', '#e2ecf5', '#8d9fb5', '#2a3444'] },
    { id: 'campanita-hielo', name: 'Campanita de hielo', biome: 'tundra', kind: 'flor', art: ['F2'], petals: P('#e2f2ff', '#8fbcef', '#4a6ea8'), seed: ['#4a6ea8', '#e2f2ff', '#8fbcef', '#24385a'] },
    { id: 'estrella-nieve', name: 'Estrella de nieve', biome: 'tundra', kind: 'flor', art: ['F4'], petals: P('#ffffff', '#d6e2f0', '#8a97ad', '#f2d45e'), seed: ['#8a97ad', '#ffffff', '#d6e2f0', '#4a5468'] },
    { id: 'lirio-escarcha', name: 'Lirio de escarcha', biome: 'tundra', kind: 'flor', art: ['F5'], petals: P('#ece6ff', '#a99ae6', '#5e4ea0'), seed: ['#5e4ea0', '#ece6ff', '#a99ae6', '#2e2458'] },
    { id: 'enebro-nevado', name: 'Enebro nevado', biome: 'tundra', kind: 'matorral', art: ['T1', 'T0'], ramp: 'leaf', seed: ['#294853', '#c0d9df', '#6c97a2', '#13232a'] },
    // Dunas de Ceniza
    { id: 'hierba-ceniza', name: 'Hierba de ceniza', biome: 'dunas', kind: 'pasto', art: ['G1', 'G3', 'H0', 'G2'], ramp: 'leaf', seed: ['#7c582d', '#f1d9a6', '#b38747', '#3a2410'] },
    { id: 'flor-brasa', name: 'Flor de brasa', biome: 'dunas', kind: 'flor', art: ['F5'], petals: P('#ffb070', '#e05a2a', '#8a2a14'), seed: ['#8a2a14', '#ffc090', '#e05a2a', '#40100a'] },
    { id: 'cardo-arena', name: 'Cardo de arena', biome: 'dunas', kind: 'flor', art: ['F3'], petals: P('#e6b0f0', '#a46ab8', '#5e3270'), seed: ['#5e3270', '#e6c0f0', '#a46ab8', '#2e1438'] },
    { id: 'cactus-ceniza', name: 'Cactus de ceniza', biome: 'dunas', kind: 'matorral', art: ['TC'], ramp: 'leaf', petals: P('#ff9ab8', '#e0507a', '#8a2244'), seed: ['#514f20', '#d4d282', '#9b9845', '#292a14'] },
    // Ciénaga Sombría
    { id: 'junco-negro', name: 'Junco negro', biome: 'cienaga', kind: 'pasto', art: ['R0', 'R1', 'G2', 'R0'], ramp: 'leaf', petals: P('#b0784a', '#7a4a26', '#4a2a14'), seed: ['#4a2a14', '#c09060', '#7a4a26', '#20100a'] },
    { id: 'lirio-pantano', name: 'Lirio de pantano', biome: 'cienaga', kind: 'flor', art: ['F5'], petals: P('#e0a8f4', '#9145b0', '#4f2266'), seed: ['#4f2266', '#e0b8f4', '#9145b0', '#26102e'] },
    { id: 'ojo-sapo', name: 'Ojo de sapo', biome: 'cienaga', kind: 'flor', art: ['F4'], petals: P('#f0f08a', '#b9c23a', '#5f6a1a', '#ff8a2a'), seed: ['#5f6a1a', '#f0f0a0', '#b9c23a', '#2c3008'] },
    { id: 'flor-fantasma', name: 'Flor fantasma', biome: 'cienaga', kind: 'flor', art: ['F2'], petals: P('#f6f4ff', '#c9c3e6', '#6f6a8a'), seed: ['#6f6a8a', '#f6f4ff', '#c9c3e6', '#34304a'] },
    { id: 'canaveral', name: 'Cañaveral', biome: 'cienaga', kind: 'matorral', art: ['TR0', 'TR1'], ramp: 'leaf', petals: P('#b0784a', '#7a4a26', '#4a2a14'), seed: ['#4a2a14', '#c09060', '#7a4a26', '#20100a'] },
    // Bosque de Cristal
    { id: 'hierba-prisma', name: 'Hierba prisma', biome: 'cristal', kind: 'pasto', art: ['G0', 'G1', 'G2', 'H0', 'H1'], ramp: 'grass', seed: ['#435193', '#c8d8ff', '#788cc3', '#1d2048'] },
    { id: 'rosa-cuarzo', name: 'Rosa de cuarzo', biome: 'cristal', kind: 'flor', art: ['F5'], petals: P('#ffd0f6', '#e080e8', '#8a3a9a'), seed: ['#8a3a9a', '#ffd0f6', '#e080e8', '#44184c'] },
    { id: 'campana-celeste', name: 'Campana celeste', biome: 'cristal', kind: 'flor', art: ['F2'], petals: P('#c8f8ff', '#4fd0e6', '#2a7f9a'), seed: ['#2a7f9a', '#c8f8ff', '#4fd0e6', '#123c4a'] },
    { id: 'lagrima-amatista', name: 'Lágrima de amatista', biome: 'cristal', kind: 'flor', art: ['F3'], petals: P('#ecc8ff', '#a46ae0', '#5a2a9a'), seed: ['#5a2a9a', '#ecc8ff', '#a46ae0', '#2a1050'] },
    { id: 'arbusto-cristal', name: 'Arbusto de cristal', biome: 'cristal', kind: 'matorral', art: ['TX0', 'TX1'], ramp: 'leaf', petals: P('#d8fbff', '#7fd8f0', '#3a7fb0'), seed: ['#3a7fb0', '#d8fbff', '#7fd8f0', '#1a3a5a'] }
  ].map(sp => Object.freeze({ ...sp, seedKey: 'sem-' + sp.id, seedName: 'Semillas de ' + sp.name.charAt(0).toLowerCase() + sp.name.slice(1) })));
  const SPECIES = Object.freeze(Object.fromEntries(FLORA.map(sp => [sp.id, sp])));
  const BY_BIOME = Object.freeze(Object.fromEntries(Object.keys(BIOMES).map(b => [b, Object.freeze({
    pasto: FLORA.filter(s => s.biome === b && s.kind === 'pasto'),
    flor: FLORA.filter(s => s.biome === b && s.kind === 'flor'),
    matorral: FLORA.filter(s => s.biome === b && s.kind === 'matorral')
  })])));

  /** Colores de cada letra para una especie (follaje del bioma + pétalos propios). */
  function colorsOf(sp) {
    const B = BIOMES[sp.biome], ramp = sp.ramp === 'leaf' ? B.leaf : B.grass;
    const flowerFoliage = B.leaf;                    // tallos y hojas de las flores: los del bioma
    const base = sp.kind === 'flor' ? flowerFoliage : ramp;
    return Object.assign({}, base, sp.petals || {});
  }
  const spriteId = (sp, k) => 'fl_' + sp.id + '_' + k;
  const seedIcon = sp => 'sem_' + sp.id;
  /** Rastrojo: las filas de abajo de la planta, con el corte más claro arriba. */
  function stubble(rows, keep) {
    const out = rows.slice(rows.length - keep);
    out[0] = [...out[0]].map(c => c === '.' ? '.' : (c === 'O' || c === 'D' ? 'm' : 'l')).join('');
    return out;
  }
  /** Todas las imágenes que hay que pintar: [id, filas, colores]. */
  function spriteList() {
    const out = [];
    for (const sp of FLORA) {
      const col = colorsOf(sp);
      sp.art.forEach((t, k) => {
        if (sp.art.indexOf(t) !== k) return;               // la misma plantilla repetida = más frecuente, no otra imagen
        const rows = TPL[t], sh = shapeOf(t);
        out.push([spriteId(sp, k), rows, col], [spriteId(sp, k) + '_c', stubble(rows, sh.keep), col]);
      });
      const [y, w, g, q] = sp.seed;
      out.push([seedIcon(sp), ITEM_ART.itemSemilla, { y, w, g, q }]);
    }
    for (const id of ['itemFibra', 'itemCana', 'itemSemilla']) out.push([id, ITEM_ART[id], ITEM_COL]);
    return out;
  }
  // Lo que se recoge (va a la bolsa; servirá para craftear y para la granja).
  const ITEM_ART = {
    itemFibra: ['..l.h..', '.lkmlh.', 'lkmlmkl', '.dkmkd.', 'lkmlmkl', '.lkmlh.', '..d.d..'],
    itemSemilla: ['..yy..', '.ywgy.', 'ygwwgy', 'yggggy', '.ygqy.', '..yy..'],
    itemCana: ['......hl', '.....lmk', '....lmkd', '...lmkd.', '..lmkd..', '.lmkd...', 'lmkd....', 'kdd.....']
  };
  const ITEM_COL = Object.assign({}, PAL, { y: '#e9c25e', w: '#eeeadb', g: '#b9b3a2', q: '#b45f8c' });
  const MAT_NAMES = { fibra: 'fibra de pasto', cana: 'caña', semilla: 'semillas silvestres' };
  for (const sp of FLORA) MAT_NAMES[sp.seedKey] = sp.seedName.toLowerCase();
  const MAT_ICON = { fibra: 'itemFibra', semilla: 'itemSemilla', cana: 'itemCana' };
  for (const sp of FLORA) MAT_ICON[sp.seedKey] = seedIcon(sp);
  /** Lo que suelta cada especie: [material, probabilidad, cantidad]. */
  function dropsOf(sp, tpl) {
    const S = sp.seedKey, t = (tpl || sp.art[0]).replace(/\d+$/, '');
    if (sp.kind === 'flor') return [[S, 0.7, 1], ['fibra', 0.3, 1]];
    if (sp.kind === 'pasto') return t === 'R' ? [['fibra', 0.6, 1], ['cana', 0.25, 1], [S, 0.15, 1]] : [['fibra', 0.55, 1], [S, 0.15, 1]];
    if (t === 'TC') return [['fibra', 1, 1], [S, 0.5, 1]];
    if (t === 'TX') return [['fibra', 0.5, 1], [S, 0.5, 1]];
    if (t === 'TR') return [['cana', 1, 3], ['fibra', 1, 1], [S, 0.4, 1]];
    return [['cana', 1, 2], ['fibra', 1, 2], [S, 0.4, 1]];
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. Reparto por el mundo (puro y determinista; probado con un mapa falso)
  // ════════════════════════════════════════════════════════════════════
  function hashStr(s) { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
  const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  class Field {
    /**
     * T: terreno del motor (w, h, kind, level, biome, biomes, dirtAt, obstacleCells, obstacles, inBounds).
     * exclude: círculos sin plantas (campamento, portales, santuario…).
     */
    constructor(T, opt = {}) {
      const W = Object.assign({}, DEF.world, opt);
      this.T = T; this.S = W.spacing; this.TS = W.thicketCell; this.gap = W.thicketGap; this.CS = W.chunk; this.dens = W.density;
      this.k = (hashStr(T.id || 'mundo') % 997) * 0.731 + 0.37;
      this.exclude = opt.exclude || []; this.c = new Map(); this.tc = new Map(); this.ta = new Map();
    }
    h(x, y, k = 0) { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7 + this.k * 13.13) * 43758.5453; return s - Math.floor(s); }
    vn(x, y, sc, k = 0) {
      const X = x / sc, Y = y / sc, xi = Math.floor(X), yi = Math.floor(Y), fx = X - xi, fy = Y - yi, sm = q => q * q * (3 - 2 * q);
      const a = this.h(xi, yi, k), b = this.h(xi + 1, yi, k), c = this.h(xi, yi + 1, k), d = this.h(xi + 1, yi + 1, k);
      const top = a + (b - a) * sm(fx), bot = c + (d - c) * sm(fx);
      return top + (bot - top) * sm(fy);
    }
    colony(x, y) { return this.vn(x, y, 3.2, 1) * 0.65 + this.vn(x + 40, y - 17, 1.4, 2) * 0.35; }
    biome(x, y) {
      const T = this.T; if (!T.biomes) return 'pradera';
      const b = T.biomes[T.biome[Math.floor(y) * T.w + Math.floor(x)]];
      return BIOMES[b] ? b : 'pradera';
    }
    /** Suelo firme y a la misma altura que el centro (sin agua, piedra, escaleras ni bordes de acantilado). */
    flat(x, y, lv) {
      const T = this.T, i = Math.floor(x), j = Math.floor(y);
      if (!T.inBounds(i, j)) return false;
      const k = j * T.w + i;
      return T.kind[k] === 0 && (lv === undefined || T.level[k] === lv);
    }
    nearDirt(x, y) {
      const T = this.T; if (!T.dirtAt) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const cx = Math.floor(x + dx * 0.8), cy = Math.floor(y + dy * 0.8); if (T.inBounds(cx, cy) && T.dirtAt(cx, cy)) return true; }
      return false;
    }
    free(x, y, m) {
      const T = this.T, cells = T.obstacleCells ? T.obstacleCells() : null, obs = T.obstacles || [];
      const test = o => o && Math.abs(o.x - x) < (o.r || 0.3) + m && Math.abs(o.y - y) < (o.r || 0.3) + m;
      if (!cells) return !obs.some(test);
      const i0 = Math.floor(x - m - 1), i1 = Math.floor(x + m + 1), j0 = Math.floor(y - m - 1), j1 = Math.floor(y + m + 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!T.inBounds(i, j)) continue;
        const list = cells[j * T.w + i]; if (!list) continue;
        for (const e of list) if (test(typeof e === 'number' ? obs[e] : e)) return false;
      }
      return true;
    }
    excluded(x, y, pad) { return this.exclude.some(c => Math.hypot(c.x - x, c.y - y) < c.r + pad); }
    /** Planta candidata de la celda (i, j) de la rejilla fina, o null. */
    cand(i, j) {
      const key = i * 65536 + j; if (this.c.has(key)) return this.c.get(key);
      const r = this._cand(i, j); this.c.set(key, r); return r;
    }
    _cand(i, j) {
      const S = this.S, x = (i + 0.5 + (this.h(i, j, 3) - 0.5) * 0.8) * S, y = (j + 0.5 + (this.h(j, i, 4) - 0.5) * 0.8) * S;
      const T = this.T, ci = Math.floor(x), cj = Math.floor(y);
      if (!T.inBounds(ci, cj) || T.kind[cj * T.w + ci] !== 0) return null;
      const b = this.biome(x, y), B = BIOMES[b], V = B.veg, L = BY_BIOME[b];
      const col = this.colony(x, y), region = this.vn(x + 300, y - 120, 15, 5);
      const dens = (col - 0.26) / 0.24 * (0.65 + 0.8 * region) * V.tufts * this.dens;
      const patch = this.vn(x + 90, y + 33, 2.6, 6), inPatch = patch > 1 - 0.4 * Math.min(1.6, V.flowers);
      let kind;
      if (inPatch && this.h(x * 1.7, y * 2.3, 7) < 0.72) kind = 'flor';
      else if (this.h(x * 3.7, y * 2.9, 8) < dens) kind = 'pasto';
      else if (this.h(x * 5.3, y * 1.1, 9) < 0.02 * V.flowers) kind = 'flor';
      else return null;
      const list = L[kind]; if (!list.length) return null;
      // Las flores de una misma especie crecen juntas (manchas), con alguna mezclada.
      let n = Math.floor(this.vn(x - 55, y + 71, 5.5, 10) * list.length * 1.999) % list.length;
      if (this.h(x, y, 11) < 0.15) n = Math.floor(this.h(y, x, 12) * list.length) % list.length;
      if (kind === 'pasto' && list.length > 1) n = col + (this.h(x, y, 15) - 0.5) * 0.12 > 0.62 ? 1 : 0;   // la hierba alta, en el corazón de las colonias
      const sp = list[n], k = Math.floor(this.h(x * 2.1, y * 0.7, 13) * sp.art.length) % sp.art.length, tpl = sp.art[k];
      const rows = TPL[tpl], w = rows[0].length, hgt = rows.length, hw = w / 32, M = 0.04;
      const lv = T.level[cj * T.w + ci];
      if (!this.flat(x - hw, y, lv) || !this.flat(x + hw, y, lv) || !this.flat(x, y - 0.3, lv) || !this.flat(x, y + 0.3, lv)) return null;
      if (this.nearDirt(x, y) || !this.free(x, y, 0.6) || this.excluded(x, y, 0.4)) return null;
      const bw = hw * 0.8, bh = hgt / 32 * 0.7;          // las matas pueden tocarse un poco, como en la naturaleza
      return { i, j, x, y, sp, k: sp.art.indexOf(tpl), tpl, w, h: hgt, thick: false, prio: this.h(i, j, 14),
        box: { x0: x - bw - M, x1: x + bw + M, y0: y - bh - M, y1: y + bh + M } };
    }
    /** Matorral candidato de la celda (ti, tj) de la rejilla gruesa, o null. */
    tcand(ti, tj) {
      const key = ti * 65536 + tj; if (this.tc.has(key)) return this.tc.get(key);
      const r = this._tcand(ti, tj); this.tc.set(key, r); return r;
    }
    _tcand(ti, tj) {
      const TS = this.TS, x = (ti + 0.5 + (this.h(ti, tj, 20) - 0.5) * 0.7) * TS, y = (tj + 0.5 + (this.h(tj, ti, 21) - 0.5) * 0.7) * TS;
      const T = this.T, ci = Math.floor(x), cj = Math.floor(y);
      if (!T.inBounds(ci, cj) || T.kind[cj * T.w + ci] !== 0) return null;
      const b = this.biome(x, y), V = BIOMES[b].veg, list = BY_BIOME[b].matorral; if (!list.length) return null;
      const col = this.colony(x, y);
      if (col < 0.6 - 0.07 * (V.bushes - 1) || this.h(ti, tj, 22) > 0.62 * Math.min(1.5, V.bushes) * this.dens) return null;
      const sp = list[Math.floor(this.h(x, y, 23) * list.length) % list.length];
      const k = Math.floor(this.h(y, x, 24) * sp.art.length) % sp.art.length, tpl = sp.art[k], rows = TPL[tpl];
      const w = rows[0].length, hgt = rows.length, hw = w / 32, lv = T.level[cj * T.w + ci];
      for (const [dx, dy] of [[-hw, 0], [hw, 0], [0, -0.5], [0, 0.5], [-hw * 0.6, 0.4], [hw * 0.6, 0.4]]) if (!this.flat(x + dx, y + dy, lv)) return null;
      const half = hw + 0.4;
      if (!this.free(x, y, 0.6) || !this.free(x - half, y, 0.6) || !this.free(x + half, y, 0.6)) return null;
      if (this.nearDirt(x, y) || this.nearDirt(x - half, y) || this.nearDirt(x + half, y) || this.excluded(x, y, hw + 0.8)) return null;
      return { i: ti, j: tj, x, y, sp, k: sp.art.indexOf(tpl), tpl, w, h: hgt, thick: true, prio: this.h(ti, tj, 25),
        box: { x0: x - hw - 0.1, x1: x + hw + 0.1, y0: y - hgt / 32 - 0.1, y1: y + hgt / 32 + 0.1 } };
    }
    /** Un matorral queda si ningún vecino cercano con más prioridad lo pisa (regla local: no depende del orden). */
    tAccept(ti, tj) {
      const key = ti * 65536 + tj; if (this.ta.has(key)) return this.ta.get(key);
      const c = this.tcand(ti, tj); let ok = !!c;
      if (ok) for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const n = this.tcand(ti + di, tj + dj);
        if (n && Math.hypot(n.x - c.x, n.y - c.y) < this.gap && n.prio > c.prio) { ok = false; break; }
      }
      this.ta.set(key, ok ? c : null); return ok ? c : null;
    }
    accept(i, j) {
      const c = this.cand(i, j); if (!c) return null;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        if (!di && !dj) continue;
        const n = this.cand(i + di, j + dj);
        if (n && overlap(c.box, n.box) && (n.prio > c.prio || (n.prio === c.prio && (dj > 0 || (dj === 0 && di > 0))))) return null;
      }
      const ti = Math.floor(c.x / this.TS), tj = Math.floor(c.y / this.TS);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const t = this.tAccept(ti + di, tj + dj);
        if (t && overlap(c.box, t.box)) return null;
      }
      return c;
    }
    /** Plantas del trozo (cx, cy): cada celda pertenece a un solo trozo, así no hay costuras ni repetidas. */
    chunk(cx, cy) {
      const CS = this.CS, S = this.S, TS = this.TS, out = [];
      const r0 = (a, s) => Math.ceil(a / s - 0.5);
      for (let tj = r0(cy * CS, TS); tj < r0((cy + 1) * CS, TS); tj++) for (let ti = r0(cx * CS, TS); ti < r0((cx + 1) * CS, TS); ti++) {
        const t = this.tAccept(ti, tj); if (t) out.push(t);
      }
      for (let j = r0(cy * CS, S); j < r0((cy + 1) * CS, S); j++) for (let i = r0(cx * CS, S); i < r0((cx + 1) * CS, S); i++) {
        const p = this.accept(i, j); if (p) out.push(p);
      }
      if (this.c.size > 120000) { this.c.clear(); this.ta.clear(); }
      if (this.tc.size > 20000) { this.tc.clear(); this.ta.clear(); }
      return out;
    }
  }
  const keyOf = p => (p.thick ? 't' : '') + p.i + ',' + p.j;

  // Campo → textura RGBA8: rg = desplazamiento (−1..1), ba = velocidad (÷ VMAX, −1..1). 128 = reposo.
  const VMAX = 12;
  function encodeField(S, d) {
    const q = v => Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255)));
    for (let k = 0; k < S.dx.length; k++) {
      d[k * 4] = q(S.dx[k]); d[k * 4 + 1] = q(S.dy[k]);
      d[k * 4 + 2] = q(Math.max(-1, Math.min(1, S.vx[k] / VMAX))); d[k * 4 + 3] = q(Math.max(-1, Math.min(1, S.vy[k] / VMAX)));
    }
    return d;
  }
  const API = { DEF, VegSim, PAL, BIOMES, TPL, SHAPE, shapeOf, FLORA, SPECIES, BY_BIOME, colorsOf, spriteList, spriteId, seedIcon,
    stubble, ITEM_ART, MAT_NAMES, MAT_ICON, dropsOf, Field, keyOf, hashStr, encodeField, VMAX, genReeds, genCrystal };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root.document) return;

  /**
   * Red compartida por los módulos beta (vegetación y combate): eventos propios («x…»)
   * por la misma cola de eventos fiable que usa el motor (se reenvían hasta que llegan).
   * Un solo envoltorio por sesión aunque ambos módulos estén activos.
   */
  function tmNet() {
    if (root.__TM_NET__) return root.__TM_NET__;
    const H = new Map();
    root.__TM_NET__ = {
      on(type, fn) { H.set(type, fn); },
      attach(s) {
        if (!s || s.__tmNet || typeof s._onEvent !== 'function') return;
        s.__tmNet = true;
        const orig = s._onEvent;
        s._onEvent = function (e, t) {
          const fn = Array.isArray(t) && typeof t[0] === 'string' && t[0][0] === 'x' ? H.get(t[0]) : null;
          if (fn) { try { fn(e, t, s); } catch (er) { console.error('Red beta:', er); } return undefined; }
          return orig.apply(this, arguments);
        };
      },
      send(s, arr) { if (!s || !s.channel || !s.outbox || typeof s.outbox.push !== 'function') return false; s.outbox.push(arr); return true; },
      online(s) { return !!(s && s.channel); }
    };
    return root.__TM_NET__;
  }

  // ════════════════════════════════════════════════════════════════════
  // 4. Pintar las plantas en la zona libre del atlas
  // ════════════════════════════════════════════════════════════════════
  function paintSprite(g, x0, y0, rows, col) {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const c = col[rows[y][x]]; if (c) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 5. Inyección en el shader del terreno (la raíz no se mueve)
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
      this.acc = 0; this.prev = null; this.ent = new Map(); this.stats = { simMs: 0, uploads: 0, active: 0, plants: 0, frames: 0, steps: 0, src: { jugador: 0, ataque: 0, criaturas: 0, ondas: 0 }, chunks: 0, worldPlants: 0, buildMs: 0, hidden: 0 };
      this.view = null; this.mat = null; this.tex = null; this.data = null; this.on = true; this.lastAtk = undefined;
      this.drops = []; this.chips = []; this.gain = {}; this.cuts = 0; this._regT = 0;
      // Trozos vivos (clave «cx,cy») y plantas por clave; lo cortado se recuerda por mundo.
      this.chunks = new Map(); this.byKey = new Map(); this.field = null; this.cutState = new Map(); this.thickets = [];
      // Cooperativo: lo que corta cada jugador se ve cortado en las pantallas de todos.
      this.net = tmNet(); this.outCuts = []; this._cutT = 0;
      this.net.on('xc', (e, t) => this.onRemoteCut(t, null));
      this.net.on('xr', (e, t) => this.onRemoteCut(t, true));
      if (app.bus && app.bus.on) app.bus.on('net:player-seen', () => { clearTimeout(this._snapT); this._snapT = setTimeout(() => this.sendSnapshot(), 1500); });
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
    /** Especie de la planta más cercana (para pistas o un herbario futuro). */
    plantAt(x, y, r = 1) {
      let best = null, bd = r;
      for (const p of this.nearPlants(x, y, r)) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
      return best ? { id: best.sp.id, name: best.sp.name, biome: best.sp.biome, cut: best.cut } : null;
    }

    // ── Simulación (30 Hz fijos) ──
    tick(dt) {
      const a = this.app, s = a.session, av = s && s.avatar;
      if (s) { this.net.attach(s); this.flushCuts(s, dt); }
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
      // Rebrote: lo cortado vuelve a crecer (comida para los animales, más adelante).
      this._regT += dt;
      if (this._regT > 1) {
        this._regT = 0; const now = performance.now() / 1000, st = this.cuts0();
        for (const [k, t] of st) if (now >= t) { st.delete(k); const p = this.byKey.get(k); if (p && p.cut) this.setCut(p, false); }
      }
      // Paso fijo.
      this.acc += Math.min(dt, 0.1);
      const h = 1 / C.hz, t0 = performance.now();
      while (this.acc >= h) { if (this.sim.awake) { this.sim.step(h); this.stats.steps++; this.dirty = true; } this.acc -= h; }
      this.stats.simMs = this.stats.simMs * 0.9 + (performance.now() - t0) * 0.1;
    }
    /** Lo cortado en el mundo actual: clave → momento de rebrote. */
    cuts0() {
      const id = this.app.terrain ? this.app.terrain.id : '';
      if (!this.cutState.has(id)) this.cutState.set(id, new Map());
      return this.cutState.get(id);
    }

    // ── Antes de dibujar: shader, trozos, textura y uniformes ──
    before() {
      const a = this.app, v = a.view, s = a.session, av = s && s.avatar;
      if (!v || !av || !v.terrainMat) return;
      if (this.view !== v) this.setup(v);
      if (!this.mat || !this.mat.uniforms.uVegWin) return;
      this.tagChunks(v);
      if (this.on) this.stream(av);
      const U = this.mat.uniforms, C = this.cfg, t = performance.now() / 1000;
      U.uVegWin.value.set(this.sim.x0, this.sim.y0, C.cells * C.cell, this.on ? 1 : 0);
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
        encodeField(this.sim, this.data);
        this.tex.needsUpdate = true; this.dirty = false; this.stats.uploads++;
      }
      this.stats.active = this.sim.awake ? 1 : 0; this.stats.frames++;
      const now = performance.now() / 1000, fdt = Math.min(0.05, now - (this._lastFx || now)); this._lastFx = now;
      if (this.chips.length || this.drops.length) this.updateFx(fdt, av);
    }

    // ════ Trozos de vegetación alrededor del jugador ════
    /** Crea los trozos cercanos que faltan (con un tope de tiempo por cuadro) y quita los lejanos. */
    stream(av) {
      if (!this.field || !this.atlasReady) return;
      const W = this.cfg.world, CS = W.chunk, T = this.app.terrain;
      const pcx = av.x / CS, pcy = av.y / CS, R = W.radius / CS, K = W.keep / CS;
      const nx = Math.ceil(T.w / CS), ny = Math.ceil(T.h / CS);
      // Quitar los lejanos.
      for (const [k, ch] of this.chunks) if (Math.hypot(ch.cx + 0.5 - pcx, ch.cy + 0.5 - pcy) > K) this.dropChunk(k, ch);
      // Crear los cercanos, del más próximo al más lejano.
      const want = [];
      for (let cy = Math.max(0, Math.floor(pcy - R - 1)); cy <= Math.min(ny - 1, Math.floor(pcy + R)); cy++)
        for (let cx = Math.max(0, Math.floor(pcx - R - 1)); cx <= Math.min(nx - 1, Math.floor(pcx + R)); cx++) {
          const d = Math.hypot(cx + 0.5 - pcx, cy + 0.5 - pcy);
          if (d <= R + 0.71 && !this.chunks.has(cx + ',' + cy)) want.push([d, cx, cy]);
        }
      if (!want.length) return;
      want.sort((p, q) => p[0] - q[0]);
      const t0 = performance.now(), budget = this._warm ? W.budgetMs : 60;   // al llegar al mundo se llena de una vez
      for (const [, cx, cy] of want) {
        this.buildChunk(cx, cy);
        if (performance.now() - t0 > budget) break;
      }
      this._warm = true;
      this.stats.buildMs = +(performance.now() - t0).toFixed(1);
    }
    dropChunk(k, ch) {
      if (ch.mesh) { this.view.scene.remove(ch.mesh); ch.mesh.geometry.dispose(); }
      for (const p of ch.plants) this.byKey.delete(p.key);
      this.chunks.delete(k); this.stats.chunks = this.chunks.size; this.stats.worldPlants -= ch.plants.length;
      this.thickets = this.thickets.filter(t => t.chunk !== ch);
    }
    clearChunks() {
      for (const [k, ch] of this.chunks) this.dropChunk(k, ch);
      this.chunks.clear(); this.byKey.clear(); this.thickets = []; this.stats.worldPlants = 0;
    }
    /** Arma la malla de un trozo: cada planta es un cuadro de pie con 2 (pasto) o 5 (matorral) tramos. */
    buildChunk(cx, cy) {
      const v = this.view, T = this.app.terrain, at = v.atlas, W = at.w || 512, H = at.h || 512;
      const list = this.field.chunk(cx, cy), ch = { cx, cy, plants: [], mesh: null };
      this.chunks.set(cx + ',' + cy, ch); this.stats.chunks = this.chunks.size;
      if (!list.length) return ch;
      const pos = [], uvs = [], cols = [], vegs = [], idx = [], cut = this.cuts0(), now = performance.now() / 1000;
      for (const c of list) {
        const id = spriteId(c.sp, c.k), r = at.regions[id], rc = at.regions[id + '_c']; if (!r || !rc) continue;
        const z = T.surfaceAt(c.x, c.y); if (z !== z) continue;
        const sh = shapeOf(c.tpl), flip = this.field.h(c.x * 9.1, c.y, 30) < 0.5, amp = sh.amp * (0.85 + this.field.h(c.x, c.y * 3, 31) * 0.3);
        const l = z + 0.01, xc = Math.round(c.x * 16) / 16, hh = l - Math.round((l - c.y) * 16) / 16, u = r.w / 32, f = r.h / 32;
        const ph = this.field.h(c.x * 2.3, c.y * 1.9, 32) * 0.999 + 2 + (c.thick ? 4 : 0);   // +2 = de pie, +4 = matorral (el shader los distingue)
        const SEG = c.thick ? 5 : 2, base = pos.length / 3, key = keyOf(c);
        for (let row = 0; row <= SEG; row++) {           // de la punta (atrás) a la raíz (adelante)
          // De pie, mirando a la cámara (inclinada 45°): tapa a quien esté detrás y no a quien esté delante.
          const tf = row / SEG, wgt = Math.pow(1 - tf, 1.5);
          pos.push(xc - u, l + (1 - tf) * 2 * f, hh + f, xc + u, l + (1 - tf) * 2 * f, hh + f);
          uvs.push(0, 0, 0, 0);
          cols.push(1, 0, 0, 1, 0, 0); vegs.push(wgt, amp, ph, 2 * f, wgt, amp, ph, 2 * f);
        }
        for (let row = 0; row < SEG; row++) { const q = base + row * 2; idx.push(q, q + 2, q + 3, q, q + 3, q + 1); }
        const p = { key, sp: c.sp, tpl: c.tpl, id, x: c.x, y: c.y, base, seg: SEG, flip, thick: c.thick, l, f, amp, hp: sh.hp, keep: sh.keep, rows: c.h, cut: false, chunk: ch };
        const until = cut.get(key); if (until && now < until) p.cut = true;
        ch.plants.push(p); this.byKey.set(key, p);
        if (c.thick) this.thickets.push({ x: c.x, y: c.y, r: r.w / 32, id: c.sp.id, chunk: ch, get cut() { return p.cut; } });
      }
      if (!ch.plants.length) return ch;
      const vc = pos.length / 3, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      const nrm = new Float32Array(vc * 3); for (let i = 0; i < vc; i++) nrm[i * 3 + 1] = 1;
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('aMask', new THREE.BufferAttribute(new Float32Array(vc * 2).fill(-1), 2));
      geo.setAttribute('aVeg', new THREE.Float32BufferAttribute(vegs, 4));
      geo.setIndex(idx);
      ch.geo = geo;
      for (const p of ch.plants) this.look(p, p.cut, true);
      const mesh = new THREE.Mesh(geo, v.terrainMat); mesh.frustumCulled = false; mesh.name = 'vegetacion-' + cx + '-' + cy;
      v.scene.add(mesh); ch.mesh = mesh; this.tagged.add(geo);
      this.stats.worldPlants += ch.plants.length; this.stats.zonePlants = this.stats.worldPlants;
      return ch;
    }
    /** Imagen y alto de la planta: entera o cortada a ras (rastrojo). */
    look(p, cut, quiet) {
      const g = p.chunk.geo, at = this.view.atlas; if (!g || !at) return;
      const r = at.regions[cut ? p.id + '_c' : p.id]; if (!r) return;
      const W = at.w || 512, H = at.h || 512, uv = g.attributes.uv, pos = g.attributes.position, vg = g.attributes.aVeg;
      const p0 = (p.flip ? r.x + r.w : r.x) / W, p1 = (p.flip ? r.x : r.x + r.w) / W, g0 = r.y / H, g1 = (r.y + r.h) / H;
      const k = cut ? p.keep / p.rows : 1;
      for (let row = 0; row <= p.seg; row++) {
        const tf = row / p.seg, vv = g0 + (g1 - g0) * tf, y = p.l + (1 - tf) * 2 * p.f * k, w = cut ? 0 : Math.pow(1 - tf, 1.5);
        const a = p.base + row * 2;
        uv.setXY(a, p0, vv); uv.setXY(a + 1, p1, vv);
        pos.setY(a, y); pos.setY(a + 1, y);
        vg.setX(a, w); vg.setX(a + 1, w);
      }
      uv.needsUpdate = true; pos.needsUpdate = true; vg.needsUpdate = true;
      p.cut = cut;
      if (!quiet) this.stats.cuts = this.cuts;
    }
    /** Plantas vivas cerca de (x, y). */
    nearPlants(x, y, r) {
      const CS = this.cfg.world.chunk, out = [];
      for (let cy = Math.floor((y - r - 1) / CS); cy <= Math.floor((y + r + 1) / CS); cy++)
        for (let cx = Math.floor((x - r - 1) / CS); cx <= Math.floor((x + r + 1) / CS); cx++) {
          const ch = this.chunks.get(cx + ',' + cy); if (!ch) continue;
          for (const p of ch.plants) if (Math.abs(p.x - x) <= r + 1 && Math.abs(p.y - y) <= r + 1) out.push(p);
        }
      return out;
    }

    // ════ Cortar plantas con el arma: rastrojo, recortes que saltan y lo que se recoge ════
    /** Golpe del arma: corta lo que está en el arco de enfrente (los matorrales aguantan varios golpes). */
    slash(x, y, fx, fy) {
      if (!this.chunks.size) return 0;
      const cx = x + fx * 0.75, cy = y + fy * 0.75; let n = 0;
      for (const p of this.nearPlants(x, y, 2.2)) {
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
    /** Corta (o hace rebrotar) una planta y lo recuerda aunque el trozo se quite y vuelva. */
    setCut(p, cut, remote) {
      const st = this.cuts0();
      if (cut && !remote) this.outCuts.push(p.key);
      if (cut) {
        st.set(p.key, performance.now() / 1000 + (p.thick ? this.cfg.regrow.thicket : this.cfg.regrow.grass) * (0.8 + Math.random() * 0.4));
        this.cuts++;
      } else { st.delete(p.key); p.hp = shapeOf(p.tpl).hp; }
      this.look(p, cut);
    }
    // ════ Cooperativo ════
    /** Envía los cortes propios en tandas (un evento cada 0,25 s como mucho). */
    flushCuts(s, dt) {
      this._cutT -= dt;
      if (!this.outCuts.length || this._cutT > 0) return;
      this._cutT = 0.25;
      if (!this.net.online(s) || !this.app.terrain) { this.outCuts.length = 0; return; }
      const keys = this.outCuts.splice(0, 20);
      this.net.send(s, ['xc', this.app.terrain.id].concat(keys));
    }
    /** Corte de otro jugador (o foto de lo cortado al entrar): sin recoger nada. */
    onRemoteCut(t, snap) {
      const tid = t[1]; if (typeof tid !== 'string' || tid.length > 40) return;
      if (!this.cutState.has(tid)) this.cutState.set(tid, new Map());
      const st = this.cutState.get(tid), now = performance.now() / 1000, here = this.app.terrain && this.app.terrain.id === tid;
      const step = snap ? 2 : 1;
      for (let i = 2; i < t.length && i < 2 + 48; i += step) {
        const key = t[i]; if (typeof key !== 'string' || !/^t?-?\d{1,5},-?\d{1,5}$/.test(key)) continue;
        const thick = key[0] === 't', left = snap ? Math.max(1, Math.min(600, +t[i + 1] || 0)) : (thick ? this.cfg.regrow.thicket : this.cfg.regrow.grass);
        st.set(key, now + left);
        const p = here && this.byKey.get(key);
        if (p && !p.cut) { this.look(p, true); this.burst(p, p.thick ? 10 : 4); }
      }
      this.stats.remoteCuts = (this.stats.remoteCuts || 0) + 1;
    }
    /** A quien entra se le manda lo que sigue cortado aquí (en tandas pequeñas). */
    sendSnapshot() {
      const s = this.app.session, T = this.app.terrain; if (!this.net.online(s) || !T) return;
      const st = this.cutState.get(T.id); if (!st || !st.size) return;
      const now = performance.now() / 1000, all = [...st].filter(([, t]) => t > now + 2).slice(-60);
      for (let i = 0; i < all.length; i += 12) {
        const ev = ['xr', T.id];
        for (const [k, t] of all.slice(i, i + 12)) ev.push(k, Math.round(t - now));
        this.net.send(s, ev);
      }
    }
    fxMat(kind) {
      const v = this.view; this._fxm = this._fxm || {};
      if (!this._fxm[kind]) this._fxm[kind] = kind === 'icon'
        ? new THREE.MeshBasicMaterial({ map: v.atlasTex, alphaTest: 0.5, transparent: false })
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(kind) });
      return this._fxm[kind];
    }
    /** Recortes que saltan al cortar (con los colores de la especie). */
    burst(p, n) {
      const v = this.view, T = this.app.terrain; if (!v || !v.scene || !T) return;
      const z = T.surfaceAt(p.x, p.y); if (z !== z) return;
      this._chipGeo = this._chipGeo || new THREE.PlaneGeometry(2 / 16, 2 / 16);   // trocitos de 2 px
      const col = colorsOf(p.sp), cols = [col.l, col.h, col.m, col.k].concat(p.sp.petals ? [p.sp.petals.a, p.sp.petals.b] : []);
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
      for (const [mat, chance, count] of dropsOf(p.sp, p.tpl)) {
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
          if (d.t > 90) { v.scene.remove(d.m); d.m.geometry.dispose(); this.drops.splice(i, 1); continue; }
        } else {                                                       // vuela hacia el personaje
          const k = Math.min(1, dt * 12); d.x += (av.x - d.x) * k; d.y += (av.y - d.y) * k; d.z += ((av.z || d.z) - d.z) * k; d.h += (0.6 - d.h) * k;
          if (Math.hypot(av.x - d.x, av.y - d.y) < 0.2) { this.collect(d.mat); v.scene.remove(d.m); d.m.geometry.dispose(); this.drops.splice(i, 1); continue; }
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
        const txt = Object.entries(this.gain).map(([k, n]) => '+' + n + ' ' + (MAT_NAMES[k] || k)).join(' · ');
        this.gain = {};
        try { a.ui && a.ui.toast && a.ui.toast(txt + ' (en tu bolsa)', 'gold', 2600); if (a.audio) a.audio.play('click'); } catch (_) { /* nada */ }
        try { if (a.gearScreen && a.gearScreen.refresh) a.gearScreen.refresh(); } catch (_) { /* nada */ }
      }, 700);
    }

    // ════ Preparación por mundo: shader, atlas y reparto ════
    setup(v) {
      this.clearChunks();
      this.view = v; this.tagged = new WeakSet(); this._regs = null; this._warm = false; this.atlasReady = false;
      const gl = this.app.pr && (this.app.pr.renderer || this.app.pr.r) && (this.app.pr.renderer || this.app.pr.r).getContext && (this.app.pr.renderer || this.app.pr.r).getContext();
      let vtf = true; try { vtf = !gl || gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0; } catch (_) { vtf = true; }
      this.vtf = vtf;
      this.atlasReady = this.addSprites(v);
      this.mat = this.patch(v.terrainMat, vtf);
      if (vtf && this.mat) {
        const N = this.cfg.cells; this.data = new Uint8Array(N * N * 4).fill(128);
        this.tex = new THREE.DataTexture(this.data, N, N, THREE.RGBAFormat);
        this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
        this.mat.uniforms.uVegTex = { value: this.tex };
      }
      const T = this.app.terrain;
      this.field = T ? new Field(T, Object.assign({}, this.cfg.world, { exclude: this.exclusions(T) })) : null;
      this.stats.biomes = T && T.biomes ? T.biomes.slice() : ['pradera'];
    }
    /** Lugares sin plantas: campamento, portales, faroles y el Santuario de la Corona. */
    exclusions(T) {
      const out = [];
      for (const s of T.spawns || []) out.push({ x: s.x, y: s.y, r: 3.2 });
      for (const p of T.portals || []) out.push({ x: p.x, y: p.y, r: 2.4 });
      for (const l of T.lamps || []) out.push({ x: l.x, y: l.y, r: 0.9 });
      try {
        const k = root.__TM_REY_CONTROLLER__, c = k && k.findCenter && k.findCenter();
        if (c && c.terrain === T) out.push({ x: c.x, y: c.y, r: 6.4 });
      } catch (_) { /* sin santuario */ }
      return out;
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
    /** Regiones de plantas fijas del atlas: arbustos (se mecen) y matas/flores (se reemplazan por las vivas). */
    regions(v) {
      if (this._regs) return this._regs;
      const at = v.atlas, W = at.w || 512, H = at.h || 512, out = [], hide = this.cfg.replaceMapPlants;
      for (const [k, r] of Object.entries(at.regions)) {
        const map = /^tuft/.test(k) || /^flowers/.test(k);
        const amp = /^tuft/.test(k) ? 0.18 : /^flowers/.test(k) ? 0.1 : /^bush/.test(k) ? 0.05 : 0;
        if (amp) out.push({ type: amp, hide: hide && map, len: r.h / 16, u0: r.x / W, v0: r.y / H, u1: (r.x + r.w) / W, v1: (r.y + r.h) / H });
      }
      this._regs = out; return out;
    }
    /** Marca cada vértice de planta del mapa: peso 1 arriba, 0 en la raíz. Las matas y flores fijas se ocultan. */
    tagGeometry(geo, regs, shift) {
      const uv = geo.attributes.uv, pos = geo.attributes.position; if (!uv || !pos) return 0;
      const n = uv.count, out = new Float32Array(n * 4); let plants = 0, hidden = 0;
      const at = this.view.atlas, W = at.w || 512, H = at.h || 512, hole = at.regions.tmVegHole;
      const hu = hole ? (hole.x + hole.w / 2) / W : -1, hv = hole ? (hole.y + hole.h / 2) / H : -1;
      for (let i = 0; i < n; i++) {
        const u = uv.getX(i), vv = uv.getY(i);
        for (let pass = 0; pass < 2; pass++) {
          const uu = pass ? u - shift : u; if (pass && !shift) break;
          const r = regs.find(q => uu >= q.u0 - 1e-4 && uu <= q.u1 + 1e-4 && vv >= q.v0 - 1e-4 && vv <= q.v1 + 1e-4);
          if (!r) continue;
          if (r.hide && hole) { uv.setXY(i, hu, hv); pos.setY(i, -500); hidden++; break; }   // fuera de cámara y transparente: no cuesta nada dibujarla
          const w = 1 - (vv - r.v0) / Math.max(1e-6, r.v1 - r.v0);
          const ph = (Math.sin(pos.getX(i) * 12.9898 + pos.getZ(i) * 78.233) * 43758.5453) % 1;
          out[i * 4] = Math.max(0, Math.min(1, w)); out[i * 4 + 1] = r.type; out[i * 4 + 2] = Math.abs(ph); out[i * 4 + 3] = r.len * Math.cbrt(Math.max(0, Math.min(1, w)));   // en el shader: pow(w, 2/3) · esto = w · largo
          if (w > 0.5) plants++;
          break;
        }
      }
      if (hidden) { uv.needsUpdate = true; pos.needsUpdate = true; this.stats.hidden += hidden / 4; }
      geo.setAttribute('aVeg', new THREE.BufferAttribute(out, 4));
      return plants;
    }
    tagChunks(v) {
      const ch = v.chunks; if (!ch || !ch.live || !this.mat) return;
      const regs = this.regions(v), shift = (this.mat.uniforms.uShiftB && this.mat.uniforms.uShiftB.value) || 0;
      for (const entry of ch.live.values()) for (const g of entry.geos) {
        if (this.tagged.has(g)) continue;
        this.tagged.add(g);
        this.stats.plants += this.tagGeometry(g, regs, shift);
      }
    }
    /**
     * Pinta todas las especies, sus rastrojos y las semillas en la franja libre del atlas
     * (solo la mitad izquierda cuando el piso tiene dos biomas) y deja un hueco transparente.
     */
    addSprites(v) {
      const at = v.atlas, img = v.atlasTex && v.atlasTex.image; if (!at || !img || !img.getContext) return false;
      if (at.__tmFlora) return true;
      const shift = (v.terrainMat && v.terrainMat.uniforms && v.terrainMat.uniforms.uShiftB && v.terrainMat.uniforms.uShiftB.value) || 0;
      const limW = shift > 0 ? Math.floor(img.width * shift) : img.width;
      let maxY = 0; for (const [k, r] of Object.entries(at.regions)) if (!/^(fl_|sem_|item|veg|tmVeg)/.test(k)) maxY = Math.max(maxY, r.y + r.h);
      const g = img.getContext('2d'), list = spriteList().concat([['tmVegHole', ['....', '....', '....', '....'], {}]]);
      // Estantes: los más altos primero, para aprovechar la franja.
      list.sort((p, q) => q[1].length - p[1].length);
      let x = 2, y = maxY + 3, shelf = 0, n = 0;
      for (const [id, rows, col] of list) {
        const w = rows[0].length, h = rows.length;
        if (x + w > limW - 2) { x = 2; y += shelf + 2; shelf = 0; }
        if (y + h > img.height - 1) { console.warn('Vegetación beta: el atlas no tiene sitio para', id); break; }
        g.clearRect(x, y, w, h); paintSprite(g, x, y, rows, col);
        at.regions[id] = { x, y, w, h };
        x += w + 2; shelf = Math.max(shelf, h); n++;
      }
      v.atlasTex.needsUpdate = true; this._regs = null; at.__tmFlora = true;
      this.stats.sprites = n; this.stats.atlasUsedTo = y + shelf;
      return n === list.length;
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
        plantas: v ? (st.worldPlants || 0) + ' vivas en ' + (st.chunks || 0) + ' trozos · ' + st.hidden + ' fijas ocultas' : 0,
        biomas: v && st.biomes ? st.biomes.join(' + ') : '—',
        texturas_en_vertices: v ? (v.vtf ? 'sí' : 'no') : '—',
        calidad: a.tier || '—'
      };
      // Compacta (2 líneas) para no tapar el juego; los datos completos quedan en window.__TM_VEG_TEL__.data.
      this.el.textContent = data.fps + ' FPS · ' + data.ms + ' ms (p95 ' + data.ms_p95 + ') · ' + data.calidad +
        '\n' + (v ? 'hierba ' + data.sim + ' · ' + (st.worldPlants || 0) + ' plantas · ' + data.pasos_s + ' pasos/s' : 'sin vegetación');
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
