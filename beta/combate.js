/* Torre Multiversal · Combate v2 «Esencias» (beta) · 17-11-2026
 *
 * Pedido del director: «el combate se siente fome: no hay progresión de habilidades ni
 * mejoras, ni habilidades para escoger u obtener de las criaturas, ni combos con gracia».
 * Primera entrega (de tres):
 *  - ESENCIAS: cada criatura que vences tiene probabilidad de soltar su esencia (las de élite
 *    sueltan tres). Con esencias aprendes la habilidad de esa criatura y la subes de nivel
 *    (I → V). Son 23 habilidades, una por especie: la Embestida del lanudo, la Carga del
 *    jabalí, el Mordisco helado del armiño, las Ilusiones del zorro…
 *  - DOS RANURAS de habilidad con botones propios (teclas R y G), recarga visible y panel
 *    para elegir cuáles llevar (tecla H o tocar una ranura vacía).
 *  - IMPACTO: pausa de impacto (solo en solitario), temblor de cámara, golpes críticos y
 *    contador de combo con bonificación de daño por tramos.
 *
 * Integración sin reescribir el motor:
 *  - El daño de las habilidades entra por el mismo camino que los golpes del arma: se
 *    añaden golpes a los que devuelve `session.combat.step`, así funcionan igual en
 *    solitario, como anfitrión y como invitado (al invitado se le limitan alcance y daño
 *    a lo que el anfitrión acepta).
 *  - Efectos de control (aturdir, enraizar, ralentizar) y curación: solo cuando esta
 *    partida es la que manda (solitario o anfitrión), sobre las criaturas del mundo.
 *  - Guardado en `progress.habilidades` (normalizado también por beta/game.js).
 * Activación: /beta/?combate=1.
 */
