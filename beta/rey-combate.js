/* Torre Multiversal · Rey Slime · Formas II y III (beta · solo) · 14-11-2026
 *
 * Fases B y C del plan aprobado:
 *  - Máquina de estados I → II (66 % de vida) → III (33 %). Un golpe nunca
 *    salta una forma; durante la transformación el Rey no recibe daño ni
 *    ataca, y absorbe a sus clones. En su trono nunca recupera la forma
 *    anterior. La forma se deduce de la vida guardada (sobrevive a recargar).
 *  - Forma II · Bestia gelatinosa: avance pesado, mordisco en embestida,
 *    megasalto con aviso grande, espinas en círculo, absorción de clones y
 *    expulsión de gotas que se esquivan.
 *  - Forma III · Rey humanoide: pasos que retumban, Puñetazo del Rey en tres
 *    tiempos (carga · dirección · cono que alcanza y astilla los árboles),
 *    martillo doble y gancho.
 *  - Clones con tope 5 / 10 / 20 según la forma y director: solo 2, 2 o 3
 *    atacan a la vez; el resto rodea al jugador a distancia. Ningún clon da
 *    experiencia (ver rey-slime.js · applyHit).
 *
 * El arte sale de rey-formas.js (aprobado como concepto) dibujado a la
 * escala de juego de la hoja del director. Las hojas se generan poco a poco
 * en segundo plano para no trabar el juego en el celular.
 */
