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
    spring: 22, damping: 3.6, couple: 120, maxDisp: 1, sleep: 2e-5,
    player: { radius: 1.0, force: 7 }, creature: { force: 4 }, attack: { radius: 1.8, force: 16 },
    wind: { strength: 0.45, gust: 0.35 }, lod: { near: 8, far: 15 },
    zone: { radius: 16, tall: 0.32, fern: 0.06, max: 600 }
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

  const API = { DEF, VegSim };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root.document) return;

  // ════════════════════════════════════════════════════════════════════
  // 2. Arte de las especies nuevas (pintadas en la zona libre del atlas)
  // ════════════════════════════════════════════════════════════════════
  const NEW_SPRITES = [
    // id, w, h, tipo (2 = pasto alto, 3 = helecho)
    ['vegAlto0', 9, 20, 2], ['vegAlto1', 11, 18, 2], ['vegAlto2', 7, 22, 2], ['vegHelecho0', 18, 15, 3], ['vegHelecho1', 15, 13, 3]
  ];
  function paintSprite(g, x0, y0, id, w, h) {
    const G = ['#163f1c', '#1f5229', '#2b6e30', '#3d8c38', '#59aa42', '#82c552', '#b2df70'], OUT = '#0f2614';
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) { g.fillStyle = c; g.fillRect(x0 + x, y0 + y, 1, 1); } };
    if (id.startsWith('vegAlto')) {
      const blades = id === 'vegAlto1' ? 5 : 4;
      for (let b = 0; b < blades; b++) {
        const bx = 1 + Math.round(b * (w - 3) / (blades - 1)), lean = (b - (blades - 1) / 2) * 0.35, top = Math.round((b % 2) * 4 + (id === 'vegAlto2' ? 0 : 2));
        for (let y = h - 1; y >= top; y--) {
          const t = (h - 1 - y) / (h - 1 - top), x = Math.round(bx + lean * (1 - t) * 0 + lean * t * 4);
          put(x, y, t > 0.75 ? G[6] : t > 0.45 ? G[5] : t > 0.2 ? G[4] : G[3]);
          if (t < 0.85) put(x + 1, y, t > 0.5 ? G[3] : G[2]);
        }
        put(Math.round(bx + lean * 4), top - 1, OUT);
      }
      for (let x = 0; x < w; x++) put(x, h - 1, G[1]);
    } else {
      // Helecho: tallo central curvo con hojuelas alternadas.
      const fronds = id === 'vegHelecho0' ? 3 : 2;
      for (let f = 0; f < fronds; f++) {
        const ang = -0.9 + f * (1.8 / Math.max(1, fronds - 1)), len = h - 2 - (f === 1 ? 0 : 2);
        for (let s = 0; s < len; s++) {
          const t = s / len, x = Math.round(w / 2 + Math.sin(ang) * s * 0.75 + Math.sin(t * 3) * 0.6), y = Math.round(h - 1 - Math.cos(ang * 0.6) * s);
          put(x, y, G[2]);
          if (s % 2 === 0 && t < 0.9) { const L = Math.round((1 - t) * 3) + 1; for (let q = 1; q <= L; q++) { put(x - q, y - (q >> 1), q === L ? G[5] : G[4]); put(x + q, y - (q >> 1), q === L ? G[4] : G[3]); } }
        }
      }
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
          float vw = aVeg.x, vt = aVeg.y, dist = distance(wp.xz, uVegCam.xy);
          float lod = 1.0 - smoothstep(uVegLod.x, uVegLod.y, dist), mid = 1.0 - smoothstep(uVegLod.y, uVegLod.y + 4.0, dist);
          float amp = vt < 1.5 ? 0.16 : vt < 2.5 ? 0.26 : vt < 3.5 ? 0.2 : vt < 4.5 ? 0.09 : 0.06;
          float freq = vt < 1.5 ? 1.9 : vt < 2.5 ? 1.4 : vt < 3.5 ? 1.0 : vt < 4.5 ? 3.2 : 0.8;
          float gust = 0.65 + 0.35 * sin(uVegCam.z * 0.27 + wp.x * 0.045 + wp.z * 0.03);
          float wind = sin(uVegCam.z * freq + wp.x * 0.55 + wp.z * 0.35 + aVeg.z * 6.2831) * uVegWind.z * gust;
          vec2 d = vec2(0.0);
          #ifdef TM_VEG_TEX
          vec2 tuv = (wp.xz - uVegWin.xy) / uVegWin.z;
          if (tuv.x > 0.0 && tuv.y > 0.0 && tuv.x < 1.0 && tuv.y < 1.0) d = (texture2D(uVegTex, tuv).rg * 2.0 - 1.0) * lod;
          #endif
          wp.x += (d.x * amp + (wind + uVegWind.w) * amp * 0.45 * mid * uVegWind.x) * vw;
          wp.z += d.y * amp * 0.45 * vw;
        }`;

  class Veg {
    constructor(app, cfg) {
      this.app = app; this.cfg = cfg; this.sim = new VegSim(cfg);
      this.acc = 0; this.prev = null; this.ent = new Map(); this.stats = { simMs: 0, uploads: 0, active: 0, plants: 0, frames: 0 };
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
    blast(x, y, r = 3, force = 9) { if (this.on) this.sim.impulse(x, y, r, force); }

    // ── Simulación (30 Hz fijos) ──
    tick(dt) {
      const a = this.app, s = a.session, av = s && s.avatar;
      if (!this.on || !av || a.mode !== 'game' || !s.world) return;
      this.sim.center(av.x, av.y);
      const C = this.cfg;
      // Jugador: posición, velocidad y dirección.
      if (this.prev) {
        const vx = (av.x - this.prev.x) / Math.max(dt, 1e-3), vy = (av.y - this.prev.y) / Math.max(dt, 1e-3), sp = Math.hypot(vx, vy);
        if (sp > 0.4 && sp < 40) this.sim.impulse(av.x, av.y + 0.1, C.player.radius, C.player.force * Math.min(1.6, sp / 4) * dt * 30, vx / sp, vy / sp);
        // Ataque cuerpo a cuerpo: abanico al frente.
        const atk = av.atk | 0;
        if (atk && atk !== this.lastAtk) {
          const fx = sp > 0.2 ? vx / sp : (this.face ? this.face[0] : 1), fy = sp > 0.2 ? vy / sp : (this.face ? this.face[1] : 0);
          this.sim.impulse(av.x + fx * 0.9, av.y + fy * 0.9, C.attack.radius, C.attack.force, fx, fy);
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
        if (m > 0.01 && m < 2) { const r = Math.max(0.6, (e.r || 0.4) * 1.3); this.sim.impulse(e.x, e.y, r, C.creature.force * Math.min(2, m / dt / 3) * (0.6 + r * 0.4) * dt * 30, mx / m, my / m); }
      }
      if (this.ent.size > 400) this.ent.clear();
      // Paso fijo.
      this.acc += Math.min(dt, 0.1);
      const h = 1 / C.hz, t0 = performance.now();
      while (this.acc >= h) { this.sim.step(h); this.acc -= h; this.dirty = true; }
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
      const gust = Math.max(0, Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1)) * C.wind.gust;
      U.uVegWind.value.set(1, 0, C.wind.strength * (0.7 + gust), gust * 0.6);
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
        const type = /^tuft/.test(k) ? 1 : /^vegAlto/.test(k) ? 2 : /^vegHelecho/.test(k) ? 3 : /^flowers/.test(k) ? 4 : /^bush/.test(k) ? 5 : 0;
        if (type) out.push({ type, u0: r.x / W, v0: r.y / H, u1: (r.x + r.w) / W, v1: (r.y + r.h) / H });
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
        g.clearRect(x, y, w, h); paintSprite(g, x, y, id, w, h);
        at.regions[id] = { x, y, w, h };
        x += w + 2;
      }
      v.atlasTex.needsUpdate = true; this._regs = null;
    }
    /** Zona controlada: pradera de pasto alto y helechos alrededor de la salida del valle. */
    buildZone(v) {
      const a = this.app, T = a.terrain; if (!T || T.id !== 'valle-alba' || !v.scene) return;
      const at = v.atlas, W = at.w || 512, H = at.h || 512, sp = (T.spawns && T.spawns[0]) || { x: T.w / 2, y: T.h / 2 };
      const Z = this.cfg.zone, pos = [], uvs = [], cols = [], vegs = [], idx = [];
      const free = (x, y) => !(T.obstacles || []).some(o => Math.abs(o.x - x) < (o.r || 0.3) + 0.5 && Math.abs(o.y - y) < (o.r || 0.3) + 0.5);
      const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
      let n = 0;
      for (let j = -Z.radius; j <= Z.radius && n < Z.max; j += 0.5) for (let i = -Z.radius; i <= Z.radius && n < Z.max; i += 0.5) {
        const x = sp.x + i + (hash(i, j) - 0.5) * 0.4, y = sp.y + j + (hash(j, i) - 0.5) * 0.4, d = Math.hypot(i, j);
        if (d < 3.5 || d > Z.radius) continue;
        const h0 = hash(i * 3.1, j * 1.7), fern = h0 < Z.fern, tall = !fern && h0 < Z.fern + Z.tall * (1 - d / Z.radius * 0.4);
        if (!fern && !tall) continue;
        const z = T.surfaceAt(x, y); if (z !== z || !free(x, y)) continue;
        if (T.kind && T.idx && T.inBounds(Math.floor(x), Math.floor(y)) && T.dirtAt && T.dirtAt(Math.floor(x), Math.floor(y))) continue;   // no sobre caminos
        const id = fern ? 'vegHelecho' + (h0 < Z.fern / 2 ? 0 : 1) : 'vegAlto' + Math.floor(hash(j, i * 2) * 3), r = at.regions[id]; if (!r) continue;
        // Mismo esquema de cuadrado que usan las plantas del mapa (horneado por el motor).
        const l = z + 0.01, c = Math.round(x * 16) / 16, hh = l - Math.round((l - y) * 16) / 16, u = r.w / 32, f = r.h / 32;
        const p0 = r.x / W, p1 = (r.x + r.w) / W, g0 = r.y / H, g1 = (r.y + r.h) / H, b = n * 4;
        pos.push(c - u, l, hh - f, c - u, l, hh + f, c + u, l, hh + f, c + u, l, hh - f);
        uvs.push(p0, g0, p0, g1, p1, g1, p1, g0);
        for (let q = 0; q < 4; q++) cols.push(1, 0, 0);
        const ph = hash(x, y), ty = fern ? 3 : 2;
        vegs.push(1, ty, ph, 0, ty, ph, 0, ty, ph, 1, ty, ph);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        n++;
      }
      if (!n) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).flatMap(() => [0, 1, 0]), 3));
      geo.setAttribute('aMask', new THREE.Float32BufferAttribute(new Array(n * 8).fill(-1), 2));
      geo.setAttribute('aVeg', new THREE.Float32BufferAttribute(vegs, 3));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, v.terrainMat); mesh.frustumCulled = false; mesh.name = 'vegetacion-zona';
      v.scene.add(mesh); this.zone = mesh; this.tagged.add(geo); this.stats.zonePlants = n;
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
