/* Torre Multiversal · Rey Slime (beta · solo) · v2 · 13-11-2026
 *
 * Base de reglas: primera integración (ChatGPT, acb7eae). Se conservan el
 * ritual de diez limos, la mezcla de colores, el perdón/arma y el guardado.
 *
 * Esta versión añade:
 *  - Santuario de la Corona: lugar fijo en un claro del bosque del Valle del
 *    Alba (fuera de la Torre). Diez pedestales con colisión; los limos
 *    colocados se ven en ellos. El ritual se abre con USAR estando ahí.
 *  - Cinemática de fusión con cámara, runas, saltos, crecimiento de la masa,
 *    caída de la corona, rugido y presentación del jefe (se puede saltar).
 *  - Rey Slime fase 1 con IA propia: saltos, embestida (se aturde si choca
 *    con un árbol), salto aplastante con aviso en el suelo, rebote corto y
 *    llamado de súbditos. Todo avisado con tiempo para esquivar en el celular.
 *  - v3 (14-11-2026): Formas II y III, transformaciones y director de clones
 *    en rey-combate.js (enganchado aquí con `this.forms`).
 *  - Barra de jefe, música propia, derrota animada y elección con «mantener
 *    pulsado» (sin ventanas del navegador).
 *  - Aliado que salta detrás del jugador y ataca con animación.
 *
 * Seguridad: solo partida individual, nunca cooperativo. No toca la economía
 * verificada ni Supabase. El guardado sigue pasando por progress.reySlime.
 */
