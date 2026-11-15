/* Torre Multiversal · Rey Slime · Ritual de mundo (fase E, beta) · 15-11-2026
 *
 * Según docs/REY_SLIME_DISENO_CORAZON_DEL_ALBA.md §2–§4:
 *  - La Charca del Primer Reflejo: escondida tras raíces junto al agua del
 *    Valle del Alba, en un punto elegido a partir de la huella del mapa (lejos
 *    de portales, salidas y del santuario). Tres pistas sin tutorial: huellas
 *    de gelatina, tres piedras marcadas que se reflejan al revés y un brillo
 *    dorado invertido al examinar el reflejo. Responde al amanecer, o de noche
 *    con antorcha. Entrega la Corona del Rey una sola vez (reliquia única).
 *  - Piedras lisas en las orillas y gel de slime (de limos salvajes vencidos,
 *    con tope) para el Cuenco de Convergencia, que se fabrica en el santuario.
 *  - El Trono exige la corona colocada en el suelo del centro y el cuenco.
 * Solo partida individual. Nada de esto toca la economía verificada.
 */
(function (root) {
  'use strict';
  if (!root.document) return;
  const TAU = Math.PI * 2;
  const NODE_RESPAWN = 8 * 60 * 1000;

  // ── Arte (paleta oficial del juego) ──
  function art() {
    const A = root.TMReyArt, P = A.PAL, O = P.outline;
    const pond = () => {
      const w = 64, h = 36, px = new A.Px(w, h), cx = w / 2, cy = h / 2;
      const water = ['#0e1f33', '#14304d', '#1c4468', '#275c86', '#3b7aa6', '#7fb4d6'];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.hypot((x + 0.5 - cx) / (w / 2), (y + 0.5 - cy) / (h / 2));
        if (d > 1) continue;
        if (d > 0.86) { px.set(x, y, d > 0.95 ? '#2a1d12' : '#4a3520'); continue; } // orilla de barro
        const depth = 1 - d, band = Math.min(4, Math.floor(depth * 6 + ((x + y) % 2) * 0.5));
        px.set(x, y, water[band]);
      }
      // Reflejos: tres piedras con runas, al revés y en posiciones que no corresponden.
      [[16, 13], [30, 22], [44, 12]].forEach(([sx, sy], i) => {
        for (let j = 0; j < 5; j++) for (let k = 0; k < 7; k++) if (Math.abs(k - 3) + j * 0.6 < 4) px.set(sx + k - 3, sy + j, P.stone[3 + (j === 0 ? 1 : 0)], 255);
        px.set(sx, sy + 2, P.rune[2], 192); px.set(sx - 1 + i, sy + 3, P.rune[3], 192);
      });
      for (let i = 0; i < 9; i++) px.set(18 + i * 3, 8 + (i % 3), water[5]); // brillos
      return px.canvas();
    };
    const roots = (v) => {
      const w = 40, h = 30, px = new A.Px(w, h), C = ['#2a1a0e', '#43291a', '#5f3d24', '#7d5733'];
      for (let r = 0; r < 4; r++) {
        let x = 6 + r * 8 + v * 2, y = h - 2;
        for (let s = 0; s < 22; s++) {
          const t = s / 22, bx = Math.round(x + Math.sin(s * 0.7 + r + v) * 3 * t), by = Math.round(y - s);
          for (let k = -2; k <= 2; k++) if (Math.abs(k) <= 2 - t * 1.5) px.set(bx + k, by, C[Math.max(0, 3 - Math.abs(k) - (k > 0 ? 1 : 0))]);
          if (s % 5 === 2) px.set(bx + 2, by, P.grass[4]);
        }
      }
      for (let x = 0; x < w; x++) if (px.alpha(x, h - 1)) px.set(x, h - 1, O);
      return px.canvas();
    };
    const marked = (v) => {
      const w = 16, h = 14, px = new A.Px(w, h);
      for (let y = 2; y < h; y++) for (let x = 1; x < w - 1; x++) {
        const d = Math.hypot((x - 7.5) / 7, (y - 9) / 7); if (d > 1) continue;
        px.set(x, y, d > 0.85 ? O : P.stone[y < 6 ? 5 : y < 10 ? 4 : 3]);
      }
      const marks = [[[7, 6], [7, 7], [7, 8], [6, 9], [8, 9]], [[6, 6], [8, 6], [7, 7], [6, 8], [8, 8]], [[5, 7], [6, 6], [7, 7], [8, 6], [9, 7]]][v];
      marks.forEach(([x, y]) => px.set(x, y, P.rune[3], 192));
      return px.canvas();
    };
    const print = () => {
      const px = new A.Px(10, 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) if (Math.hypot((x - 4.5) / 4.5, (y - 4) / 3.4) < 1) px.set(x, y, (x + y) % 3 ? '#5fd0b8' : '#9ef0dc', 200);
      return px.canvas();
    };
    const smooth = () => {
      const px = new A.Px(12, 8);
      for (let y = 1; y < 8; y++) for (let x = 0; x < 12; x++) {
        const d = Math.hypot((x - 5.5) / 6, (y - 4.5) / 3.5); if (d > 1) continue;
        px.set(x, y, d > 0.82 ? O : y < 4 ? P.stone[7] : P.stone[6]);
      }
      px.set(4, 3, P.white); px.set(5, 3, P.white);
      return px.canvas();
    };
    const bowl = () => {
      const w = 28, h = 18, px = new A.Px(w, h);
      for (let y = 4; y < h; y++) for (let x = 1; x < w - 1; x++) {
        const d = Math.hypot((x - 13.5) / 13, (y - 6) / 11); if (d > 1 || y < 6) continue;
        px.set(x, y, d > 0.9 ? O : P.ruin[y < 10 ? 6 : 5]);
      }
      for (let x = 2; x < w - 2; x++) { px.set(x, 5, P.gold[5]); px.set(x, 6, P.gold[3]); } // borde dorado
      for (let x = 5; x < w - 5; x++) px.set(x, 7, x % 4 ? '#5fd0b8' : '#9ef0dc', 192); // gel convergente
      [8, 13, 19].forEach(x => px.set(x, 11, P.rune[3], 192));
      return px.canvas();
    };
    const glint = () => {
      const px = new A.Px(24, 10);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 24; x++) if (Math.hypot((x - 11.5) / 12, (y - 5) / 5) < 1 && (x + y * 2) % 3) px.set(x, y, y < 5 ? P.gold[6] : P.gold[5]);
      return px.canvas();
    };
    return { pond, roots, marked, print, smooth, bowl, glint };
  }

  class ReyRitual {
    constructor(ctl) {
      this.ctl = ctl; this.site = null; this.siteT = null; this.meshes = null; this.group = null;
      this.taken = new Map(); this.lookT = 0; this.emerge = null; this.lastNote = 0;
    }
    K() { return root.__TM_REY_KIT__; }
    API() { return this.K().API; }
    rite() {
      const s = this.ctl.state(); if (!s) return null;
      if (!s.rite || typeof s.rite !== 'object' || !('crownPlaced' in s.rite)) s.rite = this.API().normalizeRite(s.rite);
      return s.rite;
    }
    save() { this.ctl.persist(); }
    torch() {
      const g = this.ctl.app.data && this.ctl.app.data.profile && this.ctl.app.data.profile.gear;
      if (!g || !g.eq || !Array.isArray(g.items)) return false;
      const on = new Set(Object.values(g.eq).filter(v => v !== null));
      return g.items.some(it => it && it.i === 'antorcha' && on.has(it.u));
    }
    time() { const s = this.ctl.app.session; try { return s && s.timeState ? s.timeState() : null; } catch (_) { return null; } }

    // ── Lugar de la charca: determinista a partir de la huella del mapa ──
    locate() {
      const T = this.ctl.app.terrain;
      if (!T || T.id !== 'valle-alba') return null;
      if (this.siteT === T) return this.site;
      this.siteT = T; this.site = null;
      const lily = (T.props || []).find(p => p.type === 'lily');
      if (!lily) return null;
      const WATER = T.kind[T.idx(Math.floor(lily.x), Math.floor(lily.y))];
      let fp = 7; try { const f = T.fingerprint ? String(T.fingerprint()) : 'valle'; for (let i = 0; i < f.length; i++) fp = (fp * 31 + f.charCodeAt(i)) >>> 0; } catch (_) { /* opcional */ }
      const hash = (x, y) => { const v = Math.sin(x * 12.9898 + y * 78.233 + (fp % 1000) * 0.917) * 43758.5453; return v - Math.floor(v); };
      const isWater = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y); return T.inBounds(cx, cy) && T.kind[T.idx(cx, cy)] === WATER; };
      const ground = (x, y, z) => { const s = T.surfaceAt(x, y); return s === s && !isWater(x, y) && (z === undefined || Math.abs(s - z) < 0.01); };
      const free = (x, y, r) => !(T.obstacles || []).some(o => Math.hypot(o.x - x, o.y - y) < (o.r || 0.3) + r);
      const sp = (T.spawns && T.spawns[0]) || { x: T.w / 2, y: T.h / 2 }, comp = T.componentAt ? T.componentAt(sp.x, sp.y) : 0;
      const sc = this.ctl.findCenter();
      const away = (x, y) => Math.hypot(x - sp.x, y - sp.y) > 14 && (T.portals || []).every(p => Math.hypot(p.x - x, p.y - y) > 10) && (!sc || Math.hypot(sc.x - x, sc.y - y) > 16);
      const shore = (x, y, r0, r1) => { for (let a = 0; a < 12; a++) for (let r = r0; r <= r1; r += 0.5) if (isWater(x + Math.cos(a / 12 * TAU) * r, y + Math.sin(a / 12 * TAU) * r)) return true; return false; };
      const cands = [];
      for (let cy = 6; cy < T.h - 6; cy++) for (let cx = 6; cx < T.w - 6; cx++) {
        const x = cx + 0.5, y = cy + 0.5;
        if (isWater(x, y) || !shore(x, y, 2, 3)) continue;
        cands.push({ x, y, h: hash(cx, cy) });
      }
      cands.sort((a, b) => a.h - b.h);
      for (const c of cands) {
        const z = T.surfaceAt(c.x, c.y); if (z !== z || !away(c.x, c.y)) continue;
        if (T.componentAt && T.componentAt(c.x, c.y) !== comp) continue;
        let ok = free(c.x, c.y, 1.5);
        for (let a = 0; ok && a < 16; a++) ok = ground(c.x + Math.cos(a / 16 * TAU) * 1.4, c.y + Math.sin(a / 16 * TAU) * 1.4, z);
        if (!ok) continue;
        // Tres piedras marcadas alrededor, raíces delante (lado de la cámara) y un rastro de huellas.
        const stones = [];
        for (let a = 0; a < 24 && stones.length < 3; a++) {
          const ang = -Math.PI / 2 + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 0.42, sx = c.x + Math.cos(ang) * 2.1, sy = c.y + Math.sin(ang) * 2.1;
          if (ground(sx, sy, z) && free(sx, sy, 0.3) && stones.every(s => Math.hypot(s.x - sx, s.y - sy) > 1.4)) stones.push({ x: sx, y: sy, z, v: stones.length });
        }
        if (stones.length < 3) continue;
        const roots = [0.35, 0.5, 0.65].map((k, i) => ({ x: c.x + Math.cos(k * Math.PI) * 1.6, y: c.y + Math.sin(k * Math.PI) * 1.3, z, v: i })).filter(r => ground(r.x, r.y, z));
        let wx = 0, wy = 0; for (let a = 0; a < 16; a++) { const ax = Math.cos(a / 16 * TAU), ay = Math.sin(a / 16 * TAU); if (isWater(c.x + ax * 2.6, c.y + ay * 2.6)) { wx += ax; wy += ay; } }
        const d = Math.hypot(wx, wy) || 1, dx = -wx / d, dy = -wy / d, prints = [];
        for (let i = 0; i < 7; i++) {
          const r = 2.6 + i * 0.9, side = (i % 2 ? 0.25 : -0.25), px = c.x + dx * r - dy * side, py = c.y + dy * r + dx * side;
          if (!ground(px, py, z) || !free(px, py, 0.1)) break;
          prints.push({ x: px, y: py, z });
        }
        if (prints.length < 3) continue;
        this.site = { pond: { x: c.x, y: c.y, z }, stones, roots, prints, nodes: [] };
        break;
      }
      // Piedras lisas: orillas repartidas por el valle.
      if (this.site) {
        const nodes = [];
        for (const c of cands) {
          if (nodes.length >= 10) break;
          const z = T.surfaceAt(c.x, c.y); if (z !== z || !free(c.x, c.y, 0.4)) continue;
          if (T.componentAt && T.componentAt(c.x, c.y) !== comp) continue;
          if (Math.hypot(c.x - this.site.pond.x, c.y - this.site.pond.y) < 6 || nodes.some(n => Math.hypot(n.x - c.x, n.y - c.y) < 9)) continue;
          if (!shore(c.x, c.y, 1, 1.5)) continue;
          nodes.push({ x: c.x, y: c.y, z, key: Math.round(c.x * 10) + ':' + Math.round(c.y * 10) });
        }
        this.site.nodes = nodes;
      }
      return this.site;
    }

    near() {
      const site = this.locate(), av = this.ctl.app.session && this.ctl.app.session.avatar;
      return !!(site && av && this.ctl.soloSession() && Math.hypot(av.x - site.pond.x, av.y - site.pond.y) < 2.6);
    }
    interact() {
      const r = this.rite(), site = this.site; if (!r || !site) return;
      const API = this.API();
      if (r.crown) { this.ctl.notice('El agua ya no guarda nada. Solo tu reflejo.', 'gold', 3200); return; }
      if (r.clues !== API.CLUES.all) { this.ctl.notice('Solo ves tu reflejo en el agua quieta.', 'gold', 3200); return; }
      if (!API.reflectionLit(this.time(), this.torch())) {
        this.ctl.notice('Algo dorado se mueve al revés bajo el reflejo… pero no hay luz suficiente.', 'gold', 4200);
        this.lookT = 4; return;
      }
      // ¡Emerge la Corona del Rey! Se guarda ANTES de la animación (no se pierde ni se duplica).
      let fp = 'valle'; try { fp = String(this.ctl.app.terrain.fingerprint()).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'valle'; } catch (_) { /* opcional */ }
      r.crown = { id: 'corona-' + fp, at: Date.now() };
      this.save();
      this.emerge = { t: 0 };
      this.lookT = 5;
      if (this.ctl.audio) { this.ctl.audio.chime(0); setTimeout(() => this.ctl.audio && this.ctl.audio.crownLand(), 1100); }
    }
    /** Pista para los Fragmentos de Realidad del glitch. */
    hint(av) {
      const r = this.rite(), site = this.locate(); if (!r || r.crown || !site || !av) return '';
      const dx = site.pond.x - av.x, dy = site.pond.y - av.y, d = Math.hypot(dx, dy);
      const dirs = ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste'];
      const dir = dirs[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
      return `El Primer Reflejo duerme junto al agua, al ${dir}, a unos ${Math.round(d / 5) * 5} pasos.`;
    }

    // ── Paso lógico ──
    tick(dt) {
      const C = this.ctl, s = C.state(), sess = C.app.session, av = sess && sess.avatar;
      if (!s || !av || !C.soloSession() || !C.inValley()) return;
      const site = this.locate(); if (!site) return;
      const r = this.rite(), API = this.API();
      // Pistas: se reconocen al acercarse (sin mensajes).
      const before = r.clues;
      if (site.prints.some(p => Math.hypot(p.x - av.x, p.y - av.y) < 1.4)) r.clues |= API.CLUES.prints;
      site.stones.forEach((st, i) => { if (Math.hypot(st.x - av.x, st.y - av.y) < 1.3) r.clues |= [API.CLUES.stone1, API.CLUES.stone2, API.CLUES.stone3][i]; });
      if (r.clues !== before) {
        C.app.saves.markDirty();
        if (r.clues === API.CLUES.all && !r.crown) { this.lookT = 4; if (C.audio) C.audio.chime(3); }
      }
      // Piedras lisas.
      const t = Date.now();
      for (const n of site.nodes) {
        if ((this.taken.get(n.key) || 0) > t) continue;
        if (Math.hypot(n.x - av.x, n.y - av.y) < 0.9) {
          if (r.stone >= API.MAT_CAP) { if (t - this.lastNote > 4000) { this.lastNote = t; C.notice('Ya no te caben más piedras lisas.', 'gold', 2200); } continue; }
          r.stone++; this.taken.set(n.key, t + NODE_RESPAWN); C.app.saves.markDirty();
          C.notice(`+1 piedra lisa (${r.stone})`, 'good', 1800); if (C.audio) C.audio.place(1);
        }
      }
      // Los slimes salvajes se giran hacia la charca.
      if (this.lookT > 0) {
        this.lookT -= dt;
        for (const e of sess.world.entities) if (e.species === 'limo' && !e.dead && !e.reyMinion && !e.royal && !e.ally && Math.hypot(e.x - site.pond.x, e.y - site.pond.y) < 14) { e.facing = site.pond.x < e.x ? 6 : 2; e.moving = false; }
      }
    }
    /** Gel de slime: un limo salvaje vencido puede soltarlo (la mitad de las veces, con tope). */
    onKill(e) {
      if (!e || e.species !== 'limo' || e.reyMinion || e.royal || e.ally || !this.ctl.soloSession()) return;
      const r = this.rite(); if (!r || r.gel >= this.API().MAT_CAP || Math.random() >= 0.5) return;
      r.gel++; this.ctl.app.saves.markDirty();
      this.ctl.notice(`+1 gel de slime (${r.gel})`, 'good', 1800);
    }

    // ── Panel del Trono (dentro del ritual) ──
    renderPanel(box) {
      const r = this.rite(), API = this.API(), food = this.ctl.app.data.progress.food || {};
      if (!box || !r) return;
      const R = API.RECIPE, lunar = food.lunar | 0;
      const row = (name, have, need) => `<li class="${have >= need ? 'ok' : ''}"><span>${name}</span><b>${Math.min(have, 99)}/${need}</b></li>`;
      box.innerHTML = `
        <div class="tm-rey-h">TRONO DE LOS DIEZ ECOS</div>
        <div class="tm-rey-rite-row ${r.crownPlaced ? 'is-done' : ''}">
          <span>👑 Corona del Rey</span>
          ${r.crownPlaced ? '<em>En el centro</em>' : r.crown ? '<button type="button" id="tm-rey-place-crown">Colocar en el centro</button>' : '<em>Perdida… dicen que el agua la recuerda</em>'}
        </div>
        <div class="tm-rey-rite-row ${r.bowl ? 'is-done' : ''}">
          <span>🥣 Cuenco de Convergencia</span>
          ${r.bowl ? '<em>Instalado</em>' : '<button type="button" id="tm-rey-craft">Fabricar</button>'}
        </div>
        ${r.bowl ? '' : `<ul class="tm-rey-recipe">${row('Piedras lisas', r.stone, R.stone)}${row('Gel de slime', r.gel, R.gel)}${row('Hongos lunares', lunar, R.lunar)}</ul>`}`;
      const pc = box.querySelector('#tm-rey-place-crown');
      if (pc) pc.onclick = () => { const cur = this.rite(); if (!cur.crown) return; cur.crownPlaced = true; this.save(); if (this.ctl.audio) this.ctl.audio.crownLand(); this.ctl.refresh(true); };
      const cb = box.querySelector('#tm-rey-craft');
      if (cb) {
        const can = API.craftBowl(r, food).ok;
        cb.disabled = !can;
        cb.onclick = () => {
          const res = API.craftBowl(this.rite(), this.ctl.app.data.progress.food || {});
          if (!res.ok) { this.ctl.notice(res.why === 'faltan' ? `Faltan: ${res.miss.join(', ')}.` : 'El cuenco ya está instalado.', 'bad'); return; }
          const s = this.ctl.state(), f = this.ctl.app.data.progress.food || (this.ctl.app.data.progress.food = {});
          s.rite = res.rite; f.lunar = res.lunar; // una sola operación
          this.save(); if (this.ctl.audio) this.ctl.audio.forge();
          this.ctl.notice('Cuenco de Convergencia instalado en el Trono.', 'gold');
          this.ctl.refresh(true);
        };
      }
    }

    // ── Dibujo ──
    draw(dt, zAt) {
      const C = this.ctl, st = C.stage, K = this.K(), site = this.locate(), s = C.state();
      if (!site || !st.group || !s) return;
      if (this.group !== st.group) this.build();
      const M = this.meshes, r = this.rite(), time = K.now() / 1000;
      K.placeFlat(M.pond, site.pond.x, site.pond.z, site.pond.y, 0.02); M.pond.visible = true;
      M.roots.forEach((m, i) => { const p = site.roots[i]; m.visible = !!p; if (p) K.placeUp(m, p.x, p.z, p.y); });
      M.stones.forEach((m, i) => { const p = site.stones[i]; m.visible = true; K.placeUp(m, p.x, p.z, p.y); });
      M.prints.forEach((m, i) => { const p = site.prints[i]; m.visible = !!p && !r.crown; if (p) K.placeFlat(m, p.x, p.z, p.y, 0.025); });
      const tnow = Date.now();
      M.nodes.forEach((m, i) => { const n = site.nodes[i]; m.visible = !!n && (this.taken.get(n.key) || 0) <= tnow; if (n) K.placeUp(m, n.x, n.z, n.y); });
      // Brillo dorado invertido: con las pistas reconocidas y luz suficiente.
      const lit = !r.crown && r.clues === this.API().CLUES.all && this.API().reflectionLit(this.time(), this.torch());
      M.glint.visible = lit || !!this.emerge;
      if (M.glint.visible) { M.glint.material.opacity = 0.5 + 0.4 * Math.sin(time * 4); K.placeFlat(M.glint, site.pond.x + Math.sin(time) * 0.3, site.pond.z, site.pond.y + 0.15, 0.03); }
      // Corona que emerge y vuela hacia el jugador.
      if (this.emerge) {
        const e = this.emerge; e.t += dt;
        const av = C.app.session && C.app.session.avatar;
        const u1 = Math.min(1, e.t / 1.2), u2 = Math.max(0, Math.min(1, (e.t - 1.4) / 0.7));
        const x = av ? K.lerp(site.pond.x, av.x, u2) : site.pond.x, y = av ? K.lerp(site.pond.y, av.y, u2) : site.pond.y;
        const h = K.ease(u1) * 1.6 + Math.sin(u2 * Math.PI) * 1.2;
        M.relic.visible = e.t < 2.1; K.placeUp(M.relic, x, zAt(x, y) + h, y);
        if (Math.random() < 0.4) st.spawn({ x, y, h: h + 0.4, vh: 0.6, g: 0, life: 0.5, col: 2, row: 3, scale: 0.9 });
        if (e.t >= 2.1) {
          this.emerge = null;
          if (C.ui) C.ui.showBanner('<small>RELIQUIA ÚNICA</small><b>Corona del Rey</b><em>Colócala en el centro del Trono de los Diez Ecos</em>', 4200);
        }
      } else M.relic.visible = false;
      // Trono: corona en el suelo del centro y cuenco instalado (solo mientras se reúnen los slimes).
      const c = C.center, show = s.stage === 'collect' && !C.cine;
      M.bowl.visible = !!(c && r.bowl && show); if (M.bowl.visible) K.placeUp(M.bowl, c.x, c.z, c.y + 0.35);
      M.throneCrown.visible = !!(c && r.crownPlaced && show);
      if (M.throneCrown.visible) K.placeUp(M.throneCrown, c.x, c.z + 0.05 + Math.sin(time * 2) * 0.04, c.y + 0.4);
    }
    build() {
      const C = this.ctl, st = C.stage, K = this.K(), A = root.TMReyArt, ART = art();
      this.group = st.group;
      const up = (canvas, w, h, off = 1) => st.mesh(st.geo(K.geoUp(w, h, off)), st.mat(st.tex(canvas)));
      const flat = (canvas, w, h, op = 1, add = false) => { const m = st.mesh(st.geo(K.geoFlat(w, h)), K.decalMat(st.tex(canvas, true), op, add), 1); st.mats.push(m.material); return m; };
      const site = this.site;
      const pond = flat(ART.pond(), 64, 36, 1);
      const roots = (site.roots || []).map((_, i) => up(ART.roots(i), 40, 30));
      const stones = [0, 1, 2].map(i => up(ART.marked(i), 16, 14));
      const printC = ART.print(), prints = site.prints.map(() => flat(printC, 10, 8, 0.75));
      const smoothC = ART.smooth(), nodes = site.nodes.map(() => up(smoothC, 12, 8));
      const glint = flat(ART.glint(), 24, 10, 0.8, true);
      const relicSheet = A.crownSheet({ hue: 'verde', mix: [4, 3, 3] });
      const crownMat = (sheet) => { const m = st.mat(st.tex(sheet.canvas), false); K.setFrame(m, 0, 0, 4, 1, false); return m; };
      const relic = st.mesh(st.crownGeo, crownMat(relicSheet), 4);
      const throneCrown = st.mesh(st.crownGeo, crownMat(relicSheet), 3);
      const bowl = up(ART.bowl(), 28, 18, 2);
      this.meshes = { pond, roots, stones, prints, nodes, glint, relic, throneCrown, bowl };
      for (const k of Object.keys(this.meshes)) { const v = this.meshes[k]; (Array.isArray(v) ? v : [v]).forEach(m => { m.visible = false; }); }
    }
  }

  root.TMReyRitual = ReyRitual;
})(typeof window !== 'undefined' ? window : globalThis);