(function (root) {
  'use strict';
  if (!root.document) return;
  const TAU = Math.PI * 2, CONE = Object.freeze({ len: 6.5, half: 30 * Math.PI / 180 });
  const MORPH = 2.8; // duración de la transformación (s)
  const HUE_IDX = { verde: 0, azul: 1, rosa: 2 };

  // ── Cuadros de cada forma (opciones de rey-formas.js) ──
  const BEAST_FRAMES = [
    ['idle0', { breath: 0, tailCurl: 0, t: 0 }], ['idle1', { breath: 0.5, tailCurl: 0.12, t: 0.25 }],
    ['idle2', { breath: 1, tailCurl: 0.24, t: 0.5 }], ['idle3', { breath: 0.5, tailCurl: 0.12, t: 0.75 }],
    ['hopCrouch', { crouch: 0.7, t: 0.1 }], ['hopAir', { stretch: 0.6, jaw: 0.3, t: 0.3 }],
    ['crouch', { crouch: 1, spines: 0.2, t: 0.2 }], ['air', { stretch: 1, jaw: 0.8, t: 0.4 }],
    ['bite', { jaw: 1, stretch: 0.35, headX: 4, headY: 4, t: 0.6 }], ['spines', { spines: 1, crouch: 0.6, t: 0.7 }],
    ['inflate', { inflate: 1, jaw: 1, headY: -2, t: 0.8 }], ['expel', { jaw: 1, inflate: 0.3, headY: 2, headX: -2, t: 0.9 }],
    ['dazed0', { crouch: 0.8, jaw: 0.4, headY: 3, t: 0.1 }], ['dazed1', { crouch: 0.6, jaw: 0.2, headY: 2, tailCurl: 0.3, t: 0.6 }],
    ['hurt', { crouch: 0.3, jaw: 0.5, headY: -1, t: 0.3 }],
    ...[0.25, 0.5, 0.75].map((k, i) => ['morph' + (i + 1), { morph: k, crouch: 1 - k, inflate: (1 - k) * 0.6, t: k }])
  ];
  const TITAN_FRAMES = [
    ['idle0', { breath: 0, sway: 0, t: 0 }], ['idle1', { breath: 1, sway: 0.6, t: 0.3 }], ['idle2', { breath: 0, sway: 1, t: 0.6 }],
    ['walk0', { crouch: 0.25, sway: -0.5, t: 0.1 }], ['walk1', { crouch: 0.25, sway: 0.5, t: 0.4 }],
    ['charge', { right: 'charge', glow: 1, crouch: 0.4, t: 0.2 }], ['aim', { right: 'charge', glow: 1.5, crouch: 0.6, t: 0.5 }],
    ['punch', { right: 'punch', t: 0.8 }], ['hammerUp', { left: 'up', right: 'up', crouch: 0.2, t: 0.1 }],
    ['hammerDown', { left: 'punch', right: 'punch', crouch: 0.9, t: 0.3 }], ['hook', { left: 'punch', crouch: 0.3, t: 0.5 }],
    ['summon', { left: 'up', right: 'up', glow: 1, t: 0.4 }],
    ['dazed0', { crouch: 0.9, sway: 0.8, t: 0.2 }], ['dazed1', { crouch: 0.7, sway: -0.8, t: 0.7 }], ['hurt', { crouch: 0.4, sway: 0.3, t: 0.4 }],
    ...[0.15, 0.45, 0.75].map((k, i) => ['morph' + (i + 1), { morph: k, crouch: (1 - k) * 0.8, t: k }])
  ];

  /** Genera una hoja de sprites cuadro a cuadro (sin trabar el juego). */
  class SheetBuilder {
    constructor(kind, spec) {
      const F = root.TMReyFormas, A = root.TMReyArt;
      this.kind = kind; this.spec = spec; this.key = kind + '|' + spec.hue + '|' + spec.mix.join(',');
      const beast = kind === 'beast';
      this.W = beast ? F.BEAST.W : F.TITAN.W; this.H = beast ? F.BEAST.H : F.TITAN.H; this.G = beast ? F.BEAST.G : F.TITAN.G;
      this.S = beast ? F.SCALE.beast : F.SCALE.titan;
      this.ax = beast ? F.beastParts({ scale: this.S }).body.x : F.TITAN.CX;
      this.defs = beast ? BEAST_FRAMES : TITAN_FRAMES;
      this.draw = (px, o) => (beast ? F.drawBeast : F.drawTitan)(px, 0, 0, spec, { ...o, scale: this.S });
      this.Px = A.Px; this.done = null; this.i = 0; this.px = [];
    }
    step(budgetMs) {
      if (this.done) return this.done;
      const t0 = performance.now();
      while (this.i < this.defs.length) {
        const px = new this.Px(this.W, this.H);
        this.draw(px, this.defs[this.i][1]);
        this.px.push(px); this.i++;
        if (performance.now() - t0 > budgetMs) return null;
      }
      return this.finish();
    }
    finish() {
      // Recorte común a todos los cuadros, centrado en el punto de apoyo.
      let x0 = this.W, x1 = 0, y0 = this.H, y1 = 0;
      for (const p of this.px) for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        if (!p.d[(y * p.w + x) * 4 + 3]) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const ax = Math.round(this.ax), half = Math.max(ax - x0, x1 + 1 - ax) + 1;
      const w = half * 2, left = ax - half, top = Math.max(0, y0 - 1), bottom = Math.min(this.H, y1 + 2), h = bottom - top;
      const cols = 6, rows = Math.ceil(this.px.length / cols);
      const c = document.createElement('canvas'); c.width = cols * w; c.height = rows * h;
      const g = c.getContext('2d');
      const frames = {};
      this.px.forEach((p, i) => {
        const img = g.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const sx = left + x, sy = top + y;
          if (sx < 0 || sx >= p.w) continue;
          const s = (sy * p.w + sx) * 4, d = (y * w + x) * 4;
          img.data[d] = p.d[s]; img.data[d + 1] = p.d[s + 1]; img.data[d + 2] = p.d[s + 2]; img.data[d + 3] = p.d[s + 3];
        }
        g.putImageData(img, (i % cols) * w, Math.floor(i / cols) * h);
        frames[this.defs[i][0]] = i;
      });
      this.px = null;
      this.done = { canvas: c, frames, cols, rows, w, h, off: bottom - this.G, key: this.key };
      return this.done;
    }
  }

  /** Textura del cono del Puñetazo del Rey (pixelada, con flechas). */
  function coneCanvas(len, half) {
    const L = Math.round(len * 16), Wd = Math.ceil(L * Math.tan(half)) * 2 + 4, A = root.TMReyArt, px = new A.Px(Wd, L);
    const cx = Wd / 2;
    for (let y = 0; y < L; y++) for (let x = 0; x < Wd; x++) {
      const dx = x + 0.5 - cx, dy = L - y - 0.5, d = Math.hypot(dx, dy), a = Math.abs(Math.atan2(dx, dy));
      if (d > L || a > half) continue;
      const edge = d > L - 2 || a > half - 1.6 / Math.max(8, d);
      const chev = Math.abs(((d - Math.abs(dx) * 0.6) % 22) - 11) < 2 && d > 10 && d < L - 6;
      px.set(x, y, edge ? '#ff9aa0' : chev ? '#ffd0c8' : '#e0585c', edge || chev ? 255 : 150);
    }
    return px.canvas();
  }

  class ReyCombate {
    constructor(ctl) {
      this.ctl = ctl; this.K = root.__TM_REY_KIT__; this.API = this.K && this.K.API;
      this.builders = new Map(); this.sheets = new Map(); this.meshes = new Map();
      this.shots = []; this.active = new Set(); this.dirT = 0; this.shownForm = 0;
      this.rebels = new Map(); this.rebelCount = 0; // Fragmentos Rebeldes (id → datos), por sesión
      this.coneMesh = null; this.group = null;
    }
    kit() { if (!this.K) { this.K = root.__TM_REY_KIT__; this.API = this.K && this.K.API; } return this.K; }
    form() { const e = this.ctl.actor; return e && e.ai ? (e.ai.form || 1) : 1; }
    spec() { const s = this.ctl.state(); return s && s.king; }

    // ── Ciclo de vida ──
    onActor(e) {
      if (!this.kit()) return;
      const f = this.API.formOf(e.hp, e.maxHp);
      Object.assign(e.ai, { form: f, pending: 0, summonCd: 3, absorbCd: 6, spineCd: 2, biteCd: 1.5, jumpCd: 3, punchCd: 2.5, hammerCd: 2, hookCd: 1, absorbed: 0, step: 0 });
      e.r = this.API.FORMS[f].r;
      this.shownForm = 0;
      this.queue(f);
      if (f >= 2) this.sheet(f === 2 ? 'beast' : 'titan', true);
    }
    reset() { this.shots = []; this.active = new Set(); this.rebelCount = 0; this.hideMine(); }
    lineage() { const k = this.spec(); return (this.API && this.API.LINEAGES[k && k.lineage]) || (this.API && this.API.LINEAGES.silvestre); }

    /** Cada clon nace con la fase del Rey; una minoría se vuelve independiente (Fragmento Rebelde). */
    onClone(m) {
      if (!this.kit()) return;
      const e = this.ctl.actor, k = this.spec(); if (!e || !k) return;
      m.fragPhase = e.ai.form || 1;
      if (this.rebelCount < 4 && Math.random() < 0.12) {
        this.rebelCount++;
        const id = Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
        m.rebel = { fragmentPhase: m.fragPhase, originKingId: 'rey-' + k.seed, identityId: id };
        m.atkCd = 99;
        this.rebels.set(m.id, { rebel: m.rebel, x: m.x, y: m.y });
      }
    }
    queue(f) {
      const k = this.spec(); if (!k || !root.TMReyFormas) return;
      for (const kind of f >= 3 ? ['titan'] : ['beast', 'titan']) {
        const b = new SheetBuilder(kind, k);
        if (!this.sheets.has(b.key) && !this.builders.has(b.key)) this.builders.set(b.key, b);
      }
    }
    /** Hoja lista de una forma; si se pide `now`, termina de generarla al momento. */
    sheet(kind, now) {
      const k = this.spec(); if (!k || !root.TMReyFormas) return null;
      const key = kind + '|' + k.hue + '|' + k.mix.join(',');
      if (this.sheets.has(key)) return this.sheets.get(key);
      if (!now) return null;
      const b = this.builders.get(key) || new SheetBuilder(kind, k);
      const s = b.step(1e9); this.builders.delete(key); this.sheets.set(key, s);
      return s;
    }

    tick(dt) {
      if (!this.kit()) return;
      // Hojas en segundo plano: unos pocos milisegundos por paso.
      for (const [key, b] of this.builders) {
        const s = b.step(5);
        if (s) { this.builders.delete(key); this.sheets.set(key, s); }
        break;
      }
      const e = this.ctl.actor, sess = this.ctl.app.session;
      if (sess && sess.world) {
        const w0 = sess.world;
        this.ctl.free = this.ctl.free.filter(m => w0.entities.includes(m) && !m.dead);
        for (const m of this.ctl.minions.concat(this.ctl.free)) {
          if (!m.rebel || m.dead) continue;
          const r = this.rebels.get(m.id); if (r) { r.x = m.x; r.y = m.y; }
          if (Math.random() < dt * 1.2) this.ctl.stage.spawn({ x: m.x + (Math.random() - 0.5) * 0.4, y: m.y, h: 0.9, vh: 0.8, g: 0, life: 0.6, col: 2, row: 3, scale: 0.7 });
        }
      }
      if (!e || !e.ai || !sess || !sess.world) { this.shots.length = 0; return; }
      const w = sess.world, av = sess.avatar, pid = sess.self.pid, down = !av || sess.isDown(pid);
      // Director de clones.
      this.dirT -= dt;
      if (this.dirT <= 0 && av) {
        this.dirT = 0.4;
        const n = e.ai.st === 'morph' || e.ai.st === 'absorb' ? 0 : this.API.FORMS[this.form()].active;
        this.active = this.API.directClones(this.ctl.minions.filter(m => w.entities.includes(m) && !m.rebel), this.active, av.x, av.y, n);
      }
      // Clones absorbidos por el Rey.
      for (const m of this.ctl.minions) {
        if (!m.__gone || !w.entities.includes(m)) continue;
        w.entities = w.entities.filter(x => x !== m);
        this.ctl.fxBurst(m.x, m.y, 0.8, 'drop' + (HUE_IDX[m.hue] || 0), 4, 0.35);
        if (this.ctl.audio) this.ctl.audio.pop();
        if (e.ai.st === 'absorb') {
          e.ai.absorbed++;
          e.hp = Math.min(this.API.formCeil(e.ai.form, e.maxHp), e.hp + e.maxHp * 0.025); e.ai.lastHp = e.hp;
        }
      }
      // Gotas expulsadas por la Bestia (se ven venir y se esquivan).
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const s = this.shots[i];
        s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.p) { s.p.x = s.x; s.p.y = s.y; s.p.vx = s.p.vy = 0; }
        if (!down && !s.hit && Math.hypot(av.x - s.x, av.y - s.y) < s.r && Math.abs(av.z - e.z) < 1) {
          s.hit = true; w.playerHits.push({ pid, dmg: s.dmg, id: e.id, x: s.x, y: s.y, st: null, dps: 0 });
          if (s.p) s.p.t = s.p.life;
          this.shots.splice(i, 1); continue;
        }
        const z = this.ctl.app.terrain.surfaceAt(s.x, s.y);
        if (s.t >= s.life || z !== z) { if (s.p) s.p.t = s.p.life; this.shots.splice(i, 1); }
      }
      // Barra de jefe: forma actual.
      const ui = this.ctl.ui, f = this.form();
      if (ui && !ui.boss.hidden && this.shownForm !== f) {
        this.shownForm = f;
        const F = this.API.FORMS[f], k = this.spec();
        const tag = ui.boss.querySelector('.tm-rey-phase'); if (tag) tag.textContent = F.tag;
        const sub = document.getElementById('tm-rey-boss-sub');
        const L = this.lineage();
        if (sub && k) sub.textContent = `${f === 1 ? this.API.variantName(k) : F.name}${L.rank ? ' · ' + L.name : ''} · Nv. ${k.level}`;
        if (this.ctl.audio && this.ctl.audio.setIntensity) this.ctl.audio.setIntensity(f);
      }
    }

    /** Filtra cada golpe al Rey: umbrales de forma e invulnerabilidad al transformarse. */
    gate(e, before, r, w, n) {
      const ai = e.ai; if (!ai || !this.kit()) return;
      const morphing = ai.st === 'morph';
      const g = this.API.gateHp(ai.form || 1, before, e.hp, e.maxHp, morphing);
      if (g.hp !== e.hp) {
        e.hp = g.hp;
        if (e.hp > 0 && e.dead) { e.dead = false; e.deadT = 0; if (r && typeof r === 'object') r.killed = false; }
        if (e.hp > 0 && w.kills && w.kills.length > n) w.kills.splice(n);
      }
      if (morphing && before > 0) ai.flash = 0.05;
      if (g.morph && !morphing && !ai.pending) ai.pending = Math.min(3, (ai.form || 1) + 1);
    }

    /** Red de seguridad por tick: ningún daño (quemadura, veneno…) salta una forma ni mata antes de la III. */
    guard(e) {
      const ai = e.ai; if (!ai || !this.kit()) return;
      const f = ai.form || 1;
      if (ai.st === 'morph') { if (e.hp < ai.morphHp) e.hp = ai.morphHp; }
      else if (f < 3) {
        const floor = this.API.formFloor(f, e.maxHp);
        if (e.hp <= floor) { e.hp = floor; if (!ai.pending) ai.pending = f + 1; }
      } else return;
      if (e.hp > 0 && e.dead) { e.dead = false; e.deadT = 0; }
    }

    /** Clones: los elegidos por el director atacan con la IA normal; el resto espera rodeando. */
    controlClone(m, dt, w) {
      const e = this.ctl.actor; if (!e) return false;
      if (m.__pull) {
        const dx = e.x - m.x, dy = e.y - m.y, d = Math.hypot(dx, dy) || 1, v = 7;
        m.x += dx / d * Math.min(d, v * dt); m.y += dy / d * Math.min(d, v * dt);
        const z = this.ctl.app.terrain.surfaceAt(m.x, m.y); if (z === z) m.z = z;
        m.moving = true; m.facing = dx < 0 ? 6 : 2; m.atk = 0;
        if (d < 1.2) m.__gone = true;
        return true;
      }
      if (m.rebel) {
        // Un Fragmento Rebelde no obedece: se aleja del Rey y no ataca. Se doma con calma cuando el Rey cae.
        const dx = m.x - e.x, dy = m.y - e.y, d = Math.hypot(dx, dy) || 1;
        m.atk = 0; m.moving = false;
        if (d < 5.5) { w._move(m, dx / d * 2.2, dy / d * 2.2, dt); m.moving = true; m.facing = dx < 0 ? 6 : 2; }
        return true;
      }
      if (this.active.has(m.id)) return false;
      const sess = this.ctl.app.session, av = sess && sess.avatar;
      m.atk = 0; m.moving = false; m.vx = m.vy = 0;
      if (!av) return true;
      const t = performance.now() / 1000, a = m.id * 2.399 + t * 0.22, R = 3.8 + (m.id % 3) * 0.55;
      const tx = av.x + Math.cos(a) * R, ty = av.y + Math.sin(a) * R * 0.8;
      const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
      if (d > 0.35) { const v = Math.min(1.8, d * 2); w._move(m, dx / d * v, dy / d * v, dt); m.moving = true; }
      m.facing = av.x < m.x ? 6 : 2;
      return true;
    }

    // ═══════════════════════════════════════════════════════════════
    // IA de las Formas II y III (y la transformación desde la I)
    // ═══════════════════════════════════════════════════════════════
    step(e, dt, w) {
      if (!this.kit()) return false;
      const ai = e.ai, API = this.API, K = this.K, C = this.ctl;
      if (!ai.form) ai.form = API.formOf(e.hp, e.maxHp);
      const enter = (st, extra) => { ai.st = st; ai.t = 0; ai.phase = ''; ai.hit = false; ai.hits = null; ai.note = ''; Object.assign(ai, extra || {}); };
      if (ai.pending && ai.st !== 'morph') { this.startMorph(e, ai.pending); ai.pending = 0; }
      if (ai.form === 1 && ai.st !== 'morph') return false;
      ai.ox = e.x; ai.oy = e.y; ai.oh = ai.h; ai.t += dt;
      const LIN = this.lineage();
      for (const cd of ['summonCd', 'absorbCd', 'spineCd', 'biteCd', 'jumpCd', 'punchCd', 'hammerCd', 'hookCd']) ai[cd] = (ai[cd] || 0) - dt / LIN.cd;
      e.moving = false; e.vx = 0; e.vy = 0; e.atk = 0;
      const sess = C.app.session, av = sess && sess.avatar, pid = sess && sess.self.pid;
      const down = !av || sess.isDown(pid), c = C.findCenter(), k = C.state().king;
      const dPC = av && c ? Math.hypot(av.x - c.x, av.y - c.y) : 99;
      const dist = av ? Math.hypot(av.x - e.x, av.y - e.y) : 99;
      if (e.hp < ai.lastHp) { ai.flash = 0.1; if (['idle', 'dazed', 'walk'].includes(ai.st)) ai.hurt = 0.22; }
      ai.lastHp = e.hp;
      ai.flash = Math.max(0, ai.flash - dt); ai.hurt = Math.max(0, ai.hurt - dt);
      const f = ai.form, atk = k.atk * (f === 2 ? 1.15 : 1.3);
      const face = x => { ai.flip = x < e.x; };
      const shake = s => { C.app.shakeT = Math.max(C.app.shakeT || 0, K.reduced() ? s * 0.3 : s); };
      const hit = (key, mul, r, test) => {
        if (down || !av) return false;
        ai.hits = ai.hits || new Set(); if (ai.hits.has(key)) return false;
        if (Math.abs(av.z - e.z) > 1.1) return false;
        if (test ? !test() : Math.hypot(av.x - e.x, av.y - e.y) > r) return false;
        ai.hits.add(key);
        w.playerHits.push({ pid, dmg: Math.max(1, Math.round(atk * mul)), id: e.id, x: e.x, y: e.y, st: null, dps: 0 });
        return true;
      };
      const move = (vx, vy) => {
        const moved = w._move(e, vx, vy, dt);
        if (c) {
          const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy);
          if (d > K.ARENA.leash) { e.x = c.x + dx / d * K.ARENA.leash; e.y = c.y + dy / d * K.ARENA.leash; const z = C.app.terrain.surfaceAt(e.x, e.y); if (z === z) e.z = z; return false; }
        }
        return moved;
      };
      const clamp2 = (x, y) => {
        if (!c) return { x, y };
        const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
        return d > K.ARENA.leash ? { x: c.x + dx / d * K.ARENA.leash, y: c.y + dy / d * K.ARENA.leash } : { x, y };
      };
      const busy = !['idle', 'hop', 'walk', 'return', 'dazed'].includes(ai.st);
      if ((down || dPC > K.ARENA.lose) && !busy && ai.st !== 'return') enter('return');
      const clones = C.minions.filter(m => !m.dead && !m.rebel && w.entities.includes(m) && !m.__pull).length;

      switch (ai.st) {
        // ── Transformación ──
        case 'morph': {
          ai.h = Math.max(0, ai.h - dt * 30);
          if (Math.random() < 0.5) C.fxBurst(e.x + (Math.random() - 0.5) * 2, e.y, 0.6 + Math.random() * 2, 'drop' + (HUE_IDX[k.hue] || 0), 1, 0.4);
          if (ai.t > 1.4 && !ai.hit) { ai.hit = true; ai.form = ai.to; e.r = API.FORMS[ai.to].r; }
          if (ai.t > 2.2 && !ai.boomed) {
            ai.boomed = true;
            shake(0.5); C.stage.shock(e.x, e.z, e.y, 4.5, 0.6); C.stage.shock(e.x, e.z, e.y, 2.8, 0.4);
            C.fxDust(e.x, e.y, 14, 2.6); C.fxBurst(e.x, e.y, 2.4, 'spark', 10, 0.6);
            if (C.ui) C.ui.flashOnce(0.8);
            // La onda empuja al jugador fuera del cuerpo del Rey (sin daño).
            if (av && !down && dist < API.FORMS[ai.to].r + 1.4) this.pushOut(av, e, API.FORMS[ai.to].r + 1.6);
            const F = API.FORMS[ai.to];
            if (C.ui) C.ui.showBanner(`<small>${F.tag}</small><b>${F.name.toUpperCase()}</b><em>${ai.to === 2 ? 'Esquiva el megasalto y castígala cuando quede pegada' : 'Sal del cono del Puñetazo del Rey'}</em>`, 3600);
          }
          if (ai.t >= MORPH) { ai.boomed = false; enter('idle', { wait: 0.6 }); }
          break;
        }
        case 'idle': {
          ai.h = 0;
          if (av && !down) face(av.x);
          if (ai.t < ai.wait || !av || down) break;
          const r = Math.random();
          if (f === 2) {
            const pick = API.pickAttackII({ d: dist, clones, summonCd: ai.summonCd, absorbCd: ai.absorbCd, spineCd: ai.spineCd, biteCd: ai.biteCd, jumpCd: ai.jumpCd }, r);
            if (pick === 'summon') { enter('summon'); ai.summonCd = 10; }
            else if (pick === 'absorb') { enter('absorb'); ai.absorbCd = 14; ai.absorbed = 0; if (C.audio) C.audio.suck(1.5); }
            else if (pick === 'spines') { enter('spines'); ai.spineCd = 5; }
            else if (pick === 'bite') { enter('bite', { phase: 'windup', dx: av.x - e.x, dy: av.y - e.y }); ai.biteCd = 3.6; face(av.x); }
            else if (pick === 'megajump') { enter('megajump', { phase: 'crouch', tx: av.x, ty: av.y }); ai.jumpCd = 7.5; }
            else { const st = Math.max(0.7, Math.min(dist - 1.9, 1.7)), dx = av.x - e.x, dy = av.y - e.y, d = dist || 1, p = clamp2(e.x + dx / d * st, e.y + dy / d * st); enter('hop', { phase: 'crouch', tx: p.x, ty: p.y, dur: 0.5 }); }
          } else {
            const pick = API.pickAttackIII({ d: dist, clones, summonCd: ai.summonCd, punchCd: ai.punchCd, hammerCd: ai.hammerCd, hookCd: ai.hookCd }, r);
            if (pick === 'summon') { enter('summon'); ai.summonCd = 11; }
            else if (pick === 'punch') { enter('punch', { phase: 'charge', dx: av.x - e.x, dy: av.y - e.y }); ai.punchCd = 6.5; if (C.audio) C.audio.chargeUp(0.9); }
            else if (pick === 'hammer') { enter('hammer', { phase: 'up' }); ai.hammerCd = 4.8; }
            else if (pick === 'hook') { enter('hook', { phase: 'windup' }); ai.hookCd = 2.6; face(av.x); }
            else enter('walk', { dur: 0.9 + Math.random() * 0.4 });
          }
          break;
        }
        case 'return': {
          const back = c ? Math.hypot(e.x - c.x, e.y - c.y) : 0;
          ai.note = down ? 'El Rey recupera fuerzas…' : 'El Rey vuelve a su trono';
          if (back < 0.6) {
            ai.h = 0;
            e.hp = Math.min(API.formCeil(f, e.maxHp), e.hp + e.maxHp * (down ? 0.5 : 0.05) * dt); ai.lastHp = e.hp;
            if (!down && dPC < K.ARENA.lose - 2) enter('idle', { wait: 0.6 });
            break;
          }
          const dx = c.x - e.x, dy = c.y - e.y, d = back || 1, v = f === 2 ? 2.6 : 2.2;
          move(dx / d * v, dy / d * v); e.moving = true; face(c.x);
          ai.h = f === 2 ? Math.abs(Math.sin(ai.t * 6)) * 0.4 : 0;
          break;
        }
        case 'dazed': {
          ai.h = 0;
          if (ai.t >= (ai.dur || 1.5)) enter('idle', { wait: 0.25 });
          break;
        }
        case 'summon': {
          if (ai.t >= 0.6 && !ai.hit) { ai.hit = true; C.summonMinions(e); shake(0.12); }
          if (ai.t >= 1.4) enter('idle', { wait: 0.5 });
          break;
        }

        // ── Forma II · Bestia gelatinosa ──
        case 'hop': {
          if (ai.phase === 'crouch') { if (ai.t >= 0.16) { ai.phase = 'air'; ai.t = 0; ai.sx = e.x; ai.sy = e.y; face(ai.tx); } }
          else if (ai.phase === 'air') {
            const u = Math.min(1, ai.t / ai.dur);
            ai.h = Math.sin(u * Math.PI) * 0.7; e.moving = true;
            move((ai.tx - ai.sx) / ai.dur, (ai.ty - ai.sy) / ai.dur);
            if (u >= 1) { ai.phase = 'land'; ai.t = 0; ai.h = 0; shake(0.08); C.fxDust(e.x, e.y, 5, 1.1); if (C.audio) C.audio.stomp(); }
          } else if (ai.t >= 0.2) enter('idle', { wait: 0.3 + Math.random() * 0.3 });
          break;
        }
        case 'bite': {
          if (ai.phase === 'windup') {
            if (av && ai.t < 0.5) { ai.dx = av.x - e.x; ai.dy = av.y - e.y; face(av.x); }
            if (ai.t >= 0.72) { const d = Math.hypot(ai.dx, ai.dy) || 1; ai.dx /= d; ai.dy /= d; ai.phase = 'dash'; ai.t = 0; if (C.audio) C.audio.whoosh(false); }
          } else if (ai.phase === 'dash') {
            const v = 9.5, bx = e.x, by = e.y, moved = move(ai.dx * v, ai.dy * v);
            e.moving = true; hit('bite', 1.0, 1.75);
            if (Math.random() < 0.6) C.fxDust(e.x - ai.dx, e.y - ai.dy, 1, 0.5);
            const stuck = !moved || Math.hypot(e.x - bx, e.y - by) < v * dt * 0.3;
            if (stuck && ai.t > 0.06) {
              enter('dazed', { dur: 1.6 }); ai.note = '¡Se estrelló! Es tu oportunidad';
              shake(0.32); C.stage.shock(e.x, e.z, e.y, 2, 0.35); C.fxStars(e); if (C.audio) C.audio.boom(false);
            } else if (ai.t >= 0.45) { ai.phase = 'skid'; ai.t = 0; C.fxDust(e.x, e.y, 6, 1.2); }
          } else {
            move(ai.dx * Math.max(0, 5 * (1 - ai.t / 0.35)), ai.dy * Math.max(0, 5 * (1 - ai.t / 0.35)));
            if (ai.t >= 0.6) enter('idle', { wait: 0.35 });
          }
          break;
        }
        case 'megajump': {
          const R = 3.2;
          if (ai.phase === 'crouch') {
            if (ai.t >= 0.7) { ai.phase = 'rise'; ai.t = 0; if (C.audio) C.audio.whoosh(true); C.fxDust(e.x, e.y, 8, 1.6); shake(0.1); }
          } else if (ai.phase === 'rise') {
            ai.h = 12 * K.ease(Math.min(1, ai.t / 0.35));
            if (ai.t >= 0.35) { ai.phase = 'air'; ai.t = 0; }
          } else if (ai.phase === 'air') {
            ai.h = 12;
            const lock = 1.1;
            if (av && ai.t < lock - 0.4) { const kk = Math.min(1, dt * 3); const p = clamp2(K.lerp(ai.tx, av.x, kk), K.lerp(ai.ty, av.y, kk)); ai.tx = p.x; ai.ty = p.y; }
            if (Math.floor(ai.t * 6) !== Math.floor((ai.t - dt) * 6) && C.audio) C.audio.warn();
            if (ai.t >= lock) {
              const z = C.app.terrain.surfaceAt(ai.tx, ai.ty);
              if (z === z && Math.abs(z - e.z) < 0.01) { e.x = ai.tx; e.y = ai.ty; ai.ox = e.x; ai.oy = e.y; }
              ai.phase = 'fall'; ai.t = 0;
            }
          } else if (ai.phase === 'fall') {
            ai.h = 12 * (1 - Math.min(1, ai.t / 0.22));
            if (ai.t >= 0.22) {
              ai.h = 0; ai.phase = 'land'; ai.t = 0;
              hit('jump', 1.5, R);
              shake(0.55); C.stage.shock(e.x, e.z, e.y, R + 1.2, 0.55); C.stage.shock(e.x, e.z, e.y, R * 0.7, 0.35);
              C.stage.crack(e.x, e.z, e.y); C.fxDust(e.x, e.y, 14, 2.8); C.fxDrops(e, 12);
              if (C.audio) C.audio.boom(true);
            }
          } else if (ai.t >= 0.25) { enter('dazed', { dur: 1.5 }); ai.note = '¡La Bestia quedó pegada al suelo!'; C.fxStars(e); }
          break;
        }
        case 'spines': {
          const R = 2.7;
          if (!ai.phase) { ai.phase = 'windup'; if (C.audio) C.audio.warn(); }
          if (ai.phase === 'windup' && ai.t >= 0.75) {
            ai.phase = 'burst'; ai.t = 0;
            hit('spines', 1.1, R);
            if (C.audio) C.audio.spines();
            shake(0.15);
            for (let i = 0; i < 14; i++) {
              const a = i / 14 * TAU, v = 5 + Math.random();
              C.stage.spawn({ x: e.x + Math.cos(a) * 0.8, y: e.y + Math.sin(a) * 0.5, h: 0.9, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vh: 1.5, g: 6, drag: 4, life: 0.4, col: 3, row: 1, scale: 1.1 });
            }
          } else if (ai.phase === 'burst' && ai.t >= 0.55) enter('idle', { wait: 0.45 });
          break;
        }
        case 'absorb': {
          // Atrae a sus clones; cada uno que entra la cura un poco.
          if (Math.floor(ai.t * 5) !== Math.floor((ai.t - dt) * 5)) {
            for (const m of C.minions) if (!m.dead && !m.rebel && Math.hypot(m.x - e.x, m.y - e.y) < 9) m.__pull = true;
          }
          ai.note = 'La Bestia absorbe a sus clones…';
          if (ai.t >= 1.7) {
            for (const m of C.minions) m.__pull = m.__gone ? m.__pull : false;
            enter('expel', { count: Math.min(18, 8 + ai.absorbed * 2) });
          }
          break;
        }
        case 'expel': {
          if (ai.t >= 0.3 && !ai.hit) {
            ai.hit = true;
            if (C.audio) C.audio.spit();
            shake(0.12);
            const n = ai.count || 8, off = Math.random() * TAU, hue = k.hue;
            for (let i = 0; i < n; i++) {
              const a = off + i / n * TAU, v = 5.8;
              const p = C.stage.spawn({ x: e.x, y: e.y, h: 1.1, g: 0, life: 1.4, col: HUE_IDX[hue] || 0, row: 0, scale: 1.7 });
              if (!p) break;
              this.shots.push({ x: e.x + Math.cos(a) * 0.9, y: e.y + Math.sin(a) * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.75, t: 0, life: 1.35, r: 0.55, dmg: Math.max(1, Math.round(atk * 0.5)), p });
            }
          }
          if (ai.t >= 0.95) enter('idle', { wait: 0.4 });
          break;
        }

        // ── Forma III · Rey humanoide ──
        case 'walk': {
          if (av && !down && dist > 2.1) {
            const v = 1.75, dx = av.x - e.x, dy = av.y - e.y, d = dist || 1;
            move(dx / d * v, dy / d * v); e.moving = true; face(av.x);
          }
          const stepN = Math.floor(ai.t / 0.42);
          if (stepN !== ai.step) { ai.step = stepN; if (C.audio) C.audio.stomp(); shake(0.06); C.fxDust(e.x + (stepN % 2 ? 0.6 : -0.6), e.y + 0.2, 3, 0.7); }
          if (ai.t >= ai.dur || (dist < 2.1 && ai.t > 0.3)) enter('idle', { wait: 0.15 });
          break;
        }
        case 'punch': {
          // Tiempo 1: carga (el puño brilla). Tiempo 2: dirección (cono en el suelo). Tiempo 3: golpe.
          if (ai.phase === 'charge') {
            if (av) { ai.dx = av.x - e.x; ai.dy = av.y - e.y; face(av.x); }
            ai.note = '¡El Rey carga su puño!';
            if (ai.t >= 0.9) { ai.phase = 'aim'; ai.t = 0; const d = Math.hypot(ai.dx, ai.dy) || 1; ai.dx /= d; ai.dy /= d; ai.flip = ai.dx < 0; }
          } else if (ai.phase === 'aim') {
            ai.note = '¡Sal del cono!';
            if (Math.floor(ai.t * 8) !== Math.floor((ai.t - dt) * 8) && C.audio) C.audio.warn();
            if (ai.t >= 0.65) {
              ai.phase = 'strike'; ai.t = 0; ai.note = '';
              hit('punch', 1.8, 0, () => API.inCone(e.x, e.y, ai.dx, ai.dy, av.x, av.y, CONE.len, CONE.half + 0.05));
              if (C.audio) C.audio.punch();
              shake(0.6); if (C.ui) C.ui.flashOnce(0.35);
              for (const s of [1.6, 3.6, 5.6]) C.stage.shock(e.x + ai.dx * s, e.z, e.y + ai.dy * s, 1.6, 0.45);
              C.stage.crack(e.x + ai.dx * 2.2, e.z, e.y + ai.dy * 2.2);
              for (let i = 0; i < 10; i++) { const s = 1 + Math.random() * 5; C.fxDust(e.x + ai.dx * s, e.y + ai.dy * s, 1, 1.4); }
              this.splinterTrees(e, ai.dx, ai.dy);
            }
          } else if (ai.phase === 'strike') {
            if (ai.t >= 0.35) {
              ai.phase = 'recover'; ai.t = 0;
              ai.echo = LIN.rank >= 3 ? 0.55 : 0; // Renacido III: el puño deja un eco que golpea otra vez
              ai.note = ai.echo ? '¡Eco del puño! Sigue fuera del cono' : '¡Quedó abierto tras el golpe!';
            }
          } else {
            if (ai.echo && ai.t >= ai.echo) {
              ai.echo = 0; ai.echoes = (ai.echoes || 0) + 1; ai.note = '¡Quedó abierto tras el golpe!';
              hit('echo', 1.0, 0, () => API.inCone(e.x, e.y, ai.dx, ai.dy, av.x, av.y, CONE.len, CONE.half + 0.05));
              if (C.audio) C.audio.punch();
              shake(0.35);
              for (const s2 of [2, 4.2]) C.stage.shock(e.x + ai.dx * s2, e.z, e.y + ai.dy * s2, 1.4, 0.4);
            }
            if (ai.t >= (LIN.rank >= 3 ? 1.4 : 1.0)) enter('idle', { wait: 0.3 });
          }
          break;
        }
        case 'hammer': {
          const R = 3.0;
          if (ai.phase === 'up' && ai.t >= 0.8) {
            ai.phase = 'down'; ai.t = 0;
            hit('hammer', 1.35, R);
            shake(0.45); C.stage.shock(e.x, e.z, e.y, R + 1, 0.5); C.stage.crack(e.x, e.z, e.y);
            C.fxDust(e.x, e.y, 12, 2.4); C.fxDrops(e, 6); if (C.audio) C.audio.boom(true);
          } else if (ai.phase === 'down' && ai.t >= 0.75) enter('idle', { wait: 0.35 });
          break;
        }
        case 'hook': {
          const R = 2.4;
          if (ai.phase === 'windup' && ai.t >= 0.45) {
            ai.phase = 'swing'; ai.t = 0;
            hit('hook', 0.95, R, () => Math.hypot(av.x - e.x, av.y - e.y) < R && (ai.flip ? av.x <= e.x + 0.4 : av.x >= e.x - 0.4));
            if (C.audio) C.audio.whoosh(false);
            shake(0.12); C.fxDust(e.x + (ai.flip ? -1.4 : 1.4), e.y, 4, 1);
          } else if (ai.phase === 'swing' && ai.t >= 0.45) enter('idle', { wait: 0.3 });
          break;
        }
        default: enter('idle', { wait: 0.5 });
      }
      e.high = (ai.st === 'megajump' && (ai.phase === 'air' || ai.phase === 'rise'));
      e.homeX = c ? c.x : e.x; e.homeY = c ? c.y : e.y;
      e.facing = ai.flip ? 6 : 2;
      return true;
    }

    startMorph(e, to) {
      const ai = e.ai, C = this.ctl;
      this.sheet(to === 2 ? 'beast' : 'titan', true);
      Object.assign(ai, { st: 'morph', t: 0, phase: '', hit: false, hits: null, to, from: ai.form || 1, boomed: false, note: 'El Rey se transforma…', wait: 0, morphHp: e.hp });
      this.shots.forEach(s => { if (s.p) s.p.t = s.p.life; }); this.shots = [];
      for (const m of C.minions) if (!m.dead && !m.rebel) m.__pull = true; // la masa reabsorbe a sus clones (los rebeldes se resisten)
      if (C.audio) C.audio.transform(to);
      C.app.shakeT = Math.max(C.app.shakeT || 0, 0.25);
      if (to === 3) this.queue(3);
    }

    /** Aparta al jugador del cuerpo recién crecido, solo hacia un suelo libre y al mismo nivel. */
    pushOut(av, e, R) {
      const T = this.ctl.app.terrain, d = Math.hypot(av.x - e.x, av.y - e.y);
      const base = d > 0.05 ? Math.atan2(av.y - e.y, av.x - e.x) : Math.PI / 2;
      for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
        const a = base + off, x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R, z = T.surfaceAt(x, y);
        if (z !== z || Math.abs(z - av.z) > 0.01) continue;
        if ((T.obstacles || []).some(o => Math.hypot(o.x - x, o.y - y) < (o.r || 0.3) + 0.4)) continue;
        av.x = av.px = x; av.y = av.py = y;
        return true;
      }
      return false;
    }

    /** El Puñetazo del Rey rompe los árboles dentro del cono (hasta 4 por golpe). */
    splinterTrees(e, dx, dy) {
      const T = this.ctl.app.terrain, K = this.K; if (!T || !T.obstacles) return;
      const props = T.props || [];
      const hits = T.obstacles.filter(o => o.tag !== K.OB_TAG && this.API.inCone(e.x, e.y, dx, dy, o.x, o.y, CONE.len + 0.8, CONE.half))
        .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 4);
      let broke = 0;
      for (const o of hits) {
        const prop = props.find(p => p.type === 'tree' && (p.ob === o || (Math.abs(p.x - o.x) < 1e-6 && Math.abs(p.y - o.y) < 1e-6)));
        this.ctl.fxBurst(o.x, o.y, 1.8, 'spark', 4, 0.4);
        this.ctl.fxDust(o.x, o.y, 6, 1.4);
        if (prop && this.breakTree(T, o, prop)) broke++;
      }
      if (hits.length && this.ctl.audio) this.ctl.audio.crunch();
      if (broke && this.ctl.ui) this.ctl.ui.showBanner('<small>PUÑETAZO DEL REY</small><b>¡Derribó ' + (broke === 1 ? 'un árbol' : broke + ' árboles') + '!</b><em>Ojo: el bosque ya no te cubre por ese lado</em>', 2200);
    }
    /** Quita un árbol del mapa en esta sesión (vuelve a crecer al recargar). */
    breakTree(T, o, prop) {
      const view = this.ctl.app.view, ch = view && view.chunks;
      if (!ch || !ch.props || !ch.live || typeof ch._dispose !== 'function') return false; // motor sin sectores: solo astillas
      T.obstacles = T.obstacles.filter(x => x !== o); T._obstCells = null;
      T.props = T.props.filter(x => x !== prop);
      const cx = Math.floor(prop.x / ch.size), cy = Math.floor(prop.y / ch.size), key = ch.key(cx, cy);
      const list = ch.props.get(key); if (list) { const i = list.indexOf(prop); if (i >= 0) list.splice(i, 1); }
      const live = ch.live.get(key);
      if (live) { ch._dispose(key, live); try { ch._buildNow(cx, cy); } catch (_) { /* se rehace en el próximo cuadro */ } }
      // Tronco que estalla: hojas, astillas, polvo y grieta en la base.
      const st = this.ctl.stage;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * TAU, v = 1.5 + Math.random() * 2.5;
        st.spawn({ x: o.x, y: o.y, h: 1.5 + Math.random() * 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vh: 1 + Math.random() * 2.5, g: 5, drag: 1.2, life: 0.9 + Math.random() * 0.4, col: 0, row: 0, scale: 0.9 });
      }
      this.ctl.fxBurst(o.x, o.y, 0.8, 'spark', 6, 0.5);
      this.ctl.fxDust(o.x, o.y, 10, 2);
      st.crack(o.x, o.z || 0, o.y);
      return true;
    }

    /** Cámara de jefe: encuadra al jugador y al Rey (que en las Formas II y III es enorme). */
    camera(dt) {
      const C = this.ctl, pr = C.app.pr, e = C.actor, av = C.app.session && C.app.session.avatar;
      const want = { x: 0, y: 0 };
      if (e && e.ai && av && ((e.ai.form || 1) >= 2 || e.ai.st === 'morph')) {
        const dx = e.x - av.x, dy = e.y - av.y, d = Math.hypot(dx, dy) || 1, k = Math.min(d * 0.4, 3) / d;
        const tall = (e.ai.form || 1) >= 3 || e.ai.to === 3 ? 2.3 : 1.1;
        want.x = dx * k; want.y = dy * k - tall;
      }
      const cam = this.cam || (this.cam = { x: 0, y: 0 }), u = Math.min(1, dt * 3);
      cam.x += (want.x - cam.x) * u; cam.y += (want.y - cam.y) * u;
      if (!pr || (Math.abs(cam.x) < 0.02 && Math.abs(cam.y) < 0.02)) return;
      pr.focus(pr.col / 16 + cam.x, 0, -pr.row / 16 + cam.y);
    }

    // ═══════════════════════════════════════════════════════════════
    // Dibujo
    // ═══════════════════════════════════════════════════════════════
    meshFor(kind) {
      const st = this.ctl.stage, sh = this.sheet(kind, true); if (!sh || !st.group) return null;
      let m = this.meshes.get(kind);
      if (m && (m.key !== sh.key || m.group !== st.group)) { if (m.group === st.group) st.group.remove(m.mesh); m = null; }
      if (!m) {
        const mat = st.mat(st.tex(sh.canvas)), mesh = st.mesh(st.geo(this.K.geoUp(sh.w, sh.h, sh.off)), mat);
        m = { mesh, mat, sheet: sh, key: sh.key, group: st.group };
        this.meshes.set(kind, m);
      }
      return m;
    }
    coneFor() {
      const st = this.ctl.stage; if (!st.group) return null;
      if (this.coneMesh && this.coneGroup === st.group) return this.coneMesh;
      const L = Math.round(CONE.len * 16), c = coneCanvas(CONE.len, CONE.half);
      const g = new THREE.PlaneGeometry(c.width / 16, L / 16); g.translate(0, L / 32, 0); g.rotateX(-Math.PI / 2);
      this.coneMesh = st.mesh(st.geo(g), this.K.decalMat(st.tex(c, true), 0), 1);
      this.coneGroup = st.group;
      return this.coneMesh;
    }
    hideMine() {
      for (const m of this.meshes.values()) if (m.mesh) m.mesh.visible = false;
      if (this.coneMesh) this.coneMesh.visible = false;
      const st = this.ctl.stage;
      if (st && st.slamRing) st.slamRing.visible = st.slamFill.visible = st.smallRing.visible = st.lane.visible = false;
      if (st && st.view) st.setGlow('fist', null);
    }

    draw(dt, s, zAt, KS, e) {
      if (!this.kit() || !e || !e.ai) return false;
      const ai = e.ai, K = this.K, st = this.ctl.stage, f = ai.form || 1;
      if (f === 1 && ai.st !== 'morph') { this.hideMine(); return false; }
      const al = K.clamp(this.ctl.app.loop ? this.ctl.app.loop.alpha : 1, 0, 1);
      const x = K.lerp(ai.ox, e.x, al), y = K.lerp(ai.oy, e.y, al), h = K.lerp(ai.oh, ai.h, al);
      const z = zAt(x, y), time = K.now() / 1000, blink = n => Math.floor(time * n) % 2;
      let kind = f === 2 ? 'beast' : 'titan', frame = 'idle0', jitter = 0, tint = 0, glow = 0;
      const idle = () => kind === 'beast' ? 'idle' + (Math.floor(time * 5) % 4) : 'idle' + [0, 1, 2, 1][Math.floor(time * 3) % 4];
      // ── Elección de cuadro ──
      if (ai.st === 'morph') {
        const u = ai.t / MORPH;
        jitter = (blink(28) ? 1 : -1) / 16 * (u < 0.8 ? 1 : 0);
        if (ai.to === 2) {
          if (u < 0.22) kind = 'king';
          else { kind = 'beast'; frame = u < 0.38 ? 'morph1' : u < 0.54 ? 'morph2' : u < 0.7 ? 'morph3' : u < 0.82 ? 'crouch' : 'inflate'; }
        } else {
          if (u < 0.22) { kind = 'beast'; frame = blink(10) ? 'inflate' : 'crouch'; }
          else { kind = 'titan'; frame = u < 0.38 ? 'morph1' : u < 0.54 ? 'morph2' : u < 0.7 ? 'morph3' : u < 0.82 ? 'hammerUp' : 'summon'; }
        }
        if (u < 0.8) tint = blink(12) ? 0.45 : 0.15;
      } else if (kind === 'beast') {
        switch (ai.st) {
          case 'idle': frame = ai.hurt > 0 ? 'hurt' : idle(); break;
          case 'hop': frame = ai.phase === 'crouch' ? 'hopCrouch' : ai.phase === 'air' ? 'hopAir' : 'hopCrouch'; break;
          case 'return': frame = ai.h > 0.2 ? 'hopAir' : 'hopCrouch'; break;
          case 'bite': frame = ai.phase === 'windup' ? 'crouch' : 'bite'; if (ai.phase === 'windup') { jitter = (blink(24) ? 1 : -1) / 16; tint = 1; } break;
          case 'megajump': frame = ai.phase === 'crouch' ? 'crouch' : ai.phase === 'land' ? 'crouch' : 'air'; if (ai.phase === 'crouch') { jitter = (blink(30) ? 1 : -1) / 16; tint = 1; } break;
          case 'spines': frame = ai.phase === 'burst' ? 'spines' : 'crouch'; if (ai.phase !== 'burst') { jitter = (blink(30) ? 1 : -1) / 16; tint = 1; } break;
          case 'absorb': frame = 'inflate'; jitter = (blink(16) ? 1 : -1) / 16; break;
          case 'expel': frame = ai.t < 0.3 ? 'inflate' : 'expel'; break;
          case 'summon': frame = ai.t < 0.6 ? 'inflate' : 'expel'; break;
          case 'dazed': frame = blink(4) ? 'dazed1' : 'dazed0'; break;
          default: frame = idle();
        }
      } else {
        switch (ai.st) {
          case 'idle': frame = ai.hurt > 0 ? 'hurt' : idle(); break;
          case 'walk': case 'return': frame = ai.st === 'walk' || e.moving ? 'walk' + (Math.floor(time * 4.8) % 2) : idle(); break;
          case 'punch': frame = ai.phase === 'charge' ? 'charge' : ai.phase === 'aim' ? 'aim' : ai.phase === 'strike' ? 'punch' : 'hurt';
            glow = ai.phase === 'charge' ? 0.6 + ai.t : ai.phase === 'aim' ? 1.6 : 0;
            if (ai.phase === 'aim') { jitter = (blink(30) ? 1 : -1) / 16; tint = 1; } break;
          case 'hammer': frame = ai.phase === 'up' ? 'hammerUp' : 'hammerDown'; if (ai.phase === 'up') { jitter = (blink(26) ? 1 : -1) / 16; tint = 1; } break;
          case 'hook': frame = ai.phase === 'windup' ? 'charge' : 'hook'; if (ai.phase === 'windup') tint = 1; break;
          case 'summon': frame = ai.t < 0.6 ? 'hammerUp' : 'summon'; break;
          case 'dazed': frame = blink(3) ? 'dazed1' : 'dazed0'; break;
          default: frame = idle();
        }
      }
      // ── Sprite ──
      for (const [k2, m] of this.meshes) if (k2 !== kind && m.mesh) m.mesh.visible = false;
      KS.crown.visible = false;
      let mat;
      if (kind === 'king') {
        st.kingFrame(blink(8) ? 'hurt' : 'summon', ai.flip);
        KS.mesh.visible = true; K.placeUp(KS.mesh, x + jitter, z + h, y); mat = KS.mat;
      } else {
        KS.mesh.visible = false;
        const M = this.meshFor(kind); if (!M) return false;
        const sh = M.sheet, i = sh.frames[frame] !== undefined ? sh.frames[frame] : 0;
        const flip = ai.st === 'bite' && ai.phase === 'dash' ? ai.dx < 0 : ai.flip;
        K.setFrame(M.mat, i % sh.cols, Math.floor(i / sh.cols), sh.cols, sh.rows, flip);
        M.mesh.visible = true; K.placeUp(M.mesh, x + jitter, z + h, y); mat = M.mat;
      }
      const u = mat.uniforms;
      u.uFlash.value = ai.flash > 0 ? 0.85 : ai.st === 'morph' && ai.t > 2.1 && ai.t < 2.35 ? 1 : 0;
      if (tint) u.uTint.value.set(1, 0.2, 0.2, blink(10) ? 0.35 * tint : 0.12 * tint);
      else if (ai.st === 'morph') u.uTint.value.set(0.75, 0.6, 1, blink(12) ? 0.3 : 0.1);
      else u.uTint.value.set(0, 0, 0, 0);
      const rim = this.lineage().rim;
      if (rim) u.uRim.value.set(rim[0], rim[1], rim[2], 0.35 + 0.15 * Math.sin(time * 3)); else u.uRim.value.set(0, 0, 0, 0);
      // Sombra a la medida de la forma.
      const big = kind === 'beast' ? 2.1 : kind === 'titan' ? 1.8 : 1;
      KS.shadow.visible = true;
      const ss = big * (1 - Math.min(0.65, h / 14));
      KS.shadow.scale.set(ss, 1, ss);
      K.placeFlat(KS.shadow, x, z, y + 0.08);
      // Luz del puño cargado.
      if (glow > 0) st.setGlow('fist', { x: x + (ai.flip ? -1.3 : 1.3), y, z: z + 2.2, r: 2.5 + glow * 1.5, color: [0.55, 0.42, 1], pulse: 1, prio: 4 });
      else st.setGlow('fist', null);
      // ── Avisos en el suelo ──
      st.slamRing.visible = st.slamFill.visible = st.smallRing.visible = st.lane.visible = false;
      const cone = this.coneFor(); if (cone) cone.visible = false;
      const ring = (R, flashN) => { st.smallRing.visible = true; st.smallRing.material.opacity = 0.5 + 0.35 * blink(flashN); const sc = R * 2 / 3.25; st.smallRing.scale.set(sc, 1, sc); K.placeFlat(st.smallRing, x, z, y, 0.05); };
      if (ai.st === 'megajump' && ['air', 'fall', 'rise'].includes(ai.phase)) {
        const R = 3.2, lock = 1.1, p = ai.phase === 'air' ? K.clamp(ai.t / lock, 0, 1) : ai.phase === 'fall' ? 1 : 0, tz = zAt(ai.tx, ai.ty);
        st.slamRing.visible = true; st.slamRing.material.opacity = 0.55 + 0.35 * blink(10);
        K.placeFlat(st.slamRing, ai.tx, tz, ai.ty, 0.05); st.slamRing.scale.set(R * 2 / 5, 1, R * 2 / 5);
        st.slamFill.visible = true; st.slamFill.material.opacity = 0.32;
        const fs = Math.max(0.05, p) * R * 2 / 5; st.slamFill.scale.set(fs, 1, fs); K.placeFlat(st.slamFill, ai.tx, tz, ai.ty, 0.045);
        K.placeFlat(KS.shadow, ai.tx, tz, ai.ty + 0.08);
        const M = this.meshes.get('beast');
        if (ai.phase === 'air' && M) M.mesh.visible = false;
        else if (ai.phase === 'fall' && M) K.placeUp(M.mesh, ai.tx, tz + h, ai.ty);
      }
      if ((ai.st === 'spines' && ai.phase !== 'burst')) ring(2.7, 12);
      if (ai.st === 'hammer' && ai.phase === 'up') ring(3.0, 10);
      if (ai.st === 'hook' && ai.phase === 'windup') ring(2.4, 14);
      if (ai.st === 'bite' && ai.phase === 'windup') {
        const d = Math.hypot(ai.dx, ai.dy) || 1, ang = Math.atan2(ai.dx / d, -ai.dy / d);
        st.lane.visible = true; st.lane.material.opacity = K.clamp(ai.t / 0.45, 0, 1) * (0.55 + 0.3 * blink(10));
        st.lane.rotation.set(0, -ang, 0); st.lane.scale.set(1.3, 1, 0.75); K.placeFlat(st.lane, x, z, y, 0.05);
      }
      if (cone && ai.st === 'punch' && ai.phase === 'recover' && ai.echo) {
        const ang = Math.atan2(ai.dx, -ai.dy);
        cone.visible = true; cone.rotation.set(0, -ang, 0); cone.material.opacity = 0.35 + 0.35 * blink(14);
        K.placeFlat(cone, x, z, y, 0.06);
      }
      if (cone && ai.st === 'punch' && (ai.phase === 'aim' || ai.phase === 'strike')) {
        const ang = Math.atan2(ai.dx, -ai.dy);
        cone.visible = true; cone.rotation.set(0, -ang, 0);
        cone.material.opacity = ai.phase === 'aim' ? K.clamp(ai.t / 0.25, 0, 1) * (0.55 + 0.35 * blink(12)) : Math.max(0, 0.9 - ai.t * 2.6);
        K.placeFlat(cone, x, z, y, 0.06);
      }
      if (ai.st === 'dazed' && Math.floor(time * 10) !== Math.floor((time - dt) * 10)) {
        const a = time * 5, hh = kind === 'titan' ? 6.6 : 4.2;
        st.spawn({ x: x + Math.cos(a) * 1.2, y: y + Math.sin(a) * 0.4, h: hh, col: 0, row: 3, life: 0.35, scale: 1 });
      }
      st.setGlow('king', null);
      return true;
    }
  }

  root.TMReyCombate = ReyCombate;
})(typeof window !== 'undefined' ? window : globalThis);