(function (root) {
  'use strict';

  // ════════════════════════════════════════════════════════════════════════
  // 1. Reglas puras (probadas con node --test)
  // ════════════════════════════════════════════════════════════════════════
  const HUES = Object.freeze(['verde', 'azul', 'rosa']);
  const WEAPONS = Object.freeze(['hoja-rey-slime', 'cetro-rey-slime', 'dagas-rey-slime']);
  const WEAPON_INFO = Object.freeze({
    'hoja-rey-slime': { name: 'Hoja del Rey Slime', kind: 'Espada larga · Arcano' },
    'cetro-rey-slime': { name: 'Cetro del Rey Slime', kind: 'Báculo · Arcano' },
    'dagas-rey-slime': { name: 'Dagas del Rey Slime', kind: 'Dagas · Arcano' }
  });
  const LIMIT = 10;
  const BOSS_ID_MIN = 57000, BOSS_ID_MAX = 57099, MINION_ID_MIN = 57100, MINION_ID_MAX = 57199;
  const $ = id => root.document && root.document.getElementById(id);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+x) ? +x : lo));

  // Ficha completa de la mascota, con los mismos campos que guarda el motor.
  // Se conserva para devolver EXACTAMENTE la misma criatura si se retira.
  function petRecord(pet) {
    if (!pet || typeof pet !== 'object' || typeof pet.uid !== 'string' || !/^[a-z0-9]{4,16}$/.test(pet.uid) || pet.species !== 'limo' || !HUES.includes(pet.hue)) return null;
    const r = { uid: pet.uid, species: 'limo', hue: pet.hue };
    if (typeof pet.name === 'string' && pet.name.length <= 24) r.name = pet.name; else r.name = null;
    r.bond = Number.isInteger(pet.bond) ? Math.max(0, Math.min(50, pet.bond)) : 0;
    r.at = Number.isFinite(pet.at) ? Math.max(0, pet.at) : 0;
    if (pet.hp !== undefined) r.hp = Number.isFinite(pet.hp) ? Math.max(0, Math.min(100, pet.hp)) : pet.hp;
    if (Number.isInteger(pet.el)) r.el = pet.el;
    return r;
  }
  function validPiece(p) {
    if (!p || typeof p !== 'object' || !/^[a-z0-9]{4,16}$/.test(p.uid || '') || !HUES.includes(p.hue)) return null;
    const q = { uid: p.uid, hue: p.hue, bond: Math.floor(clamp(p.bond, 0, 50)), lv: Math.floor(clamp(p.lv, 1, 20)), el: Math.floor(clamp(p.el, 0, 511)) };
    const pet = petRecord(p.pet);
    if (pet && pet.uid === q.uid && pet.hue === q.hue) q.pet = pet;
    return q;
  }
  function normalize(raw) {
    const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const seen = new Set(), pieces = [];
    for (const p of Array.isArray(o.pieces) ? o.pieces.slice(0, LIMIT) : []) {
      const q = validPiece(p);
      if (q && !seen.has(q.uid)) { pieces.push(q); seen.add(q.uid); }
    }
    const r = { v: 1, pieces, cycle: Math.floor(clamp(o.cycle, 0, 100000)), stage: 'collect', king: null, ally: null, history: [] };
    const k = o.king;
    if (k && typeof k === 'object' && HUES.includes(k.hue) && Array.isArray(k.mix) && k.mix.length === 3) {
      const mix = k.mix.map(x => Math.floor(clamp(x, 0, LIMIT)));
      if (mix.reduce((a, b) => a + b, 0) === LIMIT) {
        r.king = {
          hue: k.hue, mix, level: Math.floor(clamp(k.level, 1, 20)), seed: Math.floor(clamp(k.seed, 1, 2147483647)),
          x: clamp(k.x, 0, 4096), y: clamp(k.y, 0, 4096),
          world: typeof k.world === 'string' && /^(?:valle-alba|sala-pruebas|torre-[1-9][0-9]{0,2})$/.test(k.world) ? k.world : 'valle-alba',
          hp: Math.floor(clamp(k.hp, 0, 2000)), maxHp: Math.floor(clamp(k.maxHp, 1, 2000)),
          atk: Math.floor(clamp(k.atk, 1, 120)), speed: clamp(k.speed, 0.5, 4), prism: k.prism === true
        };
        if (['battle', 'decision'].includes(o.stage)) r.stage = o.stage;
      }
    }
    const a = o.ally;
    if (a && typeof a === 'object' && HUES.includes(a.hue)) r.ally = {
      hue: a.hue, mix: Array.isArray(a.mix) && a.mix.length === 3 ? a.mix.map(v => Math.floor(clamp(v, 0, 10))) : [10, 0, 0],
      level: Math.floor(clamp(a.level, 1, 20)), seed: Math.floor(clamp(a.seed, 1, 2147483647)), prism: a.prism === true
    };
    for (const h of Array.isArray(o.history) ? o.history.slice(-12) : []) {
      if (h && ['aliado', ...WEAPONS].includes(h.reward) && Number.isInteger(h.seed)) r.history.push({ seed: Math.floor(clamp(h.seed, 1, 2147483647)), reward: h.reward });
    }
    return r;
  }
  function levelOf(p) { return Math.max(1, Math.min(20, (p.lv || 1) + Math.floor((p.bond || 0) / 12) + (p.el ? 2 : 0))); }
  function compose(pieces, seed = 1) {
    if (!Array.isArray(pieces) || pieces.length !== LIMIT) throw Error('El ritual necesita exactamente diez fragmentos.');
    const ps = pieces.map(validPiece);
    if (ps.some(p => !p) || new Set(ps.map(p => p.uid)).size !== LIMIT) throw Error('Los fragmentos deben ser diez slimes distintos.');
    const mix = HUES.map(h => ps.filter(p => p.hue === h).length);
    const primary = colorsOf(mix).hue === 'verde' ? 0 : colorsOf(mix).hue === 'azul' ? 1 : 2;
    const level = Math.min(20, Math.max(1, Math.round(ps.reduce((sum, p) => sum + levelOf(p), 0) / 10)));
    const maxHp = Math.min(2000, 360 + level * 28 + mix[1] * 19);
    const atk = Math.min(120, 13 + level * 3 + mix[2] * 2);
    const speed = clamp(1.15 + mix[2] * 0.10, 1, 2.4);
    return { hue: HUES[primary], mix, level, seed: Math.max(1, seed | 0), maxHp, hp: maxHp, atk, speed, prism: mix.every(n => n > 0) };
  }
  // Apariencia según la mezcla: color dominante, híbrido si los dos primeros
  // empatan, y vetas de los colores secundarios. (El linaje es otro sistema.)
  function colorsOf(mix) {
    const m = Array.isArray(mix) && mix.length === 3 ? mix.map(n => Math.max(0, n | 0)) : [10, 0, 0];
    const order = [0, 1, 2].sort((a, b) => m[b] - m[a] || a - b);
    const hybrid = m[order[0]] > 0 && m[order[0]] === m[order[1]] ? [HUES[order[0]], HUES[order[1]]] : null;
    const veins = order.slice(hybrid ? 2 : 1).filter(i => m[i] > 0).map(i => HUES[i]);
    return { hue: HUES[order[0]], hybrid, veins };
  }
  // Mezcla parcial para el «presagio» (con menos de diez limos).
  function partialMix(pieces) { return HUES.map(h => pieces.filter(p => p.hue === h).length); }
  function chooseWeapon(seed) { return WEAPONS[Math.abs(seed | 0) % WEAPONS.length]; }
  function takePiece(state, pets, uid) {
    if (state.stage !== 'collect') throw Error('El ritual actual ya está en curso.');
    if (state.pieces.length === LIMIT) throw Error('Las diez posiciones están ocupadas.');
    const i = pets.findIndex(p => p.uid === uid && p.species === 'limo' && HUES.includes(p.hue));
    if (i < 0) throw Error('Solo puedes colocar slimes que has domesticado.');
    const pet = pets[i];
    if (state.pieces.some(p => p.uid === uid)) throw Error('Ese slime ya forma parte del ritual.');
    const piece = validPiece({ uid: pet.uid, hue: pet.hue, bond: pet.bond || 0, lv: pet.lv || 1, el: pet.el || 0, pet: petRecord(pet) });
    if (!piece) throw Error('Los datos de esta mascota no son válidos.');
    state.pieces.push(piece); pets.splice(i, 1);
    return piece;
  }
  function giveBack(state, pets, index) {
    if (state.stage !== 'collect') throw Error('No se puede retirar un fragmento después de invocar.');
    if (!Number.isInteger(index) || index < 0 || index >= state.pieces.length) throw Error('Posición vacía.');
    if (pets.length >= 12) throw Error('No hay espacio para devolverlo al inventario de mascotas.');
    if (pets.some(p => p.uid === state.pieces[index].uid)) throw Error('Ese limo ya está en tu inventario.');
    const [piece] = state.pieces.splice(index, 1);
    // Se devuelve la ficha original intacta (nombre, vida, fecha de captura…).
    // Solo las piezas guardadas por la versión anterior, sin ficha, se rehacen.
    pets.push(piece.pet ? JSON.parse(JSON.stringify(piece.pet)) : { uid: piece.uid, species: 'limo', hue: piece.hue, name: null, bond: piece.bond, at: 0, ...(piece.el ? { el: piece.el } : {}) });
    return piece;
  }
  function labels(mix) { return HUES.map((h, i) => `${h}: ${mix[i]}`).join(' · '); }
  function color(h) { return h === 'azul' ? '#72b0ee' : h === 'rosa' ? '#f08cc0' : '#8ddb6a'; }
  const ADJ = { verde: 'verde', azul: 'azul', rosa: 'rosa' }, PLURAL = { verde: 'verdes', azul: 'azules', rosa: 'rosas' };
  function variantName(k) {
    if (!k) return '';
    const c = colorsOf(k.mix || (k.hue ? HUES.map(h => (h === k.hue ? 10 : 0)) : null));
    const base = c.hybrid ? `híbrido ${ADJ[c.hybrid[0]]} y ${ADJ[c.hybrid[1]]}` : ADJ[c.hue];
    const veins = c.veins.length ? ` con vetas ${c.veins.map(h => PLURAL[h]).join(' y ')}` : '';
    return base + veins;
  }
  // Elección del siguiente movimiento del jefe (fase 1).
  function pickAttack(s, r) {
    if (s.minions < 3 && ((s.hpFrac <= 0.7 && s.summons < 1) || (s.hpFrac <= 0.4 && s.summons < 2))) return 'summon';
    if (s.d < 2.1) return r < 0.72 ? 'bounce' : 'hop';
    if (s.d < 7.5) {
      if (s.slamCd <= 0 && r < 0.42) return 'slam';
      if (s.chargeCd <= 0 && s.d > 2.6 && r < 0.82) return 'charge';
      return 'hop';
    }
    return s.chargeCd <= 0 && s.d < 10 ? 'charge' : 'hop';
  }
  function pedestalPos(cx, cy, i, R = 4.4) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / LIMIT;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  }

  // ── Tres formas (fase B): I → II al 66 % de vida → III al 33 % ──
  // Cada forma tiene su propio tope de clones vivos y cuántos pueden atacar a
  // la vez (el resto espera en círculo: el jugador nunca queda rodeado).
  const FORMS = Object.freeze([null,
    Object.freeze({ id: 1, name: 'Rey Slime', tag: 'FORMA I', cap: 5, active: 2, wave: 3, r: 1.05 }),
    Object.freeze({ id: 2, name: 'Bestia gelatinosa', tag: 'FORMA II', cap: 10, active: 2, wave: 4, r: 1.6 }),
    Object.freeze({ id: 3, name: 'Rey humanoide', tag: 'FORMA III', cap: 20, active: 3, wave: 5, r: 1.45 })]);
  const FORM_AT = Object.freeze([0, 1, 0.66, 0.33]);
  function formOf(hp, maxHp) {
    if (hp <= Math.ceil(maxHp * FORM_AT[3])) return 3;
    if (hp <= Math.ceil(maxHp * FORM_AT[2])) return 2;
    return 1;
  }
  /** Vida mínima de una forma: al llegar a ella, se transforma (la III no tiene suelo). */
  function formFloor(form, maxHp) { return form >= 3 ? 0 : Math.ceil(maxHp * FORM_AT[form + 1]); }
  /** Vida máxima que puede recuperar en su trono (nunca vuelve a la forma anterior). */
  function formCeil(form, maxHp) { return form <= 1 ? maxHp : Math.ceil(maxHp * FORM_AT[form]); }
  /** Filtra un golpe recibido: no cruza de forma de un solo golpe y no recibe daño mientras se transforma. */
  function gateHp(form, before, after, maxHp, morphing) {
    if (morphing) return { hp: before, morph: false };
    const floor = formFloor(form, maxHp);
    if (form < 3 && after <= floor) return { hp: Math.min(before, floor), morph: true };
    return { hp: after, morph: false };
  }
  /** Director de clones: conserva a los que ya atacaban y completa con los más cercanos. */
  function directClones(clones, prev, px, py, n) {
    const alive = clones.filter(c => !c.dead), out = new Set();
    if (n <= 0) return out;
    for (const c of alive) if (prev && prev.has(c.id) && out.size < n) out.add(c.id);
    const rest = alive.filter(c => !out.has(c.id)).sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    for (const c of rest) { if (out.size >= n) break; out.add(c.id); }
    return out;
  }
  function pickAttackII(s, r) {
    if (s.clones < 3 && s.summonCd <= 0) return 'summon';
    if (s.clones >= 3 && s.absorbCd <= 0 && r < 0.3) return 'absorb';
    if (s.d < 2.4) {
      if (s.spineCd <= 0 && r < 0.6) return 'spines';
      return s.biteCd <= 0 ? 'bite' : 'hop';
    }
    if (s.d < 9) {
      if (s.jumpCd <= 0 && r < 0.45) return 'megajump';
      if (s.biteCd <= 0 && r < 0.85) return 'bite';
      return 'hop';
    }
    return s.jumpCd <= 0 ? 'megajump' : 'hop';
  }
  function pickAttackIII(s, r) {
    if (s.clones < 4 && s.summonCd <= 0) return 'summon';
    if (s.d < 2.6) {
      if (s.hookCd <= 0 && r < 0.6) return 'hook';
      return s.hammerCd <= 0 ? 'hammer' : 'walk';
    }
    if (s.d < 8) {
      if (s.punchCd <= 0 && r < 0.55) return 'punch';
      if (s.hammerCd <= 0 && s.d < 4.5) return 'hammer';
      return 'walk';
    }
    return s.punchCd <= 0 ? 'punch' : 'walk';
  }
  /** ¿El punto (px, py) está dentro del cono del Puñetazo del Rey? */
  function inCone(ox, oy, dx, dy, px, py, len, half) {
    const vx = px - ox, vy = py - oy, d = Math.hypot(vx, vy), n = Math.hypot(dx, dy) || 1;
    if (d > len) return false;
    if (d < 0.6) return true;
    return (vx * dx + vy * dy) / (d * n) >= Math.cos(half);
  }

  const API = { LIMIT, HUES, WEAPONS, WEAPON_INFO, FORMS, FORM_AT, normalize, validPiece, petRecord, compose, colorsOf, partialMix, chooseWeapon, takePiece, giveBack, pickAttack, pickAttackII, pickAttackIII, formOf, formFloor, formCeil, gateHp, directClones, inCone, pedestalPos, variantName };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root.document) return;

  // ════════════════════════════════════════════════════════════════════════
  // 2. Puente con el motor (posiciones, geometrías y materiales)
  // ════════════════════════════════════════════════════════════════════════
  const ART = () => root.TMReyArt;
  const SQ = Math.SQRT1_2, BIAS = 0.35, TAU = Math.PI * 2;
  const SANCTUARY = Object.freeze({ prefer: { x: 94.5, y: 107.5 }, clear: 6.6, ring: 4.4, enter: 7.4, near: 9.5 });
  const ARENA = Object.freeze({ leash: 8.0, lose: 13.5 });
  const OB_TAG = 91;
  const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const now = () => (root.performance ? root.performance.now() : Date.now());

  function geoUp(w, h, off = 0) { const g = new THREE.PlaneGeometry(w / 16, h / 16); g.translate(0, h / 32 - off / 16, 0); return g; }
  function geoFlat(w, h) { const g = new THREE.PlaneGeometry(w / 16, h / 16); g.rotateX(-Math.PI / 2); return g; }
  function placeUp(m, x, z, y, b = BIAS) { const o = Math.round(x * 16) / 16, r = Math.round((z - y) * 16) / 16; m.position.set(o, z + b * SQ, z - r + b * SQ); }
  function placeFlat(m, x, z, y, lift = 0.03) { const n = z + lift; m.position.set(Math.round(x * 16) / 16, n, n - Math.round((n - y) * 16) / 16); }
  function canvasTex(c, flip) {
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.flipY = !!flip; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  }
  function fallbackMat(tex) {
    return new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uFrame: { value: new THREE.Vector4(0, 0, 1, 1) }, uFlash: { value: 0 }, uTint: { value: new THREE.Vector4() }, uRim: { value: new THREE.Vector4() } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform sampler2D map;uniform vec4 uFrame;uniform float uFlash;uniform vec4 uTint;varying vec2 vUv;void main(){vec2 uv=uFrame.xy+vec2(vUv.x,1.0-vUv.y)*uFrame.zw;vec4 t=texture2D(map,uv);if(t.a<0.5)discard;vec3 c=mix(t.rgb,uTint.rgb,uTint.a);gl_FragColor=vec4(mix(c,vec3(1.0),uFlash),1.0);}'
    });
  }
  function setFrame(mat, col, row, cols, rows, flip) {
    const u = mat.uniforms.uFrame.value;
    if (flip) u.set((col + 1) / cols, row / rows, -1 / cols, 1 / rows); else u.set(col / cols, row / rows, 1 / cols, 1 / rows);
  }
  function decalMat(tex, opacity = 1, additive = false) {
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, alphaTest: 0.05, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  }

  // Herramientas compartidas con el módulo de las Formas II y III (rey-combate.js).
  root.__TM_REY_KIT__ = Object.freeze({ API, ARENA, SANCTUARY, OB_TAG, ease, lerp, clamp, reduced, now, geoUp, geoFlat, placeUp, placeFlat, canvasTex, setFrame, decalMat });

  // ════════════════════════════════════════════════════════════════════════
  // 3. Escena 3D del Rey (santuario, jefe, efectos, aliado)
  // ════════════════════════════════════════════════════════════════════════
  class Stage {
    constructor(ctl) {
      this.ctl = ctl; this.view = null; this.group = null; this.mats = []; this.geos = []; this.texs = [];
      this.parts = []; this.partPool = []; this.slots = []; this.kingKey = ''; this.allyKey = ''; this.chanKey = '';
      this.glowIds = [];
    }
    mat(tex, lit = true) {
      const m = this.ctl.kit.ds && this.view.rig ? this.ctl.kit.ds(tex, this.view.rig, { lit }) : fallbackMat(tex);
      this.mats.push(m); return m;
    }
    tex(canvas, flip) { const t = canvasTex(canvas, flip); this.texs.push(t); return t; }
    geo(g) { this.geos.push(g); return g; }
    mesh(geo, mat, order = 2) { const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; this.group.add(m); return m; }

    ensure(view) {
      if (this.view === view && this.group && this.group.parent === view.scene) return true;
      this.dispose();
      if (!view || !view.scene || !ART()) return false;
      this.view = view; this.group = new THREE.Group(); this.group.name = 'rey-slime'; view.scene.add(this.group);
      this.build();
      return true;
    }
    dispose() {
      if (this.group && this.group.parent) this.group.parent.remove(this.group);
      this.removeGlows();
      for (const m of this.mats) m.dispose(); for (const g of this.geos) g.dispose(); for (const t of this.texs) t.dispose();
      this.mats = []; this.geos = []; this.texs = []; this.parts = []; this.partPool = []; this.slots = [];
      this.group = null; this.view = null; this.kingKey = ''; this.allyKey = ''; this.chanKey = '';
      this.king = this.ally = null;
    }

    build() {
      const A = ART();
      // ── Santuario ──
      const plat = A.platform(), size = plat.size;
      this.platform = this.mesh(this.geo(geoFlat(size, size)), decalMat(this.tex(plat.canvas, true)), 1);
      this.chanPx = new A.Px(size, size);
      this.chanTex = this.tex(this.chanPx.canvas(), true);
      this.chanMat = decalMat(this.chanTex, 0.95);
      this.channels = this.mesh(this.geos[this.geos.length - 1], this.chanMat, 1);
      const ped = A.pedestalSheet(), pedTex = this.tex(ped.canvas), pedGeo = this.geo(geoUp(ped.w, ped.h, 1));
      const shadowS = A.shadowTex(18, 6), shadowTexS = this.tex(shadowS.canvas, true), shadowGeoS = this.geo(geoFlat(18, 6));
      const slime = this.view._slimeTex ? this.view._slimeTex.bind(this.view) : null;
      const slimeGeo = this.geo(geoUp(16, 16, 1));
      const beam = A.beamTex('#fff4c4'), beamTex = this.tex(beam.canvas, true), beamGeo = this.geo(geoUp(beam.w, beam.h, 0));
      for (let i = 0; i < LIMIT; i++) {
        const m = this.mat(pedTex);
        const s = { ped: this.mesh(pedGeo, m), pedMat: m, shadow: this.mesh(shadowGeoS, this.shadowMat(shadowTexS), 1), slime: null, slimeMat: null, hue: null };
        s.beam = this.mesh(beamGeo, decalMat(beamTex, 0, true), 3);
        s.beam.material.depthTest = false;
        this.mats.push(s.beam.material, s.shadow.material);
        s.slimeTex = slime;
        s.slimeGeo = slimeGeo;
        this.slots.push(s);
      }
      const st = A.statueSheet();
      this.statueMat = this.mat(this.tex(st.canvas));
      this.statue = this.mesh(this.geo(geoUp(st.w, st.h, 2)), this.statueMat);
      this.statueShadow = this.mesh(this.geo(geoFlat(30, 8)), this.shadowMat(this.tex(A.shadowTex(30, 8).canvas, true)), 1);
      const br = A.brazierSheet(), brTex = this.tex(br.canvas), brGeo = this.geo(geoUp(br.w, br.h, 1));
      this.braziers = [0, 1].map(() => { const m = this.mat(brTex); return { mesh: this.mesh(brGeo, m), mat: m }; });
      this.centerBeam = this.mesh(this.geo(geoUp(beam.w * 3, beam.h * 1.6, 0)), decalMat(beamTex, 0, true), 3);
      this.centerBeam.material.depthTest = false; this.mats.push(this.centerBeam.material);
      // ── Avisos y ondas ──
      const ember = '#e0585c';
      this.slamRing = this.mesh(this.geo(geoFlat(80, 80)), decalMat(this.tex(A.ringTex(80, 3, ember, 0.18).canvas, true), 0), 1);
      this.slamFill = this.mesh(this.geo(geoFlat(80, 80)), decalMat(this.tex(A.discTex(80, ember).canvas, true), 0), 1);
      this.smallRing = this.mesh(this.geo(geoFlat(52, 52)), decalMat(this.tex(A.ringTex(52, 2, ember, 0.25).canvas, true), 0), 1);
      const lane = A.laneTex();
      const laneGeo = new THREE.PlaneGeometry(lane.w / 16, lane.h / 16); laneGeo.translate(0, lane.h / 32, 0); laneGeo.rotateX(-Math.PI / 2);
      this.lane = this.mesh(this.geo(laneGeo), decalMat(this.tex(lane.canvas, true), 0), 1);
      const shockTex = this.tex(A.ringTex(64, 2, '#fff4c4', 0).canvas, true), shockGeo = this.geo(geoFlat(64, 64));
      this.shocks = [0, 1, 2].map(() => ({ mesh: this.mesh(shockGeo, decalMat(shockTex, 0, true), 1), t: 9, dur: 0.5, r0: 0.4, r1: 3 }));
      for (const s of this.shocks) this.mats.push(s.mesh.material);
      const crack = A.crackTex(), crackTex = this.tex(crack.canvas, true), crackGeo = this.geo(geoFlat(crack.w, crack.h));
      this.cracks = [0, 1].map(() => ({ mesh: this.mesh(crackGeo, decalMat(crackTex, 0), 1), t: 9 }));
      for (const c of this.cracks) this.mats.push(c.mesh.material);
      this.glowDisc = this.mesh(this.geo(geoFlat(96, 96)), decalMat(this.tex(A.discTex(96, '#ffe17a').canvas, true), 0, true), 1);
      this.mats.push(this.slamRing.material, this.slamFill.material, this.smallRing.material, this.lane.material, this.glowDisc.material, this.platform.material, this.chanMat);
      // ── Partículas ──
      const ps = A.particleSheet();
      this.partTex = this.tex(ps.canvas); this.partGeo = this.geo(geoUp(8, 8, 0));
      // ── Corona suelta y arma ──
      this.crownGeo = this.geo(geoUp(32, 32, 0));
      this.weaponGeo = this.geo(geoUp(24, 24, 0));
      this.hideAll();
    }
    shadowMat(tex) { return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.32, depthWrite: false, alphaTest: 0.5, color: 0 }); }

    hideAll() { if (!this.group) return; for (const c of this.group.children) c.visible = false; this.removeGlows(); }

    // ── Luces dinámicas (se suman a las del motor) ──
    setGlow(id, g) {
      const list = this.view && this.view.glows; if (!list) return;
      let e = list.find(x => x.__rey === id);
      if (!g) { if (e) list.splice(list.indexOf(e), 1); return; }
      if (!e) { e = { __rey: id, x: 0, y: 0, z: 0, r: 1, color: [0, 0, 0], pulse: 0, prio: 3 }; list.push(e); }
      Object.assign(e, g);
    }
    removeGlows() { const list = this.view && this.view.glows; if (!list) return; for (let i = list.length - 1; i >= 0; i--) if (list[i].__rey) list.splice(i, 1); }

    // ── Rey (hoja grande) ──
    kingSprite(spec) {
      const key = [spec.hue, spec.mix.join(',')].join('|');
      if (this.king && this.kingKey === key) return this.king;
      if (this.king) { this.group.remove(this.king.mesh, this.king.shadow); }
      const A = ART(), sheet = A.kingSheet(spec, 64);
      const mat = this.mat(this.tex(sheet.canvas));
      const mesh = this.mesh(this.geo(geoUp(64, 64, 3)), mat);
      const sh = A.shadowTex(50, 14);
      const shadow = this.mesh(this.geo(geoFlat(50, 14)), this.shadowMat(this.tex(sh.canvas, true)), 1);
      this.mats.push(shadow.material);
      const cs = A.crownSheet(spec), crownMat = this.mat(this.tex(cs.canvas), false);
      const crown = this.mesh(this.crownGeo, crownMat, 4);
      this.king = { mesh, mat, shadow, sheet, crown, crownMat };
      this.kingKey = key;
      return this.king;
    }
    kingFrame(id, flip) {
      const k = this.king, s = k.sheet, i = s.frames[id] !== undefined ? s.frames[id] : 0;
      setFrame(k.mat, i % s.cols, Math.floor(i / s.cols), s.cols, s.rows, flip);
    }
    allySprite(spec) {
      const key = [spec.hue, spec.mix.join(',')].join('|');
      if (this.ally && this.allyKey === key) return this.ally;
      if (this.ally) this.group.remove(this.ally.mesh, this.ally.shadow);
      const A = ART(), sheet = A.kingSheet(spec, 32);
      const mat = this.mat(this.tex(sheet.canvas));
      const mesh = this.mesh(this.geo(geoUp(32, 32, 2)), mat);
      const shadow = this.mesh(this.geo(geoFlat(22, 7)), this.shadowMat(this.tex(A.shadowTex(22, 7).canvas, true)), 1);
      this.mats.push(shadow.material);
      this.ally = { mesh, mat, shadow, sheet };
      this.allyKey = key;
      return this.ally;
    }
    allyFrame(id, flip) {
      const k = this.ally, s = k.sheet, i = s.frames[id] !== undefined ? s.frames[id] : 0;
      setFrame(k.mat, i % s.cols, Math.floor(i / s.cols), s.cols, s.rows, flip);
    }

    // ── Partículas ──
    // kind: drop0..3 · spark0..3 · dust0..3 · star · heart · light · rune
    spawn(p) {
      if (this.parts.length > 70) return null;
      let m = this.partPool.pop();
      if (!m) { const mat = this.mat(this.partTex, false); m = this.mesh(this.partGeo, mat, 3); }
      m.visible = true;
      const q = Object.assign({ x: 0, y: 0, z: 0, h: 0, vx: 0, vy: 0, vh: 0, g: 0, drag: 0, life: 0.6, t: 0, col: 0, row: 0, anim: 0, fps: 10, scale: 1, flash: 0, mesh: m, tx: null }, p);
      this.parts.push(q);
      return q;
    }
    stepParts(dt, zAt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { p.mesh.visible = false; this.partPool.push(p.mesh); this.parts.splice(i, 1); continue; }
        if (p.tx !== null) {
          // Atraída hacia un punto (convergencia).
          const k = Math.min(1, dt * (p.pull || 4));
          p.x = lerp(p.x, p.tx, k); p.y = lerp(p.y, p.ty, k); p.h = lerp(p.h, p.th || 0, k);
        } else {
          p.vh -= p.g * dt;
          const dr = Math.max(0, 1 - p.drag * dt);
          p.vx *= dr; p.vy *= dr;
          p.x += p.vx * dt; p.y += p.vy * dt; p.h += p.vh * dt;
          if (p.h < 0 && p.g > 0) { p.h = 0; p.vh = -p.vh * 0.35; p.vx *= 0.6; p.vy *= 0.6; }
        }
        const col = p.anim ? Math.min(3, p.col + Math.floor(p.t * p.fps)) : p.col;
        setFrame(p.mesh.material, col, p.row, 4, 4, false);
        const z = zAt(p.x, p.y);
        const fade = p.t > p.life * 0.7 ? 1 - (p.t - p.life * 0.7) / (p.life * 0.3) : 1;
        const s = p.scale * (p.shrink ? Math.max(0.2, fade) : 1);
        p.mesh.scale.set(s, s, s);
        placeUp(p.mesh, p.x, z + p.h, p.y, 0.6);
        p.mesh.material.uniforms.uFlash.value = p.flash;
        // Las partículas que se desvanecen parpadean (sin transparencia real).
        p.mesh.visible = fade > 0.35 || Math.floor(p.t * 30) % 2 === 0;
      }
    }

    shock(x, z, y, r1 = 3, dur = 0.5) {
      const s = this.shocks.find(q => q.t >= q.dur) || this.shocks[0];
      Object.assign(s, { x, z, y, t: 0, dur, r1 });
    }
    crack(x, z, y) {
      const c = this.cracks.find(q => q.t >= 3) || this.cracks[0];
      Object.assign(c, { x, z, y, t: 0 });
    }
    stepDecals(dt) {
      for (const s of this.shocks) {
        s.t += dt;
        const m = s.mesh; if (s.t >= s.dur) { m.visible = false; continue; }
        const u = s.t / s.dur, r = lerp(0.3, s.r1, 1 - (1 - u) * (1 - u));
        m.visible = true; m.scale.set(r / 2, 1, r / 2); m.material.opacity = 1 - u;
        placeFlat(m, s.x, s.z, s.y, 0.05);
      }
      for (const c of this.cracks) {
        c.t += dt;
        const m = c.mesh; if (c.t >= 3) { m.visible = false; continue; }
        m.visible = true; m.material.opacity = c.t < 2 ? 0.85 : 0.85 * (3 - c.t);
        placeFlat(m, c.x, c.z, c.y, 0.04);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. Interfaz (HTML): ritual, cinemática, barra de jefe, decisión, brújula
  // ════════════════════════════════════════════════════════════════════════
  function el(tag, cls, html) { const e = root.document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function slimeIcon(view, hue, size = 32) {
    const c = el('canvas'); c.width = size; c.height = size; c.className = 'tm-rey-ico';
    try {
      const t = view && view._slimeTex && view._slimeTex(hue), img = t && t.image;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      if (img) g.drawImage(img, 0, 0, 16, 16, 0, 0, size, size);
    } catch (_) { /* icono opcional */ }
    return c;
  }
  // Botón de «mantener pulsado» para decisiones irreversibles.
  function holdButton(btn, ms, onDone) {
    let start = 0, raf = 0, done = false;
    const bar = el('i', 'tm-rey-hold'); btn.append(bar);
    const reset = () => { cancelAnimationFrame(raf); start = 0; bar.style.transform = 'scaleX(0)'; btn.classList.remove('is-holding'); };
    const loop = () => {
      const u = Math.min(1, (now() - start) / ms);
      bar.style.transform = `scaleX(${u})`;
      if (u >= 1) { done = true; reset(); onDone(); return; }
      raf = requestAnimationFrame(loop);
    };
    const down = e => {
      if (btn.disabled) return;
      e.preventDefault(); done = false; start = now(); btn.classList.add('is-holding');
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* opcional */ }
      raf = requestAnimationFrame(loop);
    };
    btn.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, () => { if (!done) reset(); });
    btn.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); onDone(); } });
    btn.addEventListener('click', e => e.preventDefault());
  }

  class Overlay {
    constructor(ctl) {
      this.ctl = ctl;
      const app = $('app') || root.document.body;
      // Chip junto al reloj.
      const time = $('time-hud');
      this.chip = el('button', 'chip tm-rey-chip'); this.chip.type = 'button'; this.chip.id = 'tm-rey-open'; this.chip.hidden = true;
      this.chipIcon = el('i', 'tm-rey-chip-ico'); this.chipLabel = el('span', '', '0/10');
      this.chip.append(this.chipIcon, this.chipLabel);
      this.chip.setAttribute('aria-label', 'Ritual del Rey Slime');
      if (time) time.append(this.chip); else app.append(this.chip);
      this.chip.addEventListener('click', () => ctl.onChip());

      // Panel del ritual.
      this.panel = el('section', 'tm-rey-panel');
      this.panel.id = 'tm-rey-panel'; this.panel.hidden = true;
      this.panel.setAttribute('role', 'dialog'); this.panel.setAttribute('aria-modal', 'true'); this.panel.setAttribute('aria-label', 'Santuario de la Corona');
      this.panel.innerHTML = `
        <div class="tm-rey-window">
          <header><div><small>SANTUARIO DE LA CORONA</small><strong>Ritual del Rey Slime</strong></div>
            <button type="button" class="tm-rey-x" id="tm-rey-close" aria-label="Cerrar">✕</button></header>
          <div class="tm-rey-cols"><div class="tm-rey-colA">
            <div class="tm-rey-ring" id="tm-rey-ring" role="group" aria-label="Diez pedestales"></div>
            <p class="tm-rey-note" id="tm-rey-notice"></p>
          </div><div class="tm-rey-colB">
            <div class="tm-rey-omen" id="tm-rey-omen"></div>
            <h3 class="tm-rey-h">Tus limos domados</h3>
            <div class="tm-rey-list" id="tm-rey-list"></div>
            <div class="tm-rey-actions">
              <button type="button" class="tm-rey-go" id="tm-rey-summon"><span>Mantén pulsado para invocar</span></button>
            </div>
            <p class="tm-rey-foot">Los diez limos se fusionarán para siempre. Beta · partida individual.</p>
          </div></div>
        </div>`;
      app.append(this.panel);
      $('tm-rey-close').addEventListener('click', () => ctl.togglePanel(false));
      $('tm-rey-ring').addEventListener('click', e => { const b = e.target.closest('button[data-index]'); if (b && !b.disabled) ctl.remove(Number(b.dataset.index)); });
      $('tm-rey-list').addEventListener('click', e => { const b = e.target.closest('button[data-pet]'); if (b && !b.disabled) ctl.place(b.dataset.pet); });
      holdButton($('tm-rey-summon'), 1100, () => ctl.summon());
      this.panel.addEventListener('keydown', e => { if (e.key === 'Escape') ctl.togglePanel(false); });

      // Cinemática.
      this.cine = el('div', 'tm-rey-cine'); this.cine.hidden = true;
      this.cine.innerHTML = `<i class="tm-rey-bar top"></i><i class="tm-rey-bar bot"></i>
        <div class="tm-rey-title" id="tm-rey-title" hidden><small>— SOBERANO DEL VALLE —</small><b>REY SLIME</b><em id="tm-rey-title-sub"></em></div>
        <button type="button" class="tm-rey-skip" id="tm-rey-skip" hidden>Saltar ▸▸</button>`;
      app.append(this.cine);
      $('tm-rey-skip').addEventListener('click', () => ctl.skipCine());
      this.flash = el('div', 'tm-rey-flash'); app.append(this.flash);

      // Barra del jefe.
      this.boss = el('div', 'tm-rey-boss'); this.boss.hidden = true;
      this.boss.innerHTML = `<div class="tm-rey-boss-top"><canvas width="32" height="32" class="tm-rey-boss-ico"></canvas>
          <b>REY SLIME</b><em id="tm-rey-boss-sub"></em><span class="tm-rey-phase">FASE I</span></div>
        <div class="tm-rey-boss-bar"><i class="trail" id="tm-rey-boss-trail"></i><i class="fill" id="tm-rey-boss-fill"></i></div>
        <p class="tm-rey-boss-note" id="tm-rey-boss-note"></p>`;
      app.append(this.boss);
      this.bossFill = $('tm-rey-boss-fill'); this.bossTrail = $('tm-rey-boss-trail'); this.bossNote = $('tm-rey-boss-note');
      this.trail = 1; this.trailHold = 0;

      // Decisión.
      this.decide = el('section', 'tm-rey-decide'); this.decide.hidden = true;
      this.decide.setAttribute('role', 'dialog'); this.decide.setAttribute('aria-modal', 'true'); this.decide.setAttribute('aria-label', 'El destino del Rey Slime');
      this.decide.innerHTML = `<div class="tm-rey-window tm-rey-decide-win">
          <small>EL REY SLIME SE RINDE</small><strong>¿Cuál será su destino?</strong>
          <div class="tm-rey-choices">
            <button type="button" class="tm-rey-choice" id="tm-rey-pardon"><canvas width="64" height="64"></canvas>
              <b>Perdonar</b><span>Se une a ti como aliado: te sigue y ataca a tus enemigos.</span><em id="tm-rey-pardon-note"></em></button>
            <button type="button" class="tm-rey-choice is-blade" id="tm-rey-finish"><canvas width="48" height="48"></canvas>
              <b>Rematar</b><span id="tm-rey-weapon"></span><em>Arma rara del Rey</em></button>
          </div>
          <p class="tm-rey-foot">Mantén pulsada tu elección. No se puede deshacer.</p></div>`;
      app.append(this.decide);
      holdButton($('tm-rey-pardon'), 900, () => ctl.resolve(true));
      holdButton($('tm-rey-finish'), 900, () => ctl.resolve(false));

      // Brújula hacia el santuario.
      this.compass = el('div', 'tm-rey-compass'); this.compass.hidden = true;
      this.compass.innerHTML = '<i></i><span></span>';
      app.append(this.compass);

      // Banner de recompensa.
      this.banner = el('div', 'tm-rey-banner'); this.banner.hidden = true; app.append(this.banner);
    }
    flashOnce(strength = 1) {
      if (reduced()) strength *= 0.4;
      this.flash.style.setProperty('--a', String(strength));
      this.flash.classList.remove('is-on'); void this.flash.offsetWidth; this.flash.classList.add('is-on');
    }
    showBanner(html, ms = 3200) {
      this.banner.innerHTML = html; this.banner.hidden = false;
      this.banner.classList.remove('is-on'); void this.banner.offsetWidth; this.banner.classList.add('is-on');
      clearTimeout(this._bannerT); this._bannerT = setTimeout(() => { this.banner.hidden = true; }, ms);
    }
    setBoss(k, hp, max, note, dt = 1 / 60) {
      if (!k) { if (!this.boss.hidden) this.boss.hidden = true; root.document.body.classList.remove('tm-rey-fight'); return; }
      if (this.boss.hidden) {
        this.boss.hidden = false; root.document.body.classList.add('tm-rey-fight');
        $('tm-rey-boss-sub').textContent = `${variantName(k)} · Nv. ${k.level}`;
        const ico = this.boss.querySelector('canvas'), g = ico.getContext('2d');
        g.imageSmoothingEnabled = false; g.clearRect(0, 0, 32, 32);
        try { g.drawImage(ART().portrait(k), 0, 0, 64, 64, 0, 0, 32, 32); } catch (_) { /* opcional */ }
        this.trail = hp / max;
      }
      const f = clamp(hp / max, 0, 1);
      this.bossFill.style.transform = `scaleX(${f})`;
      if (f < this.trail) { if (this.trailHold <= 0) this.trailHold = 0.45; }
      this.trailHold -= dt;
      if (this.trailHold <= 0 && this.trail > f) this.trail = Math.max(f, this.trail - 0.75 * dt);
      if (f > this.trail) this.trail = f;
      this.bossTrail.style.transform = `scaleX(${this.trail})`;
      this.boss.classList.toggle('is-low', f <= 0.3);
      if (this.bossNote.textContent !== (note || '')) this.bossNote.textContent = note || '';
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. Controlador
  // ════════════════════════════════════════════════════════════════════════
  class KingSlime {
    constructor(app, kit) {
      this.app = app; this.kit = kit || {};
      this.audio = root.TMReyAudio ? new root.TMReyAudio(app) : null;
      this.stage = new Stage(this);
      this.ui = null; this.open = false; this.cine = null; this.decisionOpen = false;
      this.actor = null; this.actorWorld = null; this.minions = [];
      this.center = null; this.alpha = 0; this.lastDraw = 0; this.elapsed = 0;
      this.lastSave = 0; this.lastUI = 0; this.attackT = 0; this.found = false;
      this.slotAnim = new Array(LIMIT).fill(null); this.prevPieces = null;
      this.allyPos = null; this.compassT = 0; this.messages = new Map();
      this.post = null; // animaciones tras la derrota / decisión
      // Formas II y III (transformaciones, IA y clones): módulo aparte.
      this.forms = root.TMReyCombate ? new root.TMReyCombate(this) : null;
      this.initUI(); this.hook();
    }
    // ── Estado guardado ──
    state() {
      const p = this.app.saves && this.app.data && this.app.data.progress;
      if (!p) return null;
      if (!p.reySlime) p.reySlime = normalize(null);
      return p.reySlime;
    }
    soloSession() {
      const e = this.app, s = e.session;
      return !!(e.mode === 'game' && s && !s.channel && !e.trial && s.state === 'playing' && s.isHost && s.avatar && s.world);
    }
    solo() { const s = this.app.session; return this.soloSession() && !s.isDown(s.self.pid); }
    inValley() { return !!(this.app.terrain && this.app.terrain.id === 'valle-alba'); }
    notice(t, kind = 'gold', ms = 4200) { if (this.app.ui && this.app.ui.toast) this.app.ui.toast(t, kind, ms); }
    once(key, text, kind) { if (this.messages.get(key)) return; this.messages.set(key, true); this.notice(text, kind); }
    persist() {
      this.app.saves.markDirty(); this.app._saveNow();
      if (typeof root.__TM_SYNC_NOW__ === 'function') root.__TM_SYNC_NOW__('rey').catch(() => {});
    }
    blocking() { return !!(this.open || this.cine || this.decisionOpen || (this.post && this.post.block)); }
    syncPause() { try { this.app._syncOverlayState(); } catch (_) { /* motor antiguo */ } }

    // ── Santuario: ubicación fija, comprobada contra el mapa real ──
    findCenter() {
      const T = this.app.terrain; if (!T || T.id !== 'valle-alba') return null;
      if (this.center && this.center.terrain === T) return this.center;
      const obs = (T.obstacles || []).filter(o => o.tag !== OB_TAG);
      const score = (x, y) => {
        const z = T.surfaceAt(x, y); if (z !== z) return -1;
        const comp = T.componentAt ? T.componentAt(x, y) : 0;
        for (let a = 0; a < 16; a++) for (const r of [2.5, 4.4, SANCTUARY.clear]) {
          const px = x + Math.cos(a / 16 * TAU) * r, py = y + Math.sin(a / 16 * TAU) * r;
          const pz = T.surfaceAt(px, py);
          if (pz !== pz || Math.abs(pz - z) > 0.01 || (T.componentAt && T.componentAt(px, py) !== comp)) return -1;
        }
        let m = 99;
        for (const o of obs) { const d = Math.hypot(o.x - x, o.y - y) - (o.r || 0.3); if (d < m) m = d; }
        return m;
      };
      let best = { x: SANCTUARY.prefer.x, y: SANCTUARY.prefer.y, s: score(SANCTUARY.prefer.x, SANCTUARY.prefer.y) };
      if (best.s < SANCTUARY.clear) {
        for (let r = 1; r <= 40 && best.s < SANCTUARY.clear; r += 1) for (let a = 0; a < 24; a++) {
          const x = SANCTUARY.prefer.x + Math.cos(a / 24 * TAU) * r, y = SANCTUARY.prefer.y + Math.sin(a / 24 * TAU) * r;
          if (x < 10 || y < 10 || x > T.w - 10 || y > T.h - 10) continue;
          const s = score(x, y); if (s > best.s) best = { x, y, s };
        }
      }
      const z = T.surfaceAt(best.x, best.y);
      this.center = { x: best.x, y: best.y, z: z === z ? z : 0, terrain: T };
      return this.center;
    }
    pedestal(i) { const c = this.center; return pedestalPos(c.x, c.y, i, SANCTUARY.ring); }
    statuePos() { const c = this.center; return { x: c.x, y: c.y - 6.3 }; }
    brazierPos(i) { const c = this.center; return { x: c.x + (i ? 2.4 : -2.4), y: c.y + 6.2 }; }
    ensureObstacles(on) {
      const T = this.app.terrain; if (!T || !T.obstacles) return;
      const has = T.obstacles.some(o => o.tag === OB_TAG);
      if (on && !has && this.center) {
        // La huella del mapa se calcula ANTES de añadir pedestales: así no cambia
        // y la exploración guardada sigue siendo válida.
        try { if (T.fingerprint) T.fingerprint(); } catch (_) { /* opcional */ }
        for (let i = 0; i < LIMIT; i++) { const p = this.pedestal(i); T.addObstacle(p.x, p.y, 0.42, OB_TAG); }
        const s = this.statuePos(); T.addObstacle(s.x, s.y, 0.75, OB_TAG);
        for (const i of [0, 1]) { const b = this.brazierPos(i); T.addObstacle(b.x, b.y, 0.3, OB_TAG); }
      } else if (!on && has) {
        T.obstacles = T.obstacles.filter(o => o.tag !== OB_TAG); T._obstCells = null;
      }
    }
    distToCenter() {
      const s = this.app.session, a = s && s.avatar, c = this.center;
      return a && c ? Math.hypot(a.x - c.x, a.y - c.y) : 99;
    }
    nearSanctuary() { return this.soloSession() && this.inValley() && !!this.findCenter() && this.distToCenter() < SANCTUARY.enter; }

    // ── Enganches con el motor ──
    initUI() {
      const start = () => { this.ui = new Overlay(this); this.refresh(true); };
      if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
    }
    hook() {
      const a = this.app, self = this;
      const origStep = a._step;
      a._step = function (dt) { const r = origStep.call(a, dt); try { self.tick(dt); } catch (e) { self.fail(e); } return r; };
      const origRender = a._render;
      a._render = function (alpha, ms) {
        self.alpha = alpha;
        const r = origRender.call(a, alpha, ms);
        if (a.pr && !a.pr.__tmKingPatched) {
          const pr = a.pr, fn = pr.render;
          pr.render = function () { try { self.beforeDraw(); } catch (e) { self.fail(e); } return fn.apply(pr, arguments); };
          pr.__tmKingPatched = true;
        }
        return r;
      };
      const origTarget = a._targetFrame;
      a._targetFrame = function (frame) {
        const out = origTarget.call(a, frame);
        const s = a.session;
        if (self.actor && s && s.combat && s.combat.targetId === self.actor.id && a.ui) a.ui.setTargetFrame(null);
        return out;
      };
      const origLeave = a.leaveGame;
      a.leaveGame = function () { self.saveHp(); self.endEverything(); return origLeave.apply(a, arguments); };
      const origOverlay = a._overlayOpen;
      a._overlayOpen = function () { return origOverlay.call(a) || self.blocking(); };
      const origNear = a._nearArmory;
      a._nearArmory = function () { return origNear.call(a) || self.nearSanctuary(); };
      const origInteract = a.interact;
      a.interact = function () {
        if (a.mode === 'game' && a.session && !a._overlayOpen() && !a.session.nearPortal() && !origNear.call(a) && self.nearSanctuary()) {
          self.interact(); return;
        }
        return origInteract.apply(a, arguments);
      };
      if (a.mapView && a.mapView.draw) {
        const mv = a.mapView, origDraw = mv.draw;
        mv.draw = function (seen, info) {
          const r = origDraw.apply(mv, arguments);
          try { self.drawMapMarker(mv, seen); } catch (_) { /* marcador opcional */ }
          return r;
        };
      }
      root.addEventListener('pagehide', () => self.saveHp());
      root.document.addEventListener('visibilitychange', () => { if (root.document.hidden) self.saveHp(); });
    }
    fail(e) {
      if (this._failed) return; this._failed = true;
      console.error('Rey Slime beta:', e);
      setTimeout(() => { this._failed = false; }, 4000);
    }
    hookWorld(w) {
      if (!w || w.__tmRey) return;
      w.__tmRey = true;
      const self = this;
      if (w.tame) {
        const ctl = w.tame.control;
        w.tame.control = function (e, dt, players) {
          if (e && e.royal) { try { self.bossStep(e, dt, w); } catch (err) { self.fail(err); } return true; }
          if (e && e.reyMinion && self.forms) { try { if (self.forms.controlClone(e, dt, w)) return true; } catch (err) { self.fail(err); } }
          return ctl.apply(this, arguments);
        };
        const onHit = w.tame.onHit;
        w.tame.onHit = function (e) { if (e && (e.royal || e.reyMinion)) return; return onHit.apply(this, arguments); };
        const onPlayerHit = w.tame.onPlayerHit;
        if (onPlayerHit) w.tame.onPlayerHit = function (e) { if (e && (e.royal || e.reyMinion)) return; return onPlayerHit.apply(this, arguments); };
      }
      // Los súbditos y clones del Rey NO dan experiencia ni cuentan para el
      // bestiario ni las expediciones: su muerte se borra del registro.
      if (w.applyHit) {
        const apply = w.applyHit;
        w.applyHit = function (id) {
          const target = this.entities.find(x => x.id === id);
          const n = this.kills.length, before = target && target.royal ? target.hp : 0;
          const r = apply.apply(this, arguments);
          if (target && target.royal && self.forms) { try { self.forms.gate(target, before, r, this, n); } catch (err) { self.fail(err); } }
          if (target && target.reyMinion && r && r.killed && this.kills.length > n) this.kills.splice(n);
          return r;
        };
      }
    }
    hookSession(s) {
      if (!s || s.__tmRey) return;
      s.__tmRey = true;
      const self = this, fx = s._fx;
      // Los números de daño del Rey aparecen a la altura de su cuerpo.
      s._fx = function (e) {
        if (e && self.actor && e.id === self.actor.id && typeof e.z === 'number') e = { ...e, z: e.z + 1.6 };
        return fx.call(this, e);
      };
    }

    // ── Bucle lógico (60 Hz, mundo activo) ──
    tick(dt) {
      this.elapsed += dt;
      const s = this.state(); if (!s || !this.app.view) return;
      if (!this.soloSession() || !this.inValley()) {
        if (this.actor) this.closeActor();
        this.clearMinions(true);
        this.ensureObstacles(false);
        this.refresh();
        return;
      }
      const sess = this.app.session;
      this.hookWorld(sess.world); this.hookSession(sess);
      if (!this.findCenter()) return;
      this.ensureObstacles(true);
      // Descubrimiento del santuario.
      const d = this.distToCenter();
      if (d < SANCTUARY.near && !this.found) {
        this.found = true;
        const key = 'tm.rey.found.' + (this.app.data.profile.id || '');
        const store = root.__TM_BETA_STORAGE__;
        let first = true;
        try { first = !(store && store.getItem(key)); if (store) store.setItem(key, '1'); } catch (_) { /* almacenamiento opcional */ }
        if (first) { this.notice('Descubriste el Santuario de la Corona', 'gold', 4200); if (this.app.audio) this.app.audio.play('discover'); }
        setTimeout(() => this.notice(this.app.isTouch ? 'Santuario de la Corona: toca USAR para abrir el ritual' : 'Santuario de la Corona: pulsa F para abrir el ritual', 'gold', 3600), first ? 1800 : 0);
      }
      if (d > SANCTUARY.near + 6) this.found = false;
      // Jefe.
      if (s.stage === 'battle' && s.king && s.king.world === this.app.terrain.id && !this.cine) {
        this.ensureActor();
        const e = this.actor;
        if (e && this.forms) this.forms.guard(e); // daño por quemaduras u otras vías: respeta las formas
        if (e && (e.dead || e.hp <= 0)) this.onBossDefeated();
        else if (e && this.elapsed - this.lastSave > 3) { this.lastSave = this.elapsed; this.saveHp(); }
      } else if (this.actor) this.closeActor();
      if (this.forms) this.forms.tick(dt);
      this.stepMinions();
      this.stepAlly(dt, s);
      this.refresh();
    }

    // ── Actor del jefe en el mundo ──
    ensureActor() {
      const a = this.app, t = a.session, s = this.state();
      if (!s || !s.king || !t || !t.world) return;
      if (this.actor && this.actorWorld === t.world && t.world.entities.includes(this.actor)) return;
      this.closeActor();
      const w = t.world, k = s.king, c = this.findCenter();
      const ids = new Set(w.entities.map(e => e.id));
      let id = BOSS_ID_MIN; while (ids.has(id) && id <= BOSS_ID_MAX) id++;
      if (id > BOSS_ID_MAX) return;
      const foe = { name: 'Rey Slime', hp: k.maxHp, chase: k.speed, attack: { kind: 'embestida', range: 0, windup: 1, lunge: 0, lungeTime: 0.3, hitR: 1.2, dmg: k.atk, cd: 99 } };
      const rand = { range: (lo, hi) => lo + (hi - lo) * Math.random(), fork: () => rand };
      const x = c ? c.x : k.x, y = c ? c.y : k.y, z = a.terrain.surfaceAt(x, y);
      const zz = Number.isFinite(z) ? z : t.avatar.z;
      const actor = {
        id, kind: 1, species: 'limo', hue: k.hue, royal: true, heavy: true, foe, slot: false, r: 1.05, homeX: x, homeY: y, x, y, z: zz,
        px: x, py: y, pz: zz, vx: 0, vy: 0, facing: 0, moving: false, animT: 0, tp: 0, state: 0, timer: 0.5, tx: x, ty: y, rng: rand,
        maxHp: k.maxHp, hp: k.hp > 0 ? k.hp : k.maxHp, mul: 2 + k.level * 0.28, gen: 0, dead: false, deadT: 0, ag: t.self.pid, agT: 0,
        stagger: 0, kbx: 0, kby: 0, kbT: 0, poise: 0, threat: new Map([[t.self.pid, 10]]), atk: 0, atkT: 0, atkCd: 99,
        aimX: 0, aimY: 0, lvx: 0, lvy: 0, hitSet: new Set(), mood: 0
      };
      actor.ai = { st: 'idle', t: 0, wait: 1.2, h: 0, oh: 0, ox: x, oy: y, slamCd: 2, chargeCd: 1.5, summons: 0, lastHp: actor.hp, flash: 0, hurt: 0, flip: false, hit: false, note: '' };
      this.clearArena();
      w.entities.push(actor);
      this.actor = actor; this.actorWorld = w;
      if (this.forms) this.forms.onActor(actor);
      if (t.combat) t.combat.targetId = id;
    }
    closeActor() {
      if (this.actorWorld && this.actor) {
        this.actorWorld.entities = this.actorWorld.entities.filter(e => e !== this.actor);
        const vis = this.app.view && this.app.view.entityVis && this.app.view.entityVis.get(this.actor.id);
        if (vis) { vis.sprite.visible = false; if (vis.shadow) vis.shadow.visible = false; }
      }
      this.actor = null; this.actorWorld = null;
      if (this.forms) this.forms.reset();
      if (this.ui) this.ui.setBoss(null);
      if (this.audio) this.audio.stopMusic(0.8);
    }
    saveHp() {
      const s = this.state();
      if (s && s.stage === 'battle' && s.king && this.actor && !this.actor.dead) { s.king.hp = Math.max(1, Math.round(this.actor.hp)); this.app.saves.markDirty(); }
    }

    // ── IA del Rey (fase 1) — corre DENTRO del paso del mundo ──
    bossStep(e, dt, w) {
      const ai = e.ai; if (!ai) return;
      if (this.forms && this.forms.step(e, dt, w)) return; // Formas II, III y transformaciones
      ai.ox = e.x; ai.oy = e.y; ai.oh = ai.h; ai.t += dt;
      ai.slamCd -= dt; ai.chargeCd -= dt;
      e.moving = false; e.vx = 0; e.vy = 0; e.atk = 0; e.high = ai.st === 'slam' && ai.phase === 'air';
      const sess = this.app.session, av = sess && sess.avatar, pid = sess && sess.self.pid;
      const down = !av || sess.isDown(pid);
      const c = this.findCenter();
      const dPC = av && c ? Math.hypot(av.x - c.x, av.y - c.y) : 99;
      const dist = av ? Math.hypot(av.x - e.x, av.y - e.y) : 99;
      const k = this.state().king;
      if (e.hp < ai.lastHp) {
        ai.flash = 0.1;
        if (ai.st === 'idle' || ai.st === 'dazed') ai.hurt = 0.22;
      }
      ai.lastHp = e.hp;
      ai.flash = Math.max(0, ai.flash - dt); ai.hurt = Math.max(0, ai.hurt - dt);
      // La escalada del combate llegará con las transformaciones (fase B).
      const spd = 1;
      const atk = k.atk;
      const enter = (st, extra) => { ai.st = st; ai.t = 0; ai.phase = ''; ai.hit = false; ai.note = ''; Object.assign(ai, extra || {}); };
      const face = (x) => { ai.flip = x < e.x; };
      const busy = ['charge', 'slam', 'bounce', 'summon'].includes(ai.st);
      // Abandono de la arena o jugador caído: vuelve a su trono.
      if ((down || dPC > ARENA.lose) && !busy && ai.st !== 'return') { enter('return'); ai.note = down ? 'El Rey Slime recupera fuerzas…' : 'El Rey Slime vuelve a su trono'; }
      if (ai.st === 'return' && !ai.note) ai.note = down ? 'El Rey Slime recupera fuerzas…' : 'El Rey Slime vuelve a su trono';
      const hitPlayer = (mul, r) => {
        if (ai.hit || down || !av) return false;
        if (Math.hypot(av.x - e.x, av.y - e.y) > r || Math.abs(av.z - e.z) > 0.9) return false;
        ai.hit = true;
        w.playerHits.push({ pid, dmg: Math.max(1, Math.round(atk * mul)), id: e.id, x: e.x, y: e.y, st: null, dps: 0 });
        return true;
      };
      const move = (vx, vy) => {
        const moved = w._move(e, vx, vy, dt);
        if (c) {
          const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy);
          if (d > ARENA.leash) { e.x = c.x + dx / d * ARENA.leash; e.y = c.y + dy / d * ARENA.leash; const z = this.app.terrain.surfaceAt(e.x, e.y); if (z === z) e.z = z; return false; }
        }
        return moved;
      };
      const stepHop = (onLand) => {
        if (ai.phase === 'crouch') {
          if (ai.t >= 0.13 / spd) { ai.phase = 'air'; ai.t = 0; ai.sx = e.x; ai.sy = e.y; }
        } else if (ai.phase === 'air') {
          const u = Math.min(1, ai.t / ai.dur);
          ai.h = Math.sin(u * Math.PI) * 0.55;
          move((ai.tx - ai.sx) / ai.dur, (ai.ty - ai.sy) / ai.dur); e.moving = true;
          if (u >= 1) { ai.phase = 'land'; ai.t = 0; ai.h = 0; this.fxDust(e.x, e.y, 4, 0.8); if (this.audio) this.audio.thud(); }
        } else if (ai.phase === 'land') {
          if (ai.t >= 0.14 / spd) onLand();
        }
      };
      const hopTo = (tx, ty, maxStep) => {
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, step = Math.min(d, maxStep);
        enter('hop', { tx: e.x + dx / d * step, ty: e.y + dy / d * step, dur: 0.36 / spd });
        face(tx);
      };
      switch (ai.st) {
        case 'idle': {
          ai.h = 0;
          if (av && !down) face(av.x);
          if (ai.t < ai.wait) break;
          if (!av || down) break;
          const pick = pickAttack({ d: dist, hpFrac: e.hp / e.maxHp, summons: ai.summons, minions: this.minions.filter(m => !m.dead).length, slamCd: ai.slamCd, chargeCd: ai.chargeCd }, Math.random());
          if (pick === 'summon') { enter('summon'); ai.summons++; }
          else if (pick === 'bounce') { enter('bounce', { phase: 'crouch' }); face(av.x); }
          else if (pick === 'slam') { enter('slam', { phase: 'crouch', tx: av.x, ty: av.y }); ai.slamCd = 7 / spd; }
          else if (pick === 'charge') { enter('charge', { phase: 'windup', dx: av.x - e.x, dy: av.y - e.y }); ai.chargeCd = 4.5 / spd; face(av.x); }
          else hopTo(av.x, av.y, Math.max(0.6, Math.min(dist - 1.4, 0.9 + k.speed * 0.8)));
          break;
        }
        case 'hop': {
          if (!ai.phase) ai.phase = 'crouch';
          stepHop(() => enter('idle', { wait: 0.35 + Math.random() * 0.3 }));
          break;
        }
        case 'return': {
          const back = c ? Math.hypot(e.x - c.x, e.y - c.y) : 0;
          if (!ai.phase || ai.phase === 'rest') {
            if (back < 0.5) {
              ai.phase = 'rest'; ai.h = 0;
              e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (down ? 0.5 : 0.06) * dt);
              ai.lastHp = e.hp;
              if (e.hp / e.maxHp > 0.7) ai.summons = 0; else if (e.hp / e.maxHp > 0.4) ai.summons = Math.min(ai.summons, 1);
              if (!down && dPC < ARENA.lose - 2) { ai.note = ''; enter('idle', { wait: 0.6 }); }
              break;
            }
            const dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, 1.6);
            ai.phase = 'crouch'; ai.t = 0; ai.dur = 0.36; ai.tx = e.x + dx / d * st; ai.ty = e.y + dy / d * st; face(c.x);
          }
          stepHop(() => { ai.phase = ''; ai.t = 0; });
          break;
        }
        case 'bounce': {
          if (ai.phase === 'crouch') {
            if (av) { ai.tx = av.x; ai.ty = av.y; face(av.x); }
            if (ai.t >= 0.42 / spd) { ai.phase = 'air'; ai.t = 0; ai.sx = e.x; ai.sy = e.y; if (this.audio) this.audio.whoosh(true); }
          } else if (ai.phase === 'air') {
            const dur = 0.5, u = Math.min(1, ai.t / dur);
            ai.h = Math.sin(u * Math.PI) * 1.5;
            move((ai.tx - ai.sx) / dur, (ai.ty - ai.sy) / dur);
            if (u >= 1) {
              ai.phase = 'land'; ai.t = 0; ai.h = 0;
              hitPlayer(0.8, 1.55);
              this.app.shakeT = Math.max(this.app.shakeT || 0, 0.18);
              this.stage.shock(e.x, e.z, e.y, 1.8, 0.35); this.fxDust(e.x, e.y, 7, 1.4);
              if (this.audio) this.audio.boom(false);
            }
          } else if (ai.t >= 0.5 / spd) enter('idle', { wait: 0.4 + Math.random() * 0.3 });
          break;
        }
        case 'charge': {
          if (ai.phase === 'windup') {
            if (av && ai.t < 0.62 / spd) { ai.dx = av.x - e.x; ai.dy = av.y - e.y; face(av.x); }
            if (ai.t >= 0.85 / spd) {
              const d = Math.hypot(ai.dx, ai.dy) || 1; ai.dx /= d; ai.dy /= d;
              ai.phase = 'dash'; ai.t = 0; if (this.audio) this.audio.whoosh(false);
            }
          } else if (ai.phase === 'dash') {
            const v = 10.5 * spd;
            const before = { x: e.x, y: e.y };
            const moved = move(ai.dx * v, ai.dy * v);
            e.moving = true;
            hitPlayer(0.9, 1.25);
            if (Math.random() < 0.5) this.fxDust(e.x - ai.dx * 0.8, e.y - ai.dy * 0.8, 1, 0.4);
            const stuck = !moved || Math.hypot(e.x - before.x, e.y - before.y) < v * dt * 0.3;
            if (stuck && ai.t > 0.06) {
              // ¡Choque! Se aturde: la gran oportunidad del jugador.
              enter('dazed', { dur: 1.8 }); ai.note = '¡Aturdido! Es tu oportunidad';
              this.app.shakeT = Math.max(this.app.shakeT || 0, 0.3);
              this.stage.shock(e.x + ai.dx * 0.9, e.z, e.y + ai.dy * 0.9, 1.6, 0.35);
              this.fxStars(e); if (this.audio) this.audio.boom(false);
            } else if (ai.t >= 0.55) { ai.phase = 'skid'; ai.t = 0; this.fxDust(e.x, e.y, 5, 1); }
          } else if (ai.phase === 'skid') {
            const v = Math.max(0, 6 * (1 - ai.t / 0.35));
            move(ai.dx * v, ai.dy * v);
            if (ai.t >= 0.75 / spd) enter('idle', { wait: 0.3 });
          }
          break;
        }
        case 'slam': {
          if (ai.phase === 'crouch') {
            if (ai.t >= 0.55 / spd) { ai.phase = 'rise'; ai.t = 0; if (this.audio) this.audio.whoosh(true); this.fxDust(e.x, e.y, 6, 1.2); }
          } else if (ai.phase === 'rise') {
            ai.h = 10 * ease(Math.min(1, ai.t / 0.32));
            if (ai.t >= 0.32) { ai.phase = 'air'; ai.t = 0; }
          } else if (ai.phase === 'air') {
            ai.h = 10;
            // Persigue al jugador y luego fija el objetivo (círculo de aviso).
            const lock = 0.95 / spd;
            if (av && ai.t < lock - 0.4) {
              const k2 = Math.min(1, dt * 3.2);
              ai.tx = lerp(ai.tx, av.x, k2); ai.ty = lerp(ai.ty, av.y, k2);
              if (c) { const dx = ai.tx - c.x, dy = ai.ty - c.y, d = Math.hypot(dx, dy); if (d > ARENA.leash) { ai.tx = c.x + dx / d * ARENA.leash; ai.ty = c.y + dy / d * ARENA.leash; } }
            }
            if (Math.floor(ai.t * 6) !== Math.floor((ai.t - dt) * 6) && this.audio) this.audio.warn();
            if (ai.t >= lock) {
              const T = this.app.terrain, z = T.surfaceAt(ai.tx, ai.ty);
              if (z === z && Math.abs(z - e.z) < 0.01) { e.x = ai.tx; e.y = ai.ty; ai.ox = e.x; ai.oy = e.y; }
              ai.phase = 'fall'; ai.t = 0;
            }
          } else if (ai.phase === 'fall') {
            ai.h = 10 * (1 - Math.min(1, ai.t / 0.2));
            if (ai.t >= 0.2) {
              ai.h = 0; ai.phase = 'land'; ai.t = 0;
              hitPlayer(1.35, 2.45);
              this.app.shakeT = Math.max(this.app.shakeT || 0, reduced() ? 0.1 : 0.42);
              this.stage.shock(e.x, e.z, e.y, 3.6, 0.5); this.stage.shock(e.x, e.z, e.y, 2.2, 0.32);
              this.stage.crack(e.x, e.z, e.y); this.fxDust(e.x, e.y, 12, 2.4); this.fxDrops(e, 8);
              if (this.audio) this.audio.boom(true);
            }
          } else if (ai.phase === 'land') {
            if (ai.t >= 0.28) { enter('dazed', { dur: 1.6 }); ai.note = '¡Aturdido! Es tu oportunidad'; this.fxStars(e); }
          }
          break;
        }
        case 'dazed': {
          ai.h = 0;
          if (ai.t >= (ai.dur || 1.5)) { ai.note = ''; enter('idle', { wait: 0.25 }); }
          break;
        }
        case 'summon': {
          if (ai.t >= 0.55 && !ai.hit) { ai.hit = true; this.summonMinions(e); }
          if (ai.t >= 1.35) enter('idle', { wait: 0.4 });
          break;
        }
        default: enter('idle', { wait: 0.6 });
      }
      if (ai.st !== 'return' && ai.note && ai.note.startsWith('El Rey Slime') && !down) ai.note = '';
      e.homeX = c ? c.x : e.x; e.homeY = c ? c.y : e.y;
      e.facing = ai.flip ? 6 : 2;
    }

    summonMinions(e) {
      const sess = this.app.session, w = sess && sess.world; if (!w) return;
      const k = this.state().king, alive = this.minions.filter(m => !m.dead && w.entities.includes(m)).length;
      const F = FORMS[this.forms ? this.forms.form() : 1];
      const n = Math.max(0, Math.min(F.wave, F.cap - alive)); if (!n) return;
      if (this.audio) this.audio.summon();
      const tpl = w.entities.find(x => x.species === 'limo' && !x.ally && !x.royal && !x.reyMinion && x.foe);
      const baseFoe = tpl ? tpl.foe : { name: 'Limo', hp: 60, chase: 1.7, attack: { kind: 'salto', range: 1.15, windup: 0.6, lunge: 1, lungeTime: 0.2, hitR: 0.6, dmg: 8, cd: 1.5 } };
      const ids = new Set(w.entities.map(x => x.id));
      const pool = []; HUES.forEach((h, i) => { for (let j = 0; j < k.mix[i]; j++) pool.push(h); });
      for (let i = 0; i < n; i++) {
        let id = MINION_ID_MIN; while (ids.has(id) && id <= MINION_ID_MAX) id++;
        if (id > MINION_ID_MAX) break;
        ids.add(id);
        const ang = Math.random() * TAU, r = 2 + Math.random() * 0.8;
        let x = e.x + Math.cos(ang) * r, y = e.y + Math.sin(ang) * r;
        const z = this.app.terrain.surfaceAt(x, y);
        if (z !== z || Math.abs(z - e.z) > 0.01) { x = e.x; y = e.y; }
        const hue = pool[Math.floor(Math.random() * pool.length)] || k.hue;
        const foe = { ...baseFoe, name: 'Súbdito real', hp: Math.round(baseFoe.hp * 0.8), attack: { ...baseFoe.attack, dmg: Math.max(4, Math.round(baseFoe.attack.dmg * 0.9)) } };
        const rand = { range: (lo, hi) => lo + (hi - lo) * Math.random(), fork: () => rand };
        const m = {
          id, kind: 1, hue, foe, species: 'limo', slot: false, reyMinion: true, r: 0.32, homeX: x, homeY: y, x, y, z: e.z, vx: 0, vy: 0, facing: 0, moving: false,
          animT: 0, tp: 0, state: 0, timer: 0.5, tx: x, ty: y, rng: rand, maxHp: foe.hp, hp: foe.hp, gen: 0, dead: false, deadT: 0,
          ag: sess.self.pid, agT: 0, stagger: 0, kbx: 0, kby: 0, kbT: 0, poise: 0, threat: new Map([[sess.self.pid, 5]]), atk: 0, atkT: 0, atkCd: 0.8,
          aimX: 0, aimY: 0, lvx: 0, lvy: 0, hitSet: new Set(), px: x, py: y, pz: e.z, mood: 0, born: 0.55
        };
        // Se lanza como gota y aparece al caer.
        this.fxThrow(e, x, y, hue, () => {
          if (!this.actor || this.actorWorld !== w) return;
          w.entities.push(m); this.minions.push(m);
          if (sess._fx) sess._fx({ k: 'poof', x, y, z: m.z });
        });
      }
    }
    stepMinions() {
      const w = this.app.session && this.app.session.world;
      for (let i = this.minions.length - 1; i >= 0; i--) {
        const m = this.minions[i];
        if (!w || !w.entities.includes(m)) { this.minions.splice(i, 1); continue; }
        // Se retiran al morir (antes de que el mundo los haga renacer).
        if (m.dead) { w.entities = w.entities.filter(x => x !== m); this.minions.splice(i, 1); continue; }
        // Si el Rey no está, se disuelven.
        if (!this.actor) { m.dead = true; m.hp = 0; m.deadT = 0.6; }
      }
    }
    clearMinions(silent) {
      const sess = this.app.session, w = sess && sess.world;
      for (const m of this.minions) {
        if (w && w.entities.includes(m)) { w.entities = w.entities.filter(x => x !== m); if (!silent && sess._fx) sess._fx({ k: 'poof', x: m.x, y: m.y, z: m.z }); }
      }
      this.minions = [];
    }

    onBossDefeated() {
      const s = this.state(), e = this.actor, k = s.king;
      const pos = { x: e.x, y: e.y, z: e.z };
      s.king.hp = 0; s.stage = 'decision';
      this.clearMinions(false);
      this.closeActor();
      this.persist();
      if (this.audio) { this.audio.stopMusic(0.3); setTimeout(() => this.audio && this.audio.victory(), 350); }
      this.startCine('death', { pos, spec: k });
    }

    // ── Ritual ──
    onChip() {
      const s = this.state(); if (!s) return;
      if (!this.soloSession()) { this.notice('El ritual solo está disponible en partida individual.'); return; }
      if (s.stage === 'decision' && !this.cine) { this.openDecision(); return; }
      if (this.nearSanctuary() || s.stage !== 'collect') {
        if (s.stage === 'collect') this.togglePanel(true);
        else this.guide();
        return;
      }
      this.guide();
    }
    guide() {
      if (!this.inValley()) { this.notice('El Santuario de la Corona está en el Valle del Alba, fuera de la Torre.'); return; }
      this.findCenter();
      const s = this.state();
      this.notice(s && s.stage === 'battle' ? 'El Rey Slime te espera en su santuario. Sigue la flecha.' : 'El Santuario de la Corona está en el claro del bosque, al norte del campamento. Sigue la flecha.', 'gold', 4600);
      this.compassT = 16;
    }
    interact() {
      const s = this.state(); if (!s) return;
      if (s.stage === 'collect') this.togglePanel(true);
      else if (s.stage === 'decision') this.openDecision();
      else this.notice('¡El Rey Slime ya despertó! Enfréntalo.', 'bad');
    }
    togglePanel(yes) {
      if (!this.ui) return;
      if (yes && (!this.solo() || this.app.ui.isPauseOpen())) { this.notice('El ritual solo está disponible durante la partida individual.'); return; }
      if (yes && !this.nearSanctuary()) { this.guide(); return; }
      this.open = !!yes; this.ui.panel.hidden = !yes;
      this.syncPause();
      if (yes) { if (this.app.audio) this.app.audio.play('emote', { pitch: 1.2 }); setTimeout(() => { const b = $('tm-rey-close'); if (b) b.focus({ preventScroll: true }); }, 0); }
      this.refresh(true);
    }
    place(uid) {
      if (!this.soloSession()) return;
      const p = this.app.data.progress, s = this.state();
      try {
        const before = s.pieces.length;
        takePiece(s, p.companions, uid);
        p.party = (p.party || []).filter(x => x !== uid); p.companion = p.party[0] || null;
        this.app._applyParty(true); this.app._renderCompanions();
        this.slotAnim[before] = { kind: 'in', t0: now() };
        if (this.audio) this.audio.place(before);
        this.persist(); this.refresh(true);
      } catch (e) { this.notice(e.message, 'bad'); }
    }
    remove(index) {
      const p = this.app.data.progress, s = this.state(); if (!s) return;
      try {
        const hue = s.pieces[index] && s.pieces[index].hue;
        giveBack(s, p.companions, index);
        this.app._renderCompanions();
        this.slotAnim.splice(index, 1); this.slotAnim.push(null);
        this.leaving = { hue, i: index, t0: now() };
        if (this.audio) this.audio.unplace();
        this.persist(); this.refresh(true);
      } catch (e) { this.notice(e.message, 'bad'); }
    }
    summon() {
      if (!this.solo()) return;
      const s = this.state();
      if (!s || s.stage !== 'collect' || s.pieces.length !== LIMIT) { this.notice('Coloca diez limos diferentes antes de invocar.'); return; }
      const c = this.findCenter();
      const seed = 1 + (Math.floor(Date.now() / 1000) + s.cycle * 8191) % 2147483645;
      const boss = compose(s.pieces, seed);
      Object.assign(boss, { x: c.x, y: c.y, world: this.app.terrain.id });
      const consumed = s.pieces.map(q => ({ ...q }));
      s.king = boss; s.stage = 'battle'; s.pieces = []; s.cycle++;
      this.persist();
      this.open = false; this.ui.panel.hidden = true;
      this.clearArena();
      this.startCine('fusion', { spec: boss, pieces: consumed });
    }

    // Los animales del claro huyen cuando empieza el ritual (no tapan la escena).
    clearArena() {
      const sess = this.app.session, w = sess && sess.world, c = this.center, T = this.app.terrain;
      if (!w || !c) return;
      for (const e of w.entities) {
        if (e.ally || e.royal || e.reyMinion || e.dead) continue;
        const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy);
        if (d > 7.6) continue;
        const a = d > 0.01 ? Math.atan2(dy, dx) : Math.random() * TAU;
        for (const r of [9.2, 10.5, 12, 14]) {
          const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r, z = T.surfaceAt(x, y);
          if (z !== z || Math.abs(z - c.z) > 0.01) continue;
          if (sess._fx) sess._fx({ k: 'poof', x: e.x, y: e.y, z: e.z });
          e.x = e.px = x; e.y = e.py = y; e.z = e.pz = z; e.homeX = x; e.homeY = y; e.tx = x; e.ty = y; e.state = 0; e.timer = 1.5; e.tp = (e.tp + 1) & 255;
          break;
        }
      }
    }

    // ── Decisión ──
    openDecision() {
      const s = this.state(); if (!s || s.stage !== 'decision' || !s.king || !this.ui) return;
      const k = s.king, wid = chooseWeapon(k.seed), info = WEAPON_INFO[wid];
      $('tm-rey-weapon').textContent = `Obtienes: ${info.name} (${info.kind})`;
      $('tm-rey-pardon-note').textContent = s.ally ? 'Reemplaza a tu Rey aliado actual' : 'Aliado único';
      const A = ART();
      try {
        const c1 = $('tm-rey-pardon').querySelector('canvas'), g1 = c1.getContext('2d'); g1.imageSmoothingEnabled = false; g1.clearRect(0, 0, 64, 64); g1.drawImage(A.portrait(k), 0, 0);
        const c2 = $('tm-rey-finish').querySelector('canvas'), g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false; g2.clearRect(0, 0, 48, 48); g2.drawImage(A.weaponIcon(wid).canvas, 0, 0, 48, 48);
      } catch (_) { /* iconos opcionales */ }
      this.decisionOpen = true; this.ui.decide.hidden = false; this.syncPause();
      setTimeout(() => { const b = $('tm-rey-pardon'); if (b) b.focus({ preventScroll: true }); }, 0);
    }
    resolve(pardon) {
      const s = this.state(); if (!s || s.stage !== 'decision' || !s.king) return;
      const king = s.king;
      let weapon = null;
      if (pardon) {
        s.ally = { hue: king.hue, mix: king.mix.slice(), level: king.level, seed: king.seed, prism: king.prism };
        s.history.push({ seed: king.seed, reward: 'aliado' });
      } else {
        const id = chooseWeapon(king.seed), gear = this.app.data.profile.gear;
        if (!gear || !Array.isArray(gear.items) || gear.items.length >= 60) { this.notice('Inventario lleno. Libera espacio para recibir el arma del Rey.', 'bad'); return; }
        gear.items.push({ u: gear.next++, i: id, d: 0 }); s.history.push({ seed: king.seed, reward: id });
        weapon = id;
        if (this.app.gearScreen && this.app.gearScreen.refresh) this.app.gearScreen.refresh();
      }
      s.history = s.history.slice(-12); s.stage = 'collect'; s.king = null;
      this.persist();
      this.decisionOpen = false; this.ui.decide.hidden = true;
      this.startCine(pardon ? 'pardon' : 'finish', { spec: king, weapon });
    }

    // ── Aliado (lógica de daño original + movimiento con saltos) ──
    stepAlly(dt, s) {
      if (!s.ally || this.cine) return;
      const t = this.app.session; if (!t || !t.avatar || !t.world) return;
      this.attackT -= dt;
      if (this.attackT > 0) return;
      const p = t.avatar;
      const enemies = t.world.entities.filter(e => !e.ally && !e.dead && !e.royal && e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 4);
      enemies.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      if (enemies.length) {
        const foe = enemies[0], dmg = 8 + s.ally.level * 2;
        const hit = t.companionHit(foe, dmg, p.x, p.y, { element: s.ally.prism ? 'arcano' : null });
        if (hit && hit.ok) { this.attackT = 2.25; this.allyLunge = { x: foe.x, y: foe.y, t0: now() }; }
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // Cinemáticas (tiempo real, con el mundo detenido)
    // ════════════════════════════════════════════════════════════════════
    startCine(kind, data) {
      const pr = this.app.pr;
      if (this.audio) this.audio.decodeTrack();
      this.cine = { kind, t: 0, last: now(), data, cam0: pr ? { x: pr.col / 16, i: -pr.row / 16 } : null, fired: new Set(), skippable: kind === 'fusion' };
      this.syncPause();
      if (this.ui) {
        this.ui.cine.hidden = false;
        this.ui.cine.classList.toggle('is-thin', kind !== 'fusion');
        this.ui.cine.classList.remove('is-out'); void this.ui.cine.offsetWidth; this.ui.cine.classList.add('is-in');
        $('tm-rey-skip').hidden = true; $('tm-rey-title').hidden = true;
      }
      root.document.body.classList.add('tm-rey-cinema');
    }
    skipCine() { if (this.cine && this.cine.kind === 'fusion' && this.cine.t < 9.0) { this.cine.t = 9.0; this.cine.skipped = true; if (this.audio) this.audio.roar(); } }
    endCine() {
      const c = this.cine; if (!c) return;
      this.cine = null;
      if (this.ui) { this.ui.cine.classList.remove('is-in'); this.ui.cine.classList.add('is-out'); setTimeout(() => { if (!this.cine && this.ui) this.ui.cine.hidden = true; }, 520); }
      root.document.body.classList.remove('tm-rey-cinema');
      if (this.app.pr) { this.app.pr.setDark(0); }
      if (c.kind === 'fusion') {
        this.ensureActor();
        if (this.audio) this.audio.startMusic();
        if (this.actor) this.actor.ai.wait = 0.9;
      }
      if (c.kind === 'death') { this.post = null; this.openDecision(); }
      if (c.kind === 'pardon') { this.notice('El Rey Slime reconoce tu misericordia. ¡Ahora te protege!', 'good'); this.allyPos = null; }
      if (c.kind === 'finish') { if (this.app.audio) this.app.audio.play('levelup'); }
      this.syncPause();
      this.refresh(true);
    }
    endEverything() {
      if (this.cine) { this.cine = null; root.document.body.classList.remove('tm-rey-cinema'); if (this.ui) this.ui.cine.hidden = true; }
      if (this.ui) { this.ui.panel.hidden = true; this.ui.decide.hidden = true; this.ui.setBoss(null); this.ui.compass.hidden = true; }
      this.open = false; this.decisionOpen = false;
      this.clearMinions(true); this.closeActor();
      if (this.audio) this.audio.stopMusic(0.3);
      this.stage.hideAll();
    }

    // ════════════════════════════════════════════════════════════════════
    // Dibujo (cada cuadro, antes de renderizar)
    // ════════════════════════════════════════════════════════════════════
    beforeDraw() {
      const t = now(), dt = Math.min(0.05, Math.max(0, (t - (this.lastDraw || t)) / 1000));
      this.lastDraw = t;
      const a = this.app, s = this.state();
      const show = s && a.view && a.session && this.soloSession() && this.inValley() && a.mode === 'game';
      if (!show) { if (this.stage.group) this.stage.hideAll(); if (this.ui) { this.ui.compass.hidden = true; this.ui.setBoss(null); } return; }
      if (!this.findCenter() || !this.stage.ensure(a.view)) return;
      const T = a.terrain, zAt = (x, y) => { const z = T.surfaceAt(x, y); return z === z ? z : this.center.z; };
      if (this.cine) {
        this.cine.t += Math.min(0.05, (t - this.cine.last) / 1000) * (this.cine.slow || 1);
        this.cine.last = t;
        this.cine.slow = 1;
      }
      this.drawSanctuary(dt, s, zAt);
      this.drawKing(dt, s, zAt);
      if (this.forms && !this.cine) this.forms.camera(dt);
      this.drawAlly(dt, s, zAt);
      this.stage.stepParts(dt, zAt);
      this.stage.stepDecals(dt);
      if (this.cine) this.runCine(dt, s, zAt);
      this.drawCompass(dt);
      // Barra del jefe.
      if (this.ui) {
        if (this.actor && s.stage === 'battle' && !this.cine) this.ui.setBoss(s.king, this.actor.hp, this.actor.maxHp, this.actor.ai.note || '', dt);
        else this.ui.setBoss(null);
      }
      // El sprite pequeño del motor para el actor queda oculto.
      if (this.actor) { const v = a.view.entityVis.get(this.actor.id); if (v) { v.sprite.visible = false; if (v.shadow) v.shadow.visible = false; } }
    }

    drawSanctuary(dt, s, zAt) {
      const st = this.stage, c = this.center, time = now() / 1000;
      const cine = this.cine && this.cine.kind === 'fusion' ? this.cine : null;
      st.platform.visible = true; placeFlat(st.platform, c.x, c.z, c.y, 0.022);
      // Pedestales y limos.
      const pieces = cine ? cine.data.pieces : (s.stage === 'collect' ? s.pieces : []);
      for (let i = 0; i < LIMIT; i++) {
        const sl = st.slots[i], p = this.pedestal(i), z = zAt(p.x, p.y), piece = pieces[i];
        const lit = piece ? (cine ? cine.t >= 1.0 + i * 0.15 : true) : false;
        sl.ped.visible = true; setFrame(sl.pedMat, lit ? 1 + HUES.indexOf(piece.hue) : 0, 0, 4, 1, false);
        placeUp(sl.ped, p.x, z, p.y);
        sl.shadow.visible = true; placeFlat(sl.shadow, p.x, z, p.y + 0.06);
        // Limo sobre el pedestal.
        let show = !!piece, sx = p.x, sy = p.y, sh = 1.5, frame = Math.floor(time * 2.5 + i * 0.7) % 2;
        if (piece && !cine) {
          const an = this.slotAnim[i];
          if (an && an.kind === 'in') {
            const u = (now() - an.t0) / 550;
            if (u >= 1) this.slotAnim[i] = null;
            else {
              const av = this.app.session.avatar, k = ease(u);
              sx = lerp(av.x, p.x, k); sy = lerp(av.y, p.y, k); sh = lerp(0.2, 1.5, k) + Math.sin(u * Math.PI) * 1.6; frame = 3;
              if (u > 0.9 && !an.poofed) { an.poofed = true; this.fxBurst(p.x, p.y, 1.6, 'spark', 5); }
            }
          }
        }
        if (cine && piece) {
          const leap = 2.5 + i * 0.18, land = leap + 0.55;
          if (cine.t >= land) show = false;
          else if (cine.t >= leap) {
            const u = (cine.t - leap) / 0.55;
            sx = lerp(p.x, c.x, u); sy = lerp(p.y, c.y, u); sh = lerp(1.5, 1.4, u) + Math.sin(u * Math.PI) * 2.2; frame = 3;
          }
        }
        if (show) {
          if (!sl.slime || sl.hue !== piece.hue) {
            if (sl.slime) { st.group.remove(sl.slime); sl.slime = null; }
            if (sl.slimeTex) { sl.slimeMat = st.mat(sl.slimeTex(piece.hue)); sl.slime = st.mesh(sl.slimeGeo, sl.slimeMat); sl.hue = piece.hue; }
          }
          if (sl.slime) {
            sl.slime.visible = true;
            setFrame(sl.slimeMat, frame, 0, 4, 3, sx < c.x);
            const bob = cine ? 0 : (Math.floor(time * 2.5 + i) % 2) / 16;
            placeUp(sl.slime, sx, z + sh + bob, sy, 0.45);
          }
        } else if (sl.slime) sl.slime.visible = false;
        // Columna de luz (fusión).
        if (cine && piece) {
          const on = 1.0 + i * 0.15, u = (cine.t - on) / 1.4;
          sl.beam.visible = u > 0 && u < 1;
          if (sl.beam.visible) { sl.beam.material.opacity = (1 - u) * 0.85; sl.beam.scale.set(1, 1 + u * 0.4, 1); placeUp(sl.beam, p.x, z + 0.6, p.y, 0.8); }
        } else sl.beam.visible = false;
      }
      // Limo que vuelve al jugador.
      if (this.leaving) {
        const L = this.leaving, u = (now() - L.t0) / 450, p = this.pedestal(L.i);
        if (u >= 1 || !this.app.session.avatar) this.leaving = null;
        else if (L.hue) this.fxBurst(lerp(p.x, this.app.session.avatar.x, u), lerp(p.y, this.app.session.avatar.y, u), 1.2 + Math.sin(u * Math.PI), 'drop' + HUES.indexOf(L.hue), 1, 0.25);
      }
      // Canales de luz.
      const slots = [];
      for (let i = 0; i < LIMIT; i++) {
        const piece = pieces[i];
        if (!piece) { slots.push(null); continue; }
        const fill = cine ? clamp((cine.t - (1.0 + i * 0.15)) / 0.5, 0, 1) : 0.0;
        slots.push({ hue: piece.hue, fill: cine && cine.t > 6.8 ? 0 : fill });
      }
      const center = cine ? clamp((cine.t - 2.5) / 2.3, 0, 1) * (cine.t > 6.8 ? 0 : 1) : (pieces.length === LIMIT ? 0.25 + 0.1 * Math.sin(time * 3) : 0);
      const pulse = Math.floor(time * 8);
      const key = slots.map(q => q ? q.hue + (q.fill * 20 | 0) : '-').join(',') + '|' + (center * 20 | 0) + '|' + (cine ? pulse : 0);
      if (key !== st.chanKey) {
        st.chanKey = key;
        ART().channelsLayer(st.chanPx, slots, center, pulse / 8);
        const g = st.chanTex.image.getContext('2d');
        g.putImageData(new ImageData(st.chanPx.d, st.chanPx.w, st.chanPx.h), 0, 0);
        st.chanTex.needsUpdate = true;
      }
      st.channels.visible = pieces.length > 0 || !!cine;
      placeFlat(st.channels, c.x, c.z, c.y, 0.028);
      // Estatua y braseros.
      const sp = this.statuePos(), sz = zAt(sp.x, sp.y);
      st.statue.visible = true; st.statueShadow.visible = true;
      setFrame(st.statueMat, pieces.length || s.stage !== 'collect' ? 1 : 0, 0, 2, 1, false);
      placeUp(st.statue, sp.x, sz, sp.y); placeFlat(st.statueShadow, sp.x, sz, sp.y + 0.1);
      const fr = Math.floor(time * 8);
      st.braziers.forEach((b, i) => {
        const bp = this.brazierPos(i), bz = zAt(bp.x, bp.y);
        b.mesh.visible = true; setFrame(b.mat, (fr + i * 2) % 4, 0, 4, 1, false); placeUp(b.mesh, bp.x, bz, bp.y);
        st.setGlow('braz' + i, { x: bp.x, y: bp.y, z: bz + 1.1, r: 3.2, color: [0.18, 0.34, 0.75], pulse: 1, prio: 2 });
      });
      const glowK = pieces.length / LIMIT;
      st.setGlow('statue', { x: sp.x, y: sp.y + 0.4, z: sz + 2.2, r: 3 + glowK * 2, color: [0.62 * (0.4 + glowK), 0.46 * (0.4 + glowK), 0.14], pulse: 1, prio: 3 });
    }

    drawKing(dt, s, zAt) {
      const st = this.stage, cine = this.cine;
      const e = this.actor;
      const spec = (cine && cine.data && cine.data.spec) || s.king;
      if (!cine && !e && s.stage === 'decision' && spec) {
        // Rey vencido esperando tu decisión (también tras recargar).
        const K = st.kingSprite(spec), c = this.center, time = now() / 1000;
        st.kingFrame(Math.floor(time * 2) % 2 ? 'defeated1' : 'defeated0', false);
        K.mesh.visible = true; K.mesh.scale.set(1, 1, 1); placeUp(K.mesh, c.x, c.z, c.y);
        K.mat.uniforms.uFlash.value = 0; K.mat.uniforms.uTint.value.set(0, 0, 0, 0); K.mat.uniforms.uRim.value.set(0, 0, 0, 0);
        K.shadow.visible = true; K.shadow.scale.set(1, 1, 1); placeFlat(K.shadow, c.x, c.z, c.y + 0.08);
        K.crown.visible = false;
        st.slamRing.visible = st.slamFill.visible = st.smallRing.visible = st.lane.visible = false;
        return;
      }
      if (!spec || (!e && !cine) || (cine && cine.kind !== 'fusion' && cine.kind !== 'death' && cine.kind !== 'pardon' && cine.kind !== 'finish')) {
        if (st.king) { st.king.mesh.visible = false; st.king.shadow.visible = false; st.king.crown.visible = false; }
        st.slamRing.visible = st.slamFill.visible = st.smallRing.visible = st.lane.visible = false;
        st.setGlow('king', null);
        return;
      }
      const K = st.kingSprite(spec);
      if (cine) return; // la cinemática dibuja al Rey
      if (this.forms && this.forms.draw(dt, s, zAt, K, e)) return; // Formas II y III
      K.crown.visible = false;
      const ai = e.ai, al = clamp(this.app.loop ? this.app.loop.alpha : 1, 0, 1);
      const x = lerp(ai.ox, e.x, al), y = lerp(ai.oy, e.y, al), h = lerp(ai.oh, ai.h, al);
      const z = zAt(x, y), time = now() / 1000;
      let frame = 'idle0', jitter = 0;
      const idleF = () => {
        const blink = (time % 3.4) < 0.12;
        return blink ? 'blink' : 'idle' + (Math.floor(time * 6) % 4);
      };
      switch (ai.st) {
        case 'idle': frame = ai.hurt > 0 ? 'hurt' : idleF(); break;
        case 'hop': case 'return': frame = ai.phase === 'crouch' ? 'hopCrouch' : ai.phase === 'air' ? 'hopAir' : ai.phase === 'land' ? 'hopLand' : idleF(); break;
        case 'bounce': frame = ai.phase === 'crouch' ? 'slamCrouch' : ai.phase === 'air' ? 'slamAir' : 'hopLand'; if (ai.phase === 'crouch') jitter = Math.floor(time * 30) % 2 ? 1 / 16 : -1 / 16; break;
        case 'charge': frame = ai.phase === 'windup' ? 'windup' : ai.phase === 'dash' ? 'charge' : 'hopLand'; if (ai.phase === 'windup') jitter = Math.floor(time * 24) % 2 ? 1 / 16 : -1 / 16; break;
        case 'slam': frame = ai.phase === 'crouch' ? 'slamCrouch' : ai.phase === 'land' ? 'slamLand' : 'slamAir'; if (ai.phase === 'crouch') jitter = Math.floor(time * 30) % 2 ? 1 / 16 : -1 / 16; break;
        case 'dazed': frame = Math.floor(time * 4) % 2 ? 'dazed1' : 'dazed0'; break;
        case 'summon': frame = ai.t < 0.25 ? 'hopCrouch' : 'summon'; break;
        default: frame = idleF();
      }
      const flip = ai.st === 'charge' && ai.phase === 'dash' ? ai.dx < 0 : ai.flip;
      st.kingFrame(frame, flip);
      K.mesh.visible = true;
      placeUp(K.mesh, x + jitter, z + h, y);
      const m = K.mat.uniforms;
      m.uFlash.value = ai.flash > 0 ? 0.85 : 0;
      const tele = (ai.st === 'charge' && ai.phase === 'windup') || (ai.st === 'slam' && ai.phase === 'crouch') || (ai.st === 'bounce' && ai.phase === 'crouch');
      if (tele) m.uTint.value.set(1, 0.2, 0.2, Math.floor(time * 10) % 2 ? 0.35 : 0.12);
      else m.uTint.value.set(0, 0, 0, 0);
      m.uRim.value.set(0, 0, 0, 0);
      // Sombra (se encoge cuando el Rey está en el aire).
      K.shadow.visible = true;
      const ss = 1 - Math.min(0.65, h / 12);
      K.shadow.scale.set(ss, 1, ss);
      placeFlat(K.shadow, x, z, y + 0.08);
      // Avisos en el suelo.
      st.slamRing.visible = st.slamFill.visible = false; st.smallRing.visible = false; st.lane.visible = false;
      if (ai.st === 'slam' && (ai.phase === 'air' || ai.phase === 'fall' || ai.phase === 'rise')) {
        const lock = 0.95, u = ai.phase === 'air' ? clamp(ai.t / lock, 0, 1) : ai.phase === 'fall' ? 1 : 0;
        const tz = zAt(ai.tx, ai.ty);
        st.slamRing.visible = true; st.slamRing.material.opacity = 0.55 + 0.35 * (Math.floor(time * 10) % 2);
        placeFlat(st.slamRing, ai.tx, tz, ai.ty, 0.05);
        st.slamRing.scale.set(2.45 * 2 / 5, 1, 2.45 * 2 / 5);
        st.slamFill.visible = true; st.slamFill.material.opacity = 0.32;
        const fs = Math.max(0.05, u) * 2.45 * 2 / 5;
        st.slamFill.scale.set(fs, 1, fs); placeFlat(st.slamFill, ai.tx, tz, ai.ty, 0.045);
        // La sombra se dibuja en el objetivo mientras cae.
        placeFlat(K.shadow, ai.tx, tz, ai.ty + 0.08);
        if (ai.phase === 'air') { K.mesh.visible = false; }
        else if (ai.phase === 'fall') placeUp(K.mesh, ai.tx, tz + h, ai.ty);
      }
      if (ai.st === 'bounce' && ai.phase !== 'land') {
        const tx = ai.tx || x, ty = ai.ty || y;
        st.smallRing.visible = true; st.smallRing.material.opacity = 0.5 + 0.3 * (Math.floor(time * 12) % 2);
        st.smallRing.scale.set(1.55 * 2 / 3.25, 1, 1.55 * 2 / 3.25);
        placeFlat(st.smallRing, tx, zAt(tx, ty), ty, 0.05);
      }
      if (ai.st === 'charge' && ai.phase === 'windup') {
        const d = Math.hypot(ai.dx, ai.dy) || 1, ang = Math.atan2(ai.dx / d, -ai.dy / d);
        st.lane.visible = true; st.lane.material.opacity = clamp(ai.t / 0.5, 0, 1) * (0.55 + 0.3 * (Math.floor(time * 10) % 2));
        st.lane.rotation.set(0, -ang, 0);
        st.lane.scale.set(1, 1, 0.75);
        placeFlat(st.lane, x, z, y, 0.05);
      }
      // Estrellas del aturdimiento.
      if (ai.st === 'dazed' && Math.floor(time * 10) !== Math.floor((time - dt) * 10)) {
        const a = time * 5;
        this.stage.spawn({ x: x + Math.cos(a) * 0.9, y: y + Math.sin(a) * 0.35, h: 3.3, col: 0, row: 3, life: 0.35, scale: 0.9 });
      }
      st.setGlow('king', null);
    }

    drawAlly(dt, s, zAt) {
      const st = this.stage, sess = this.app.session;
      const cineHide = this.cine && (this.cine.kind === 'pardon' || this.cine.kind === 'fusion');
      if (!s.ally || !sess.avatar || cineHide) { if (st.ally) { st.ally.mesh.visible = false; st.ally.shadow.visible = false; } return; }
      const A = st.allySprite(s.ally), p = sess.avatar, time = now() / 1000;
      const facing = (p.facing | 0);
      const back = facing >= 5 && facing <= 7 ? 1 : facing >= 1 && facing <= 3 ? -1 : 0;
      const target = { x: p.x + back * 1.2, y: p.y + 0.9 };
      if (!this.allyPos) this.allyPos = { x: target.x, y: target.y, hop: 0, sx: target.x, sy: target.y, tx: target.x, ty: target.y, flip: false };
      const P = this.allyPos;
      const d = Math.hypot(target.x - P.x, target.y - P.y);
      if (d > 12) { P.x = target.x; P.y = target.y; P.hop = 0; }
      let frame = 'idle' + (Math.floor(time * 5) % 4), h = 0;
      const L = this.allyLunge;
      if (L && now() - L.t0 < 520) {
        const u = (now() - L.t0) / 520, k = Math.sin(u * Math.PI);
        frame = u < 0.5 ? 'charge' : 'hopLand';
        const lx = lerp(P.x, L.x, k * 0.8), ly = lerp(P.y, L.y, k * 0.8);
        h = k * 0.7; P.flip = L.x < P.x;
        A.mesh.visible = true; st.allyFrame(frame, P.flip);
        placeUp(A.mesh, lx, zAt(lx, ly) + h, ly);
        A.shadow.visible = true; placeFlat(A.shadow, lx, zAt(lx, ly), ly + 0.05);
        return;
      }
      if (P.hop > 0) {
        P.hop = Math.min(1, P.hop + dt / 0.42);
        P.x = lerp(P.sx, P.tx, P.hop); P.y = lerp(P.sy, P.ty, P.hop);
        h = Math.sin(P.hop * Math.PI) * 0.45; frame = P.hop < 0.15 ? 'hopCrouch' : P.hop > 0.9 ? 'hopLand' : 'hopAir';
        if (P.hop >= 1) P.hop = 0;
      } else if (d > 0.9) {
        const step = Math.min(d, 1.5);
        P.sx = P.x; P.sy = P.y; P.tx = P.x + (target.x - P.x) / d * step; P.ty = P.y + (target.y - P.y) / d * step;
        P.flip = target.x < P.x; P.hop = 0.0001;
      } else if ((time % 6) < 0.6) frame = 'happy';
      A.mesh.visible = true; st.allyFrame(frame, P.flip);
      const z = zAt(P.x, P.y);
      placeUp(A.mesh, P.x, z + h, P.y);
      A.shadow.visible = true; placeFlat(A.shadow, P.x, z, P.y + 0.05);

    }

    drawCompass(dt) {
      if (!this.ui) return;
      const cp = this.ui.compass;
      this.compassT = Math.max(0, this.compassT - dt);
      const d = this.distToCenter();
      if (this.compassT <= 0 || d < SANCTUARY.near || this.cine) { if (!cp.hidden) cp.hidden = true; return; }
      const av = this.app.session.avatar, c = this.center;
      const ang = Math.atan2(c.y - av.y, c.x - av.x);
      cp.hidden = false;
      cp.style.setProperty('--ang', `${ang + Math.PI / 2}rad`);
      cp.style.setProperty('--dx', `${Math.cos(ang) * 92}px`);
      cp.style.setProperty('--dy', `${Math.sin(ang) * 92}px`);
      cp.querySelector('span').textContent = `${Math.round(d)} m`;
    }

    // ── Efectos de partículas ──
    fxDust(x, y, n, spread) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, v = spread * (0.6 + Math.random());
        this.stage.spawn({ x, y, h: 0.15, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vh: 0.6 + Math.random(), g: 3, drag: 3, life: 0.45 + Math.random() * 0.25, col: 0, row: 2, anim: 1, fps: 7, scale: 1 });
      }
    }
    fxDrops(e, n) {
      const k = this.state().king || {}, frags = ART().fragsOf(k);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, v = 2 + Math.random() * 2.5, h = frags[i % frags.length] || 'verde';
        this.stage.spawn({ x: e.x, y: e.y, h: 1.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vh: 3 + Math.random() * 2, g: 14, life: 0.9, col: HUES.indexOf(h), row: 0, scale: 1 });
      }
    }
    fxStars(e) {
      for (let i = 0; i < 3; i++) this.stage.spawn({ x: e.x + (i - 1) * 0.6, y: e.y, h: 3.2, vh: 0.6, g: 0, life: 0.6, col: 0, row: 3, scale: 1 });
    }
    fxBurst(x, y, h, kind, n, life = 0.5) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, v = 1 + Math.random() * 2;
        let col = 1, row = 1;
        if (kind === 'spark') { col = Math.floor(Math.random() * 4); row = 1; }
        else if (kind === 'heart') { col = 1; row = 3; }
        else if (kind === 'light') { col = 2; row = 3; }
        else if (kind.startsWith('drop')) { col = +kind.slice(4) || 0; row = 0; }
        this.stage.spawn({ x, y, h, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vh: 1.5 + Math.random() * 2, g: kind === 'heart' ? -0.5 : 6, drag: 1.5, life: life + Math.random() * 0.3, col, row, scale: 1 });
      }
    }
    fxThrow(e, x, y, hue, done) {
      const p = this.stage.spawn({ x: e.x, y: e.y, h: 2.2, col: HUES.indexOf(hue), row: 0, life: 0.5, scale: 1.4 });
      if (!p) { done(); return; }
      const dur = 0.45, vx = (x - e.x) / dur, vy = (y - e.y) / dur;
      Object.assign(p, { vx, vy, vh: 4.6, g: (2.2 + 4.6 * dur) * 2 / (dur * dur) });
      setTimeout(done, dur * 1000);
    }

    // ── Guion de cada cinemática ──
    runCine(dt, s, zAt) {
      const c = this.cine, st = this.stage, A = this.app, pr = A.pr, ctr = this.center, t = c.t;
      const at = (sec, key, fn) => { if (t >= sec && !c.fired.has(key)) { c.fired.add(key); if (!(c.skipped && sec < 9.0)) fn(); } };
      const K = st.king;
      let camX = ctr.x, camY = ctr.y - 1.6, shake = 0;
      if (c.kind === 'fusion') {
        const spec = c.data.spec, z = ctr.z;
        if (t > 1.2 && this.ui && $('tm-rey-skip').hidden) $('tm-rey-skip').hidden = false;
        // Masa central.
        const absorbed = c.data.pieces.filter((p, i) => t >= 2.5 + i * 0.18 + 0.55).length;
        at(1.0, 'rumble', () => this.audio && this.audio.rumble(5.6));
        for (let i = 0; i < LIMIT; i++) {
          at(1.0 + i * 0.15, 'chime' + i, () => this.audio && this.audio.chime(i));
          at(2.5 + i * 0.18 + 0.55, 'gloop' + i, () => {
            if (this.audio) this.audio.gloop(i);
            this.fxBurst(ctr.x, ctr.y, 0.8, 'drop' + HUES.indexOf(c.data.pieces[i].hue), 4, 0.5);
            c.pulse = 1;
          });
        }
        c.pulse = Math.max(0, (c.pulse || 0) - dt * 4);
        let frame = null, scale = 1, flashV = c.pulse * 0.6;
        if (t < 6.8) {
          if (absorbed > 0) {
            frame = 'mass' + (Math.floor(t * (t > 4.6 ? 14 : 6)) % 4);
            scale = 0.22 + absorbed * 0.065 + (t > 4.6 ? Math.sin(t * 40) * 0.03 * Math.min(1, (t - 4.6)) : 0);
            if (t > 4.6) shake = Math.min(2, (t - 4.6) * 1.3);
          }
          // Chispas que giran hacia el centro.
          if (t > 4.4 && Math.random() < 0.6) {
            const a = Math.random() * TAU, r = 4 + Math.random() * 2;
            this.stage.spawn({ x: ctr.x + Math.cos(a) * r, y: ctr.y + Math.sin(a) * r * 0.8, h: 0.5 + Math.random() * 2, tx: ctr.x, ty: ctr.y, th: 1.4, pull: 2.8, life: 1.1, col: 1 + Math.floor(Math.random() * 2), row: 1, scale: 1 });
          }
        } else {
          // Rey revelado.
          const u = t - 6.8;
          frame = u < 0.18 ? 'slamLand' : u < 0.42 ? 'hopAir' : u < 0.6 ? 'hopLand' : (t >= 7.25 && t < 8.6 ? 'roar' : 'idle' + (Math.floor(t * 6) % 4));
          scale = u < 0.42 ? 1 + Math.sin(u / 0.42 * Math.PI) * 0.12 : 1;
          if (t >= 7.25 && t < 8.6) shake = 1.4;
        }
        // La corona nace DENTRO de la masa y asciende por su interior hasta la
        // cabeza (diseño aprobado): se ve teñida por la gelatina mientras sube.
        const crownT = (t - 4.6) / 2.2;
        if (crownT >= 0 && crownT < 1) {
          K.crown.visible = true;
          const inside = crownT < 0.82;
          const hh = inside ? lerp(-0.6, 0.6, ease(crownT / 0.82)) : lerp(0.6, 1.9, ease((crownT - 0.82) / 0.18));
          setFrame(K.crownMat, inside ? 0 : Math.floor(t * 14) % 4, 0, 4, 1, false);
          placeUp(K.crown, ctr.x, z + hh, ctr.y, 1.2);
          const look = ART().lookOf(spec.mix, spec.hue), gel = ART().PAL[look.hue][4];
          const n = parseInt(gel.slice(1), 16);
          K.crownMat.uniforms.uTint.value.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, inside ? lerp(0.7, 0.25, crownT / 0.82) : 0);
          K.crownMat.uniforms.uFlash.value = inside ? 0.15 + 0.15 * Math.sin(t * 18) : 0.4;
          if (inside && Math.random() < 0.4) this.stage.spawn({ x: ctr.x + (Math.random() - 0.5) * 1.2, y: ctr.y + 0.1, h: hh - 0.2, vh: 1.2, g: 0, life: 0.5, col: 2, row: 3, scale: 0.8 });
          if (!inside && Math.random() < 0.7) this.stage.spawn({ x: ctr.x + (Math.random() - 0.5) * 0.6, y: ctr.y, h: hh + 0.4, vh: 0.8, life: 0.45, col: Math.floor(Math.random() * 4), row: 1, scale: 1 });
        } else { K.crown.visible = false; K.crownMat.uniforms.uTint.value.set(0, 0, 0, 0); K.crownMat.uniforms.uFlash.value = 0; }
        at(6.4, 'crownBreach', () => { if (this.audio) this.audio.pop(); });
        at(6.8, 'crown', () => {
          if (this.audio) this.audio.crownLand();
          if (this.ui) this.ui.flashOnce(1);
          st.shock(ctr.x, z, ctr.y, 4.2, 0.6); st.shock(ctr.x, z, ctr.y, 2.6, 0.4);
          this.fxDust(ctr.x, ctr.y, 16, 3); this.fxBurst(ctr.x, ctr.y, 2.6, 'spark', 14, 0.7);
          c.hold = 0.12;
        });
        if (c.hold > 0) { c.hold -= dt; c.t -= dt * 0.85; shake = 2.5; }
        at(7.25, 'roar', () => { if (this.audio) this.audio.roar(); st.shock(ctr.x, z, ctr.y, 5.2, 0.7); this.fxDust(ctr.x, ctr.y, 10, 3.4); });
        at(7.45, 'title', () => {
          if (!this.ui) return;
          const tt = $('tm-rey-title');
          $('tm-rey-title-sub').textContent = `Rey Slime ${variantName(spec)} · Nivel ${spec.level}`;
          tt.hidden = false; tt.classList.remove('is-on'); void tt.offsetWidth; tt.classList.add('is-on');
        });
        at(9.5, 'titleOff', () => { if (this.ui) $('tm-rey-title').hidden = true; });
        if (frame) {
          st.kingFrame(frame, false);
          K.mesh.visible = true; K.mesh.scale.set(scale, scale, 1);
          placeUp(K.mesh, ctr.x, z, ctr.y);
          K.mat.uniforms.uFlash.value = flashV;
          K.mat.uniforms.uTint.value.set(0, 0, 0, 0);
          K.mat.uniforms.uRim.value.set(1, 0.9, 0.6, t < 6.8 ? 0.5 + 0.3 * Math.sin(t * 12) : 0);
          K.shadow.visible = true; const ss = Math.min(1, scale); K.shadow.scale.set(ss, 1, ss); placeFlat(K.shadow, ctr.x, z, ctr.y + 0.08);
        } else { K.mesh.visible = false; K.shadow.visible = false; }
        // Haz de luz central y resplandor.
        const beamU = (t < 5.0 ? clamp((t - 4.4) / 0.6, 0, 1) : Math.max(0.18, 1 - (t - 5.0) / 0.9)) * (t < 6.8 ? 1 : 0);
        st.centerBeam.visible = beamU > 0;
        if (beamU > 0) { st.centerBeam.material.opacity = beamU * 0.7; st.centerBeam.scale.set(0.35 + beamU * 0.45, 1, 1); placeUp(st.centerBeam, ctr.x, z, ctr.y, 1); }
        const glowU = t < 6.8 ? clamp((t - 2.5) / 4.3, 0, 1) : Math.max(0, 1 - (t - 6.8) / 0.25);
        st.glowDisc.visible = glowU > 0; st.glowDisc.material.opacity = glowU * (t > 5.0 ? 0.22 : 0.42);
        st.glowDisc.scale.set(0.3 + glowU * 0.42, 1, 0.3 + glowU * 0.42); placeFlat(st.glowDisc, ctr.x, z, ctr.y, 0.06);
        st.setGlow('ritual', glowU > 0 ? { x: ctr.x, y: ctr.y, z: z + 1.5, r: 3 + glowU * 5, color: [glowU * 0.9, glowU * 0.75, glowU * 0.3], pulse: 0, prio: 6 } : null);
        // Ambiente: el claro se oscurece mientras crece la luz.
        if (pr) pr.setDark(t < 8.6 ? Math.min(0.55, t / 2) : Math.max(0, 0.55 - (t - 8.6)));
        // Cámara: entra hacia el santuario y vuelve al jugador al final.
        const inU = ease(t / 1.2), outU = ease((t - 9.0) / 0.9);
        const cam0 = c.cam0 || { x: camX, i: camY - z };
        const tx = camX, ti = camY - z;
        let fx = lerp(cam0.x, tx, inU), fi = lerp(cam0.i, ti, inU);
        if (t > 9.0) {
          const av = A.session.avatar;
          fx = lerp(tx, av.x, outU); fi = lerp(ti, av.y - av.z, outU);
        }
        this.camera(fx, fi, shake);
        if (t >= 9.9) { st.centerBeam.visible = false; st.glowDisc.visible = false; st.setGlow('ritual', null); K.mesh.scale.set(1, 1, 1); this.endCine(); }
        return;
      }
      if (c.kind === 'death') {
        const spec = c.data.spec, p0 = c.data.pos;
        // El charco vuelve a su trono antes de recomponerse.
        const home = ease(clamp((t - 1.9) / 0.7, 0, 1));
        const p = { x: lerp(p0.x, ctr.x, home), y: lerp(p0.y, ctr.y, home) }, z = zAt(p.x, p.y);
        camX = lerp(p0.x, ctr.x, home); camY = lerp(p0.y, ctr.y, home) - 1.4;
        let frame = 'hurt', flash = 0, scale = 1;
        at(0, 'start', () => { if (this.ui) this.ui.flashOnce(0.7); st.shock(p.x, z, p.y, 3.4, 0.5); this.fxBurst(p.x, p.y, 2, 'spark', 12, 0.6); });
        if (t < 0.5) { flash = Math.floor(t * 20) % 2 ? 1 : 0.2; shake = 1.6; }
        else if (t < 1.1) frame = 'death0';
        else if (t < 1.6) frame = 'death1';
        else if (t < 2.2) frame = 'death2';
        else if (t < 2.5) frame = 'death1';
        else if (t < 2.75) frame = 'death0';
        else frame = Math.floor(t * 2) % 2 ? 'defeated1' : 'defeated0';
        at(0.5, 'pop', () => { if (this.audio) this.audio.pop(); });
        at(1.0, 'deflate', () => { if (this.audio) this.audio.deflate(); });
        if (t > 1.1 && t < 2.2 && Math.random() < 0.35) this.stage.spawn({ x: p.x + (Math.random() - 0.5) * 2.4, y: p.y + (Math.random() - 0.5) * 0.6, h: 0.3, vh: 1.4, g: 0, life: 1.2, col: 2, row: 3, scale: 1 });
        // La corona sale volando y luego vuelve, torcida.
        const out = (t - 0.5) / 1.1, back = (t - 2.25) / 0.55;
        if (out >= 0 && out < 1) {
          K.crown.visible = true; setFrame(K.crownMat, Math.floor(t * 14) % 4, 0, 4, 1, false);
          const cx = lerp(p0.x, p0.x + 1.8, out), cy = lerp(p0.y, p0.y + 0.7, out), hh = 3 + Math.sin(out * Math.PI) * 3 - out * 2.6;
          placeUp(K.crown, cx, zAt(cx, cy) + Math.max(0.3, hh), cy, 1.2);
        } else if (back >= 0 && back < 1) {
          K.crown.visible = true; setFrame(K.crownMat, Math.floor(t * 14) % 4, 0, 4, 1, false);
          const cx = lerp(p0.x + 1.8, p.x, back), cy = lerp(p0.y + 0.7, p.y, back), hh = 0.3 + Math.sin(back * Math.PI) * 2.5 + back * 2;
          placeUp(K.crown, cx, zAt(cx, cy) + hh, cy, 1.2);
        } else if (t >= 1.6 && t < 2.25) {
          K.crown.visible = true; setFrame(K.crownMat, 1, 0, 4, 1, false);
          placeUp(K.crown, p0.x + 1.8, zAt(p0.x + 1.8, p0.y + 0.7) + 0.3, p0.y + 0.7, 1.2);
        } else K.crown.visible = false;
        at(1.6, 'crownThud', () => { if (this.audio) this.audio.thud(); });
        at(2.8, 'crownBack', () => { if (this.audio) this.audio.pop(); this.fxBurst(p.x, p.y, 2.4, 'spark', 6); });
        st.kingFrame(frame, false);
        K.mesh.visible = true; K.mesh.scale.set(scale, scale, 1); placeUp(K.mesh, p.x, z, p.y);
        K.mat.uniforms.uFlash.value = flash; K.mat.uniforms.uTint.value.set(0, 0, 0, 0); K.mat.uniforms.uRim.value.set(0, 0, 0, 0);
        K.shadow.visible = true; K.shadow.scale.set(1, 1, 1); placeFlat(K.shadow, p.x, z, p.y + 0.08);
        this.camera(...this.camBlend(c, camX, camY - z, 0.8), shake);
        if (t >= 3.6) this.endCine();
        return;
      }
      if (c.kind === 'pardon' || c.kind === 'finish') {
        const ctrX = ctr.x, ctrY = ctr.y, z = ctr.z;
        camX = ctrX; camY = ctrY - 1.2;
        if (c.kind === 'pardon') {
          at(0, 'hearts', () => { if (this.audio) this.audio.pardon(); this.fxBurst(ctrX, ctrY, 2.4, 'heart', 8, 0.9); });
          const u = clamp((t - 0.9) / 0.9, 0, 1);
          st.kingFrame(t < 0.9 ? 'happy' : 'hopAir', false);
          K.mesh.visible = u < 1; const sc = lerp(1, 0.5, ease(u));
          K.mesh.scale.set(sc, sc, 1);
          const av = A.session.avatar;
          const px = lerp(ctrX, av.x + 1, ease(u)), py = lerp(ctrY, av.y + 0.9, ease(u));
          placeUp(K.mesh, px, zAt(px, py) + Math.sin(u * Math.PI) * 1.4, py);
          K.mat.uniforms.uFlash.value = 0; K.mat.uniforms.uRim.value.set(1, 0.7, 0.85, 0.4);
          K.shadow.visible = u < 1; K.shadow.scale.set(sc, 1, sc); placeFlat(K.shadow, px, zAt(px, py), py + 0.08);
          if (t >= 2.0) { K.mesh.scale.set(1, 1, 1); K.mat.uniforms.uRim.value.set(0, 0, 0, 0); this.endCine(); }
        } else {
          const glow = clamp(t / 0.9, 0, 1);
          at(0.9, 'shatter', () => {
            if (this.audio) this.audio.forge();
            if (this.ui) this.ui.flashOnce(0.8);
            st.shock(ctrX, z, ctrY, 3.6, 0.5);
            this.fxBurst(ctrX, ctrY, 1.6, 'spark', 22, 0.8);
            this.fxBurst(ctrX, ctrY, 1.6, 'light', 8, 0.9);
          });
          K.mesh.visible = t < 0.9;
          if (K.mesh.visible) {
            st.kingFrame('defeated0', false); K.mesh.scale.set(1, 1, 1);
            placeUp(K.mesh, ctrX + (Math.floor(t * 30) % 2 ? 1 : -1) / 16, z, ctrY);
            K.mat.uniforms.uFlash.value = glow * 0.9;
          }
          K.shadow.visible = t < 0.9;
          // Arma que aparece, flota y vuela hacia el jugador.
          if (!st.weapon && c.data.weapon) {
            const wt = ART().weaponIcon(c.data.weapon);
            st.weaponMat = st.mat(st.tex(wt.canvas), false);
            st.weapon = st.mesh(st.weaponGeo, st.weaponMat, 4);
          }
          if (st.weapon) {
            const av = A.session.avatar, u = clamp((t - 1.8) / 0.6, 0, 1);
            st.weapon.visible = t >= 0.9 && t < 2.4;
            const wx = lerp(ctrX, av.x, ease(u)), wy = lerp(ctrY, av.y, ease(u));
            const wh = 1.4 + Math.sin(t * 4) * 0.12 + (1 - u) * 0.5;
            placeUp(st.weapon, wx, zAt(wx, wy) + wh, wy, 1.2);
            st.weaponMat.uniforms.uFlash.value = Math.max(0, 1 - (t - 0.9) * 3);
            if (t > 1.0 && Math.random() < 0.5) this.stage.spawn({ x: wx + (Math.random() - 0.5) * 0.8, y: wy, h: wh + 0.2, vh: 0.6, life: 0.4, col: Math.floor(Math.random() * 4), row: 1, scale: 1 });
          }
          at(2.4, 'banner', () => {
            if (!this.ui || !c.data.weapon) return;
            const info = WEAPON_INFO[c.data.weapon];
            this.ui.showBanner(`<small>¡ARMA REAL OBTENIDA!</small><b>${info.name}</b><em>${info.kind} · revisa tu equipamiento</em>`);
          });
          if (t >= 2.6) { if (st.weapon) { st.group.remove(st.weapon); st.weapon = null; } this.endCine(); }
        }
        this.camera(...this.camBlend(c, camX, camY - z, 0.7), 0);
      }
    }
    camBlend(c, x, i, dur) {
      const u = ease(c.t / dur), c0 = c.cam0 || { x, i };
      return [lerp(c0.x, x, u), lerp(c0.i, i, u)];
    }
    camera(x, i, shake) {
      const pr = this.app.pr; if (!pr) return;
      let sx = 0, sy = 0;
      if (shake > 0 && !reduced()) { const k = Math.round(shake); const f = Math.floor(now() / 33) % 4; sx = [k, -k, 0, k][f] / 16; sy = [0, k, -k, 0][f] / 16; }
      pr.focus(x + sx, 0, i + sy);
    }

    // ── Marcador en el mapa ──
    drawMapMarker(mv, seen) {
      if (!this.inValley() || !this.findCenter() || !mv.ctx) return;
      const c = this.center, T = this.app.terrain;
      const known = seen && seen[Math.floor(c.y) * T.w + Math.floor(c.x)];
      if (!known && this.compassT <= 0) return;
      const g = mv.ctx, x = Math.floor(c.x), y = Math.floor(c.y);
      const crown = ['#.#.#', '#####', '#####'];
      g.fillStyle = '#1d1712'; g.fillRect(x - 4, y - 3, 9, 7);
      crown.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') { g.fillStyle = j === 0 ? '#ffe17a' : '#efb43a'; g.fillRect(x - 2 + i, y - 1 + j, 1, 1); } }));
    }

    // ── Chip y panel ──
    refresh(force = false) {
      if (!this.ui || !this.app.saves || !this.app.saves.data) return;
      const s = this.state(); if (!s) return;
      if (!force && this.elapsed - this.lastUI < 0.3) return;
      this.lastUI = this.elapsed;
      const usable = this.soloSession() && this.inValley(), chip = this.ui.chip;
      if (chip.hidden === usable) chip.hidden = !usable;
      const label = s.stage === 'collect' ? `${s.pieces.length}/10` : s.stage === 'decision' ? 'Elegir' : '¡Rey!';
      if (this.ui.chipLabel.textContent !== label) this.ui.chipLabel.textContent = label;
      chip.classList.toggle('is-ready', s.stage === 'collect' && s.pieces.length === LIMIT);
      chip.classList.toggle('is-alert', s.stage !== 'collect');
      if (!this.open && !force) return;
      // Anillo de pedestales.
      const ring = $('tm-rey-ring'); ring.textContent = '';
      for (let i = 0; i < LIMIT; i++) {
        const p = s.pieces[i], b = el('button', 'tm-rey-slot' + (p ? ' is-full' : ''));
        b.type = 'button'; b.dataset.index = i; b.disabled = !p || s.stage !== 'collect';
        const a = -Math.PI / 2 + i * TAU / LIMIT;
        b.style.left = `${50 + Math.cos(a) * 40}%`; b.style.top = `${50 + Math.sin(a) * 40}%`;
        if (p) { b.style.setProperty('--slime', color(p.hue)); b.append(slimeIcon(this.app.view, p.hue, 28)); }
        else b.append(el('span', '', String(i + 1)));
        b.title = p ? `Limo ${p.hue} · vínculo ${p.bond} · toca para devolverlo` : `Pedestal ${i + 1}`;
        b.setAttribute('aria-label', b.title);
        ring.append(b);
      }
      ring.append(el('i', 'tm-rey-crown-mark'));
      // Mensaje.
      $('tm-rey-notice').textContent = s.pieces.length === LIMIT ? 'Los diez pedestales están ocupados. El ritual está listo.' :
        `Coloca diez limos domados en los pedestales. Faltan ${LIMIT - s.pieces.length}. Puedes devolverlos antes de invocar.`;
      // Presagio.
      const omen = $('tm-rey-omen'); omen.textContent = '';
      if (s.pieces.length) {
        const mix = partialMix(s.pieces);
        const bars = el('div', 'tm-rey-mix');
        HUES.forEach((h, i) => { if (!mix[i]) return; const bar = el('i'); bar.style.flex = String(mix[i]); bar.style.background = color(h); bar.title = `${mix[i]} ${h}`; bars.append(bar); });
        for (let i = s.pieces.length; i < LIMIT; i++) { const bar = el('i', 'is-empty'); bar.style.flex = '1'; bars.append(bar); }
        if (s.pieces.length === LIMIT) {
          const k = compose(s.pieces, 1);
          const img = el('canvas'); img.width = 64; img.height = 64; img.className = 'tm-rey-omen-img';
          try { const g = img.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(ART().portrait(k), 0, 0); } catch (_) { /* opcional */ }
          const txt = el('div', 'tm-rey-omen-txt', `<small>PRESAGIO</small><b>Rey Slime ${variantName(k)}</b><span>Nivel ${k.level} · Vida ${k.maxHp} · Fuerza ${k.atk}</span>`);
          omen.append(img, txt, bars);
        } else {
          omen.append(el('div', 'tm-rey-omen-txt', `<small>PRESAGIO</small><span>El color que más se repita decidirá al Rey. Si juntas los tres colores nacerá un Rey Prismático.</span>`), bars);
        }
      }
      // Lista de limos domados.
      const list = $('tm-rey-list'); list.textContent = '';
      const pets = (this.app.data.progress.companions || []).filter(p => p.species === 'limo' && HUES.includes(p.hue));
      if (!pets.length) list.append(el('p', 'tm-rey-empty', 'No tienes limos domados libres. Doma limos verdes, azules o rosados en el valle.'));
      for (const p of pets) {
        const b = el('button', 'tm-rey-pet'); b.type = 'button'; b.dataset.pet = p.uid; b.disabled = s.pieces.length >= LIMIT;
        b.style.setProperty('--slime', color(p.hue));
        b.append(slimeIcon(this.app.view, p.hue, 32), el('span', '', `<b>${p.name || 'Limo ' + p.hue}</b><small>Vínculo ${p.bond || 0}</small>`));
        list.append(b);
      }
      $('tm-rey-summon').disabled = s.pieces.length !== LIMIT || !this.solo();
    }
  }

  root.__TM_REY_API__ = API;
  root.__TM_REY_INSTALL__ = function (app, kit) {
    try { root.__TM_REY_CONTROLLER__ = new KingSlime(app, kit); } catch (e) { console.error('Rey Slime beta:', e); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