(function (root) {
  'use strict';

  // ════════════════════════════════════════════════════════════════════
  // 1. Reglas puras (probadas con node --test)
  // ════════════════════════════════════════════════════════════════════
  /** Esencias totales para cada nivel (índice = nivel). Se aprende con 3. */
  const NEED = Object.freeze([0, 3, 8, 16, 28, 45]);
  const MAX_LV = 5, SLOTS = 2;
  const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);
  const DROP = Object.freeze({ chance: 0.4, elite: 3 });
  const levelOf = n => { let l = 0; for (let i = 1; i <= MAX_LV; i++) if (n >= NEED[i]) l = i; return l; };
  /** Por nivel: +25 % de daño, −6 % de recarga y +10 % de duración. */
  function scale(sk, lv) {
    const L = Math.max(1, Math.min(MAX_LV, lv | 0)) - 1;
    return { dmg: sk.dmg * (1 + 0.25 * L), cd: sk.cd * (1 - 0.06 * L), dur: (sk.dur || 0) * (1 + 0.1 * L), lv: L + 1 };
  }
  // Colores: [oscuro, medio, claro].
  const C = {
    limo: ['#1d6b3a', '#4fc56a', '#b8f5a0'], gota: ['#1b4f7a', '#4fb3e8', '#c8f2ff'], lana: ['#6b5a44', '#d9cdb4', '#fff8e6'],
    cobre: ['#4a2a14', '#9a5a2a', '#e0a060'], avispa: ['#3a2a08', '#f0c030', '#fff3a0'], noche: ['#2a1848', '#7a58c8', '#d8c8ff'],
    alba: ['#7a5a1a', '#f2d45e', '#fff8d0'], liebre: ['#5a4020', '#c8a060', '#fff0c8'], tierra: ['#3a2414', '#7a5030', '#c09060'],
    raiz: ['#1f3d1a', '#5a8a2e', '#b6e070'], cielo: ['#2a3a5a', '#8aa8d8', '#f0f6ff'], ambar: ['#6a2a0a', '#e07a2a', '#ffd27a'],
    zorro: ['#7a2a0a', '#ff8a3a', '#ffe0b0'], espora: ['#3a1a4a', '#9a5ab8', '#d8f0a0'], bellota: ['#4a2a10', '#9a6a30', '#e8c070'],
    lobo: ['#2a2e38', '#8a96a8', '#e8eef8'], hielo: ['#193a66', '#66bfe4', '#f1ffff'], veneno: ['#2a4a10', '#8ad040', '#e0ffa0'],
    arena: ['#5a3a18', '#c8964a', '#f6dca0'], fuego: ['#522014', '#ec5b25', '#fff2bd'], buitre: ['#3a1a14', '#8a3a2a', '#e8a088']
  };
  /*
   * kind: tipo de efecto. dmg: daño base (nivel I, antes del nivel de Ascensión). cd: recarga (s).
   * r: radio (u). range: alcance (u). dur: duración (s). Extras: stun, root, slow, dot, heal…
   */
  const SKILLS = Object.freeze([
    { id: 'salto-pegajoso', species: 'limo', name: 'Salto pegajoso', glyph: '◉', kind: 'salto', col: C.limo, dmg: 22, cd: 7, r: 1.7, range: 3.6, stun: 0.6,
      desc: 'Saltas hacia tu objetivo y caes encima: daño en área y los deja pegados un instante.' },
    { id: 'enjambre', species: 'gotita', name: 'Mordisco de enjambre', glyph: '∴', kind: 'enjambre', col: C.gota, dmg: 6, cd: 8, r: 3.2, n: 7,
      desc: 'Una nube de gotitas muerde a los enemigos cercanos varias veces seguidas.' },
    { id: 'embestida', species: 'lanudo', name: 'Embestida', glyph: '➤', kind: 'carga', col: C.lana, dmg: 20, cd: 6, range: 4, w: 0.9, speed: 16,
      desc: 'Bajas la cabeza y embistes en línea recta, golpeando y empujando todo lo que pillas.' },
    { id: 'pinza', species: 'escarabajo', name: 'Pinza', glyph: '⌯', kind: 'golpe', col: C.cobre, dmg: 34, cd: 6, range: 1.9, stun: 0.8,
      desc: 'Un pellizco brutal de cerca que aturde. Ideal para abrir la guardia de los acorazados.' },
    { id: 'aguijon', species: 'avispa', name: 'Aguijón', glyph: '➶', kind: 'proyectil', col: C.avispa, dmg: 14, cd: 4.5, range: 7.5, speed: 18, dot: 4, dur: 4, art: 'sting',
      desc: 'Disparas un aguijón veloz que envenena: pierden vida poco a poco.' },
    { id: 'picado-nocturno', species: 'buho', name: 'Picado nocturno', glyph: '⋎', kind: 'picado', col: C.noche, dmg: 32, cd: 9, r: 1.3, range: 7, delay: 0.6,
      desc: 'Marcas a tu objetivo y un búho de sombra cae en picado sobre él.' },
    { id: 'canto-alba', species: 'conejo', name: 'Canto del alba', glyph: '♪', kind: 'cura', col: C.alba, dmg: 0, cd: 18, heal: 0.2, dur: 3,
      desc: 'Un canto que te cura el 20 % de tu vida en 3 segundos (más al subir de nivel).' },
    { id: 'derribo', species: 'liebre', name: 'Derribo', glyph: '⇥', kind: 'carga', col: C.liebre, dmg: 16, cd: 7, range: 3.2, w: 0.8, speed: 22, stun: 1,
      desc: 'Cruzas a toda velocidad a través de tus enemigos y los tumbas un instante.' },
    { id: 'madriguera', species: 'tejon', name: 'Madriguera', glyph: '⩍', kind: 'erupcion', col: C.tierra, dmg: 26, cd: 8, r: 1.3, range: 6.5, speed: 7, stun: 0.7,
      desc: 'La tierra avanza bajo el suelo hasta tu objetivo y estalla bajo sus pies.' },
    { id: 'raices', species: 'retono', name: 'Raíces', glyph: '⺦', kind: 'raices', col: C.raiz, dmg: 10, cd: 12, r: 2.3, root: 2,
      desc: 'Brotan raíces a tu alrededor que enredan a los enemigos: no pueden moverse ni atacar.' },
    { id: 'picado', species: 'halcon', name: 'Picado', glyph: '⩔', kind: 'picado', col: C.cielo, dmg: 28, cd: 7, r: 0.9, range: 8, delay: 0.35,
      desc: 'Un halcón cae desde lo alto sobre tu objetivo, muy rápido y preciso.' },
    { id: 'carga', species: 'jabali', name: 'Carga', glyph: '⮞', kind: 'carga', col: C.ambar, dmg: 28, cd: 9, range: 6, w: 1.1, speed: 15, knock: true,
      desc: 'Escarbas el suelo y cargas en línea recta, arrasando con lo que encuentres.' },
    { id: 'ilusiones', species: 'zorro', name: 'Ilusiones', glyph: '⧉', kind: 'ilusion', col: C.zorro, dmg: 12, cd: 10, range: 5, crits: 3, dur: 4,
      desc: 'Te desdoblas y apareces detrás de tu objetivo. Tus 3 golpes siguientes son críticos.' },
    { id: 'esporas', species: 'seta', name: 'Nube de esporas', glyph: '☁', kind: 'zona', col: C.espora, dmg: 6, cd: 11, r: 1.9, dur: 4, range: 6, at: 'target',
      desc: 'Lanzas una nube de esporas que envenena a quien se quede dentro.' },
    { id: 'bellotas', species: 'bellotero', name: 'Bellotas', glyph: '⁂', kind: 'lluvia', col: C.bellota, dmg: 12, cd: 8, r: 1.7, range: 7, n: 5,
      desc: 'Llueven bellotas alrededor de tu objetivo; cada una golpea donde cae.' },
    { id: 'aullido', species: 'lobo', name: 'Aullido de caza', glyph: '❂', kind: 'aura', col: C.lobo, dmg: 0, cd: 20, dur: 8, power: 0.3, cdr: 0.3,
      desc: 'Aúllas: durante 8 s haces un 30 % más de daño y tus habilidades se recargan más rápido.' },
    { id: 'mordisco-helado', species: 'armino', name: 'Mordisco helado', glyph: '❄', kind: 'golpe', col: C.hielo, dmg: 24, cd: 6, range: 1.9, slow: 3, element: 'hielo',
      desc: 'Un mordisco de escarcha que deja lento a tu objetivo.' },
    { id: 'pinchos-hielo', species: 'golem', name: 'Pinchos de hielo', glyph: '⩓', kind: 'linea', col: C.hielo, dmg: 18, cd: 9, range: 6, n: 7, slow: 2, element: 'hielo',
      desc: 'Una hilera de pinchos de hielo brota hacia delante y deja lentos a los que toca.' },
    { id: 'ventisca', species: 'espiritu', name: 'Ventisca', glyph: '❆', kind: 'zona', col: C.hielo, dmg: 4, cd: 14, r: 2.5, dur: 5, slow: 1, at: 'self', element: 'hielo',
      desc: 'Una niebla helada te rodea: quien entra se congela poco a poco y va lento.' },
    { id: 'aguijon-venenoso', species: 'escorpion', name: 'Aguijón venenoso', glyph: '⚚', kind: 'golpe', col: C.veneno, dmg: 14, cd: 7, range: 1.9, dot: 7, dur: 5,
      desc: 'Clavas un aguijón que envenena fuerte: pierden mucha vida durante 5 s.' },
    { id: 'embestida-subterranea', species: 'gusano', name: 'Embestida subterránea', glyph: '≋', kind: 'erupcion', col: C.arena, dmg: 40, cd: 12, r: 1.5, range: 8, speed: 11, stun: 0.5,
      desc: 'Avanzas bajo la arena a toda velocidad y sales de golpe con un mordisco enorme.' },
    { id: 'ceniza-ardiente', species: 'salamandra', name: 'Ceniza ardiente', glyph: '✺', kind: 'proyectil', col: C.fuego, dmg: 20, cd: 9, range: 7, speed: 11, r: 1.2, zone: 3, zdps: 6, art: 'fire', element: 'fuego',
      desc: 'Escupes una bola de ceniza que estalla y deja el suelo ardiendo un rato.' },
    { id: 'carronero', species: 'buitre', name: 'Carroñero', glyph: '♆', kind: 'aura', col: C.buitre, dmg: 0, cd: 20, dur: 10, leech: 0.2,
      desc: 'Durante 10 s te curas con el 20 % del daño que haces.' }
  ].map(Object.freeze));
  const BY_ID = Object.freeze(Object.fromEntries(SKILLS.map(s => [s.id, s])));
  const BY_SPECIES = Object.freeze(Object.fromEntries(SKILLS.map(s => [s.species, s])));

  /** Golpe de impacto: tramos del contador de combo (golpes seguidos sin recibir daño). */
  const COMBO = Object.freeze({ window: 3, tiers: Object.freeze([[10, 0.05, '¡Buen ritmo!'], [25, 0.1, '¡Imparable!'], [50, 0.15, '¡Furia!'], [100, 0.25, '¡Leyenda!']]) });
  function comboTier(n) { let t = null; for (const q of COMBO.tiers) if (n >= q[0]) t = q; return t; }
  const CRIT = Object.freeze({ base: 0.06, perCombo: 0.01, perComboEvery: 10, maxBonus: 0.1, mul: 1.75 });
  function critChance(combo) { return CRIT.base + Math.min(CRIT.maxBonus, Math.floor(combo / CRIT.perComboEvery) * CRIT.perCombo); }

  /** Guardado: { v, ess: {especie: n}, lv: {habilidad: 1..5}, slots: [id|null, id|null] }. */
  const okKey = k => typeof k === 'string' && /^[a-z0-9-]{1,24}$/.test(k);
  const num = (x, a, b) => Number.isFinite(+x) ? Math.min(b, Math.max(a, Math.floor(+x))) : a;
  function normalize(s) {
    const o = s && typeof s === 'object' && !Array.isArray(s) ? s : {}, ess = {}, lv = {};
    for (const [k, v] of Object.entries(o.ess && typeof o.ess === 'object' ? o.ess : {}).slice(0, 64)) if (okKey(k) && num(v, 0, 9999) > 0) ess[k] = num(v, 0, 9999);
    for (const [k, v] of Object.entries(o.lv && typeof o.lv === 'object' ? o.lv : {}).slice(0, 64)) if (okKey(k) && num(v, 0, 5) > 0) lv[k] = num(v, 1, 5);
    const slots = (Array.isArray(o.slots) ? o.slots : []).slice(0, SLOTS).map(k => okKey(k) && lv[k] ? k : null);
    while (slots.length < SLOTS) slots.push(null);
    if (slots[0] && slots[0] === slots[1]) slots[1] = null;
    return { v: 1, ess, lv, slots };
  }
  /** Suma esencias de una especie. Devuelve qué cambió (aprendida, nivel nuevo, ranura). */
  function addEssence(save, species, n = 1) {
    const sk = BY_SPECIES[species]; if (!sk || !(n > 0)) return { save, skill: null };
    const s = normalize(save), before = s.ess[species] | 0, after = Math.min(9999, before + n);
    s.ess[species] = after;
    const l0 = levelOf(before), l1 = levelOf(after);
    let slot = -1;
    if (l1 > l0) {
      s.lv[sk.id] = l1;
      if (l0 === 0 && !s.slots.includes(sk.id)) { slot = s.slots.indexOf(null); if (slot >= 0) s.slots[slot] = sk.id; }
    }
    return { save: s, skill: sk, before, after, learned: l0 === 0 && l1 > 0, levelUp: l1 > l0 ? l1 : 0, slot, next: l1 < MAX_LV ? NEED[l1 + 1] : null };
  }
  function equip(save, slot, id) {
    const s = normalize(save);
    if (!(slot >= 0 && slot < SLOTS)) return s;
    if (id && !s.lv[id]) return s;
    const other = s.slots.indexOf(id);
    if (id && other >= 0 && other !== slot) s.slots[other] = s.slots[slot];
    s.slots[slot] = id || null;
    return s;
  }
  /** Daño de una habilidad a nivel `lv` con el multiplicador de poder del personaje. */
  function skillDamage(sk, lv, power = 1) { return Math.max(1, Math.round(scale(sk, lv).dmg * power)); }

  const API = { NEED, MAX_LV, SLOTS, ROMAN, DROP, SKILLS, BY_ID, BY_SPECIES, COMBO, CRIT, levelOf, scale, comboTier, critChance, normalize, addEssence, equip, skillDamage };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  if (!root.document) return;

  // ════════════════════════════════════════════════════════════════════
  // 2. Pixel art de los efectos (dibujado por código, en caché)
  // ════════════════════════════════════════════════════════════════════
  const SQ = Math.SQRT1_2, BIAS = 0.35, TAU = Math.PI * 2;
  const nowMs = () => (root.performance ? root.performance.now() : Date.now());
  const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  function placeUp(m, x, z, y, b = BIAS) { const o = Math.round(x * 16) / 16, r = Math.round((z - y) * 16) / 16; m.position.set(o, z + b * SQ, z - r + b * SQ); }
  function placeFlat(m, x, z, y, lift = 0.03) { const n = z + lift; m.position.set(Math.round(x * 16) / 16, n, n - Math.round((n - y) * 16) / 16); }
  const TEX = new Map();
  function tex(key, w, h, draw) {
    if (TEX.has(key)) return TEX.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    const v = { t, w, h }; TEX.set(key, v); return v;
  }
  const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  /** Imágenes: anillo, disco, nube, pincho, orbe, aguijón, bola de fuego, bellota, gota, pluma, raíz, montículo, nota, estrella. */
  const ART = {
    ring(col) { return tex('ring' + col, 48, 48, (g, w) => { const c = w / 2 - 0.5; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c); if (d > c - 3 && d <= c) px(g, x, y, d > c - 1.2 ? col[2] : col[1]); } }); },
    disc(col) { return tex('disc' + col, 32, 32, (g, w) => { const c = w / 2 - 0.5; for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const d = Math.hypot(x - c, y - c) / c; if (d <= 1 && ((x + y) % 2 === 0 || d > 0.82)) px(g, x, y, d > 0.82 ? col[1] : col[0]); } }); },
    puff(col) { return tex('puff' + col, 14, 11, g => { const B = [[7, 6, 5], [4, 7, 3.5], [10, 7, 3.5], [6, 4, 3]]; for (let y = 0; y < 11; y++) for (let x = 0; x < 14; x++) { let k = -1; for (const [cx, cy, r] of B) { const d = Math.hypot(x - cx, y - cy); if (d <= r) k = Math.max(k, d < r - 1.5 ? (y < cy - 1 ? 2 : 1) : 0); } if (k >= 0) px(g, x, y, col[k]); } }); },
    spike(col) { return tex('spike' + col, 7, 15, g => { for (let y = 0; y < 15; y++) { const hw = Math.floor(y / 4.2); for (let x = 3 - hw; x <= 3 + hw; x++) px(g, x, y, x < 3 ? col[2] : x === 3 ? col[1] : col[0]); } }); },
    orb(col) { return tex('orb' + col, 9, 9, g => { for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const d = Math.hypot(x - 4, y - 4); if (d <= 4.2) px(g, x, y, d < 1.6 ? '#ffffff' : d < 3 ? col[2] : col[1]); } }); },
    sting(col) { return tex('sting' + col, 9, 3, g => { for (let x = 0; x < 9; x++) px(g, x, 1, x > 6 ? col[0] : col[1]); px(g, 8, 1, '#fff'); px(g, 2, 0, col[2]); px(g, 2, 2, col[2]); }); },
    fire(col) { return tex('fire' + col, 9, 9, g => { for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const d = Math.hypot(x - 4, (y - 5) * 1.2); if (d <= 4) px(g, x, y, d < 1.5 ? col[2] : d < 2.8 ? col[1] : col[0]); } px(g, 4, 0, col[1]); px(g, 3, 1, col[1]); }); },
    acorn(col) { return tex('acorn' + col, 6, 7, g => { const R = ['.dddd.', 'dmmmmd', '.llll.', 'lllllm', 'llllmm', '.llmm.', '..mm..']; R.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') px(g, x, y, c === 'd' ? col[0] : c === 'm' ? col[1] : col[2]); })); }); },
    drop(col) { return tex('drop' + col, 5, 6, g => { const R = ['..l..', '.lm..', '.lmm.', 'lmmmd', 'mmmdd', '.mdd.']; R.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') px(g, x, y, c === 'd' ? col[0] : c === 'm' ? col[1] : col[2]); })); }); },
    feather(col) { return tex('feather' + col, 8, 4, g => { for (let x = 0; x < 8; x++) { px(g, x, 2, col[0]); if (x > 1 && x < 7) { px(g, x, 1, col[1]); if (x % 2) px(g, x, 3, col[1]); } } px(g, 7, 1, col[2]); }); },
    root(col) { return tex('root' + col, 12, 10, g => { const R = ['....l.......', '...lm...l...', '...m...lm...', '..lm...m..l.', '..m...lm.lm.', '.lm..lm..m..', '.m..lm..lm..', 'dmdlmddlmd..', 'dddddddddd..', '.dd.d..dd...']; R.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') px(g, x, y, c === 'd' ? col[0] : c === 'm' ? col[1] : col[2]); })); }); },
    mound(col) { return tex('mound' + col, 12, 5, g => { const R = ['....ll......', '..llmml.l...', '.lmmmmmmml..', 'lmmdmmdmmml.', 'dddddddddddd']; R.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') px(g, x, y, c === 'd' ? col[0] : c === 'm' ? col[1] : col[2]); })); }); },
    note(col) { return tex('note' + col, 6, 8, g => { const R = ['...ll.', '...lml', '...l.m', '...l..', '...l..', '.mml..', 'mllm..', '.mm...']; R.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') px(g, x, y, c === 'm' ? col[1] : col[2]); })); }); },
    star(col) { return tex('star' + col, 7, 7, g => { const R = ['...l...', '...l...', '..lml..', 'llmwmll', '..lml..', '...l...', '...l...']; R.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') px(g, x, y, c === 'w' ? '#fff' : c === 'm' ? col[2] : col[1]); })); }); },
    bird(col) { return tex('bird' + col, 13, 9, g => { const R = ['l...........l', 'ml.........lm', '.mll.....llm.', '..mmll.llmm..', '...dmmmmmd...', '....dmwmd....', '.....dmd.....', '......d......', '.............']; R.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') px(g, x, y, c === 'd' ? col[0] : c === 'm' ? col[1] : c === 'w' ? '#fff' : col[2]); })); }); }
  };

  // ════════════════════════════════════════════════════════════════════
  // 3. Controlador
  // ════════════════════════════════════════════════════════════════════
  const STYLE = `
  #tm-skills{position:fixed;z-index:30;display:grid;gap:8px;pointer-events:none}
  #tm-skills[hidden]{display:none}
  #tm-skills .tm-sk{pointer-events:auto;position:relative;width:56px;height:56px}
  #tm-skills .tm-sk .glyph{font-size:21px}
  #tm-skills .tm-sk small{font-size:7px;max-width:52px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  #tm-skills .tm-sk i.cd{position:absolute;inset:3px;border-radius:50%;pointer-events:none;background:conic-gradient(rgba(5,6,10,.72) var(--p,0%),transparent 0)}
  #tm-skills .tm-sk b.lv{position:absolute;right:-4px;top:-4px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:var(--gold);color:#24170a;font:9px/16px var(--font-label);box-shadow:0 0 0 2px var(--slate-3)}
  #tm-skills .tm-sk b.lv:empty{display:none}
  #tm-skills .tm-sk em.key{position:absolute;left:-3px;top:-3px;font:8px/12px var(--font-label);color:var(--dim);font-style:normal}
  #tm-skills .tm-sk.is-empty .glyph{color:var(--dim)}
  #tm-skills .tm-sk.is-ready{box-shadow:inset 0 0 0 2px var(--gold),0 0 10px rgba(242,212,94,.45),0 3px 0 rgba(0,0,0,.5)}
  #tm-skills .tm-sk.is-cast{transform:scale(.92)}
  #tm-skills .tm-sk-more{pointer-events:auto;justify-self:center;width:30px;height:30px;border-radius:50%;border:2px solid var(--edge);background:rgba(14,17,24,.86);color:var(--gold);font:14px/1 var(--font-label);display:grid;place-items:center;cursor:pointer;padding:0;touch-action:manipulation}
  #tm-combo{position:fixed;right:calc(env(safe-area-inset-right,0px) + 14px);top:30%;z-index:29;text-align:right;pointer-events:none;font-family:var(--font-label);color:var(--gold);text-shadow:0 2px 0 #000,0 0 6px rgba(0,0,0,.8);transition:opacity .25s}
  #tm-combo[hidden]{display:none}
  #tm-combo b{display:block;font-size:26px;line-height:1;letter-spacing:.04em}
  #tm-combo small{display:block;font-size:10px;letter-spacing:.16em;color:var(--parchment)}
  #tm-combo span{display:block;font-size:11px;color:#ffb44b}
  #tm-combo.pop b{animation:tmPop .18s ease-out}
  @keyframes tmPop{0%{transform:scale(1.35)}100%{transform:scale(1)}}
  .tm-float{position:fixed;z-index:31;pointer-events:none;font-family:var(--font-label);font-weight:700;text-shadow:0 2px 0 #000,1px 0 0 #000,-1px 0 0 #000;white-space:nowrap;transform:translate(-50%,-50%)}
  #tm-banner{position:fixed;left:50%;top:13%;transform:translateX(-50%);z-index:40;min-width:240px;max-width:min(92vw,420px);padding:10px 14px 12px;text-align:center;background:rgba(14,17,24,.94);border:3px solid var(--gold-deep);box-shadow:inset 0 0 0 2px var(--edge),0 6px 18px rgba(0,0,0,.6);font-family:var(--font-ui);color:var(--parchment);pointer-events:none;animation:tmBan .35s ease-out}
  #tm-banner[hidden]{display:none}
  #tm-banner .g{font-size:30px;color:var(--gold);line-height:1.1}
  #tm-banner b{display:block;font-family:var(--font-label);color:var(--gold);letter-spacing:.08em;margin:2px 0}
  #tm-banner small{display:block;font-size:12px;line-height:1.35}
  @keyframes tmBan{0%{transform:translate(-50%,-14px);opacity:0}100%{transform:translate(-50%,0);opacity:1}}
  #tm-skill-panel{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(5,6,10,.55);padding:12px}
  #tm-skill-panel[hidden]{display:none}
  #tm-skill-panel .window{width:min(96vw,520px);max-height:min(88vh,760px);display:flex;flex-direction:column;gap:10px;overflow:hidden}
  #tm-skill-panel .tsk-head{display:flex;align-items:center;gap:8px}
  #tm-skill-panel .tsk-head b{flex:1;font-family:var(--font-label);color:var(--gold);letter-spacing:.12em}
  #tm-skill-panel .tsk-slots{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  #tm-skill-panel .tsk-slot{border:2px solid var(--edge);padding:6px 8px;background:var(--night);font-size:12px;cursor:pointer;color:var(--parchment);text-align:left;font-family:var(--font-ui)}
  #tm-skill-panel .tsk-slot.is-sel{border-color:var(--gold);box-shadow:inset 0 0 0 2px var(--gold-deep)}
  #tm-skill-panel .tsk-slot em{display:block;font-style:normal;font-size:9px;color:var(--dim);font-family:var(--font-label);letter-spacing:.1em}
  #tm-skill-panel .tsk-list{overflow:auto;display:grid;gap:6px;padding-right:2px}
  #tm-skill-panel .tsk-row{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;border:2px solid var(--edge);padding:6px;background:rgba(14,17,24,.7)}
  #tm-skill-panel .tsk-row.is-locked{opacity:.62}
  #tm-skill-panel .tsk-row .gl{width:34px;height:34px;display:grid;place-items:center;font-size:18px;border-radius:50%;background:var(--slate-3);color:var(--gold)}
  #tm-skill-panel .tsk-row .tx b{font-family:var(--font-label);font-size:12px;color:var(--parchment)}
  #tm-skill-panel .tsk-row .tx small{display:block;font-size:11px;line-height:1.3;color:var(--dim)}
  #tm-skill-panel .tsk-row .tx i{display:block;height:5px;margin-top:4px;background:var(--slate-3)}
  #tm-skill-panel .tsk-row .tx i b{display:block;height:100%;background:var(--gold)}
  #tm-skill-panel .tsk-row .btn{min-height:36px;padding:4px 10px;font-size:12px}
  #tm-skill-panel .tsk-tabs{display:flex;gap:6px}
  #tm-skill-panel .tsk-tabs .btn{flex:1;min-height:36px;font-size:12px}
  `;

  class Combat {
    constructor(app) {
      this.app = app; this.session = null; this.view = null;
      this.cd = [0, 0]; this.cdMax = [1, 1]; this.queue = []; this.later = []; this.fx = []; this.dots = []; this.zones = [];
      this.slows = new Map(); this.roots = new Map(); this.pos = new Map(); this.buff = null; this.crits = 0; this.critsUntil = 0;
      this.combo = 0; this.comboT = 0; this.bestCombo = 0; this.stopT = 0; this.shakeT = 0; this.shakeAmp = 0; this.lastHp = null;
      this.rng = Math.random; this.stats = { casts: 0, hits: 0, crits: 0, essences: 0, learned: 0, rejected: 0, maxCombo: 0 };
      this.panelSlot = 0; this.panelTab = 'mias';
      this.ui(); this.hook();
      root.__TM_COMBAT__ = this;
    }
    // ── Datos guardados ──
    data() { try { return this.app.data; } catch (_) { return null; } }   // el motor aún puede estar arrancando
    save() {
      const d = this.data(); if (!d || !d.progress) return normalize(null);
      if (!d.progress.habilidades || d.progress.habilidades.v !== 1) d.progress.habilidades = normalize(d.progress.habilidades);
      return d.progress.habilidades;
    }
    store(s) {
      const d = this.data(); if (!d || !d.progress) return;
      d.progress.habilidades = s;
      try { this.app.saves && this.app.saves.markDirty && this.app.saves.markDirty(); } catch (_) { /* nada */ }
      this.render(true);
    }
    // ── Enganches con el motor ──
    hook() {
      const a = this.app, self = this;
      const step = a._step;
      a._step = function (dt) {
        // Pausa de impacto: solo en solitario (en cooperativo el mundo no se detiene por un golpe).
        let k = 1;
        if (self.stopT > 0) { self.stopT -= dt; if (self.solo()) k = 0.08; }
        const r = step.call(a, dt * k);
        try { self.tick(dt * k, dt); } catch (e) { self.fail(e); }
        return r;
      };
      const render = a._render;
      a._render = function () {
        const r = render.apply(a, arguments);
        if (a.pr && !a.pr.__tmCombatPatched) {
          const pr = a.pr, fn = pr.render;
          pr.render = function () {
            const cam = pr.camera; let ox = 0, oy = 0;
            try { self.frame(); } catch (e) { self.fail(e); }
            if (cam && self.shakeT > 0) {
              const k = self.shakeAmp * Math.min(1, self.shakeT / 0.12);
              ox = Math.round((self.rng() * 2 - 1) * k * 16) / 16; oy = Math.round((self.rng() * 2 - 1) * k * 16) / 16;
              cam.position.x += ox; cam.position.y += oy;
            }
            try { return fn.apply(pr, arguments); } finally { if (cam && (ox || oy)) { cam.position.x -= ox; cam.position.y -= oy; } }
          };
          pr.__tmCombatPatched = true;
        }
        return r;
      };
      if (a.bus && a.bus.on) {
        a.bus.on('combat:kill', e => { try { self.onKill(e); } catch (er) { self.fail(er); } });
        a.bus.on('elite:down', e => { try { if (e && e.self) self.essence(e.species, DROP.elite, null); } catch (er) { self.fail(er); } });
      }
      root.addEventListener('keydown', e => {
        if (e.repeat || this.app.mode !== 'game') return;
        const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.code === 'KeyH') { this.togglePanel(); e.preventDefault(); return; }
        if (!this.panelEl.hidden) { if (e.code === 'Escape') this.togglePanel(false); return; }
        if (e.code === 'KeyR') { this.cast(0); e.preventDefault(); }
        else if (e.code === 'KeyG') { this.cast(1); e.preventDefault(); }
      });
    }
    fail(e) { if (this._f) return; this._f = true; console.error('Combate beta:', e); setTimeout(() => { this._f = false; }, 4000); }
    solo() { const s = this.app.session; return !!(s && s.isHost && !s.channel); }
    authority() { const s = this.app.session; return !!(s && s.isHost && s.world); }
    power() { const c = this.app.session && this.app.session.combat; return c && Number.isFinite(c.power) && c.power > 0 ? c.power : 1; }

    /** Cada sesión nueva: envolver el paso del combate (golpes) y el del mundo (lentitud). */
    attach(s) {
      this.session = s; this.queue.length = 0; this.later.length = 0; this.dots.length = 0; this.zones.length = 0;
      this.slows.clear(); this.roots.clear(); this.pos.clear(); this.combo = 0; this.lastHp = null; this.buff = null;
      if (!s || !s.combat) return;
      const self = this, cb = s.combat;
      if (!cb.__tmCombat) {
        const st = cb.step;
        cb.step = function () {
          const hits = st.apply(cb, arguments);
          try { return self.onHits(hits); } catch (e) { self.fail(e); return hits; }
        };
        cb.__tmCombat = true;
      }
      if (s.world && !s.world.__tmCombat) {
        const w = s.world, ws = w.step;
        w.step = function () {
          const before = self.slows.size || self.roots.size ? self.snapshot(w) : null;
          const r = ws.apply(w, arguments);
          try { if (before) self.applySlow(w, before); } catch (e) { self.fail(e); }
          return r;
        };
        w.__tmCombat = true;
      }
    }
    snapshot(w) { const m = new Map(); for (const e of w.entities) if (this.slows.has(e.id) || this.roots.has(e.id)) m.set(e.id, [e.x, e.y]); return m; }
    applySlow(w, before) {
      const t = this.clock(), T = this.app.terrain;
      for (const e of w.entities) {
        const p = before.get(e.id); if (!p || e.dead) continue;
        const rootUntil = this.roots.get(e.id), slow = this.slows.get(e.id);
        let k = 1;
        if (rootUntil && rootUntil > t) { k = 0; e.atk = 0; e.atkT = 0; e.stagger = Math.max(e.stagger || 0, 0.12); } else if (rootUntil) this.roots.delete(e.id);
        if (slow && slow.until > t) k = Math.min(k, slow.k); else if (slow) this.slows.delete(e.id);
        if (k >= 1) continue;
        const nx = p[0] + (e.x - p[0]) * k, ny = p[1] + (e.y - p[1]) * k, nz = T ? T.surfaceAt(nx, ny) : e.z;
        if (nz === nz) { e.x = nx; e.y = ny; e.z = nz; }
      }
    }
    clock() { return nowMs() / 1000; }

    // ── Golpes del arma y de las habilidades: críticos, combo y daño extra ──
    onHits(hits) {
      const s = this.session; if (!s) return hits;
      const host = s.isHost, lvl = s.selfProgress ? s.selfProgress().lv : 1, cap = host ? Infinity : Math.floor(40 * (1 + 0.02 * (Math.max(1, lvl) - 1)));
      let dmgMul = 1 + (comboTier(this.combo) ? comboTier(this.combo)[1] : 0);
      if (this.buff && this.buff.until > this.clock() && this.buff.power) dmgMul += this.buff.power;
      const forced = this.crits > 0 && this.critsUntil > this.clock();
      for (const h of hits) {
        if (h.__tm) continue;
        h.__tm = true;
        let crit = forced || this.rng() < critChance(this.combo);
        if (forced && this.crits > 0) this.crits--;
        let d = h.dmg * dmgMul * (crit ? CRIT.mul : 1);
        h.dmg = Math.max(1, Math.min(cap, Math.round(d)));
        this.onOwnHit(h, crit, false);
      }
      // Golpes de las habilidades (en cola desde el último paso).
      if (this.queue.length) {
        const range = host ? Infinity : this.clientRange();
        const av = s.avatar;
        for (const q of this.queue.splice(0)) {
          if (!host && av && Math.hypot(q.x - av.x, q.y - av.y) > range) { this.stats.rejected++; continue; }
          let crit = q.noCrit || q.dot ? false : (forced || this.rng() < critChance(this.combo));
          if (crit && forced && this.crits > 0) this.crits--;
          const h = { id: q.id, gen: q.gen, dmg: Math.max(1, Math.min(cap, Math.round(q.dmg * dmgMul * (crit ? CRIT.mul : 1)))), x: q.x, y: q.y, z: q.z || 0,
            splash: !!q.splash, ranged: true, hand: 'main', family: s.combat.weaponId, heavy: !!q.heavy, dir: q.dir, element: host ? (q.element || null) : null,
            finisher: !!q.heavy, __tm: true };
          hits.push(h); if (q.dot) h.__skill = true; else this.onOwnHit(h, crit, true);
          if (q.leech !== false && this.buff && this.buff.leech && this.buff.until > this.clock()) this.heal(h.dmg * this.buff.leech, true);
        }
      }
      if (this.buff && this.buff.leech && this.buff.until > this.clock()) {
        let sum = 0; for (const h of hits) if (!h.__skill) sum += h.dmg;
        if (sum) this.heal(sum * this.buff.leech, true);
      }
      return hits;
    }
    clientRange() { const c = this.session.combat, w = c && c.weapon; return Math.max(1.2, (w ? w.reach + (w.splash || 0) + (w.pierce || 0) : 1.5) + 2.6); }
    onOwnHit(h, crit, skill) {
      h.__skill = skill;
      this.combo++; this.comboT = COMBO.window; this.bestCombo = Math.max(this.bestCombo, this.combo); this.stats.maxCombo = this.bestCombo; this.stats.hits++;
      const tier = comboTier(this.combo), prev = comboTier(this.combo - 1);
      if (tier && tier !== prev) this.comboMilestone(tier);
      this.comboUi(true);
      if (crit) {
        this.stats.crits++;
        this.float(h.x, h.y, h.z, '¡CRÍTICO!', '#ffd84a', 15, 0.8, 1.35);
        this.spark(h.x, h.y, h.z, ['#7a5a1a', '#ffd84a', '#fff8d0'], 8);
      }
      // Pausa de impacto y temblor: más fuertes en remates, críticos y habilidades grandes.
      const big = crit || h.finisher || h.heavy;
      this.stopT = Math.max(this.stopT, big ? (skill ? 0.09 : 0.06) : 0.02);
      if (big) this.shake(skill ? 0.14 : 0.09, 0.16);
    }
    comboMilestone(t) {
      this.float(null, null, null, t[2] + ' +' + Math.round(t[1] * 100) + ' % daño', '#ffb44b', 12, 1.4, 1);
      try { this.app.audio && this.app.audio.play('levelup', { pitch: 1.4 }); } catch (_) { /* nada */ }
    }
    shake(amp, t) { if (this.reduced()) return; this.shakeAmp = Math.max(this.shakeAmp * (this.shakeT > 0 ? 1 : 0), amp); this.shakeT = Math.max(this.shakeT, t); }
    reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    // ── Paso de simulación ──
    tick(dt, realDt) {
      const a = this.app, s = a.session;
      if (s !== this.session) this.attach(s);
      this.shakeT = Math.max(0, this.shakeT - realDt);
      if (!s || a.mode !== 'game' || !s.avatar) { this.comboUi(false); return; }
      const av = s.avatar;
      // Posiciones recientes de los enemigos (para soltar la esencia donde cayeron).
      if (!this._posT || (this._posT -= dt) <= 0) {
        this._posT = 0.2;
        for (const e of s._enemies()) if (!e.dead) this.pos.set(e.id, { x: e.x, y: e.y, z: e.z || 0, sp: e.species, t: this.clock() });
        if (this.pos.size > 600) { const lim = this.clock() - 30; for (const [k, v] of this.pos) if (v.t < lim) this.pos.delete(k); }
      }
      // Recargas (el Aullido las acelera).
      const cdr = this.buff && this.buff.until > this.clock() && this.buff.cdr ? 1 + this.buff.cdr : 1;
      for (let i = 0; i < SLOTS; i++) this.cd[i] = Math.max(0, this.cd[i] - dt * cdr);
      // Combo: se corta si pasa el tiempo o si te golpean.
      if (this.combo) { this.comboT -= dt; if (this.comboT <= 0) this.comboEnd(); }
      const v = s.selfVital && s.selfVital();
      if (v) { if (this.lastHp !== null && v.hp < this.lastHp - 0.5 && this.combo) this.comboEnd(true); this.lastHp = v.hp; }
      // Acciones programadas (caídas en picado, erupciones, bellotas…).
      const t = this.clock();
      if (this.later.length) {
        const due = this.later.filter(q => q.at <= t); this.later = this.later.filter(q => q.at > t);
        for (const q of due) { try { q.fn(); } catch (e) { this.fail(e); } }
      }
      // Venenos y quemaduras: un golpe por segundo.
      for (let i = this.dots.length - 1; i >= 0; i--) {
        const d = this.dots[i]; d.left -= dt; d.tick -= dt;
        if (d.tick <= 0) { d.tick += 1; const e = this.enemy(d.id); if (e && e.gen === d.gen) { this.hit(e, d.dps, { noCrit: true, dot: true }); this.spark(e.x, e.y, e.z, d.col, 3); } else d.left = 0; }
        if (d.left <= 0) this.dots.splice(i, 1);
      }
      // Zonas en el suelo (esporas, ventisca, ceniza).
      for (let i = this.zones.length - 1; i >= 0; i--) {
        const z = this.zones[i]; z.left -= dt; z.tick -= dt;
        if (z.tick <= 0) {
          z.tick += 0.5;
          for (const e of this.inRange(z.x, z.y, z.r)) {
            if (z.dps) this.hit(e, z.dps * 0.5, { noCrit: true, dot: true, element: z.element });
            if (z.slow) this.slow(e, 0.5, 0.8);
          }
        }
        if (z.left <= 0) this.zones.splice(i, 1);
      }
      // Curación progresiva.
      if (this.regen && this.regen.left > 0) { const k = Math.min(dt, this.regen.left); this.regen.left -= k; this.heal(this.regen.perSec * k, false); }
    }

    // ── Enemigos ──
    enemies() { const s = this.session; return s ? s._enemies().filter(e => !e.dead && !e.hidden && !e.high) : []; }
    enemy(id) { return this.enemies().find(e => e.id === id) || null; }
    inRange(x, y, r) { return this.enemies().filter(e => Math.hypot(e.x - x, e.y - y) <= r + (e.r || 0.4) * 0.6); }
    target(range) {
      const s = this.session, av = s.avatar, list = this.enemies();
      const cur = list.find(e => e.id === s.combat.targetId);
      if (cur && Math.hypot(cur.x - av.x, cur.y - av.y) <= range) return cur;
      let best = null, bd = range;
      for (const e of list) { const d = Math.hypot(e.x - av.x, e.y - av.y); if (d <= bd && Math.abs((e.z || 0) - (av.z || 0)) < 1.6) { bd = d; best = e; } }
      return best;
    }
    facing() {
      const av = this.session.avatar, f = Number.isFinite(av.facing) ? av.facing * Math.PI / 4 : 0;
      return [Math.sin(f), Math.cos(f)];
    }
    world(e) { return this.authority() ? this.session.world.entities.find(q => q.id === e.id && !q.dead) : null; }
    /** Encola un golpe de habilidad (entra con los del arma en el próximo paso). */
    hit(e, dmg, o = {}) {
      if (!e) return;
      this.queue.push({ id: e.id, gen: e.gen | 0, dmg: Math.max(1, dmg), x: e.x, y: e.y, z: e.z || 0, heavy: !!o.heavy, element: o.element || null, noCrit: !!o.noCrit, splash: !!o.splash, dir: o.dir, dot: !!o.dot, leech: o.dot ? false : undefined });
      const w = this.world(e); if (!w) return;
      if (o.stun) { w.atk = 0; w.atkT = 0; w.moving = false; w.vx = w.vy = 0; w.stagger = Math.max(w.stagger || 0, o.stun); }
      if (o.root) this.roots.set(e.id, Math.max(this.roots.get(e.id) || 0, this.clock() + o.root));
      if (o.slowT) this.slow(e, 0.45, o.slowT);
    }
    slow(e, k, t) { if (!this.authority()) return; const cur = this.slows.get(e.id); this.slows.set(e.id, { k: Math.min(k, cur && cur.until > this.clock() ? cur.k : 1), until: Math.max(this.clock() + t, cur ? cur.until : 0) }); }
    dot(e, dps, dur, col) { if (!e || !(dps > 0)) return; const d = this.dots.find(q => q.id === e.id && q.col === col); if (d) { d.left = Math.max(d.left, dur); d.dps = Math.max(d.dps, dps); return; } this.dots.push({ id: e.id, gen: e.gen | 0, dps, left: dur, tick: 1, col }); }
    heal(n, quiet) {
      if (!this.authority() || !(n > 0)) return;
      const v = this.session.selfVital && this.session.selfVital(); if (!v || !v.maxHp || v.hp <= 0) return;
      const before = v.hp; v.hp = Math.min(v.maxHp, v.hp + n); this.lastHp = v.hp;
      const got = v.hp - before; this._healAcc = (this._healAcc || 0) + got;
      if (!quiet || this._healAcc >= 3) { const av = this.session.avatar; if (this._healAcc >= 1) this.float(av.x, av.y, av.z, '+' + Math.round(this._healAcc), '#8ce1ca', 12, 0.8, 1.1); this._healAcc = 0; }
    }

    // ════ Lanzar una habilidad ════
    cast(slot) {
      const a = this.app, s = a.session; if (!s || a.mode !== 'game' || !s.avatar) return false;
      const id = this.save().slots[slot];
      if (!id) { this.togglePanel(true, slot); return false; }
      if (this.cd[slot] > 0.05) { this.pulse(slot, 'bad'); return false; }
      if (s.isDown && s.isDown(s.self.pid)) return false;
      if (s.statusOf && (s.statusOf(s.self.pid) & 3)) { this.toast('No puedes usar habilidades mientras estás enredado o derribado'); return false; }
      const sk = BY_ID[id], lv = this.save().lv[id] || 1, S = scale(sk, lv), P = this.power();
      const ok = this[sk.kind] ? this[sk.kind](sk, S, Math.max(1, Math.round(S.dmg * P)), lv) : false;
      if (ok === false) return false;
      this.cd[slot] = this.cdMax[slot] = S.cd; this.stats.casts++;
      this.castFx(sk, slot);
      return true;
    }
    castFx(sk, slot) {
      const s = this.session, av = s.avatar;
      this.float(av.x, av.y, av.z, sk.name, sk.col[2], 11, 0.9, 1.6);
      this.pulse(slot, 'cast');
      try { this.app.audio && this.app.audio.play(sk.kind === 'cura' || sk.kind === 'aura' ? 'levelup' : 'heavy', { pitch: sk.kind === 'aura' ? 0.8 : 1.1 }); } catch (_) { /* nada */ }
    }
    // ── Tipos de habilidad ──
    golpe(sk, S, dmg) {
      const t = this.target(sk.range); if (!t) { this.toast('Acércate a un enemigo para usar ' + sk.name); return false; }
      const av = this.session.avatar;
      this.session._fx({ k: 'swing', key: this.session.combat.weaponId, combo: 3, style: 'slash', heavy: true, x: av.x, y: av.y, z: av.z, dir: av.facing | 0, tx: t.x, ty: t.y, tz: t.z });
      this.hit(t, dmg, { heavy: true, stun: sk.stun, slowT: sk.slow ? S.dur || sk.slow : 0, element: sk.element });
      if (sk.dot) this.dot(t, Math.round(sk.dot * (1 + 0.25 * (S.lv - 1))), S.dur || sk.dur, sk.col);
      this.spark(t.x, t.y, t.z, sk.col, 10); this.ring(t.x, t.y, t.z, 0.9, sk.col, 0.25);
      if (sk.slow) this.spikesAt(t.x, t.y, t.z, sk.col, 3, 0.5);
      return true;
    }
    proyectil(sk, S, dmg) {
      const t = this.target(sk.range); if (!t) { this.toast('No hay nadie a tiro para ' + sk.name); return false; }
      const av = this.session.avatar, art = sk.art === 'fire' ? ART.fire(sk.col) : ART.sting(sk.col);
      this.projectile(av.x, av.y, (av.z || 0) + 0.7, t, sk.speed, art, sk.col, () => {
        const e = this.enemy(t.id) || t;
        if (sk.r) { for (const q of this.inRange(e.x, e.y, sk.r)) this.hit(q, q.id === t.id ? dmg : Math.round(dmg * 0.6), { heavy: q.id === t.id, element: sk.element, splash: q.id !== t.id }); this.ring(e.x, e.y, e.z, sk.r, sk.col, 0.35); this.spark(e.x, e.y, e.z, sk.col, 14); this.shake(0.12, 0.18); }
        else { this.hit(e, dmg, { element: sk.element }); this.spark(e.x, e.y, e.z, sk.col, 6); }
        if (sk.dot) this.dot(e, Math.round(sk.dot * (1 + 0.25 * (S.lv - 1))), S.dur || sk.dur, sk.col);
        if (sk.zone) this.zoneAt(e.x, e.y, e.z, sk.r, sk.zone * (1 + 0.1 * (S.lv - 1)), Math.round(sk.zdps * (1 + 0.25 * (S.lv - 1))), 0, sk, 'fire');
      });
      return true;
    }
    carga(sk, S, dmg) {
      const s = this.session, av = s.avatar, t = this.target(sk.range + 1.5);
      let [fx, fy] = this.facing();
      if (t) { const dx = t.x - av.x, dy = t.y - av.y, n = Math.hypot(dx, dy) || 1; fx = dx / n; fy = dy / n; }
      const dist = sk.range, time = dist / sk.speed, hitSet = new Set(), x0 = av.x, y0 = av.y;
      s.kb = { vx: fx * sk.speed, vy: fy * sk.speed, t: time };
      s._fx({ k: 'dodge', x: av.x, y: av.y, z: av.z });
      const steps = Math.ceil(time / 0.04) + 2;
      for (let i = 0; i <= steps; i++) this.at(i * 0.04, () => {
        const p = this.session && this.session.avatar; if (!p) return;
        this.ghost(p.x, p.y, p.z, sk.col, 0.25);
        for (const e of this.enemies()) {
          if (hitSet.has(e.id)) continue;
          // Golpea a los que quedan a lo ancho del recorrido hecho hasta ahora.
          const ax = p.x - x0, ay = p.y - y0, L = Math.hypot(ax, ay) || 1, ux = ax / L, uy = ay / L;
          const ex = e.x - x0, ey = e.y - y0, along = ex * ux + ey * uy, side = Math.abs(ex * uy - ey * ux);
          if (along >= -0.4 && along <= L + 0.6 && side <= (sk.w || 0.9) + (e.r || 0.4) * 0.5) {
            hitSet.add(e.id); this.hit(e, dmg, { heavy: true, stun: sk.stun || 0.35 });
            this.spark(e.x, e.y, e.z, sk.col, 8); this.shake(sk.knock ? 0.16 : 0.1, 0.14);
            const w = this.world(e); if (w && sk.knock) { w.kbx = ux * 7; w.kby = uy * 7; w.kbT = 0.18; }
          }
        }
      });
      this.at(time + 0.02, () => { const p = this.session.avatar; this.ring(p.x, p.y, p.z, 1.1, sk.col, 0.3); });
      return true;
    }
    salto(sk, S, dmg) {
      const s = this.session, av = s.avatar, t = this.target(sk.range + 0.5);
      let tx, ty;
      if (t) { tx = t.x; ty = t.y; } else { const [fx, fy] = this.facing(); tx = av.x + fx * 2.2; ty = av.y + fy * 2.2; }
      const dx = tx - av.x, dy = ty - av.y, d = Math.min(sk.range, Math.max(0.01, Math.hypot(dx, dy) - 0.6)), time = 0.32;
      s.kb = { vx: dx / (Math.hypot(dx, dy) || 1) * d / time, vy: dy / (Math.hypot(dx, dy) || 1) * d / time, t: time };
      this.markAt(tx, ty, t ? t.z : av.z, sk.r, sk.col, time + 0.05);
      this.at(time, () => {
        const p = this.session.avatar;
        for (const e of this.inRange(p.x, p.y, sk.r)) this.hit(e, dmg, { heavy: true, stun: sk.stun, splash: true });
        this.ring(p.x, p.y, p.z, sk.r, sk.col, 0.35); this.spark(p.x, p.y, p.z, sk.col, 16); this.puffs(p.x, p.y, p.z, sk.col, 6, sk.r * 0.7, 0.6);
        this.shake(0.16, 0.2); this.session._fx({ k: 'shake', x: p.x, y: p.y, z: p.z });
      });
      return true;
    }
    enjambre(sk, S, dmg) {
      const av = this.session.avatar, near = this.inRange(av.x, av.y, sk.r);
      if (!near.length) { this.toast('No hay enemigos cerca para ' + sk.name); return false; }
      for (let i = 0; i < sk.n + (S.lv - 1); i++) this.at(i * 0.12, () => {
        const list = this.inRange(this.session.avatar.x, this.session.avatar.y, sk.r); if (!list.length) return;
        const e = list[Math.floor(this.rng() * list.length)], p = this.session.avatar;
        this.projectile(p.x + (this.rng() - 0.5), p.y + (this.rng() - 0.5), (p.z || 0) + 0.6, e, 14, ART.drop(sk.col), sk.col, () => { this.hit(e, dmg, {}); this.spark(e.x, e.y, e.z, sk.col, 3); }, 0.6);
      });
      return true;
    }
    picado(sk, S, dmg) {
      const t = this.target(sk.range); if (!t) { this.toast('Marca a un enemigo para ' + sk.name); return false; }
      const z = t.z || 0;
      this.markAt(t.x, t.y, z, sk.r, sk.col, sk.delay + 0.1, t.id);
      this.dive(t, sk.col, sk.delay);
      this.at(sk.delay, () => {
        const e = this.enemy(t.id) || t;
        for (const q of this.inRange(e.x, e.y, sk.r)) this.hit(q, q.id === t.id ? dmg : Math.round(dmg * 0.5), { heavy: q.id === t.id, stun: 0.4, splash: q.id !== t.id });
        this.ring(e.x, e.y, e.z, sk.r, sk.col, 0.3); this.feathers(e.x, e.y, e.z, sk.col, 8); this.shake(0.14, 0.18);
      });
      return true;
    }
    erupcion(sk, S, dmg) {
      const t = this.target(sk.range); if (!t) { this.toast('No hay nadie a tiro para ' + sk.name); return false; }
      const av = this.session.avatar, d = Math.hypot(t.x - av.x, t.y - av.y), time = Math.max(0.25, d / sk.speed), n = Math.max(3, Math.round(d / 0.7));
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        this.at(time * k, () => { const e = this.enemy(t.id) || t; const x = av.x + (e.x - av.x) * k, y = av.y + (e.y - av.y) * k; this.mound(x, y, sk.col); });
      }
      this.at(time + 0.05, () => {
        const e = this.enemy(t.id) || t;
        for (const q of this.inRange(e.x, e.y, sk.r)) this.hit(q, q.id === t.id ? dmg : Math.round(dmg * 0.6), { heavy: true, stun: sk.stun, splash: q.id !== t.id });
        this.spikesAt(e.x, e.y, e.z, sk.col, 6, sk.r * 0.8); this.puffs(e.x, e.y, e.z, sk.col, 6, sk.r, 0.7); this.ring(e.x, e.y, e.z, sk.r, sk.col, 0.3); this.shake(0.18, 0.2);
      });
      return true;
    }
    raices(sk, S, dmg) {
      const av = this.session.avatar, list = this.inRange(av.x, av.y, sk.r);
      this.ring(av.x, av.y, av.z, sk.r, sk.col, 0.45);
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = sk.r * (0.45 + this.rng() * 0.5); this.rootAt(av.x + Math.cos(a) * r, av.y + Math.sin(a) * r, av.z, sk.col, 0.9); }
      for (const e of list) { this.hit(e, dmg, { root: S.dur || sk.root * (1 + 0.1 * (S.lv - 1)), noCrit: false }); this.rootAt(e.x, e.y, e.z, sk.col, sk.root * (1 + 0.1 * (S.lv - 1))); }
      if (!list.length) this.toast('Las raíces brotan, pero no atrapan a nadie');
      return true;
    }
    ilusion(sk, S, dmg) {
      const s = this.session, av = s.avatar, t = this.target(sk.range);
      if (!t) { this.toast('Necesitas un objetivo cerca para ' + sk.name); return false; }
      const T = this.app.terrain, dx = t.x - av.x, dy = t.y - av.y, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
      const far = s.channel && !s.isHost ? 2.4 : 99;
      let placed = false;
      for (const back of [1.1, 0.8, 0.5]) {
        const x = t.x + ux * back, y = t.y + uy * back, z = T.surfaceAt(x, y);
        if (z !== z || Math.abs(z - (av.z || 0)) > 0.6 || Math.hypot(x - av.x, y - av.y) > far) continue;
        if ((T.obstacles || []).some(o => Math.hypot(o.x - x, o.y - y) < (o.r || 0.3) + 0.35)) continue;
        this.ghost(av.x, av.y, av.z, sk.col, 0.6); this.ghost(av.x - ux * 0.5, av.y - uy * 0.5, av.z, sk.col, 0.45);
        av.x = x; av.y = y; av.z = z; av.facing = Math.round(((Math.atan2(-ux, -uy) / (Math.PI / 4)) % 8 + 8)) % 8; placed = true; break;
      }
      if (!placed) { this.ghost(av.x, av.y, av.z, sk.col, 0.6); }
      this.crits = sk.crits + (S.lv >= 3 ? 1 : 0) + (S.lv >= 5 ? 1 : 0); this.critsUntil = this.clock() + (S.dur || sk.dur);
      this.hit(t, dmg, { heavy: true, stun: 0.5 });
      this.spark(t.x, t.y, t.z, sk.col, 10); this.puffs(av.x, av.y, av.z, sk.col, 4, 0.6, 0.5);
      return true;
    }
    zona(sk, S, dmg) {
      const av = this.session.avatar;
      let x = av.x, y = av.y, z = av.z || 0;
      if (sk.at === 'target') { const t = this.target(sk.range); if (t) { x = t.x; y = t.y; z = t.z || 0; } else { const [fx, fy] = this.facing(); x += fx * 2.5; y += fy * 2.5; const zz = this.app.terrain.surfaceAt(x, y); if (zz === zz) z = zz; } }
      this.zoneAt(x, y, z, sk.r, S.dur || sk.dur, dmg, sk.slow ? 1 : 0, sk, sk.element === 'hielo' ? 'frost' : 'spore', sk.at === 'self');
      return true;
    }
    lluvia(sk, S, dmg) {
      const t = this.target(sk.range); if (!t) { this.toast('No hay nadie a tiro para ' + sk.name); return false; }
      const n = sk.n + Math.floor((S.lv - 1) / 2);
      for (let i = 0; i < n; i++) {
        this.at(i * 0.18, () => {
          const e = this.enemy(t.id) || t, a = this.rng() * TAU, r = i === 0 ? 0 : this.rng() * sk.r, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
          const z = this.app.terrain.surfaceAt(x, y); if (z !== z) return;
          this.markAt(x, y, z, 0.55, sk.col, 0.45);
          this.fall(x, y, z, ART.acorn(sk.col), 0.42, () => {
            for (const q of this.inRange(x, y, 0.7)) this.hit(q, dmg, { splash: true });
            this.spark(x, y, z, sk.col, 6); this.ring(x, y, z, 0.6, sk.col, 0.2); this.shake(0.06, 0.08);
          });
        });
      }
      return true;
    }
    aura(sk, S) {
      const av = this.session.avatar, dur = S.dur || sk.dur;
      this.buff = { until: this.clock() + dur, power: sk.power ? sk.power + 0.05 * (S.lv - 1) : 0, cdr: sk.cdr || 0, leech: sk.leech ? sk.leech + 0.03 * (S.lv - 1) : 0, col: sk.col, name: sk.name };
      this.ring(av.x, av.y, av.z, 2.2, sk.col, 0.5); this.ring(av.x, av.y, av.z, 1.4, sk.col, 0.35);
      if (sk.id === 'aullido') { this.session._fx({ k: 'howl', x: av.x, y: av.y, z: av.z }); try { this.app.audio.play('howl'); } catch (_) { /* nada */ } }
      return true;
    }
    cura(sk, S) {
      if (!this.authority()) { this.toast('En una sala ajena la curación la decide el anfitrión: aquí no surte efecto'); return false; }
      const v = this.session.selfVital && this.session.selfVital(); if (!v) return false;
      const dur = S.dur || sk.dur, total = v.maxHp * (sk.heal + 0.04 * (S.lv - 1));
      this.regen = { left: dur, perSec: total / dur };
      const av = this.session.avatar;
      for (let i = 0; i < 6; i++) this.at(i * 0.45, () => { const p = this.session.avatar; this.notes(p.x, p.y, p.z, sk.col); });
      this.ring(av.x, av.y, av.z, 1.2, sk.col, 0.5);
      return true;
    }
    linea(sk, S, dmg) {
      const av = this.session.avatar, t = this.target(sk.range + 1);
      let [fx, fy] = this.facing();
      if (t) { const dx = t.x - av.x, dy = t.y - av.y, n = Math.hypot(dx, dy) || 1; fx = dx / n; fy = dy / n; }
      const hitSet = new Set(), n = sk.n + (S.lv - 1), step = sk.range / n, T = this.app.terrain;
      for (let i = 1; i <= n; i++) this.at(i * 0.07, () => {
        const x = av.x + fx * step * i, y = av.y + fy * step * i, z = T.surfaceAt(x, y); if (z !== z) return;
        this.spikesAt(x, y, z, sk.col, 2, 0.25);
        for (const e of this.inRange(x, y, 0.75)) if (!hitSet.has(e.id)) { hitSet.add(e.id); this.hit(e, dmg, { slowT: S.dur || sk.slow, element: sk.element, stun: 0.25 }); this.spark(e.x, e.y, e.z, sk.col, 6); }
        if (i === n) this.shake(0.08, 0.12);
      });
      return true;
    }

    // ── Programar y dibujar ──
    at(delay, fn) { this.later.push({ at: this.clock() + delay, fn }); }
    scene() { const v = this.app.view; return v && v.scene; }
    mesh(art, flat, w, h) {
      const geo = new THREE.PlaneGeometry((w || art.w) / 16, (h || art.h) / 16);
      if (flat) geo.rotateX(-Math.PI / 2); else geo.translate(0, (h || art.h) / 32, 0);
      const mat = new THREE.MeshBasicMaterial({ map: art.t, transparent: true, alphaTest: 0.4, depthWrite: false });
      const m = new THREE.Mesh(geo, mat); m.renderOrder = flat ? 2 : 4; m.frustumCulled = false;
      const sc = this.scene(); if (sc) sc.add(m);
      return m;
    }
    addFx(o) { if (this.fx.length > 220) { const old = this.fx.shift(); this.kill(old); } this.fx.push(o); return o; }
    kill(o) { if (!o || !o.m) return; const sc = this.scene(); if (sc) sc.remove(o.m); o.m.geometry.dispose(); o.m.material.dispose(); o.m = null; }
    /** Cada cuadro: animar efectos y textos flotantes. */
    frame() {
      const t = this.clock(), dt = Math.min(0.05, t - (this._lt || t)); this._lt = t;
      if (this.app.view !== this.view) { for (const o of this.fx) o.m = null; this.fx.length = 0; this.view = this.app.view; }
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const o = this.fx[i], k = (t - o.t0) / o.dur;
        if (k >= 1 || !o.m) { if (o.done) { try { o.done(); } catch (e) { this.fail(e); } } this.kill(o); this.fx.splice(i, 1); continue; }
        o.upd(o, k, dt);
      }
      this.floats(t);
      this.renderCd();
    }
    ring(x, y, z, r, col, dur) {
      const m = this.mesh(ART.ring(col), true); placeFlat(m, x, z, y, 0.04);
      this.addFx({ m, t0: this.clock(), dur, upd: (o, k) => { const s = (0.25 + 0.75 * ease(k)) * r * 2 / 3; o.m.scale.set(s, 1, s); o.m.material.opacity = 1 - k * 0.9; o.m.material.alphaTest = 0.1 + 0.6 * k; } });
    }
    markAt(x, y, z, r, col, dur, follow) {
      const m = this.mesh(ART.disc(col), true); placeFlat(m, x, z, y, 0.035);
      this.addFx({ m, t0: this.clock(), dur, upd: (o, k) => {
        if (follow) { const e = this.enemy(follow); if (e) placeFlat(o.m, e.x, e.z || 0, e.y, 0.035); }
        const s = r * 2 / 2 * (1 - 0.25 * k) * (1 + 0.06 * Math.sin(k * 30)); o.m.scale.set(s, 1, s);
      } });
    }
    spark(x, y, z, col, n) {
      const sc = this.scene(); if (!sc) return;
      for (let i = 0; i < n; i++) {
        const c = col[1 + (i % 2)], m = this.mesh(tex('px' + c, 2, 2, g => { g.fillStyle = c; g.fillRect(0, 0, 2, 2); }), false);
        const a = this.rng() * TAU, sp = 1.2 + this.rng() * 2.2, vy = 2 + this.rng() * 2.5, base = { x, y: (z || 0) + 0.35, zz: y };
        this.addFx({ m, t0: this.clock(), dur: 0.35 + this.rng() * 0.25, p: { x: base.x, h: 0, y: base.zz }, v: { x: Math.cos(a) * sp, h: vy, y: Math.sin(a) * sp * 0.6 }, upd: (o, k, dt) => {
          o.p.x += o.v.x * dt; o.p.y += o.v.y * dt; o.v.h -= 12 * dt; o.p.h = Math.max(0, o.p.h + o.v.h * dt);
          placeUp(o.m, o.p.x, (z || 0) + 0.3 + o.p.h, o.p.y, 0.5);
        } });
      }
    }
    puffs(x, y, z, col, n, r, dur) {
      for (let i = 0; i < n; i++) {
        const a = this.rng() * TAU, d = this.rng() * r, m = this.mesh(ART.puff(col), false), px0 = x + Math.cos(a) * d, py0 = y + Math.sin(a) * d * 0.7;
        this.addFx({ m, t0: this.clock(), dur: dur * (0.7 + this.rng() * 0.6), upd: (o, k) => { placeUp(o.m, px0 + Math.cos(a) * k * 0.4, (z || 0) + k * 0.5, py0, 0.4); o.m.material.alphaTest = 0.3 + 0.6 * k; } });
      }
    }
    ghost(x, y, z, col, dur) {
      const m = this.mesh(ART.orb(col), false, 9, 20);
      m.material.opacity = 0.6; m.material.transparent = true;
      placeUp(m, x, z || 0, y);
      this.addFx({ m, t0: this.clock(), dur, upd: (o, k) => { o.m.material.alphaTest = 0.2 + 0.7 * k; o.m.scale.set(1 + k * 0.3, 1 - k * 0.4, 1); } });
    }
    projectile(x, y, h, target, speed, art, col, onHit, arc = 0.25) {
      const m = this.mesh(art, false), p = { x, y, h };
      const o = this.addFx({ m, t0: this.clock(), dur: 3, upd: (o, k, dt) => {
        const e = this.enemy(target.id) || target, tz = (e.z || 0) + 0.45, dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        const st = speed * dt;
        if (d <= st + 0.1) { o.t0 = -1e9; o.done = onHit; return; }
        p.x += dx / d * st; p.y += dy / d * st; p.h += (tz - p.h) * Math.min(1, st / Math.max(d, 0.01));
        placeUp(o.m, p.x, p.h + Math.sin(Math.min(1, k * 4) * Math.PI) * arc * 0.3, p.y, 0.6);
        o.m.rotation.z = -Math.atan2(dy, dx) * 0.5;
        if (this.rng() < 0.4) this.trail(p.x, p.y, p.h, col);
      } });
      return o;
    }
    trail(x, y, h, col) {
      const c = col[2], m = this.mesh(tex('px' + c, 2, 2, g => { g.fillStyle = c; g.fillRect(0, 0, 2, 2); }), false);
      placeUp(m, x, h, y, 0.5); this.addFx({ m, t0: this.clock(), dur: 0.25, upd: (o, k) => { o.m.scale.setScalar(1 - k); } });
    }
    dive(target, col, delay) {
      const m = this.mesh(ART.bird(col), false), e0 = target;
      this.addFx({ m, t0: this.clock(), dur: delay, upd: (o, k) => { const e = this.enemy(e0.id) || e0; placeUp(o.m, e.x - 1.6 * (1 - k), (e.z || 0) + 0.4 + 4 * (1 - ease(k)), e.y, 0.6); } });
    }
    fall(x, y, z, art, dur, onHit) {
      const m = this.mesh(art, false);
      this.addFx({ m, t0: this.clock(), dur, done: onHit, upd: (o, k) => { placeUp(o.m, x, z + 3.2 * (1 - k * k), y, 0.5); } });
    }
    mound(x, y, col) {
      const z = this.app.terrain.surfaceAt(x, y); if (z !== z) return;
      const m = this.mesh(ART.mound(col), false); placeUp(m, x, z, y, 0.2);
      this.addFx({ m, t0: this.clock(), dur: 0.5, upd: (o, k) => { o.m.scale.set(1, k < 0.3 ? k / 0.3 : 1 - (k - 0.3), 1); } });
    }
    spikesAt(x, y, z, col, n, r) {
      for (let i = 0; i < n; i++) {
        const a = this.rng() * TAU, d = i === 0 ? 0 : this.rng() * r, sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d * 0.7;
        const m = this.mesh(ART.spike(col), false); placeUp(m, sx, z, sy, 0.3);
        this.addFx({ m, t0: this.clock(), dur: 0.55, upd: (o, k) => { o.m.scale.set(1, k < 0.2 ? k / 0.2 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1, 1); } });
      }
    }
    rootAt(x, y, z, col, dur) {
      const m = this.mesh(ART.root(col), false); placeUp(m, x, z || 0, y, 0.45);
      this.addFx({ m, t0: this.clock(), dur, upd: (o, k) => { const g = Math.min(1, k * dur / 0.2), sh = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1; o.m.scale.set(1, g * sh, 1); } });
    }
    feathers(x, y, z, col, n) {
      for (let i = 0; i < n; i++) {
        const m = this.mesh(ART.feather(col), false), a = this.rng() * TAU, sp = 0.6 + this.rng();
        this.addFx({ m, t0: this.clock(), dur: 0.9, upd: (o, k) => { placeUp(o.m, x + Math.cos(a) * sp * k, (z || 0) + 0.5 + Math.sin(k * Math.PI) * 0.8 - k * 0.3, y + Math.sin(a) * sp * k * 0.6, 0.5); o.m.rotation.z = Math.sin(k * 12 + a) * 0.6; } });
      }
    }
    notes(x, y, z, col) {
      const m = this.mesh(ART.note(col), false), dx = (this.rng() - 0.5) * 0.8;
      this.addFx({ m, t0: this.clock(), dur: 1.1, upd: (o, k) => { placeUp(o.m, x + dx + Math.sin(k * 8) * 0.15, (z || 0) + 0.9 + k * 0.9, y, 0.6); o.m.material.alphaTest = 0.3 + 0.6 * k; } });
    }
    zoneAt(x, y, z, r, dur, dps, slow, sk, style, follow) {
      this.zones.push({ x, y, r, left: dur, tick: 0.2, dps, slow, element: sk.element || null });
      const zone = this.zones[this.zones.length - 1];
      const m = this.mesh(ART.disc(sk.col), true); placeFlat(m, x, z, y, 0.03); m.scale.set(r, 1, r);
      this.addFx({ m, t0: this.clock(), dur, upd: (o, k) => {
        if (follow) { const p = this.session.avatar; zone.x = p.x; zone.y = p.y; placeFlat(o.m, p.x, p.z || 0, p.y, 0.03); }
        o.m.material.alphaTest = k > 0.85 ? 0.4 + (k - 0.85) * 4 : 0.4;
        if (this.rng() < 0.35) this.puffs(zone.x, zone.y, (follow ? this.session.avatar.z : z) || 0, sk.col, 1, r * 0.8, 0.9);
      } });
    }

    // ── Esencias ──
    onKill(e) {
      if (!e || !e.mine || e.clone || this.app.trial) return;
      const sk = BY_SPECIES[e.species]; if (!sk) return;
      if (this.rng() > DROP.chance) return;
      this.essence(e.species, 1, this.pos.get(e.id));
    }
    /** Suelta la esencia en el suelo; vuela hacia ti y se suma al tocarte. */
    essence(species, n, p) {
      const sk = BY_SPECIES[species]; if (!sk) return;
      const s = this.session, av = s && s.avatar; if (!av) { this.addEss(species, n); return; }
      const x0 = p ? p.x : av.x, y0 = p ? p.y : av.y, z0 = p ? p.z : av.z || 0;
      for (let i = 0; i < n; i++) {
        const m = this.mesh(ART.orb(sk.col), false), off = (i - (n - 1) / 2) * 0.35, st = { x: x0 + off, y: y0, h: z0 + 0.3 };
        let given = false;
        this.addFx({ m, t0: this.clock() + i * 0.15, dur: 3.2, upd: (o, k, dt) => {
          const a = this.session && this.session.avatar; if (!a) return;
          const tt = Math.max(0, this.clock() - o.t0);
          if (tt < 0.55) { st.h = z0 + 0.3 + Math.sin(Math.min(1, tt / 0.55) * Math.PI) * 0.8; }
          else {
            const dx = a.x - st.x, dy = a.y - st.y, d = Math.hypot(dx, dy), sp = 8 * dt;
            if (d < 0.25) { if (!given) { given = true; this.addEss(species, 1); } o.t0 = -1e9; return; }
            st.x += dx / d * Math.min(d, sp); st.y += dy / d * Math.min(d, sp); st.h += ((a.z || 0) + 0.7 - st.h) * Math.min(1, dt * 6);
          }
          placeUp(o.m, st.x, st.h, st.y, 0.6);
          if (this.rng() < 0.3) this.trail(st.x, st.y, st.h, sk.col);
        }, done: () => { if (!given) { given = true; this.addEss(species, 1); } } });
      }
    }
    addEss(species, n) {
      const r = addEssence(this.save(), species, n); if (!r.skill) return;
      this.stats.essences += n;
      this.store(r.save);
      const sk = r.skill;
      if (r.learned) {
        this.stats.learned++;
        this.banner(sk.glyph, '¡Nueva habilidad: ' + sk.name + '!', sk.desc + (r.slot >= 0 ? (this.app.isTouch ? ' Ya está en tu ' + (r.slot === 0 ? 'primer' : 'segundo') + ' botón de habilidad.' : ' Ya está en tu botón ' + (r.slot === 0 ? 'R' : 'G') + '.') : (this.app.isTouch ? ' Equípala tocando ✦.' : ' Equípala en Habilidades (H).')), sk.col);
        try { this.app.audio && this.app.audio.play('discover'); } catch (_) { /* nada */ }
      } else if (r.levelUp) {
        this.banner(sk.glyph, sk.name + ' sube a nivel ' + ROMAN[r.levelUp], 'Más daño, menos recarga' + (r.levelUp === MAX_LV ? ' · ¡nivel máximo!' : '.'), sk.col);
        try { this.app.audio && this.app.audio.play('levelup'); } catch (_) { /* nada */ }
      } else {
        const name = { limo: 'limo', gotita: 'gotita', lanudo: 'lanudo', escarabajo: 'escarabajo', avispa: 'avispa', buho: 'búho', conejo: 'conejo', liebre: 'liebre', tejon: 'tejón', retono: 'retoño', halcon: 'halcón', jabali: 'jabalí', zorro: 'zorro', seta: 'seta', bellotero: 'bellotero', lobo: 'lobo', armino: 'armiño', golem: 'gólem', espiritu: 'espíritu', escorpion: 'escorpión', gusano: 'gusano', salamandra: 'salamandra', buitre: 'buitre' }[species] || species;
        this.toast('Esencia de ' + name + ' · ' + r.after + '/' + r.next + (levelOf(r.after) ? ' para ' + sk.name + ' ' + ROMAN[levelOf(r.after) + 1] : ' para aprender ' + sk.name), 'gold', 2600);
      }
    }

    // ════ Interfaz ════
    ui() {
      const st = document.createElement('style'); st.id = 'tm-combat-style'; st.textContent = STYLE; document.head.appendChild(st);
      const bar = this.bar = document.createElement('div'); bar.id = 'tm-skills'; bar.hidden = true;
      bar.innerHTML = '<button type="button" class="tm-sk-more" aria-label="Habilidades (H)" title="Habilidades (H)">✦</button>' +
        [0, 1].map(i => `<button type="button" class="act-btn tm-sk" data-slot="${i}" aria-label="Habilidad ${i + 1}"><span><span class="glyph">+</span><small>VACÍA</small></span><i class="cd"></i><b class="lv"></b><em class="key">${i ? 'G' : 'R'}</em></button>`).join('');
      document.body.appendChild(bar);
      bar.querySelector('.tm-sk-more').addEventListener('click', () => this.togglePanel(true));
      for (const b of bar.querySelectorAll('.tm-sk')) {
        const slot = +b.dataset.slot; let lp = null, long = false;
        b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); long = false; b.classList.add('is-down'); lp = setTimeout(() => { long = true; this.togglePanel(true, slot); }, 550); });
        const up = e => { e.preventDefault(); e.stopPropagation(); b.classList.remove('is-down'); clearTimeout(lp); if (!long && e.type === 'pointerup') this.cast(slot); long = false; };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', e => { b.classList.remove('is-down'); clearTimeout(lp); });
        b.addEventListener('contextmenu', e => e.preventDefault());
      }
      const combo = this.comboEl = document.createElement('div'); combo.id = 'tm-combo'; combo.hidden = true; combo.setAttribute('aria-live', 'off');
      combo.innerHTML = '<b>0</b><small>GOLPES</small><span></span>'; document.body.appendChild(combo);
      const ban = this.banEl = document.createElement('div'); ban.id = 'tm-banner'; ban.hidden = true; ban.setAttribute('role', 'status');
      document.body.appendChild(ban);
      const p = this.panelEl = document.createElement('div'); p.id = 'tm-skill-panel'; p.hidden = true;
      p.innerHTML = '<div class="window" role="dialog" aria-modal="true" aria-labelledby="tsk-title"><div class="tsk-head"><b id="tsk-title">HABILIDADES</b><button type="button" class="btn tsk-close">Cerrar (H)</button></div>' +
        '<small class="tsk-help" style="font-size:12px;line-height:1.35;color:var(--dim)">Vence criaturas para juntar su esencia: con 3 aprendes su habilidad y con más la subes de nivel. Elige una ranura y toca «Equipar».</small>' +
        '<div class="tsk-slots"></div><div class="tsk-tabs"><button type="button" class="btn" data-tab="mias">Aprendidas</button><button type="button" class="btn" data-tab="todas">Por descubrir</button></div><div class="tsk-list"></div></div>';
      document.body.appendChild(p);
      p.addEventListener('click', e => {
        const t = e.target.closest('button'); if (!t) { if (e.target === p) this.togglePanel(false); return; }
        if (t.classList.contains('tsk-close')) this.togglePanel(false);
        else if (t.dataset.slotSel !== undefined) { this.panelSlot = +t.dataset.slotSel; this.renderPanel(); }
        else if (t.dataset.tab) { this.panelTab = t.dataset.tab; this.renderPanel(); }
        else if (t.dataset.equip) { this.store(equip(this.save(), this.panelSlot, t.dataset.equip)); this.panelSlot = (this.panelSlot + 1) % SLOTS; this.renderPanel(); }
        else if (t.dataset.unequip !== undefined) { this.store(equip(this.save(), +t.dataset.unequip, null)); this.renderPanel(); }
      });
      this.floatList = [];
      setInterval(() => { try { this.layout(); } catch (e) { this.fail(e); } }, 400);
      root.addEventListener('resize', () => this.layout());
      this.render(true);
    }
    /** Ubica los botones a la izquierda del grupo de ataques (vertical y horizontal). */
    layout() {
      const a = this.app, hud = document.getElementById('hud-actions'), on = a.mode === 'game' && a.session && hud && !hud.hidden && hud.offsetParent !== null && !(document.getElementById('hud') || {}).hidden;
      this.bar.hidden = !on; if (!on) return;
      const r = hud.getBoundingClientRect(), heavy = document.getElementById('btn-heavy'), atk = document.getElementById('btn-attack');
      const rh = heavy && !heavy.hidden ? heavy.getBoundingClientRect() : null, ra = atk && !atk.hidden ? atk.getBoundingClientRect() : null;
      const top = rh ? rh.top - 36 : r.top + 20, left = r.left - 64 - 8;
      Object.assign(this.bar.style, { left: Math.max(4, left) + 'px', top: Math.max(60, top) + 'px', gridTemplateRows: '30px 56px 56px', rowGap: (ra && rh ? Math.max(6, ra.top - rh.top - 56) : 10) + 'px' });
      this.render();
    }
    render(force) {
      const sv = this.save(), key = sv.slots.join('|') + '|' + sv.slots.map(id => id ? sv.lv[id] : 0).join('');
      if (!force && key === this._rk) return; this._rk = key;
      this.bar.querySelectorAll('.tm-sk').forEach((b, i) => {
        const id = sv.slots[i], sk = id && BY_ID[id];
        b.classList.toggle('is-empty', !sk);
        b.querySelector('.glyph').textContent = sk ? sk.glyph : '+';
        b.querySelector('.glyph').style.color = sk ? sk.col[2] : '';
        b.querySelector('small').textContent = sk ? sk.name.toUpperCase() : 'VACÍA';
        b.querySelector('b.lv').textContent = sk ? ROMAN[sv.lv[id]] : '';
        b.title = sk ? `${sk.name} ${ROMAN[sv.lv[id]]} (${i ? 'G' : 'R'}). Mantén pulsado para cambiarla.` : 'Ranura vacía: toca para elegir una habilidad';
        b.setAttribute('aria-label', sk ? `Usar ${sk.name}, nivel ${ROMAN[sv.lv[id]]}` : `Ranura de habilidad ${i + 1} vacía: elegir habilidad`);
      });
      if (!this.panelEl.hidden) this.renderPanel();
    }
    renderCd() {
      if (this.bar.hidden) return;
      this.bar.querySelectorAll('.tm-sk').forEach((b, i) => {
        const p = this.cd[i] > 0 ? Math.round(this.cd[i] / Math.max(0.1, this.cdMax[i]) * 100) : 0;
        if (b._p !== p) { b._p = p; b.querySelector('i.cd').style.setProperty('--p', p + '%'); b.classList.toggle('is-ready', p === 0 && !b.classList.contains('is-empty')); }
      });
    }
    pulse(slot, kind) {
      const b = this.bar.querySelectorAll('.tm-sk')[slot]; if (!b) return;
      b.classList.add('is-cast'); setTimeout(() => b.classList.remove('is-cast'), 120);
      if (kind === 'bad') { try { this.app.audio && this.app.audio.play('click', { pitch: 0.6 }); } catch (_) { /* nada */ } }
    }
    togglePanel(open, slot) {
      const want = open === undefined ? this.panelEl.hidden : !!open;
      this.panelEl.hidden = !want;
      if (want) { if (slot !== undefined) this.panelSlot = slot; this.panelTab = Object.keys(this.save().lv).length ? this.panelTab : 'todas'; this.renderPanel(); }
    }
    renderPanel() {
      const sv = this.save(), P = this.panelEl;
      P.querySelector('.tsk-slots').innerHTML = [0, 1].map(i => {
        const id = sv.slots[i], sk = id && BY_ID[id];
        return `<button type="button" class="tsk-slot${i === this.panelSlot ? ' is-sel' : ''}" data-slot-sel="${i}"><em>RANURA ${i + 1} · TECLA ${i ? 'G' : 'R'}</em>${sk ? sk.glyph + ' ' + sk.name + ' ' + ROMAN[sv.lv[id]] : 'Vacía'}</button>`;
      }).join('');
      P.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('btn-gold', b.dataset.tab === this.panelTab));
      const learned = SKILLS.filter(s => sv.lv[s.id]), rest = SKILLS.filter(s => !sv.lv[s.id]);
      const list = this.panelTab === 'mias' ? learned : rest.sort((p, q) => (sv.ess[q.species] | 0) - (sv.ess[p.species] | 0));
      const names = this.speciesNames();
      P.querySelector('.tsk-list').innerHTML = list.length ? list.map(sk => {
        const e = sv.ess[sk.species] | 0, lv = sv.lv[sk.id] | 0, next = lv < MAX_LV ? NEED[lv + 1] : null, prev = NEED[lv];
        const frac = next ? Math.max(0, Math.min(1, (e - prev) / (next - prev))) : 1, S = lv ? scale(sk, lv) : scale(sk, 1);
        const dmg = sk.dmg ? ` · daño ${skillDamage(sk, lv || 1, this.power())}` : '';
        const where = sv.slots.indexOf(sk.id);
        const act = lv ? (where >= 0 ? `<button type="button" class="btn" data-unequip="${where}">Quitar</button>` : `<button type="button" class="btn btn-gold" data-equip="${sk.id}">Equipar</button>`) : '';
        return `<div class="tsk-row${lv ? '' : ' is-locked'}"><span class="gl" style="color:${sk.col[2]}">${sk.glyph}</span><span class="tx"><b>${sk.name}${lv ? ' ' + ROMAN[lv] : ''}</b><small>${lv ? sk.desc : 'De: ' + (names[sk.species] || sk.species) + '. ' + sk.desc}</small><small>Recarga ${S.cd.toFixed(1)} s${dmg} · esencias ${e}${next ? '/' + next : ' (máximo)'}</small><i><b style="width:${Math.round(frac * 100)}%"></b></i></span>${act}</div>`;
      }).join('') : `<small style="color:var(--dim);font-size:12px">${this.panelTab === 'mias' ? 'Todavía no aprendiste ninguna. Vence criaturas: a veces sueltan su esencia (las de élite, siempre).' : '¡Las descubriste todas!'}</small>`;
    }
    speciesNames() { return { limo: 'limos', gotita: 'gotitas', lanudo: 'lanudos', escarabajo: 'escarabajos', avispa: 'avispas', buho: 'búhos', conejo: 'conejos cantores', liebre: 'liebres trueno', tejon: 'tejones', retono: 'retoños', halcon: 'halcones', jabali: 'jabalíes de ámbar', zorro: 'zorros ilusionistas', seta: 'setas', bellotero: 'belloteros', lobo: 'lobos', armino: 'armiños', golem: 'gólems de hielo', espiritu: 'espíritus', escorpion: 'escorpiones', gusano: 'gusanos de arena', salamandra: 'salamandras', buitre: 'buitres' }; }
    comboUi(show) {
      const el = this.comboEl;
      if (!show || this.combo < 3) { if (!el.hidden && (!show || this.combo === 0)) el.hidden = true; return; }
      el.hidden = false; el.querySelector('b').textContent = this.combo;
      const t = comboTier(this.combo); el.querySelector('span').textContent = t ? t[2] + ' +' + Math.round(t[1] * 100) + ' %' : '';
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    }
    comboEnd(hurt) {
      if (this.combo >= 10) this.float(null, null, null, (hurt ? 'Combo roto · ' : 'Combo ') + this.combo, hurt ? '#ff9f9f' : '#f2d45e', 11, 1, 1);
      this.combo = 0; this.comboT = 0; this.comboEl.hidden = true;
    }
    banner(glyph, title, text, col) {
      const b = this.banEl;
      b.innerHTML = `<div class="g" style="color:${col ? col[2] : ''}">${glyph}</div><b>${title}</b><small>${text}</small>`;
      b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
      clearTimeout(this._banT); this._banT = setTimeout(() => { b.hidden = true; }, 4200);
    }
    toast(t, kind = 'gold', ms = 2400) { try { this.app.ui && this.app.ui.toast && this.app.ui.toast(t, kind, ms); } catch (_) { /* nada */ } }
    /** Texto flotante: sobre un punto del mundo, o al centro si no hay punto. */
    float(x, y, z, text, color, size, dur, rise) {
      const el = document.createElement('div'); el.className = 'tm-float'; el.textContent = text;
      el.style.color = color; el.style.fontSize = size + 'px'; document.body.appendChild(el);
      this.floatList.push({ el, x, y, z, t0: this.clock(), dur, rise: rise || 1 });
      if (this.floatList.length > 24) { const o = this.floatList.shift(); o.el.remove(); }
    }
    floats(t) {
      if (!this.floatList.length) return;
      const pr = this.app.pr, cam = pr && pr.camera, cv = this.app.canvas || (pr && pr.canvas);
      const rc = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
      for (let i = this.floatList.length - 1; i >= 0; i--) {
        const f = this.floatList[i], k = (t - f.t0) / f.dur;
        if (k >= 1) { f.el.remove(); this.floatList.splice(i, 1); continue; }
        let sx = rc.left + rc.width / 2, sy = rc.top + rc.height * 0.3;
        if (f.x !== null && cam) {
          const v = this._v || (this._v = new THREE.Vector3()); v.set(f.x, (f.z || 0) + 1.2 + k * 0.6 * f.rise, f.y + 0.25); v.project(cam);
          sx = rc.left + (v.x + 1) / 2 * rc.width; sy = rc.top + (1 - v.y) / 2 * rc.height;
        } else sy -= k * 24;
        f.el.style.left = Math.round(sx) + 'px'; f.el.style.top = Math.round(sy) + 'px';
        f.el.style.opacity = String(k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        f.el.style.transform = `translate(-50%,-50%) scale(${k < 0.12 ? 1.3 - k * 2.5 : 1})`;
      }
    }
  }

  root.__TM_COMBAT_API__ = API;
  root.__TM_COMBAT_INSTALL__ = function (app) {
    try { if (!root.__TM_COMBAT__) new Combat(app); } catch (e) { console.error('Combate beta:', e); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
