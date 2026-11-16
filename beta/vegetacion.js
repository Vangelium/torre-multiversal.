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
    zone: { radius: 18, max: 380, spacing: 0.62 }
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
      // Bajo el umbral se duerme: todo vuelve exacto al reposo (sin vibraciones residuales).
      if (ni1 < 0 || energy < this.cfg.sleep) { this.dx.fill(0); this.dy.fill(0); this.vx.fill(0); this.vy.fill(0); this.awake = false; this.box = null; this.energy = 0; return 0; }
      this.box = [ni0, nj0, ni1, nj1];
      return energy;
    }
    at(x, y) { const c = this.cfg.cell, i = Math.floor((x - this.x0) / c), j = Math.floor((y - this.y0) / c); if (i < 0 || j < 0 || i >= this.N || j >= this.N) return [0, 0]; const k = this.idx(i, j); return [this.dx[k], this.dy[k]]; }
  }

  const AMP = { vegCorta: 0.2, vegAlta: 0.44, vegHelecho: 0.32, vegMata: 0.1, vegFlor: 0.16 };
  // Paleta = la misma de los arbustos y árboles del juego (contorno, sombras, luz).
  // Nada de verdes nuevos: así las plantas quedan integradas con el terreno.
  const PAL = { O: '#0c241a', D: '#19472a', d: '#235e31', k: '#337838', m: '#4b9440', l: '#6fb14b', h: '#a3d064', s: '#d2ec8c',
    w: '#eeeadb', g: '#b9b3a2', y: '#e9c25e', p: '#ea94bc', q: '#b45f8c' };
  // Pixel art dibujado a mano (una letra = un píxel; '.' = transparente).
  const ART = {
    vegCorta0: ['.....O......', '..O.OhO..O..', '.OhODlO.OhO.', '.OlDllmODlO.', 'OllDllmDlmO.', 'OmkDmkdDmkdO', '.DmkmkdmkdD.', '.Ddkmdkdkdd.', '..DdDdDdDD..'],
    vegCorta1: ['....O.....', '.O.OhO.O..', 'OhODlDOhO.', 'OllDllDlmO', '.OmkmkmkdO', '.DdkdkdkdD', '..DdDdDD..'],
    vegCorta2: ['.O....O....O.', 'OhO..OhO..OhO', 'OlO..OlO.OlmO', '.OlOODlmODlO.', '.OllDllmDlmO.', '..DmkmkdmkdD.', '..DdkdkdkddD.', '...DdDdDdDD..'],
    vegAlta0: ['......O........', '.....OhO.......', '.O...OlO....O..', 'OhO..OllO..OhO.', 'OlO...OllO.OlO.', '.OlO..OllO.OllO', '.OlO.ODllDOllO.', '..OlODlDlmDllO.', '.O.OlDlDlmDlmO.', 'OhODllDllmDlmO.', 'OlmDDmDlmkmkO..', '.DlmDmkDmkmkD..', '.DmkDmkDmkdkD..', '..DmkmkdmkdkdD.', '..DdkmkdkdkddD.', '...DdkdkdddDD..', '....DDdDdDDD...'],
    vegAlta1: ['....OOO......', '...OhllO.....', '..OhODlO.....', '..OO.OlO..O..', '.....OllO.OhO', '..O..OllO.OlO', '.OhO.OllDOlO.', '.OlO.OllmDlO.', '..OlODllmDlO.', '..OlDDllmDlO.', '..OlmDDmkDmkO', '...DlmDmkDmkD', '...DmkDmkmkD.', '...DmkmkdkdD.', '...DdkmkdkdD.', '....DdkdkdD..', '....DdkdddD..', '.....DDdDD...'],
    vegHelecho0: ['.........O.........', '........OhO........', '.......OlhlO.......', '......OllDllO......', '...O..OllmllO..O...', '..OhO.ODlmlDO.OhO..', '.OlhlO.OlmlO.OlhlO.', 'OllDllODlmlDOllDllO', 'DDDmlmkDlkmDkmlmDDD', '..DDmlmkmkmkmlmDD..', '...DkmdkmkdkmdkD...', '....DdkdkdkdkdD....', '.....DDdDdDdDD.....'],
    vegHelecho1: ['..........O.....', '...O.....OhO....', '..OhO...OlhlO...', '.OlhlO.OllDllO..', 'OllDllODllmlO...', 'OOOlllmDlmlDO.O.', '...OlllmlmlO.OhO', '...ODmlmkmkDOlhO', '....DkmdkmkmlmDD', '.....DdkmkdkmD..', '......DdkdkdD...', '.......DDdDD....'],
    vegMata0: ['....OOO.OO...', '..OOhllOhlO..', '.OhllmDlllmO.', 'OhllmDhlllmmO', 'OllmDlllmmDkO', 'OlmkDllmmkDmO', '.OkdDmkkdDkdO', '.DdkdDkddDkD.', '..DdddDdDdD..', '...DDDDDDD...'],
    vegMata1: ['...OO.OO...', '..OhlOhlO..', '.OhllDllmO.', 'OhllmDllmmO', 'OllmkDlmkmO', 'OmkdDkkdDdO', '.DkdddkdddD', '..DdddDddD.', '...DDDDDD..'],
    vegFlor0: ['..w.....w...', '.wyw...wyw..', '..g..w..g...', '..k.wyw.k...', '..k..g..k...', '.O.k.k.k.O..', 'OhO.kkk..OhO', 'OlmODkO.OlmO', '.DmkDmkDDmkD', '.DmkdmkdmkD.', '..DdkdkdkdD.', '...DDdDdDD..'],
    vegFlor1: ['...p....p..', '..pyp..pyp.', '...q....q..', '.p.k....k..', 'pyp.k..k...', '.q.Ok.kO.O.', '.OhDkkkDOhO', '.DlmDkDDlmD', 'DmkDmkDDmkD', '.DdkdkdkdD.', '..DDdDdDD..'],
  };
  // id, ancho, alto, amplitud de flexión (u), tipo
  const NEW_SPRITES = Object.keys(ART).map(id => { const k = id.replace(/\d+$/, ''); return [id, ART[id][0].length, ART[id].length, AMP[k], k.slice(3).toLowerCase()]; });
  const API = { DEF, VegSim, ART, PAL, NEW_SPRITES };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root.document) return;

  // ════════════════════════════════════════════════════════════════════
  // 2. Arte de las especies nuevas (pintadas en la zona libre del atlas)
  // ════════════════════════════════════════════════════════════════════
  function paintSprite(g, x0, y0, id) {
    const rows = ART[id]; if (!rows) return;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const c = PAL[rows[y][x]]; if (c) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. Inyección en el shader del terreno (la raíz no se mueve)
  // ════════════════════════════════════════════════════════════════════
  const VS_HEAD = `
      attribute vec3 aVeg;
      uniform vec4 uVegWin; uniform vec4 uVegCam; uniform vec4 uVegWind; uniform vec2 uVegLod;
      #ifdef TM_VEG_TEX
      uniform sampler2D uVegTex;
      #endif`;
  const VS_BODY = `
        if (aVeg.x > 0.0 && uVegWin.w > 0.5) {
          float vw = aVeg.x, amp = aVeg.y, ph = aVeg.z, dist = distance(wp.xz, uVegCam.xy);
          float lod = 1.0 - smoothstep(uVegLod.x, uVegLod.y, dist), mid = 1.0 - smoothstep(uVegLod.y, uVegLod.y + 4.0, dist);
          // Viento secundario: solo durante ráfagas (la mayor parte del tiempo, quieto).
          float freq = 2.4 - amp * 3.0;
          float wind = sin(uVegCam.z * freq + wp.x * 0.5 + wp.z * 0.3 + ph * 6.2831) * uVegWind.z;
          vec2 d = vec2(0.0);
          #ifdef TM_VEG_TEX
          // Cada planta lee la onda en un punto propio (reacción desfasada, no todas iguales).
          vec2 tuv = (wp.xz + vec2(ph - 0.5, fract(ph * 7.3) - 0.5) * 0.35 - uVegWin.xy) / uVegWin.z;
          if (tuv.x > 0.0 && tuv.y > 0.0 && tuv.x < 1.0 && tuv.y < 1.0) d = (texture2D(uVegTex, tuv).rg * 2.0 - 1.0) * lod * (0.8 + 0.4 * ph);
          #endif
          // Flexión hacia donde empuja el contacto + la punta baja hacia la raíz (se aplasta),
          // así el doblez se lee claro aunque la hoja sea pequeña.
          wp.x += (d.x * amp + wind * amp * 0.35 * mid) * vw;
          wp.z += (d.y * amp * 0.4 + min(1.0, length(d)) * amp * 0.45) * vw;
        }`;

  class Veg {
    constructor(app, cfg) {
      this.app = app; this.cfg = cfg; this.sim = new VegSim(cfg);
      this.acc = 0; this.prev = null; this.ent = new Map(); this.stats = { simMs: 0, uploads: 0, active: 0, plants: 0, frames: 0, steps: 0, src: { jugador: 0, ataque: 0, criaturas: 0, ondas: 0 } };
      this.view = null; this.mat = null; this.tex = null; this.data = null; this.on = true; this.lastAtk = 0;
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
        const atk = av.atk | 0;
        if (atk && atk !== this.lastAtk) {
          const fx = sp > 0.2 ? vx / sp : (this.face ? this.face[0] : 1), fy = sp > 0.2 ? vy / sp : (this.face ? this.face[1] : 0);
          this.sim.impulse(av.x + fx * 0.9, av.y + fy * 0.9, C.attack.radius, C.attack.force, fx, fy); this.stats.src.ataque++;
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
      if (this.tex && (this.dirty || this.sim.awake)) {
        const N = C.cells, d = this.data, S = this.sim;
        for (let k = 0; k < N * N; k++) { d[k * 4] = Math.round((S.dx[k] * 0.5 + 0.5) * 255); d[k * 4 + 1] = Math.round((S.dy[k] * 0.5 + 0.5) * 255); }
        this.tex.needsUpdate = true; this.dirty = false; this.stats.uploads++;
      }
      this.stats.active = this.sim.awake ? 1 : 0; this.stats.frames++;
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
      Object.assign(m.uniforms, { uVegWin: { value: new THREE.Vector4() }, uVegCam: { value: new THREE.Vector4() }, uVegWind: { value: new THREE.Vector4() }, uVegLod: { value: new THREE.Vector2(8, 15) } });
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
        const amp = /^tuft/.test(k) ? 0.12 : /^flowers/.test(k) ? 0.07 : /^bush/.test(k) ? 0.04 : 0;
        if (amp) out.push({ type: amp, u0: r.x / W, v0: r.y / H, u1: (r.x + r.w) / W, v1: (r.y + r.h) / H });
      }
      this._regs = out; return out;
    }
    /** Marca cada vértice de planta: peso 1 arriba, 0 en la raíz (la raíz nunca se mueve). */
    tagGeometry(geo, regs, shift) {
      const uv = geo.attributes.uv, pos = geo.attributes.position; if (!uv || !pos) return 0;
      const n = uv.count, out = new Float32Array(n * 3); let plants = 0;
      for (let i = 0; i < n; i++) {
        let u = uv.getX(i), vv = uv.getY(i);
        for (let pass = 0; pass < 2; pass++) {
          const uu = pass ? u - shift : u; if (pass && !shift) break;
          const r = regs.find(q => uu >= q.u0 - 1e-4 && uu <= q.u1 + 1e-4 && vv >= q.v0 - 1e-4 && vv <= q.v1 + 1e-4);
          if (!r) continue;
          const w = 1 - (vv - r.v0) / Math.max(1e-6, r.v1 - r.v0);
          const ph = (Math.sin(pos.getX(i) * 12.9898 + pos.getZ(i) * 78.233) * 43758.5453) % 1;
          out[i * 3] = Math.max(0, Math.min(1, w)); out[i * 3 + 1] = r.type; out[i * 3 + 2] = Math.abs(ph);
          if (w > 0.5) plants++;
          break;
        }
      }
      geo.setAttribute('aVeg', new THREE.BufferAttribute(out, 3));
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
      v.atlasTex.needsUpdate = true; this._regs = null;
    }
    /**
     * Zona controlada alrededor de la salida del valle: COLONIAS naturales (ruido
     * determinista) con claros, bordes suaves y mezcla de especies; caminos y
     * obstáculos despejados. Cada planta es un cuadro de 3 tramos: la flexión
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
      let n = 0;
      for (let j = -Z.radius; j <= Z.radius && n < Z.max; j += Z.spacing) for (let i = -Z.radius; i <= Z.radius && n < Z.max; i += Z.spacing) {
        const x = sp.x + i + (hash(i * 1.3, j) - 0.5) * Z.spacing * 0.9, y = sp.y + j + (hash(j, i * 1.7) - 0.5) * Z.spacing * 0.9;
        const d = Math.hypot(i, j); if (d < 4 || d > Z.radius) continue;
        const col = vn(x, y, 3.2) * 0.65 + vn(x + 40, y - 17, 1.4) * 0.35;           // colonias + detalle
        const edge = 1 - Math.max(0, (d - Z.radius * 0.75) / (Z.radius * 0.25));      // se desvanece hacia afuera
        const dens = (col - 0.52) / 0.3 * edge;
        if (dens <= 0 || hash(x * 3.7, y * 2.9) > dens) continue;                     // claros y bordes suaves
        const z = T.surfaceAt(x, y); if (z !== z || !free(x, y) || nearDirt(x, y)) continue;
        // Especie: centro de la colonia → altas y helechos; borde → cortas, matas y flores.
        const r2 = hash(y * 5.1, x * 4.3), core = dens > 0.75;
        const id = core ? (r2 < 0.55 ? pick(['vegAlta0', 'vegAlta1'], hash(x, y)) : r2 < 0.8 ? pick(['vegHelecho0', 'vegHelecho1'], hash(y, x)) : pick(['vegCorta0', 'vegCorta2'], r2))
          : (r2 < 0.58 ? pick(['vegCorta0', 'vegCorta1', 'vegCorta2'], hash(x, y)) : r2 < 0.74 ? pick(['vegMata0', 'vegMata1'], hash(y, x)) : r2 < 0.86 ? pick(['vegFlor0', 'vegFlor1'], hash(x, x)) : pick(['vegAlta1', 'vegHelecho1'], hash(x * 3, y)));
        const spr = NEW_SPRITES.find(q => q[0] === id), r = at.regions[id]; if (!spr || !r) continue;
        const flip = hash(x * 9.1, y) < 0.5, amp = spr[3] * (0.85 + hash(x, y * 3) * 0.3);
        const l = z + 0.01, c = Math.round(x * 16) / 16, hh = l - Math.round((l - y) * 16) / 16, u = r.w / 32, f = r.h / 32;
        const p0 = (flip ? r.x + r.w : r.x) / W, p1 = (flip ? r.x : r.x + r.w) / W, g0 = r.y / H, g1 = (r.y + r.h) / H, ph = hash(x * 2.3, y * 1.9);
        // 3 tramos (4 filas de vértices): z de atrás (punta) a adelante (raíz).
        const base = pos.length / 3; pts.push({ x, y, id });
        for (let row = 0; row <= 3; row++) {
          const tf = row / 3, zz = hh - f + tf * 2 * f, vv = g0 + (g1 - g0) * tf, wgt = Math.pow(1 - tf, 1.5);
          pos.push(c - u, l, zz, c + u, l, zz); uvs.push(p0, vv, p1, vv);
          cols.push(1, 0, 0, 1, 0, 0); vegs.push(wgt, amp, ph, wgt, amp, ph);
        }
        for (let row = 0; row < 3; row++) { const q = base + row * 2; idx.push(q, q + 2, q + 3, q, q + 3, q + 1); }
        n++;
      }
      if (!n) return;
      const vc = pos.length / 3, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(vc).fill(0).flatMap(() => [0, 1, 0]), 3));
      geo.setAttribute('aMask', new THREE.Float32BufferAttribute(new Array(vc * 2).fill(-1), 2));
      geo.setAttribute('aVeg', new THREE.Float32BufferAttribute(vegs, 3));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, v.terrainMat); mesh.frustumCulled = false; mesh.name = 'vegetacion-zona';
      v.scene.add(mesh); this.zone = mesh; this.zonePts = pts; this.tagged.add(geo); this.stats.zonePlants = n;
    }
  }

  root.__TM_VEG_API__ = API;
  root.__TM_VEG_INSTALL__ = function (app) {
    try {
      const cfg = Object.assign({}, DEF, root.__TM_VEG_CONFIG__ || {});
      new Veg(app, cfg);
    } catch (e) { console.error('Vegetación beta:', e); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
