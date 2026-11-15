/* Torre Multiversal · «El mundo existe porque lo recorres» (beta) · 15-11-2026
 *
 * Idea del director: si el jugador se queda quieto, el mundo empieza a
 * olvidarlo y a fallar por etapas. Primero un arbusto, luego los árboles, las
 * piedras, las criaturas y por último el mundo entero. En cuanto se mueve,
 * todo vuelve de golpe a la normalidad.
 *
 * Historia (opción 1): la Torre arma cada multiverso alrededor del viajero.
 * Si dejas de moverte, deja de sostenerlo y el mundo se deshace.
 *
 * Recompensa: con el mundo roto aparece una Grieta en el suelo, visible solo
 * mientras estás quieto. Si caminas hasta ella y vuelves a quedarte quieto
 * encima, se abre: Fragmento de Realidad, una línea de la historia y vida
 * completa.
 * Peligro: si sigues quieto, «el Olvido» te va borrando (daño creciente).
 *
 * Solo visual en cooperativo; recompensa y peligro solo en partida individual.
 * No se activa en menús, combate, jefe ni cinemáticas. Se activa con ?glitch=1.
 */
(function (root) {
  'use strict';

  // ════════════════════════════════════════════════════════════════════
  // 1. Reglas puras (probadas con node --test)
  // ════════════════════════════════════════════════════════════════════
  const STAGES = Object.freeze([
    Object.freeze({ at: 0, id: 'calma' }),
    Object.freeze({ at: 20, id: 'arbusto' }),
    Object.freeze({ at: 35, id: 'arboles' }),
    Object.freeze({ at: 50, id: 'piedras' }),
    Object.freeze({ at: 65, id: 'criaturas' }),
    Object.freeze({ at: 80, id: 'mundo' }),
    Object.freeze({ at: 100, id: 'olvido' })
  ]);
  const MOVE_EPS = 0.3;      // unidades: más que esto desde el punto de anclaje = te moviste
  const GRIETA_OPEN = 8;     // segundos quieto encima de la Grieta para abrirla
  const LORE = Object.freeze([
    'El mundo existe porque lo recorres.',
    'Cada paso tuyo le recuerda a la Torre que aquí hay alguien.',
    'Quieto, el multiverso deja de dibujarte… y empieza a olvidar.',
    'Lo primero que se olvida es lo pequeño: un arbusto, una sombra.',
    'Si todo se detiene, la Torre ya no distingue a un viajero de una piedra.'
  ]);
  function stageOf(sec) { let s = 0; for (let i = 0; i < STAGES.length; i++) if (sec >= STAGES[i].at) s = i; return s; }
  /** Intensidad 0..1 de una etapa: crece en 8 s desde que empieza. */
  function ramp(sec, i) { return i <= 0 ? 0 : Math.max(0, Math.min(1, (sec - STAGES[i].at) / 8)); }
  /** Daño del Olvido por golpe (uno cada 2 s): crece mientras sigas quieto. */
  function erosion(sec) { return sec < STAGES[6].at ? 0 : 1 + Math.floor((sec - STAGES[6].at) / 15); }
  function moved(anchor, x, y) { return Math.hypot(x - anchor.x, y - anchor.y) > MOVE_EPS; }
  function loreLine(n) { return n < LORE.length ? LORE[n] : `Fragmento de Realidad n.º ${n + 1}. La Torre te recuerda un poco más.`; }

  const API = { STAGES, MOVE_EPS, GRIETA_OPEN, LORE, stageOf, ramp, erosion, moved, loreLine };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root.document) return;

  // ════════════════════════════════════════════════════════════════════
  // 2. Shader del terreno: arbustos, árboles, piedras y suelo que fallan
  // ════════════════════════════════════════════════════════════════════
  const REGIONS = [['bush0', 1], ['bush1', 1], ['bush2', 1], ['oak', 2], ['broad0', 2], ['broad1', 2], ['broad2', 2], ['pine0', 2], ['pine1', 2], ['arch', 2], ['boulder0', 3], ['boulder1', 3]];
  const VERT_HEAD = `
      uniform vec4 uGlRect[12]; uniform float uGlCat[12];
      uniform vec4 uGlA; uniform vec4 uGlB; uniform vec4 uGlC; uniform float uGlShift;
      varying float vGl;
      float glCat(vec2 q) {
        for (int i = 0; i < 12; i++) {
          vec4 r = uGlRect[i];
          if (q.x >= r.x - 0.001 && q.x <= r.z + 0.001 && q.y >= r.y - 0.001 && q.y <= r.w + 0.001) return uGlCat[i];
        }
        return 0.0;
      }`;
  const VERT_BODY = `
        float cat = glCat(uv); if (cat == 0.0 && uGlShift > 0.0) cat = glCat(uv - vec2(uGlShift, 0.0));
        float d = distance(wp.xz, uGlB.xy), g = 0.0;
        if (cat == 1.0) g = max(g, (1.0 - step(uGlA.z, distance(wp.xz, uGlA.xy))) * uGlA.w);
        if (cat >= 1.0 && cat <= 2.0) g = max(g, (1.0 - smoothstep(uGlB.z * 0.75, uGlB.z, d)) * uGlB.w);
        if (cat == 3.0) g = max(g, (1.0 - smoothstep(uGlC.x * 0.75, uGlC.x, d)) * uGlC.y);
        g = max(g, (1.0 - smoothstep(uGlC.z * 0.7, uGlC.z, d)) * uGlC.w);
        vGl = g;`;
  const FRAG_HEAD = `
      uniform float uGlT; varying float vGl;
      float glH(float n) { return fract(sin(n) * 43758.5453); }`;
  const FRAG_UV = `
        if (vGl > 0.01) {
          float row = floor((gl_FragCoord.y + uCamPx.y) / 3.0), tt = floor(uGlT * 10.0);
          float h1 = glH(row * 12.9898 + tt * 78.233);
          if (h1 < vGl * 0.55) uv.x += (glH(h1 * 91.7) - 0.5) * 0.045 * vGl;
          if (h1 > 1.0 - vGl * 0.12) uv.y += (glH(h1 * 37.1) - 0.5) * 0.03;
        }`;
  const FRAG_COLOR = `
        if (vGl > 0.01) {
          vec2 bk = floor((gl_FragCoord.xy + uCamPx) / 4.0);
          float h2 = glH(dot(bk + floor(uGlT * 8.0), vec2(27.1, 61.7)));
          if (h2 < vGl * 0.2) c = c.gbr;
          else if (h2 > 1.0 - vGl * 0.08) c = vec3(1.0) - c;
          c = mix(c, floor(c * 4.0) / 4.0, vGl * 0.6);
        }`;

  function patchTerrain(view) {
    const m = view && view.terrainMat, atlas = view && view.atlas;
    if (!m || !atlas || !atlas.regions || m.__tmGlitch) return m && m.__tmGlitch ? m : null;
    let vs = m.vertexShader, fs = m.fragmentShader;
    const a1 = 'void main() {', a2 = 'vWp = wp.xyz;', b1 = 'vec4 t = texture2D(map, uv);', b2 = 'gl_FragColor = vec4(c, 1.0);';
    if (vs.indexOf(a1) < 0 || vs.indexOf(a2) < 0 || fs.indexOf(b1) < 0 || fs.indexOf(b2) < 0) return null; // motor distinto: sin glitch del terreno
    vs = vs.replace(a1, VERT_HEAD + '\n      ' + a1).replace(a2, a2 + VERT_BODY);
    const fi = fs.indexOf('void main()');
    fs = fs.slice(0, fi) + FRAG_HEAD + '\n      ' + fs.slice(fi);
    fs = fs.replace(b1, FRAG_UV + '\n        ' + b1).replace(b2, FRAG_COLOR + '\n        ' + b2);
    const W = atlas.w || 512, H = atlas.h || 512;
    const rects = [], cats = [];
    for (const [k, c] of REGIONS) {
      const r = atlas.regions[k];
      rects.push(r ? new THREE.Vector4(r.x / W, r.y / H, (r.x + r.w) / W, (r.y + r.h) / H) : new THREE.Vector4(-1, -1, -1, -1));
      cats.push(r ? c : 0);
    }
    Object.assign(m.uniforms, {
      uGlRect: { value: rects }, uGlCat: { value: cats }, uGlA: { value: new THREE.Vector4() }, uGlB: { value: new THREE.Vector4() },
      uGlC: { value: new THREE.Vector4() }, uGlT: { value: 0 }, uGlShift: { value: m.uniforms.uShiftB ? m.uniforms.uShiftB.value : 0 }
    });
    m.vertexShader = vs; m.fragmentShader = fs; m.needsUpdate = true; m.__tmGlitch = m;
    return m;
  }

  // ════════════════════════════════════════════════════════════════════
  // 3. Controlador
  // ════════════════════════════════════════════════════════════════════
  const now = () => (root.performance ? root.performance.now() : Date.now());
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  class Glitch {
    constructor(app) {
      this.app = app; this.idle = 0; this.anchor = null; this.stage = 0; this.prevStage = 0;
      this.bush = null; this.grieta = null; this.onGrieta = 0; this.erodeT = 0; this.mat = null; this.view = null;
      this.saved = []; this.fxT = 0; this.warned = false;
      this.initDom(); this.hook();
    }
    // ── Guardado de la recompensa (almacenamiento beta, por perfil) ──
    key() { return 'tm.glitch.' + ((this.app.data && this.app.data.profile && this.app.data.profile.id) || 'x'); }
    shards() { try { const st = root.__TM_BETA_STORAGE__; const v = st && st.getItem ? +st.getItem(this.key()) : 0; return Number.isFinite(v) ? v : 0; } catch (_) { return 0; } }
    setShards(n) { try { const st = root.__TM_BETA_STORAGE__; if (st && st.setItem) st.setItem(this.key(), String(n)); } catch (_) { /* opcional */ } }

    initDom() {
      const go = () => {
        const css = document.createElement('style'); css.id = 'tm-glitch-css';
        css.textContent = `
.tm-gl-veil { position:fixed; inset:0; z-index:25; pointer-events:none; opacity:0; mix-blend-mode:screen;
  background: repeating-linear-gradient(0deg, rgba(255,0,140,.10) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,255,230,.06) 0 1px, transparent 1px 4px); }
.tm-gl-tear { position:fixed; left:0; right:0; z-index:26; pointer-events:none; height:6px; background:linear-gradient(90deg,#ff2a8a,#2affea 40%,#ffffff 50%,#ff2a8a 70%,transparent); opacity:0; }
.tm-gl-erase { position:fixed; inset:0; z-index:27; pointer-events:none; opacity:0; background:radial-gradient(circle at 50% 50%, transparent 25%, rgba(240,240,255,.85) 95%); }
body.tm-gl-5 .hud { animation: tmGlHud .18s steps(2) infinite; }
body.tm-gl-snap canvas { animation: tmGlSnap .28s steps(4) 1; }
@keyframes tmGlHud { 0% { transform:translate(0,0) } 50% { transform:translate(2px,-1px) skewX(-2deg) } 100% { transform:translate(-1px,1px) } }
@keyframes tmGlSnap { 0% { filter:invert(1) hue-rotate(90deg) } 50% { filter:saturate(3) contrast(1.6) } 100% { filter:none } }
@media (prefers-reduced-motion: reduce) { body.tm-gl-5 .hud { animation:none } body.tm-gl-snap canvas { animation:none } }`;
        document.head.append(css);
        this.veil = Object.assign(document.createElement('div'), { className: 'tm-gl-veil' });
        this.tears = [0, 1, 2].map(() => Object.assign(document.createElement('div'), { className: 'tm-gl-tear' }));
        this.erase = Object.assign(document.createElement('div'), { className: 'tm-gl-erase' });
        document.body.append(this.veil, ...this.tears, this.erase);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
    }
    hook() {
      const a = this.app, self = this;
      const step = a._step;
      a._step = function (dt) { const r = step.call(a, dt); try { self.tick(dt); } catch (e) { self.fail(e); } return r; };
      const render = a._render;
      a._render = function () {
        const r = render.apply(a, arguments);
        if (a.pr && !a.pr.__tmGlitchPatched) {
          const pr = a.pr, fn = pr.render;
          pr.render = function () {
            try { self.before(); } catch (e) { self.fail(e); }
            const out = fn.apply(pr, arguments);
            try { self.after(); } catch (e) { self.fail(e); }
            return out;
          };
          pr.__tmGlitchPatched = true;
        }
        return r;
      };
    }
    /** El daño del Olvido entra dentro del paso del mundo, como cualquier golpe. */
    hookWorld(w) {
      if (!w || w.__tmGlitch) return; w.__tmGlitch = true;
      const self = this, step = w.step;
      w.step = function () {
        const r = step.apply(this, arguments);
        if (self.pendingDmg) { this.playerHits.push(self.pendingDmg); self.pendingDmg = null; }
        return r;
      };
    }
    fail(e) { if (this._f) return; this._f = true; console.error('Glitch beta:', e); setTimeout(() => { this._f = false; }, 4000); }

    // ── ¿Cuenta el tiempo quieto? ──
    calm() {
      const a = this.app, s = a.session;
      if (a.mode !== 'game' || !s || s.state !== 'playing' || !s.avatar || !s.world) return false;
      if (a._overlayOpen && a._overlayOpen()) return false;
      if (s.isDown && s.isDown(s.self.pid)) return false;
      const rey = root.__TM_REY_CONTROLLER__;
      if (rey && (rey.actor || rey.cine)) return false;
      const pid = s.self.pid, av = s.avatar;
      for (const e of s.world.entities) if (!e.dead && e.foe && e.ag === pid && Math.hypot(e.x - av.x, e.y - av.y) < 9) return false; // en combate
      return true;
    }
    solo() { const s = this.app.session; return !!(s && !s.channel && s.isHost); }

    tick(dt) {
      const a = this.app, s = a.session, av = s && s.avatar;
      if (!av) { this.reset(false); return; }
      if (!this.anchor) this.anchor = { x: av.x, y: av.y };
      this.clock = (this.clock || 0) + dt;
      // El empujón del propio Olvido no cuenta como moverse.
      if (this.stage >= 6 && this.clock - (this.hitAt || -9) < 0.8) this.anchor = { x: av.x, y: av.y };
      if (API.moved(this.anchor, av.x, av.y)) { this.reset(this.stage >= 1); this.anchor = { x: av.x, y: av.y }; this.checkGrieta(av); return; }
      if (!this.calm()) { if (this.stage >= 1 && !this.app._overlayOpen()) this.reset(true); return; }
      this.idle += dt;
      this.stage = API.stageOf(this.idle);
      if (this.stage !== this.prevStage) this.enter(this.stage);
      this.prevStage = this.stage;
      // Grieta: se abre si te quedas quieto encima.
      const g = this.grieta;
      if (g && this.solo() && Math.hypot(av.x - g.x, av.y - g.y) < 1.2) {
        this.onGrieta += dt;
        if (this.onGrieta >= GRIETA_OPEN) this.openGrieta();
      }
      // El Olvido: daño creciente cada 2 s.
      if (this.stage >= 6 && this.solo()) {
        if (!this.warned) { this.warned = true; this.toast('El mundo te está olvidando. ¡Muévete!', 'bad'); }
        this.erodeT -= dt;
        if (this.erodeT <= 0) {
          this.erodeT = 2;
          const dmg = API.erosion(this.idle);
          this.hookWorld(s.world);
          this.pendingDmg = { pid: s.self.pid, dmg, id: 0, x: av.x, y: av.y, st: null, dps: 0 };
          this.hitAt = this.clock;
          this.sfx('erase');
        }
      }
      // Sonido de estática ocasional.
      this.fxT -= dt;
      if (this.stage >= 1 && this.fxT <= 0) { this.fxT = 2.5 + Math.random() * 3 - this.stage * 0.3; this.sfx('crackle'); }
    }
    enter(st) {
      if (st === 1) {
        // El arbusto más cercano es el primero en fallar.
        const T = this.app.terrain, av = this.app.session.avatar;
        let best = null, bd = 7;
        for (const p of (T && T.props) || []) if (p.type === 'bush') { const d = Math.hypot(p.x - av.x, p.y - av.y); if (d < bd) { bd = d; best = p; } }
        this.bush = best;
        this.sfx('crackle');
      }
      if (st === 3 && this.solo() && !this.grieta) this.placeGrieta();
      if (st === 5 && this.app.audio && this.app.audio.buses) this.duck(true);
      if (st >= 5) document.body.classList.add('tm-gl-5');
    }
    reset(snap) {
      if (snap) {
        this.sfx('snap');
        if (!reduced()) { document.body.classList.remove('tm-gl-snap'); void document.body.offsetWidth; document.body.classList.add('tm-gl-snap'); setTimeout(() => document.body.classList.remove('tm-gl-snap'), 320); }
      }
      if (this.stage >= 5) this.duck(false);
      this.idle = 0; this.stage = 0; this.prevStage = 0; this.bush = null; this.erodeT = 0; this.warned = false; this.onGrieta = 0;
      document.body.classList.remove('tm-gl-5');
    }

    // ── Grieta (recompensa) ──
    placeGrieta() {
      const T = this.app.terrain, av = this.app.session.avatar, z0 = T.surfaceAt(av.x, av.y);
      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2, r = 4.5 + Math.random() * 2.5, x = av.x + Math.cos(ang) * r, y = av.y + Math.sin(ang) * r;
        const z = T.surfaceAt(x, y);
        if (z !== z || Math.abs(z - z0) > 0.01) continue;
        if ((T.obstacles || []).some(o => Math.hypot(o.x - x, o.y - y) < (o.r || 0.3) + 0.6)) continue;
        if (T.componentAt && T.componentAt(x, y) !== T.componentAt(av.x, av.y)) continue;
        this.grieta = { x, y, z, born: now() };
        this.sfx('reveal');
        return;
      }
    }
    checkGrieta(av) {
      // La Grieta dura 3 minutos si no se abre.
      if (this.grieta && now() - this.grieta.born > 180000) this.grieta = null;
    }
    openGrieta() {
      const n = this.shards(); this.setShards(n + 1);
      const s = this.app.session, v = s.selfVital && s.selfVital();
      if (v && v.maxHp) v.hp = v.maxHp;
      this.grieta = null; this.onGrieta = 0;
      this.sfx('open');
      this.toast(`Fragmento de Realidad (${n + 1}). «${API.loreLine(n)}»`, 'gold', 7000);
      this.reset(true);
    }
    toast(t, kind = 'gold', ms = 4200) { if (this.app.ui && this.app.ui.toast) this.app.ui.toast(t, kind, ms); }

    // ── Dibujo: antes y después del render del motor ──
    before() {
      const a = this.app, view = a.view, s = a.session;
      if (!view || !s || !s.avatar) return;
      if (this.view !== view) { this.view = view; this.mat = patchTerrain(view); this.grietaMesh = null; }
      const st = this.stage, k = i => API.ramp(this.idle, i) * (reduced() ? 0.5 : 1), av = s.avatar, t = now() / 1000;
      const U = this.mat && this.mat.uniforms;
      if (U && U.uGlA) {
        U.uGlT.value = t;
        if (U.uShiftB) U.uGlShift.value = U.uShiftB.value;
        const b = this.bush;
        U.uGlA.value.set(b ? b.x : 0, b ? b.y : 0, b ? 0.9 : 0, st >= 1 && b ? Math.max(k(1), 0.35) * (0.6 + 0.4 * Math.sin(t * 9)) : 0);
        U.uGlB.value.set(av.x, av.y, 2.5 + 5.5 * k(2), st >= 2 ? k(2) : 0);
        U.uGlC.value.set(2.5 + 5.5 * k(3), st >= 3 ? k(3) : 0, 3 + 6 * k(5), st >= 5 ? 0.45 * k(5) + (st >= 6 ? 0.3 : 0) : 0);
      }
      // Criaturas: tiemblan, cambian de color y parpadean (se restaura tras dibujar).
      this.saved.length = 0;
      if (st >= 4 && view.entityVis) {
        const kk = k(4);
        for (const [id, vis] of view.entityVis) {
          const sp = vis && vis.sprite, u = sp && sp.material && sp.material.uniforms;
          if (!sp || !sp.visible) continue;
          const e = s.world.entities.find(x => x.id === id);
          if (!e || Math.hypot(e.x - av.x, e.y - av.y) > 3 + 7 * kk) continue;
          this.saved.push({ sp, x: sp.position.x, vis: sp.visible, tint: u && u.uTint ? u.uTint.value.clone() : null, u });
          const h = Math.sin(id * 12.9898 + Math.floor(t * 10) * 78.233) * 43758.5453 % 1;
          if (Math.abs(h) < 0.35 * kk) sp.position.x += (h > 0 ? 2 : -2) / 16;
          if (u && u.uTint && Math.abs(h) < 0.5 * kk) u.uTint.value.set(h > 0 ? 1 : 0, 1, h > 0 ? 0.6 : 1, 0.55);
          if (Math.abs(h) > 1 - 0.08 * kk) sp.visible = false;
        }
      }
      this.drawGrieta(view, t);
      // Mundo: velo de líneas, desgarros y borrado.
      const wk = st >= 5 ? k(5) : 0;
      if (this.veil) {
        this.veil.style.opacity = String(wk * 0.8);
        this.tears.forEach((el, i) => {
          const on = wk > 0 && !reduced() && Math.sin(t * (7 + i * 3) + i * 2) > 0.85 - wk * 0.3;
          el.style.opacity = on ? '0.7' : '0';
          if (on) { el.style.top = `${(Math.sin(t * 13 + i * 5) * 0.5 + 0.5) * 100}%`; el.style.transform = `translateX(${Math.sin(t * 40 + i) * 12}px)`; }
        });
        this.erase.style.opacity = String(st >= 6 ? Math.min(0.85, 0.25 + (this.idle - STAGES[6].at) / 40) : 0);
      }
    }
    after() {
      for (const r of this.saved) {
        r.sp.position.x = r.x; r.sp.visible = r.vis;
        if (r.tint && r.u && r.u.uTint) r.u.uTint.value.copy(r.tint);
      }
      this.saved.length = 0;
    }
    drawGrieta(view, t) {
      const g = this.grieta, show = g && this.solo() && (this.stage >= 3 || this.onGrieta > 2.5);
      if (!this.grietaMesh && show) {
        const c = document.createElement('canvas'); c.width = 32; c.height = 48;
        const x = c.getContext('2d');
        for (let i = 0; i < 70; i++) {
          const yy = Math.floor(Math.random() * 46), w = 1 + Math.floor(Math.random() * 3);
          const xx = 16 + Math.round(Math.sin(yy * 0.6) * 4 + (Math.random() - 0.5) * 6);
          x.fillStyle = ['#ff2a8a', '#2affea', '#ffffff', '#9b6bff'][i % 4]; x.fillRect(xx, yy, w, 1 + (i % 2));
        }
        const tex = new THREE.CanvasTexture(c); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const geo = new THREE.PlaneGeometry(2, 3); geo.translate(0, 1.5, 0);
        this.grietaMesh = new THREE.Mesh(geo, mat); this.grietaMesh.renderOrder = 3; this.grietaMesh.frustumCulled = false;
        view.scene.add(this.grietaMesh);
      }
      const m = this.grietaMesh; if (!m) return;
      m.visible = !!show;
      if (!show) return;
      const SQ = Math.SQRT1_2, z = g.z, open = Math.min(1, this.onGrieta / GRIETA_OPEN);
      m.position.set(Math.round((g.x + Math.sin(t * 30) * 0.03) * 16) / 16, z + 0.35 * SQ, z - Math.round((z - g.y) * 16) / 16 + 0.35 * SQ);
      const sc = 0.7 + open * 0.8 + Math.sin(t * 6) * 0.05;
      m.scale.set(sc * (Math.floor(t * 12) % 5 ? 1 : 1.4), sc, 1);
      m.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(t * 5));
    }

    // ── Sonido (bus de efectos del juego) ──
    duck(on) {
      const au = this.app.audio; if (!au || !au.buses || !au.ctx) return;
      try {
        if (on) { const g = au.buses.music.gain, c = au.ctx.currentTime; g.cancelScheduledValues(c); g.setValueAtTime(g.value, c); g.linearRampToValueAtTime(g.value * 0.3, c + 2); }
        else if (au.setVolumes) au.setVolumes(au.vol);
      } catch (_) { /* audio opcional */ }
    }
    sfx(kind) {
      const au = this.app.audio, c = au && au.ctx, out = au && au.buses && au.buses.sfx;
      if (!c || !out) return;
      try {
        const t = c.currentTime;
        const tone = (type, f0, f1, dur, vol, at = 0) => {
          const o = c.createOscillator(), g = c.createGain();
          o.type = type; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + at + dur);
          g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(vol, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
          o.connect(g); g.connect(out); o.start(t + at); o.stop(t + at + dur + 0.05);
        };
        const noise = (dur, vol, f, at = 0) => {
          if (!au.noiseBuf) return;
          const n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
          n.buffer = au.noiseBuf; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 2;
          g.gain.setValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
          n.connect(fl); fl.connect(g); g.connect(out); n.start(t + at, Math.random() * 0.1); n.stop(t + at + dur + 0.02);
        };
        if (kind === 'crackle') { for (let i = 0; i < 3 + this.stage; i++) noise(0.03, 0.05 + this.stage * 0.01, 1500 + Math.random() * 4000, Math.random() * 0.3); }
        else if (kind === 'snap') { tone('square', 1800, 90, 0.12, 0.06); noise(0.08, 0.12, 900); }
        else if (kind === 'reveal') { [0, 0.09, 0.18].forEach((at, i) => tone('triangle', 330 * (i + 1), 660 * (i + 1), 0.25, 0.05, at)); }
        else if (kind === 'erase') { tone('sawtooth', 120, 40, 0.5, 0.06); noise(0.4, 0.08, 400); }
        else if (kind === 'open') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('sine', f, f * 1.01, 0.6, 0.07, i * 0.08)); noise(0.3, 0.06, 3000); }
      } catch (_) { /* audio opcional */ }
    }
  }

  root.__TM_GLITCH_API__ = API;
  root.__TM_GLITCH_INSTALL__ = function (app) {
    try { root.__TM_GLITCH__ = new Glitch(app); } catch (e) { console.error('Glitch beta:', e); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
