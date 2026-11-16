/* Torre Multiversal · Rey Slime · arte de las Formas II y III (v2 · 14-11-2026)
 *
 * Fase A: arte para aprobación. NO se usa todavía en el juego.
 * Referencias del director: «Forma II — Bestia gelatinosa», «Forma III — Rey
 * humanoide» y «Escala de las tres formas» (concepto final).
 *
 * Técnica: «esculpido» pixelado. Cada forma es un esqueleto de volúmenes
 * (elipsoides, cápsulas, púas y tela). Por píxel se toma el volumen más
 * cercano, su normal y su material:
 *  - Gelatina: rampa de 8 tonos, luz de borde (translucidez), brillo
 *    especular en cada bulto, burbujas de colores en el interior.
 *  - Capa, oro, armiño y boca con sus propias rampas.
 * Cada pose se REDIBUJA píxel a píxel (no se estira la imagen).
 */
(function (root) {
  'use strict';
  const A = root.TMReyArt;
  const PAL = A.PAL;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const norm = v => { const n = Math.hypot(...v) || 1; return v.map(c => c / n); };
  const LIGHT = norm([-0.55, -0.7, 0.55]);
  const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
  const hash = (a, b) => { let h = (a * 73856093 ^ b * 19349663) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

  // ── Rampas de material (oscuro → claro) ────────────────────────────────
  const GEL = Object.freeze({
    azul: ['#090d33', '#121b66', '#1a30a3', '#224ed1', '#3270ea', '#4b98f7', '#7cc8ff', '#d2f2ff'],
    verde: ['#05230f', '#0c4a1d', '#14722b', '#1f9b38', '#36c247', '#62de66', '#a2f58c', '#e4ffd2'],
    rosa: ['#2b0525', '#580e48', '#8a186c', '#bd268e', '#e246ac', '#ff76c8', '#ffaedf', '#ffe4f4']
  });
  const BUBBLE = Object.freeze({
    violeta: ['#1c0a42', '#4a229e', '#7a4ce0', '#b48cff', '#f1e8ff'],
    verde: ['#0a3a18', '#1d8838', '#4dcd58', '#9af58a', '#eeffe2'],
    rosa: ['#46093a', '#9e1e78', '#e04aa8', '#ff96d2', '#fff0f8'],
    azul: ['#08295e', '#1866c8', '#3cb0ff', '#9fe3ff', '#f0fbff']
  });
  const CAPE = Object.freeze(['#11051a', '#250a2e', '#3d1140', '#5a194d', '#7a2357', '#9e3260']);
  const ERMINE = Object.freeze(['#57536e', '#a09cb8', '#d9d6e8', '#f2f0fa', '#ffffff']);
  const MOUTH = Object.freeze(['#16051f', '#330b45', '#5c1a7a', '#8b39b0', '#d462a8']);
  const TOOTH = Object.freeze(['#5d7e9e', '#a9cde6', '#e6f6ff', '#ffffff']);
  const GOLD = PAL.gold;
  const RUBY = PAL.ruby;
  const OUT = PAL.outline;

  // ── Volúmenes ──────────────────────────────────────────────────────────
  function sEll(p, x, y) {
    const dx = (x - p.x) / p.rx, dy = (y - p.y) / p.ry, q = dx * dx + dy * dy;
    if (q > 1) return null;
    const nz = Math.sqrt(1 - q), d = p.d || Math.min(p.rx, p.ry);
    return { h: (p.z || 0) + nz * d, n: norm([dx / p.rx, dy / p.ry, nz / d]), q };
  }
  function sCap(p, x, y) {
    const vx = p.x2 - p.x1, vy = p.y2 - p.y1, len2 = vx * vx + vy * vy || 1;
    const t = clamp(((x - p.x1) * vx + (y - p.y1) * vy) / len2, 0, 1);
    const cx = p.x1 + vx * t, cy = p.y1 + vy * t, r = lerp(p.r1, p.r2 === undefined ? p.r1 : p.r2, t);
    const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
    if (dist > r) return null;
    const nz = Math.sqrt(1 - (dist / r) ** 2);
    return { h: (p.z || 0) + nz * r * (p.d || 1), n: norm([dx / r, dy / r, nz]), q: (dist / r) ** 2 };
  }
  function sSpike(p, x, y) {
    const vx = p.tx - p.bx, vy = p.ty - p.by, len = Math.hypot(vx, vy) || 1, ux = vx / len, uy = vy / len;
    const u = ((x - p.bx) * ux + (y - p.by) * uy) / len;
    if (u < -0.15 || u > 1) return null;
    const v = (x - p.bx) * -uy + (y - p.by) * ux, w = p.w * (1 - Math.max(0, u)) ** 0.85;
    if (Math.abs(v) > w) return null;
    const side = v / (w || 1);
    // Normal de un cono: hacia el lado y un poco hacia la cámara.
    return { h: (p.z || 0) + (1 - Math.abs(side)) * p.w, n: norm([-uy * side, ux * side, 0.75 + (1 - Math.abs(side)) * 0.6]), q: side * side };
  }
  function inPoly(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function sPoly(p, x, y) {
    if (!inPoly(p.pts, x, y)) return null;
    const t = clamp((y - p.top) / (p.bottom - p.top), 0, 1);
    const ph = (x - p.cx) * (0.38 - t * 0.16) + (p.sway || 0);
    const slope = Math.cos(ph) * (0.25 + t * 0.6);
    return { h: (p.z || 0) + Math.sin(ph) * 1.5, n: norm([slope, -0.1, 1]), q: 0 };
  }
  const SAMPLE = { ell: sEll, cap: sCap, spike: sSpike, poly: sPoly };
  function heightAt(parts, x, y) {
    let h = -1e9;
    for (const p of parts) { const s = SAMPLE[p.k](p, x, y); if (s && s.h > h) h = s.h; }
    return h;
  }
  // Bulto de gelatina que sobresale apenas de la superficie (aspecto «burbujeante»).
  function lump(P, x, y, rx, ry, extra = {}) {
    const d = Math.min(rx, ry) * 0.75, h = heightAt(P, x, y);
    if (h < -1e8) return;
    P.push({ k: 'ell', x, y, rx, ry, d, z: h - d * 0.55, ...extra });
  }

  // Escala de todo el esqueleto alrededor de un ancla (pies en el suelo).
  // Escala oficial del juego (hoja del director): II ≈ 2× y III ≈ 3,8× el
  // alto del jugador → SCALE.beast y SCALE.titan.
  const SCALE = Object.freeze({ beast: 0.6, titan: 0.75 });
  function scaleParts(P, S, ax, ay) {
    if (S === 1) return;
    const X = v => ax + (v - ax) * S, Y = v => ay + (v - ay) * S;
    for (const p of P) {
      for (const k of ['x', 'x1', 'x2', 'bx', 'tx', 'cx']) if (typeof p[k] === 'number') p[k] = X(p[k]);
      for (const k of ['y', 'y1', 'y2', 'by', 'ty', 'top', 'bottom']) if (typeof p[k] === 'number') p[k] = Y(p[k]);
      for (const k of ['rx', 'ry', 'r1', 'r2', 'w', 'd', 'z']) if (typeof p[k] === 'number') p[k] *= S;
      if (p.pts) p.pts = p.pts.map(([x, y]) => [X(x), Y(y)]);
    }
  }

  // ── Material de gelatina ───────────────────────────────────────────────
  function gelRamp(look, x, y, body) {
    if (look.hybrid) {
      const t = (x + 0.5 - body.x) / body.rx + Math.sin(y * 0.3) * 0.12 + (bayer(x, y) - 0.5) * 0.18;
      return GEL[t < 0 ? look.hybrid[0] : look.hybrid[1]];
    }
    return GEL[look.hue] || GEL.azul;
  }
  function veinAt(look, x, y) {
    for (let i = 0; i < look.veins.length; i++) {
      const v = look.veins[i], t = x * 0.6 + y * 0.9 + Math.sin(x * 0.22) * 2.4;
      const period = 19 - Math.min(9, v.n), band = Math.floor(t / 2.3 + i * 4.1) % period;
      if (band === 0 || (band === 1 && bayer(x, y) < 0.4)) return GEL[v.hue];
    }
    return null;
  }

  // ── Esculpir ───────────────────────────────────────────────────────────
  function sculpt(px, ox, oy, W, H, parts, look, opt = {}) {
    const N = W * H, hb = new Float32Array(N).fill(-1e9), id = new Int16Array(N).fill(-1);
    const nb = new Float32Array(N * 3), qb = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let k = 0; k < parts.length; k++) {
        const p = parts[k]; if (p.hidden) continue;
        const s = SAMPLE[p.k](p, x + 0.5, y + 0.5);
        if (s && s.h > hb[i]) { hb[i] = s.h; id[i] = k; nb[i * 3] = s.n[0]; nb[i * 3 + 1] = s.n[1]; nb[i * 3 + 2] = s.n[2]; qb[i] = s.q; }
      }
    }
    const body = opt.body || { x: W / 2, y: H / 2, rx: W / 3, ry: H / 3 };
    const mat = k => (k < 0 ? null : parts[k].m || 'gel');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = id[i]; if (k < 0) continue;
      const p = parts[k], m = mat(k), n = [nb[i * 3], nb[i * 3 + 1], nb[i * 3 + 2]];
      const diff = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
      const spec = Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]);
      const dz = bayer(x, y) - 0.5;
      let col;
      if (m === 'gel' || m === 'spine') {
        const ramp = veinAt(look, x, y) || gelRamp(look, x, y, body);
        const fres = 1 - n[2];                                   // borde: la luz atraviesa la gelatina
        const low = clamp((y - body.y) / (body.ry * 2.2), 0, 0.5);
        let v = 0.5 + diff * 0.36 + fres * fres * 0.42 - low * 0.22 + (p.shade || 0) * 0.2 + (m === 'spine' ? 0.1 : 0);
        let idx = clamp(Math.floor(v * 6.3 + dz * 0.8), 1, 6);
        const s = Math.pow(spec, p.k === 'spike' ? 18 : 34);
        if (s > 0.72) idx = 7; else if (s > 0.42 && bayer(x, y) < (s - 0.42) * 3) idx = 7;
        else if (s > 0.25 && idx < 6) idx++;
        col = ramp[idx];
      } else if (m === 'cape') {
        col = CAPE[clamp(Math.floor((0.42 + diff * 0.45 + (p.shade || 0) * 0.2) * 5.4 + dz * 0.8), 0, 5)];
      } else if (m === 'gold') {
        const s = Math.pow(spec, 20);
        col = s > 0.6 ? GOLD[6] : GOLD[clamp(Math.floor((0.4 + diff * 0.5) * 5.6 + dz * 0.6), 1, 5)];
      } else if (m === 'ruby') {
        col = RUBY[clamp(Math.floor((0.45 + diff * 0.5) * 3.6), 0, 3)];
      } else if (m === 'ermine') {
        col = ERMINE[clamp(Math.floor((0.5 + diff * 0.5) * 4.4 + dz * 0.7), 0, 4)];
        // Colitas negras del armiño, en hileras escalonadas.
        const row = Math.floor((y + oy) / 5), cx = (x + ox + (row & 1) * 4) % 8;
        if (cx === 0 && (y + oy) % 5 === 2 && diff > -0.2) { col = OUT; }
        else if (cx === 0 && (y + oy) % 5 === 3 && diff > -0.2) { col = ERMINE[1]; }
      } else if (m === 'mouth') {
        col = MOUTH[clamp(Math.floor((0.35 + diff * 0.5) * 4), 0, 3)];
      } else if (m === 'tongue') {
        col = diff > 0.2 ? MOUTH[4] : MOUTH[3];
      } else if (m === 'tooth') {
        col = TOOTH[clamp(Math.floor((0.5 + diff * 0.6) * 4), 0, 3)];
      } else col = '#ff00ff';
      px.set(ox + x, oy + y, col);
    }
    // Pliegues suaves entre bultos (más oscuro donde un volumen pasa bajo otro).
    const crease = opt.crease === undefined ? 2.2 : opt.crease;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = id[i]; if (k < 0) continue;
      if (parts[k].noCrease) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx, k2 = id[j]; if (k2 < 0 || k2 === k || parts[k2].noCrease) continue;
        if (hb[i] < hb[j] - crease) {
          const m = mat(k);
          px.set(ox + x, oy + y, m === 'cape' ? CAPE[0] : m === 'gold' ? GOLD[1] : m === 'ermine' ? ERMINE[0] :
            m === 'mouth' || m === 'tongue' ? MOUTH[0] : m === 'tooth' ? TOOTH[0] : (veinAt(look, x, y) || gelRamp(look, x, y, body))[2]);
          break;
        }
      }
    }
    // Ribete dorado de la capa: borde exterior de la tela.
    if (opt.trim) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (mat(id[i]) !== 'cape') continue;
      let edge = 9;
      for (let r = 1; r <= 2 && edge > 2; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || id[yy * W + xx] < 0) { edge = Math.min(edge, r); }
      }
      if (edge <= 2) px.set(ox + x, oy + y, edge === 1 ? GOLD[3] : (bayer(x, y) < 0.5 ? GOLD[5] : GOLD[4]));
    }
    const ramp0 = GEL[look.hybrid ? look.hybrid[0] : look.hue] || GEL.azul;
    px.outline(ox, oy, W, H, side => (side === 'up' ? ramp0[1] : side === 'side' ? ramp0[0] : OUT));
    return { hb, id, W, H, parts };
  }

  // ── Burbujas de colores dentro de la gelatina ──────────────────────────
  // Una por cada limo fusionado (su color) + «esencia» violeta del ritual.
  function bubbles(px, ox, oy, sc, look, frags, count, seed = 1, t = 0, avoid = [], rs = 1) {
    const { id, W, H, parts } = sc;
    const isGel = (x, y) => x >= 0 && y >= 0 && x < W && y < H && id[y * W + x] >= 0 && (parts[id[y * W + x]].m || 'gel') === 'gel';
    const kinds = [];
    frags.slice(0, 10).forEach(h => kinds.push(h));
    for (let i = 0; i < count; i++) if (i % 3 === 2 || i >= kinds.length) kinds.splice(i, 0, 'violeta');
    const placed = [];
    let tries = 0;
    for (let n = 0; n < count && tries < count * 60; tries++) {
      const r = Math.max(1.4, [2, 2.6, 3.4, 4.2, 5.2][Math.floor(hash(tries * 7 + seed, 3) * 5)] * rs);
      const x = Math.floor(hash(tries + seed * 31, 11) * W), y = Math.floor(hash(tries + seed * 17, 29) * H) + Math.round(Math.sin(t * 6.28 + tries) * 1);
      const R = Math.ceil(r) + 1;
      if (!isGel(x, y) || !isGel(x - R, y) || !isGel(x + R, y) || !isGel(x, y - R) || !isGel(x, y + R)) continue;
      if (placed.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + 2)) continue;
      if (avoid.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r)) continue;
      placed.push({ x, y, r });
      const B = BUBBLE[kinds[n % kinds.length]] || BUBBLE.violeta;
      for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
        const d = Math.hypot(xx + 0.5 - 0.5, yy + 0.5 - 0.5) / r;
        if (d > 1) continue;
        const lv = -(xx + yy) / (r * 1.4);
        let c;
        if (d > 0.78) { if (bayer(x + xx, y + yy) < 0.5) continue; c = B[1]; }      // borde translúcido
        else c = lv > 0.35 ? B[3] : lv > -0.25 ? B[2] : B[1];
        px.set(ox + x + xx, oy + y + yy, c);
      }
      const hx = Math.round(x - r * 0.4), hy = Math.round(y - r * 0.4);
      px.set(ox + hx, oy + hy, B[4], 192);
      if (r > 3) px.set(ox + hx + 1, oy + hy, B[4], 192);
      n++;
    }
    return placed;
  }

  // ── Charco de gelatina bajo los pies ───────────────────────────────────
  function puddle(px, ox, oy, cx, cy, rx, ry, look) {
    const ramp = GEL[look.hybrid ? look.hybrid[0] : look.hue] || GEL.azul;
    const cells = [];
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, w = Math.sin(nx * 9) * 0.06;
      if (nx * nx + ny * ny > 1 + w) continue;
      if (px.alpha(ox + x, oy + y)) continue;
      cells.push([x, y, nx, ny]);
    }
    for (const [x, y, nx, ny] of cells) {
      let c = ny < -0.3 ? ramp[4] : ny < 0.25 ? ramp[3] : ramp[2];
      if (ny < -0.1 && ny > -0.6 && Math.abs(Math.sin(nx * 7.5)) > 0.86) c = ramp[6];
      if (Math.abs(nx) > 0.82) c = ramp[2];
      px.set(ox + x, oy + y, c, 255);
    }
    for (const [x, y] of cells) for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0]]) {
      if (!px.alpha(ox + x + dx, oy + y + dy)) px.set(ox + x + dx, oy + y + dy, ramp[1]);
    }
    // Gotitas sueltas.
    for (let i = 0; i < 5; i++) {
      const x = Math.round(cx + (hash(i, 7) - 0.5) * rx * 2.4), y = Math.round(cy + (hash(i, 9) - 0.2) * ry * 1.6);
      if (px.alpha(ox + x, oy + y)) continue;
      px.set(ox + x, oy + y, ramp[5]); px.set(ox + x + 1, oy + y, ramp[3]); px.set(ox + x, oy + y + 1, ramp[2]);
    }
  }

  // ── Corona (la del Rey clásico, con rubí) ──────────────────────────────
  function stampCrown(px, spec, cx, cy, ang, scale = 1) {
    const c = A.crownSheet(spec).canvas, img = c.getContext('2d').getImageData(0, 0, 32, 32);
    const cp = new A.Px(32, 32); cp.d.set(img.data);
    if (scale === 1) { px.blitRot(cp, 0, 0, 32, 32, cx, cy, ang); return; }
    const s = new A.Px(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const sx = Math.round(16 + (x - 16) / scale), sy = Math.round(16 + (y - 16) / scale);
      if (sx < 0 || sy < 0 || sx >= 32 || sy >= 32) continue;
      const j = (sy * 32 + sx) * 4; if (!cp.d[j + 3]) continue;
      s.set(x, y, [cp.d[j], cp.d[j + 1], cp.d[j + 2]], cp.d[j + 3]);
    }
    px.blitRot(s, 0, 0, 32, 32, cx, cy, ang);
  }
  function glowEye(px, x, y, w, slant, pupil) {
    // Ojo incandescente: blanco con halo cian, rasgado (slant > 0 = ceño).
    for (let i = -1; i <= w; i++) { px.set(x + i, y - 1 + (slant ? Math.round((i + 1) * slant / (w + 1)) : 0), OUT); px.set(x + i, y + 2, OUT); }
    px.set(x - 1, y, OUT); px.set(x - 1, y + 1, OUT); px.set(x + w, y, OUT); px.set(x + w, y + 1, OUT);
    for (let i = 0; i < w; i++) for (let j = 0; j < 2; j++) {
      if (slant && j === 0 && i < Math.round(i * 0 + slant * (i + 1) / (w + 1))) continue;
      px.set(x + i, y + j, j === 0 ? '#ffffff' : '#b8f6ff', 192);
    }
    if (pupil) { px.set(x + pupil, y + 1, '#0b1a3a'); px.set(x + pupil, y, '#2a4a8a'); }
  }

  // ════════════════════════════════════════════════════════════════════
  // FORMA II · BESTIA GELATINOSA (perfil, mira a la derecha) · 160×100
  // ════════════════════════════════════════════════════════════════════
  const BEAST = Object.freeze({ W: 176, H: 112, G: 108, DX: 14, DY: 12 });
  function beastParts(o = {}) {
    const m = o.morph === undefined ? 1 : o.morph;
    const cr = (o.crouch || 0) * 6, lift = o.lift || 0, st = o.stretch || 0, inf = o.inflate || 0, br = o.breath || 0;
    const G = BEAST.G - BEAST.DY, P = [], g = 0.45 + m * 0.55;
    const by = 56 + cr - lift;
    // ── Cola: sube por detrás y termina en una maza de púas ──
    const curl = o.tailCurl || 0;
    const ctrl = [[30, by - 4], [14, by - 2], [6, by - 16], [9, by - 32 + curl * 4], [20 + curl * 6, by - 40 + curl * 2]];
    const pt = t => {
      const s = t * (ctrl.length - 1), i = Math.min(ctrl.length - 2, Math.floor(s)), u = s - i;
      const a = ctrl[Math.max(0, i - 1)], b = ctrl[i], c = ctrl[i + 1], d = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const f = (p0, p1, p2, p3) => 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
      return [f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])];
    };
    if (m > 0.15) {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) * m, [x, y] = pt(t);
        P.push({ k: 'ell', x: lerp(40, x, m), y: lerp(by - 4, y, m), rx: lerp(9, 4.6, t) * g, ry: lerp(8.5, 4.4, t) * g, z: -4 - t * 3, shade: -0.25 * t });
      }
      if (m > 0.6) {
        const [bx, byy] = pt(1), R = 7.5 * m;
        P.push({ k: 'ell', x: bx, y: byy, rx: R, ry: R, z: 6, d: R });
        for (let a = 0; a < 8; a++) {
          const ang = a / 8 * Math.PI * 2 + 0.2, l = 6.5 * m;
          P.push({ k: 'spike', bx: bx + Math.cos(ang) * R * 0.7, by: byy + Math.sin(ang) * R * 0.7, tx: bx + Math.cos(ang) * (R + l), ty: byy + Math.sin(ang) * (R + l), w: 2.8, z: 8 + (Math.sin(ang) < 0 ? 1 : -2), m: 'spine' });
        }
      }
    }
    // ── Patas lejanas ──
    const paw = (x, y, z, s, far) => {
      P.push({ k: 'ell', x, y: y - 1, rx: 7.5 * g, ry: 4.6 * g, z, shade: s });
      if (m > 0.5) [3.5, 0, -3.5].forEach((dx, i) => P.push({ k: 'ell', x: x + 4 + dx, y: y + 0.5, rx: 2.8, ry: 2.6, z: z + 2 + i * 0.1, shade: s, d: 2.6 }));
    };
    const legFront = (dx, far) => {
      const s = far ? -0.55 : 0, z = far ? -8 : 8, fx = 96 + dx + st * 12, fy = lerp(by + 10, G - 2 - lift * 0.5, m);
      P.push({ k: 'ell', x: 90 + dx, y: by + 2, rx: 10 * g, ry: 12 * g, z: z - 1, shade: s });
      P.push({ k: 'cap', x1: 92 + dx, y1: by + 6, x2: fx - 2, y2: fy - 5, r1: 8 * g, r2: 6.4 * g, z, shade: s });
      paw(fx, fy, z + 1, s, far);
    };
    const legHind = (dx, far) => {
      const s = far ? -0.55 : 0, z = far ? -8 : 7, fx = 38 + dx - st * 12, fy = lerp(by + 10, G - 2 - lift * 0.5, m);
      P.push({ k: 'ell', x: 44 + dx, y: by + 3, rx: 12 * g, ry: 14 * g, z: z - 1, shade: s, d: 12 });
      P.push({ k: 'cap', x1: 42 + dx, y1: by + 12, x2: 34 + dx - st * 6, y2: by + 20 + cr * 0.4, r1: 7.5 * g, r2: 6 * g, z, shade: s });
      P.push({ k: 'cap', x1: 34 + dx - st * 6, y1: by + 20 + cr * 0.4, x2: fx - 2, y2: fy - 4, r1: 6 * g, r2: 5.6 * g, z: z + 0.5, shade: s });
      paw(fx, fy, z + 1, s, far);
    };
    legFront(8, true); legHind(10, true);
    // ── Cuerpo: cadera, vientre y pecho alto ──
    P.push({ k: 'ell', x: 42 - st * 6, y: by - 2, rx: 17 * g, ry: (16 + inf * 3) * g, z: 0, d: 15 });
    P.push({ k: 'ell', x: 66, y: by - br, rx: (25 + st * 6 + inf * 6) * (0.8 + m * 0.2), ry: (15 + inf * 6) * (1 + (1 - m) * 0.5) + br, z: 2, d: 17 });
    P.push({ k: 'ell', x: 90 + st * 6, y: by - 6, rx: (21 + inf * 3) * g, ry: (19 + inf * 3) * g, z: 4, d: 17 });
    legFront(0, false); legHind(0, false);
    // ── Cuello y cabeza con fauces abiertas ──
    const hx = lerp(78, 118 + st * 10, m) + (o.headX || 0), hy = by - 24 + (o.headY || 0) + cr * 0.5;
    const jaw = Math.max(0.3, o.jaw === undefined ? 0.55 : o.jaw);
    P.push({ k: 'cap', x1: 98 + st * 5, y1: by - 12, x2: hx - 5, y2: hy + 5, r1: 12 * g, r2: 10 * g, z: 6 });
    P.push({ k: 'ell', x: hx, y: hy, rx: 14 * g, ry: 12.5 * g, z: 10, d: 13 });
    if (m > 0.4) {
      const k = m;
      P.push({ k: 'ell', x: hx + 5, y: hy - 7, rx: 8 * k, ry: 3.6 * k, z: 15, d: 4 });                       // ceja
      P.push({ k: 'ell', x: hx - 3, y: hy + 6, rx: 6.5 * k, ry: 5.5 * k, z: 13, d: 5 });                     // mejilla
      P.push({ k: 'ell', x: hx + 15 * k, y: hy + 1, rx: 11 * k, ry: 6.4 * k, z: 13, d: 8 });                 // hocico
      P.push({ k: 'ell', x: hx + 12 * k, y: hy + 7 + jaw * 3, rx: 11 * k, ry: (2.5 + jaw * 4.5) * k, z: 12, m: 'mouth', noCrease: true });
      P.push({ k: 'ell', x: hx + 9 * k, y: hy + 9 + jaw * 5, rx: 6 * k, ry: 2.2, z: 12.5, m: 'tongue', noCrease: true });
      P.push({ k: 'ell', x: hx + 11 * k, y: hy + 12 + jaw * 7, rx: 10.5 * k, ry: 4.2 * k, z: 11, d: 5 });   // mandíbula
    }
    // ── Cresta de púas del cuello a la cadera ──
    const sp = 1 + (o.spines || 0) * 1.1;
    const crest = [[hx - 7, hy - 10, 8], [hx - 16, hy - 4, 10], [96, by - 24, 12], [84, by - 25, 13], [72, by - 21, 13], [60, by - 18, 12], [49, by - 18, 11], [38, by - 17, 9]];
    crest.forEach(([x, y, h], i) => {
      const hh = h * m * sp; if (hh < 2) return;
      P.push({ k: 'spike', bx: x, by: y + 3, tx: x - 3 - hh * 0.3, ty: y - hh, w: 4 + h * 0.1, z: 14 - i * 0.4, m: 'spine' });
    });
    if ((o.spines || 0) > 0.4) {
      [[52, by + 8, -0.7], [66, by + 10, -0.3], [80, by + 8, 0.3], [94, by + 6, 0.7]].forEach(([x, y, a]) => {
        const l = 11 * o.spines;
        P.push({ k: 'spike', bx: x, by: y, tx: x + Math.sin(a) * l * 0.6, ty: y + l * 0.55, w: 3, z: 18, m: 'spine' });
      });
    }
    // ── Bultos de gelatina en la superficie ──
    if (m > 0.3) [[56, by - 9, 7, 5], [70, by - 8, 7, 5], [84, by - 13, 6.5, 5], [46, by - 8, 6, 5], [64, by + 7, 6, 4], [92, by + 2, 6, 5], [104, by - 14, 5, 4]]
      .forEach(([x, y, rx, ry]) => lump(P, x, y, rx * g * 1.2, ry * g * 1.2));
    const S = o.scale || 1, ax = 70, X = v => ax + (v - ax) * S, Y = v => G + (v - G) * S;
    scaleParts(P, S, ax, G);
    const DX = BEAST.DX, DY = BEAST.DY;
    for (const p of P) {
      for (const k of ['x', 'x1', 'x2', 'bx', 'tx']) if (typeof p[k] === 'number') p[k] += DX;
      for (const k of ['y', 'y1', 'y2', 'by', 'ty']) if (typeof p[k] === 'number') p[k] += DY;
    }
    return { parts: P, S, head: { x: X(hx) + DX, y: Y(hy) + DY }, jaw, body: { x: X(66) + DX, y: Y(by) + DY, rx: 40 * S, ry: 20 * S }, m, by: Y(by) + DY };
  }
  function drawBeast(px, ox, oy, spec, o = {}) {
    const look = A.lookOf(spec.mix, spec.hue), r = beastParts(o);
    const sc = sculpt(px, ox, oy, BEAST.W, BEAST.H, r.parts, look, { body: r.body });
    const S = r.S;
    bubbles(px, ox, oy, sc, look, A.fragsOf(spec), Math.round((9 + r.m * 7) * (0.4 + S * 0.6)), 3, o.t || 0, [{ x: r.head.x + 8 * S, y: r.head.y + 4 * S, r: 18 * S }], Math.max(0.6, S));
    if (r.m > 0.4) {
      const hx = Math.round(ox + r.head.x), hy = Math.round(oy + r.head.y), k = r.m * S, jw = r.jaw;
      // Ojo feroz incandescente (rasgado hacia el hocico) con halo cian.
      const EYE = S < 0.85 ? ['##...', '.###.', '#www#', '.####'] : ['##.....', '.####..', '.#wwww#', '.#wwwww#', '..#####'];
      const ex = hx + Math.round(1 * S), ey = hy - Math.round(7 * S);
      EYE.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') px.set(ex + i, ey + j, ch === '#' ? OUT : '#ffffff', ch === 'w' ? 192 : 255); }));
      [[-1, 3], [EYE[0].length + 1, 3], [3, -2]].forEach(([dx, dy]) => { if (px.alpha(ex + dx, ey + dy)) px.set(ex + dx, ey + dy, '#7ff0ff', 192); });
      // Colmillos: tres arriba y dos abajo, blancos con contorno.
      const fang = (x, y, len, dir) => {
        for (let j = 0; j < len; j++) {
          const w = j < len - 2 ? 1 : 0;
          for (let i = -w; i <= w; i++) px.set(x + i, y + j * dir, j === 0 ? TOOTH[2] : (i < 0 ? TOOTH[3] : TOOTH[2]));
          px.set(x - w - 1, y + j * dir, OUT); px.set(x + w + 1, y + j * dir, OUT);
        }
        px.set(x, y + len * dir, OUT);
      };
      const top = hy + Math.round(6 * S), bot = Math.round(hy + (11 + jw * 6) * S);
      [[19, 5], [13, 4], [8, 3]].forEach(([dx, l]) => fang(Math.round(hx + dx * k), top, Math.max(2, Math.round((l + jw * 2) * S)), 1));
      [[16, 4], [10, 3]].forEach(([dx, l]) => fang(Math.round(hx + dx * k), bot, Math.max(2, Math.round((l + jw) * S)), -1));
    }
    stampCrown(px, spec, ox + r.head.x - 4 * r.m * S, oy + r.head.y - (11 + 5 * r.m) * S, -0.32 * r.m + (o.crownAng || 0), S < 0.9 ? Math.max(0.72, S + 0.12) : 1);
    if (!o.noPuddle && !(o.lift > 3)) puddle(px, ox, oy, 70 + BEAST.DX, BEAST.G - 1, 54 * S, 4.2 * (0.6 + S * 0.4), look);
    return r;
  }

  // ════════════════════════════════════════════════════════════════════
  // FORMA III · REY HUMANOIDE (frente) · 176×156
  // ════════════════════════════════════════════════════════════════════
  const TITAN = Object.freeze({ W: 204, H: 156, G: 150, CX: 96 });
  function titanParts(o = {}) {
    const m = o.morph === undefined ? 1 : o.morph, g = 0.5 + m * 0.5;
    const br = o.breath || 0, sway = o.sway || 0, cr = (o.crouch || 0) * 6;
    const G = TITAN.G, cx = TITAN.CX, P = [];
    // ── Capa: amplia, de los hombros al suelo ──
    if (m > 0.55) {
      const k = clamp((m - 0.55) / 0.45, 0, 1), hem = lerp(80, G - 4, k), w = lerp(30, 66, k);
      P.push({ k: 'poly', pts: [[cx - 36, 44 + cr], [cx + 36, 44 + cr], [cx + w + sway * 5, hem - 8], [cx + w * 0.6 + sway * 3, hem], [cx + w * 0.2 + sway * 2, hem - 5], [cx - w * 0.2 + sway, hem], [cx - w * 0.6 + sway, hem - 5], [cx - w + sway * 5, hem - 8]], cx, top: 44, bottom: hem, sway: sway * 2, z: -60, m: 'cape', noCrease: true });
    }
    // ── Piernas gruesas y separadas ──
    // Paso: `stride` (-1..1) levanta la pierna de ese lado (rodilla adelante, pie en el aire).
    const stride = o.stride || 0;
    const leg = s => {
      const lift = Math.max(0, stride * s) * 9, plant = Math.max(0, -stride * s) * 1.5;
      const hip = cx + s * 12, knee = cx + s * (15 + cr * 0.3) - s * lift * 0.25, ank = cx + s * 17 - s * lift * 0.15;
      const ky = 120 + cr * 0.6 - lift * 0.8, ay = G - 8 - lift, fy = G - 4 - lift;
      P.push({ k: 'cap', x1: hip, y1: 98 + cr, x2: knee, y2: ky, r1: 12 * g, r2: 9.5 * g, z: 2 + lift * 0.4 });
      lump(P, hip + s * 3, 108 + cr - lift * 0.3, 8 * g, 10 * g);                                              // cuádriceps
      P.push({ k: 'cap', x1: knee, y1: ky, x2: ank, y2: ay + plant, r1: 9.5 * g, r2: 7.5 * g, z: 3 + lift * 0.4 });
      lump(P, knee + s * 2, 128 - lift * 0.8, 6 * g, 8 * g);                                                   // pantorrilla
      P.push({ k: 'ell', x: ank + s * 3, y: fy + plant, rx: 11 * g, ry: 5 * g, z: 5 + lift * 0.4, d: 5 });
      if (m > 0.6) [-4, 0, 4].forEach(dx => P.push({ k: 'ell', x: ank + s * 3 + dx + s * 5, y: fy + 1 + plant, rx: 3, ry: 2.8, z: 7 + lift * 0.4, d: 2.6 }));
    };
    leg(-1); leg(1);
    // ── Torso en V ──
    P.push({ k: 'ell', x: cx, y: 96 + cr, rx: 16 * g, ry: 9, z: 4 });
    P.push({ k: 'ell', x: cx, y: 84 + cr, rx: 16 * g, ry: 13, z: 6 });
    P.push({ k: 'ell', x: cx, y: 64 + cr - br, rx: lerp(20, 30, m), ry: 19 + (1 - m) * 10, z: 6, d: 17 });
    if (m > 0.5) {
      for (const s of [-1, 1]) lump(P, cx + s * 21, 72 + cr, 10, 14);                                          // dorsales
      for (const s of [-1, 1]) lump(P, cx + s * 11.5, 60 + cr - br, 13, 9.5);                                  // pectorales
      for (let r = 0; r < 3; r++) for (const s of [-1, 1]) lump(P, cx + s * 5.8, 76 + r * 6.6 + cr, 5.4, 3.8); // abdominales
    }
    // ── Cuello, trapecios y cabeza ──
    P.push({ k: 'cap', x1: cx, y1: 52 + cr, x2: cx, y2: 44 + cr, r1: 10, z: 8 });
    if (m > 0.5) for (const s of [-1, 1]) P.push({ k: 'ell', x: cx + s * 11, y: 48 + cr, rx: 10, ry: 5.5, z: 11, d: 5 });
    P.push({ k: 'ell', x: cx, y: 32 + cr, rx: 13.5, ry: 13.5, z: 13, d: 13 });
    P.push({ k: 'ell', x: cx, y: 41 + cr, rx: 10, ry: 6, z: 15, d: 6 });
    if (m > 0.5) P.push({ k: 'ell', x: cx, y: 27 + cr, rx: 11.5, ry: 4.2, z: 19, d: 4 });                       // ceño
    // ── Brazos y puños gigantes ──
    const arm = (s, pose) => {
      const sh = { x: cx + s * 31, y: 54 + cr };
      P.push({ k: 'ell', x: sh.x, y: sh.y, rx: 13 * g, ry: 12.5 * g, z: 11, d: 12 });                         // deltoide
      let el, fi, fr = 15.5, front = false;
      if (pose === 'punch') { el = { x: sh.x + s * 20, y: sh.y + 3 }; fi = { x: sh.x + s * 44, y: sh.y + 5 }; fr = 17; }
      else if (pose === 'charge') { el = { x: sh.x + s * 15, y: sh.y + 16 }; fi = { x: sh.x + s * 9, y: sh.y - 8 }; fr = 17; front = true; }
      else if (pose === 'up') { el = { x: sh.x + s * 6, y: sh.y - 20 }; fi = { x: sh.x - s * 6, y: sh.y - 42 }; }
      else { el = { x: sh.x + s * 7, y: sh.y + 22 }; fi = { x: sh.x + s * 9, y: sh.y + 50 }; front = true; }
      const k = 0.4 + m * 0.6;
      el = { x: lerp(sh.x, el.x, k), y: lerp(sh.y, el.y, k) }; fi = { x: lerp(sh.x, fi.x, k), y: lerp(sh.y, fi.y, k) };
      const zf = pose === 'punch' ? 26 : pose === 'charge' ? 20 : 14;
      P.push({ k: 'cap', x1: sh.x, y1: sh.y, x2: el.x, y2: el.y, r1: 10 * g, r2: 9 * g, z: zf - 3 });
      if (m > 0.5) lump(P, lerp(sh.x, el.x, 0.5) + s * 2, lerp(sh.y, el.y, 0.5), 8.5, 8.5);                    // bíceps
      P.push({ k: 'cap', x1: el.x, y1: el.y, x2: fi.x, y2: fi.y, r1: 9.5 * g, r2: 12.5 * g, z: zf });          // antebrazo ancho
      P.push({ k: 'ell', x: fi.x, y: fi.y, rx: fr * (0.4 + m * 0.6), ry: fr * 0.95 * (0.4 + m * 0.6), z: zf + 3, d: fr });
      if (m > 0.6) {
        // Nudillos y pulgar.
        const kn = pose === 'punch' ? [0, 1, 2, 3].map(i => [fi.x + s * fr * 0.72, fi.y - 6 + i * 4]) :
          pose === 'up' ? [0, 1, 2, 3].map(i => [fi.x - 6 + i * 4, fi.y - fr * 0.7]) :
            [0, 1, 2, 3].map(i => [fi.x - 7.5 + i * 5, fi.y + fr * 0.55]);
        kn.forEach(([x, y]) => P.push({ k: 'ell', x, y, rx: 4, ry: 3.6, z: zf + 3 + fr * 0.85, d: 3.4 }));
        P.push({ k: 'ell', x: fi.x - s * fr * 0.62, y: fi.y - 2, rx: 4, ry: 5.5, z: zf + 3 + fr * 0.6, d: 4 });
      }
      return { x: fi.x, y: fi.y, r: fr };
    };
    const fistL = arm(-1, o.left || 'idle'), fistR = arm(1, o.right || 'idle');
    // ── Transformación: masa erizada que se alza ──
    if (m < 0.6) {
      const k = 1 - m / 0.6;
      P.push({ k: 'ell', x: cx, y: G - 12, rx: 24 + k * 18, ry: 10 + k * 8, z: 5, d: 14 });
      P.push({ k: 'ell', x: cx, y: 72, rx: 26 + k * 6, ry: 28 + k * 6, z: 7, d: 18 });
      [[-15, 40, -0.5], [-4, 34, -0.15], [8, 35, 0.2], [19, 42, 0.6], [27, 56, 0.9], [-25, 54, -0.9]].forEach(([dx, y, a]) => {
        const l = 14 * k;
        if (l > 2) P.push({ k: 'spike', bx: cx + dx, by: y + 4, tx: cx + dx + Math.sin(a) * l, ty: y + 4 - Math.cos(a) * l, w: 4.2, z: 30, m: 'spine' });
      });
    }
    // ── Hombreras de armiño y broches de oro ──
    if (m > 0.7) {
      for (const s of [-1, 1]) {
        P.push({ k: 'ell', x: cx + s * 27, y: 46 + cr, rx: 18, ry: 10, z: 24, d: 8, m: 'ermine', noCrease: true });
        P.push({ k: 'ell', x: cx + s * 38, y: 50 + cr, rx: 9, ry: 8, z: 25, d: 7, m: 'ermine', noCrease: true });
        P.push({ k: 'ell', x: cx + s * 17, y: 44 + cr, rx: 9, ry: 7, z: 25, d: 7, m: 'ermine', noCrease: true });
        P.push({ k: 'ell', x: cx + s * 16, y: 51 + cr, rx: 4.6, ry: 4.6, z: 33, d: 4, m: 'gold' });
        P.push({ k: 'ell', x: cx + s * 16, y: 51 + cr, rx: 1.8, ry: 1.8, z: 36, d: 1.5, m: 'ruby' });
      }
    }
    const S = o.scale || 1, X = v => cx + (v - cx) * S, Y = v => G + (v - G) * S;
    scaleParts(P, S, cx, G);
    const fs = f => ({ x: X(f.x), y: Y(f.y), r: f.r * S });
    return { parts: P, S, head: { x: cx, y: Y(33 + cr) }, body: { x: cx, y: Y(76), rx: 32 * S, ry: 42 * S }, fistL: fs(fistL), fistR: fs(fistR), m, clasps: m > 0.7 ? [X(cx - 16), X(cx + 16), Y(51 + cr)] : null };
  }
  function chain(px, ox, oy, x0, x1, y, sag) {
    const n = Math.ceil(x1 - x0);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), yy = Math.round(y + Math.sin(t * Math.PI) * sag);
      const link = Math.floor(i / 2) % 2;
      px.set(ox + x, oy + yy, link ? GOLD[5] : GOLD[3]);
      px.set(ox + x, oy + yy + 1, link ? GOLD[2] : GOLD[1]);
      if (link) px.set(ox + x, oy + yy - 1, GOLD[4]);
    }
  }
  function drawTitan(px, ox, oy, spec, o = {}) {
    const look = A.lookOf(spec.mix, spec.hue), r = titanParts(o);
    const sc = sculpt(px, ox, oy, TITAN.W, TITAN.H, r.parts, look, { body: r.body, crease: 2.4, trim: 1 });
    const S = r.S;
    bubbles(px, ox, oy, sc, look, A.fragsOf(spec), Math.round((12 + r.m * 12) * (0.4 + S * 0.6)), 5, o.t || 0, [{ x: r.head.x, y: r.head.y, r: 15 * S }], Math.max(0.6, S));
    if (r.clasps) chain(px, ox, oy, r.clasps[0] + 3 * S, r.clasps[1] - 3 * S, r.clasps[2] + 2 * S, 7 * S);
    const hx = Math.round(ox + r.head.x), hy = Math.round(oy + r.head.y);
    if (r.m > 0.5) {
      // Rostro serio: ojos incandescentes bajo el ceño y boca firme.
      // Ojos furiosos: blanco incandescente rasgado bajo un ceño grueso.
      const small = S < 0.9;
      const EYE_L = small ? ['##....', '.####.', '#www##', '#wwpw#', '.#####'] : ['##......', '.###....', '..####..', '.#wwww##', '.#wwwpw#', '..######'];
      const off = small ? 7 : 10;
      for (const s of [-1, 1]) EYE_L.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '.') return;
        const x = s < 0 ? hx - off + i : hx + off - i, y = hy - (small ? 4 : 5) + j;
        px.set(x, y, ch === '#' ? OUT : ch === 'p' ? '#0b1a3a' : '#ffffff', ch === 'w' ? 192 : 255);
      }));
      // Boca: mueca seria con dientes apretados.
      const mw = Math.round(5 * (small ? 0.8 : 1)), my = hy + Math.round(8 * S);
      for (let i = -mw; i <= mw; i++) px.set(hx + i, my, OUT);
      for (let i = -mw + 1; i <= mw - 1; i++) px.set(hx + i, my + 1, i % 2 ? TOOTH[2] : TOOTH[1]);
      for (let i = -mw; i <= mw; i++) px.set(hx + i, my + 2, OUT);
      px.set(hx - mw - 1, my + 1, OUT); px.set(hx + mw + 1, my + 1, OUT);
    }
    stampCrown(px, spec, hx, hy - Math.round((r.m > 0.5 ? 17 : 14) * S), 0, S < 0.9 ? Math.max(0.75, S + 0.1) : 1);
    if (o.glow) {
      const f = o.right === 'charge' || o.right === 'punch' ? r.fistR : r.fistL;
      const fx = ox + f.x, fy = oy + f.y;
      for (let a = 0; a < 36; a++) {
        const ang = a / 36 * Math.PI * 2, rr = f.r + 4 + (a % 3) + o.glow * 2;
        const x = Math.round(fx + Math.cos(ang) * rr), y = Math.round(fy + Math.sin(ang) * rr);
        if (!px.alpha(x, y) && (a + ((o.t || 0) * 10 | 0)) % 2 === 0) px.set(x, y, a % 4 ? '#b48cff' : '#f1e8ff', 192);
      }
      // El puño se carga de luz violeta.
      for (let y = -f.r; y <= f.r; y++) for (let x = -f.r; x <= f.r; x++) {
        if (x * x + y * y > f.r * f.r * 0.5 || !px.alpha(fx + x, fy + y)) continue;
        if (bayer(fx + x, fy + y) < 0.22 * o.glow) px.set(fx + x, fy + y, '#c9b0ff', 192);
      }
    }
    if (!o.noPuddle) puddle(px, ox, oy, TITAN.CX, TITAN.G - 1, 46 * S, 4.2 * (0.6 + S * 0.4), look);
    return r;
  }

  // ── Transición I → II ──────────────────────────────────────────────────
  function drawMorphI_II(px, ox, oy, spec, k) {
    if (k <= 0.05) {
      const sheet = A.kingSheet(spec, 64), i = sheet.frames.summon;
      const img = sheet.canvas.getContext('2d').getImageData((i % 8) * 64, Math.floor(i / 8) * 64, 64, 64);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const j = (y * 64 + x) * 4; if (img.data[j + 3]) px.set(ox + 56 + x, oy + BEAST.G - 61 + y, [img.data[j], img.data[j + 1], img.data[j + 2]], img.data[j + 3]); }
      return;
    }
    drawBeast(px, ox, oy, spec, { morph: k, crouch: 1 - k, inflate: (1 - k) * 0.6 });
  }

  // ════════════════════════════════════════════════════════════════════
  // FORMA I · REY SLIME CLÁSICO (v2 · 15-11-2026) — mismo motor que II y III
  // Gelatina esculpida con luz, burbujas de colores, charco, gotas, rostro
  // dibujado a mano (ojos y bocas por expresión) y corona con rubí.
  // ════════════════════════════════════════════════════════════════════
  const EYES = {
    normal: ['..###..', '.#ppp#.', '#hhppp#', '#hhppp#', '#ppppp#', '#pppbp#', '#ppbhp#', '.#bbb#.', '..###..'],
    wide: ['..###..', '.#www#.', '#wwwww#', '#wwhpw#', '#wwppw#', '#wwppw#', '#wwwww#', '.#www#.', '..###..'],
    blink: ['.......', '.......', '.......', '.#####.', '#sssss#', '.#####.', '.......'],
    closed: ['.......', '.......', '.......', '.......', '#######', '.......', '.......'],
    happy: ['.......', '..###..', '.#...#.', '#.....#', '.......', '.......', '.......'],
    hurt: ['.......', '##.....', '..##...', '....##.', '..##...', '##.....', '.......'],
    dazed: ['.#####.', '#ppppp#', '#pwwwp#', '#pwppp#', '#pwwww#', '#ppppp#', '.#####.'],
    small: ['.##.', '#hp#', '#pb#', '.##.']
  };
  // Ojo real (concepto «El Rey»): rasgado, encendido en violeta y con halo.
  const ROYAL_EYE = ['.#####...', '#wwwww##.', '#wwwwwwg#', '#gwwwggv#', '.#vgggv#.', '..#####..'];
  function stampRoyalEye(px, x, y, mirror, open = 1) {
    // Almendra inclinada: el párpado (grueso, hace de ceño) baja hacia el centro de la cara.
    const W = 10, put = (i, j, c, a = 255) => px.set(x + (mirror ? W - 1 - i : i), y + j, c, a);
    for (let i = 0; i < W; i++) {
      const top = 1 + i * 0.42, bot = 6.2 - 0.07 * (i - 4.5) * (i - 4.5);
      const t0 = Math.floor(top);
      put(i, t0, OUT); put(i, t0 - 1, OUT);                          // párpado grueso
      if (i === W - 1) put(i, t0 + 1, OUT);
      if (open < 1) { if (i > 0 && i < W - 1) put(i, t0 + 1, '#c79bff', 192); continue; }
      for (let j = t0 + 1; j <= Math.floor(bot); j++) {
        const low = (j - t0) / Math.max(1, bot - t0), inner = i / (W - 1);
        const c = low > 0.75 || inner > 0.85 ? '#9b5cff' : low > 0.45 ? '#e3b8ff' : '#fbf4ff';
        put(i, j, c, 192);
      }
      if (i > 0 && i < W - 1) put(i, Math.floor(bot) + 1, OUT);
    }
    // Halo violeta alrededor (brilla solo, también de noche).
    for (let j = 0; j < 9; j++) for (let i = -1; i <= W; i++) {
      const xx = x + i, yy = y + j;
      if (!px.alpha(xx, yy) && (px.alpha(xx - 1, yy) || px.alpha(xx + 1, yy) || px.alpha(xx, yy - 1)) && bayer(xx, yy) < 0.5) px.set(xx, yy, '#7a3dff', 192);
    }
  }
  // ── «El Rey Loco» (figura de plastilina del director) ──
  const PINK = ['#5e0a45', '#c0128a', '#ff2fbf', '#ff7fdc', '#ffd0f4'];
  /** Ojo saltón rosado con pupila negra (cada ojo mira para su lado). */
  function locoEye(px, cx, cy, r, pdx, pdy, pr, kind) {
    const R2 = r + 0.5;
    for (let y = -Math.ceil(R2) - 1; y <= Math.ceil(R2) + 1; y++) for (let x = -Math.ceil(R2) - 1; x <= Math.ceil(R2) + 1; x++) {
      const d = Math.hypot(x, y);
      if (d > R2 + 0.9) continue;
      if (d > R2) { px.set(cx + x, cy + y, OUT); continue; }
      if (kind === 'spiral') { const a = Math.atan2(y, x), v = (a / (Math.PI * 2) + d / 2.6) % 1; px.set(cx + x, cy + y, v < 0.45 ? PINK[1] : PINK[3]); continue; }
      const shade = (x + y) / (r * 2.2);
      px.set(cx + x, cy + y, shade > 0.35 ? PINK[2] : shade < -0.45 ? PINK[4] : PINK[3]);
    }
    if (kind === 'spiral') return;
    if (kind === 'x') { for (let i = -2; i <= 2; i++) { px.set(cx + i, cy + i, OUT); px.set(cx + i, cy - i, OUT); } return; }
    if (kind === 'heart') { [[-2, -1], [-1, -2], [1, -2], [2, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2], [0, -1]].forEach(([x, y]) => px.set(cx + x, cy + y, '#ff2a6a')); return; }
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) <= pr + 0.45) px.set(cx + pdx + x, cy + pdy + y, '#0b0b14');
    const hx = cx - r * 0.42, hy = cy - r * 0.42, hr = Math.max(0.6, r * 0.28);
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) <= hr) px.set(Math.round(hx + x), Math.round(hy + y), '#ffffff', 192);
  }
  /** Boca ancha en zigzag llena de dientes (abierta = rugido). */
  function locoMouth(px, cx, y, w, open, tongue, small) {
    // Boca de oreja a oreja: borde redondeado y dientes triangulares grandes arriba y abajo.
    const h = small ? 4 : open ? 17 : 14, x0 = Math.round(cx - w / 2), P = small ? 4 : 10, A2 = small ? 1 : 5;
    for (let x = 0; x <= w; x++) {
      const u = x / w, edge = Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 2)));   // la boca se cierra en las comisuras
      const tri = q => 1 - Math.abs(((q % P) / P) * 2 - 1);                        // 0..1 diente
      const zt = tri(x + P / 2) * A2, zb = tri(x) * A2;
      const lift = small ? 0 : Math.round(Math.pow(Math.max(0, u - 0.6) / 0.4, 2) * 4);   // la comisura derecha sube (sonrisa loca)
      const top = y - lift + Math.round(h * 0.5 * (1 - edge) + zt), bot = y - lift + h - Math.round(h * 0.5 * (1 - edge) + zb);
      if (bot < top) continue;
      for (let yy = top; yy <= bot; yy++) {
        const deep = (yy - top) / Math.max(1, bot - top);
        px.set(x0 + x, yy, yy === top || yy === bot ? OUT : (tongue && deep > 0.55 && Math.abs(u - 0.55) < 0.12 ? '#ff6fae' : deep > 0.65 ? '#1c0820' : '#06040c'));
      }
      // Filo celeste de los dientes (luz de borde de la gelatina).
      if (!small) { if (top - 1 > y) px.set(x0 + x, top - 1, '#7fe9ff'); if (bot + 1 < y + h) px.set(x0 + x, bot + 1, '#5fd8ff'); }
    }
    if (tongue) for (let j = 0; j < 3; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) < 3 - j * 0.5) px.set(Math.round(cx + w * 0.05) + i, y + h + j, j === 2 ? '#c2185b' : '#ff6fae');
  }
  /** Corona amarilla de tres puntas con bolitas (como la de plastilina). */
  function locoCrown(scale = 1) {
    const W = 36, H = 30, c = new A.Px(W, H), Y = ['#6b3a00', '#b56d00', '#f2a90f', '#ffd23a', '#ffe98a', '#fff7cf'];
    const tips = [[6, 7], [18, 2], [30, 6]];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let inside = y >= 18 && y <= 25 && x >= 3 && x <= 33;
      for (const [tx, ty] of tips) { const half = (y - ty) * 0.42; if (y >= ty + 2 && y <= 19 && Math.abs(x - tx) <= half + 1.6) inside = true; }
      if (!inside) continue;
      const lv = (W - x) / W * 0.6 + (H - y) / H * 0.3;
      c.set(x, y, lv > 0.62 ? Y[5] : lv > 0.5 ? Y[4] : lv > 0.36 ? Y[3] : lv > 0.25 ? Y[2] : Y[1]);
    }
    for (const [tx, ty] of tips) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, y) <= 2.2) c.set(tx + x, ty + 2 + y, x + y < -1 ? Y[5] : x + y > 1 ? Y[2] : Y[4]);
    c.outline(0, 0, W, H, side => (side === 'up' ? Y[1] : Y[0]));
    if (scale === 1) return c;
    const s = new A.Px(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = Math.round(W / 2 + (x - W / 2) / scale), sy = Math.round(H - 5 + (y - H + 5) / scale);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const j = (sy * W + sx) * 4; if (!c.d[j + 3]) continue;
      s.set(x, y, [c.d[j], c.d[j + 1], c.d[j + 2]], c.d[j + 3]);
    }
    return s;
  }
  function drawLocoCrownAt(px, ox, oy, cx, cy, ang, sc) {
    const Y = ['#6b3a00', '#b55f00', '#ef9a0a', '#ffc21f', '#ffdc55', '#fff1a8'];
    const ca = Math.cos(ang), sa = Math.sin(ang), Wd = 15 * sc, Hb = 5 * sc;
    // Forma local: aro (x ±Wd, y 0..Hb) y tres puntas redondeadas (centro más alta).
    const tips = [[-Wd * 0.68, -10 * sc], [0, -15 * sc], [Wd * 0.68, -10 * sc]];
    const inside = (lx, ly) => {
      if (Math.abs(lx) <= Wd && ly >= -1 * sc && ly <= Hb) return true;
      for (const [tx, ty] of tips) {
        const r = 3.4 * sc;
        if (Math.hypot(lx - tx, ly - ty) <= r) return true;
        if (ly >= ty && ly <= 0) { const half = r * 0.85 + (ly - ty) * 0.22; if (Math.abs(lx - tx) <= half) return true; }
      }
      return false;
    };
    const R = Math.ceil(20 * sc), cells = [];
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const lx = x * ca + y * sa, ly = -x * sa + y * ca;
      if (!inside(lx, ly)) continue;
      cells.push([x, y]);
      const lv = (-lx / Wd) * 0.35 + (-(ly + 6 * sc) / (12 * sc)) * 0.45 + 0.45;
      let c = lv > 0.82 ? Y[5] : lv > 0.62 ? Y[4] : lv > 0.42 ? Y[3] : lv > 0.25 ? Y[2] : Y[1];
      if (ly > Hb - 1.2 * sc) c = Y[1];                                  // sombra bajo el aro
      else if (ly > -1 * sc && ly < 0.6 * sc) c = Y[5];                  // filo de luz del aro
      px.set(ox + cx + x, oy + cy + y, c);
    }
    const set = new Set(cells.map(([x, y]) => x + ',' + y));
    for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!set.has((x + dx) + ',' + (y + dy))) { const xx = ox + cx + x + dx, yy = oy + cy + y + dy; if (!set.has((x + dx) + ',' + (y + dy))) px.set(xx, yy, Y[0]); }
    }
  }
  /**
   * «El Rey Loco» dibujado como en la hoja del director: contorno oscuro grueso,
   * sombreado en bandas limpias (luz arriba a la izquierda), borde celeste,
   * brillo blanco grande, ojos enormes, boca de lado a lado con pocos dientes
   * grandes y corona de tres puntas inclinada. Sin texturas ruidosas.
   */
  function drawLocoCell(px, ox, oy, cell, spec, f) {
    const k = cell / 64, look = A.lookOf(spec.mix, spec.hue);
    const rampL = GEL[look.hybrid ? look.hybrid[0] : look.hue] || GEL.azul, rampR = look.hybrid ? (GEL[look.hybrid[1]] || rampL) : rampL;
    const sx = f.sx || 1, sy = f.sy || 1, skew = f.skew || 0, t = f.t || 0, TT = t * Math.PI * 2;
    const G = cell - 5 * k, W = Math.min(30 * k, 25 * k * sx), H = 20 * k * sy, cy = G - H, cx = cell / 2 + 1 * k;
    const LINE = '#0b0d24', CYAN = '#5fe3ff', CYAN2 = '#bff6ff';
    const inBody = (x, y) => {
      const lx = x - cx - skew * (cy - y) * 0.6, nx = lx / W, ny = (y - cy) / H;
      return ny <= 0 ? nx * nx + ny * ny * 1.02 <= 1 : Math.pow(Math.abs(nx), 2.2) + Math.pow(ny, 3.2) <= 1;
    };
    const body = new Uint8Array(cell * cell);
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (inBody(x + 0.5, y + 0.5)) body[y * cell + x] = 1;
    const B = (x, y) => x >= 0 && y >= 0 && x < cell && y < cell && body[y * cell + x] === 1;
    // Cuerpo: bandas de luz con tramado solo en los bordes de banda.
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      if (!B(x, y)) continue;
      const lx = x + 0.5 - cx - skew * (cy - y) * 0.6, nx = lx / W, ny = (y + 0.5 - cy) / H;
      const ramp = look.hybrid && lx > Math.sin(y * 0.4) * 1.5 ? rampR : rampL;
      let v = -nx * 0.38 - ny * 0.62 + 0.18 + (bayer(x, y) - 0.5) * 0.08;
      if (ny > 0.55) v -= 0.25;
      const c = v > 0.82 ? ramp[6] : v > 0.58 ? ramp[5] : v > 0.3 ? ramp[4] : v > 0.02 ? ramp[3] : v > -0.3 ? ramp[2] : ramp[1];
      px.set(ox + x, oy + y, c);
      // Borde de luz celeste (derecha y abajo) y borde claro arriba a la izquierda.
      const edge = !B(x + 1, y) || !B(x, y + 1) || !B(x - 1, y) || !B(x, y - 1);
      const edge2 = !B(x + 2, y) || !B(x, y + 2);
      if (edge && (nx > 0.1 || ny > 0.35)) px.set(ox + x, oy + y, ny > 0.35 ? CYAN : CYAN2);
      else if (edge2 && (nx > 0.35 || ny > 0.55) && bayer(x, y) < 0.6) px.set(ox + x, oy + y, CYAN);
      else if (edge && nx < -0.2 && ny < 0) px.set(ox + x, oy + y, ramp[6]);
    }
    // Brillo blanco grande arriba a la izquierda y uno pequeño a la derecha.
    const gl = (gx, gy, rx, ry, rot) => {
      for (let y = -Math.ceil(ry) - 2; y <= Math.ceil(ry) + 2; y++) for (let x = -Math.ceil(rx) - 2; x <= Math.ceil(rx) + 2; x++) {
        const qx = x * Math.cos(rot) + y * Math.sin(rot), qy = -x * Math.sin(rot) + y * Math.cos(rot), d = Math.hypot(qx / rx, qy / ry);
        const xx = Math.round(gx + x), yy = Math.round(gy + y); if (d > 1 || !B(xx, yy)) continue;
        px.set(ox + xx, oy + yy, d < 0.62 ? '#ffffff' : rampL[7], d < 0.62 ? 192 : 255);
      }
    };
    gl(cx - W * 0.55 + skew * H * 0.6, cy - H * 0.55, 4.5 * k, 2 * k, -0.5);
    gl(cx + W * 0.62 + skew * H * 0.4, cy - H * 0.25, 1.6 * k, 1.1 * k, 0.6);
    if (f.coreGlow) for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = Math.hypot(x, y) / 5; const xx = Math.round(cx + x * k), yy = Math.round(cy + 6 * k + y * k); if (d <= 1 && B(xx, yy)) px.set(ox + xx, oy + yy, d < 0.45 ? '#f4e6ff' : d < 0.75 ? '#c79bff' : '#8a5cf0', 192); }
    // Contorno grueso oscuro (2 px) y aura violeta por fuera.
    const ring = [];
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (!B(x, y) && (B(x + 1, y) || B(x - 1, y) || B(x, y + 1) || B(x, y - 1))) ring.push([x, y]);
    ring.forEach(([x, y]) => px.set(ox + x, oy + y, LINE));
    if (k > 0.75) {
      const ring2 = [];
      for (const [x, y] of ring) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (!B(xx, yy) && !px.alpha(ox + xx, oy + yy)) ring2.push([xx, yy]); }
      ring2.forEach(([x, y]) => { if (y < G) px.set(ox + x, oy + y, y > cy ? LINE : '#1a1240'); });
      for (const [x, y] of ring2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) { const xx = x + dx, yy = y + dy; if (yy < G - 1 && !px.alpha(ox + xx, oy + yy) && bayer(xx, yy) < 0.5) px.set(ox + xx, oy + yy, (xx + yy + Math.floor(t * 8)) % 4 ? '#7a3dff' : '#d07bff', 192); }
    }
    // Charco y salpicaduras.
    puddle(px, ox, oy, cx, G + 0.5 * k, W * 1.18, 2.6 * k, look);
    if (k > 0.75) [[-1, 0], [1, 0.4]].forEach(([sd, ph]) => {
      for (let i = 0; i < 3; i++) {
        const bx = Math.round(cx + sd * (W + 3 + i * 2.5)), by = Math.round(G - 2 - i * 2.2 - Math.sin(TT + ph + i));
        px.set(ox + bx, oy + by, i === 0 ? rampL[5] : rampL[6]); if (i < 2) px.set(ox + bx, oy + by + 1, rampL[3]);
        if (i === 2) px.set(ox + bx + sd, oy + by - 1, '#ffffff', 192);
      }
    });
    // Burbujas que flotan alrededor (como en la hoja).
    if (k > 0.75) for (let i = 0; i < 3; i++) {
      const a = TT + i * 2.1, bx = Math.round(cx + (i === 1 ? -1 : 1) * (W + 3 * k) * (0.85 + 0.15 * Math.cos(a))), by = Math.round(cy - H * 0.6 - i * 5 * k - ((t * 6 + i * 3) % 6));
      const r = i === 0 ? 2.2 : 1.6;
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { const d = Math.hypot(xx, yy); if (d <= r + 0.5 && !px.alpha(ox + bx + xx, oy + by + yy)) px.set(ox + bx + xx, oy + by + yy, d > r - 0.4 ? CYAN : rampL[4]); }
      px.set(ox + bx - 1, oy + by - 1, '#ffffff', 192);
    }
    // Rostro.
    if (!f.noFace) {
      const e = f.eyes || 'normal', m = f.mouth || 'smile', fsk = skew * H * 0.6;
      const kind = e === 'dazed' ? 'spiral' : e === 'hurt' ? 'x' : e === 'happy' ? 'heart' : 'eye';
      // Boca de lado a lado: franja negra en zigzag (los dientes de arriba y de abajo casi se tocan).
      const open = ['roar', 'o'].includes(m), tongue = e === 'dazed' || m === 'wavy';
      const mx0 = Math.round(cx - W * 0.8 + fsk), mx1 = Math.round(cx + W * 0.86 + fsk), span = mx1 - mx0;
      const teeth = k > 0.75 ? 4.5 : 3, tw = span / teeth, A2 = (k > 0.75 ? 6.5 : 3) * k, gap = (open ? 9 : 4) * k;
      const base = cy + H * 0.3;
      for (let x = mx0; x <= mx1; x++) {
        const u = (x - mx0) / span, taper = Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 6)));
        const lift = Math.pow(Math.max(0, u - 0.62) / 0.38, 2) * 4 * k;          // la comisura derecha sube
        const zig = (1 - Math.abs(((x - mx0) % tw) / tw * 2 - 1)) * A2;
        const top = Math.round(base - lift + zig), bot = Math.round(top + gap * taper + (open ? Math.sin(u * Math.PI) * 4 * k : 0));
        if (taper < 0.15) { px.set(ox + x, oy + top, LINE); continue; }
        for (let y = top - 1; y <= bot + 1; y++) {
          let c = y === top - 1 || y === bot + 1 ? LINE : (tongue && y > bot - 3 && Math.abs(u - 0.5) < 0.12 ? '#ff6fae' : y > top + (bot - top) * 0.6 ? '#1c0820' : '#06040c');
          px.set(ox + x, oy + y, c);
        }
        if (k > 0.75) { px.set(ox + x, oy + top - 2, CYAN2); px.set(ox + x, oy + bot + 2, CYAN); }
      }
      // Ojos saltones: izquierdo enorme, derecho asomando arriba a la derecha.
      if (e === 'blink' || e === 'closed') {
        for (let i = -6; i <= 6; i++) { px.set(ox + Math.round(cx - W * 0.4 + fsk) + i, oy + Math.round(cy - H * 0.15) + Math.round(Math.abs(i) * 0.2), LINE); px.set(ox + Math.round(cx + W * 0.5 + fsk) + i, oy + Math.round(cy - H * 0.55) + Math.round(Math.abs(i) * 0.2), LINE); }
      } else {
        const wide = e === 'wide' || e === 'angry';
        locoEye(px, ox + Math.round(cx - W * 0.42 + fsk), oy + Math.round(cy - H * 0.26), (k > 0.75 ? 9.5 : 3.4) * (wide ? 1.08 : 1), Math.round(2 * k), 0, (wide ? 1.2 : 1.8) * k * (k > 0.75 ? 1 : 1.2), kind);
        locoEye(px, ox + Math.round(cx + W * 0.5 + fsk), oy + Math.round(cy - H * 0.66), (k > 0.75 ? 8 : 2.9) * (wide ? 1.08 : 1), -Math.round(1 * k), Math.round(2 * k), (wide ? 1.1 : 1.6) * k * (k > 0.75 ? 1 : 1.4), kind);
        if (e === 'sad') for (let j = 0; j < 4; j++) px.set(ox + Math.round(cx - W * 0.55), oy + Math.round(cy - H * 0.18 + 10 * k) + j + (f.tear || 0), j === 3 ? '#d2f2ff' : '#7cc8ff', 192);
      }
    }
    // Corona grande inclinada a la izquierda, encima del ojo izquierdo.
    if (!f.noCrown) drawLocoCrownAt(px, ox, oy, Math.round(cx - W * 0.42 + skew * H + (f.crownDx || 0) * k), Math.round(Math.max(k > 0.75 ? 19 : 10, cy - H * 0.95 - 4 * k + (f.crownDy || 0) * k)), (f.crownAng || 0) - 0.42, k > 0.75 ? 1 : 0.42);
    if (f.crownGlow && !f.noCrown) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; px.set(ox + Math.round(cx - W * 0.42 + Math.cos(a) * 17 * k), oy + Math.round(cy - H - 6 * k + Math.sin(a) * 10 * k), '#fff4c4', 192); }
  }
  function drawLocoFace(px, ox, oy, fx, fy, f, k) {
    const e = f.eyes || 'normal', m = f.mouth || 'smile';
    const kind = e === 'dazed' ? 'spiral' : e === 'hurt' ? 'x' : e === 'happy' ? 'heart' : 'eye';
    if (k > 0.75) {
      if (e === 'blink' || e === 'closed') {
        for (let i = -5; i <= 5; i++) { px.set(ox + fx - 9 + i, oy + fy + Math.round(Math.abs(i) * 0.25), OUT); px.set(ox + fx + 9 + i, oy + fy + Math.round(Math.abs(i) * 0.25), OUT); }
      } else {
        const wide = e === 'wide' || e === 'angry';
        // Ojo izquierdo grande mirando arriba-afuera; derecho más chico mirando abajo-adentro: el Rey Loco.
        locoEye(px, ox + fx - 9, oy + fy + 4, 8, 1, 0, wide ? 1 : 1.7, kind);
        locoEye(px, ox + fx + 12, oy + fy - 2, 6.5, 2, -1, wide ? 1 : 1.5, kind);
        if (e === 'sad') for (let j = 0; j < 3; j++) px.set(ox + fx - 12, oy + fy + 7 + j + (f.tear || 0), j === 2 ? '#d2f2ff' : '#7cc8ff', 192);
      }
      const open = ['roar', 'o'].includes(m), tongue = e === 'dazed' || m === 'wavy';
      locoMouth(px, ox + fx + 2, oy + fy + 11, 44, open, tongue);
    } else {
      locoEye(px, ox + fx - 5, oy + fy, 2.5, -1, -1, 1, kind === 'eye' ? 'eye' : kind);
      locoEye(px, ox + fx + 4, oy + fy, 2, 0, 1, 0.8, kind === 'eye' ? 'eye' : kind);
      locoMouth(px, ox + fx, oy + fy + 4, 9, false, false, true);
    }
  }
  /** Corona real del concepto: punta central alta con diamante violeta, gemas en el aro. */
  function royalCrown(spec, scale = 1) {
    const W = 40, H = 34, c = new A.Px(W, H), G = GOLD;
    const tips = [[7, 15, 6], [13, 11, 9], [20, 5, 14], [27, 11, 9], [33, 15, 6]];
    for (const [tx, ty, h] of tips) {
      for (let y = ty + 2; y <= 24; y++) {
        const half = Math.floor((y - ty - 2) * (h > 10 ? 0.3 : 0.38));
        for (let x = tx - half; x <= tx + half; x++) c.set(x, y, x < tx ? G[5] : x === tx ? G[4] : G[3]);
      }
      c.set(tx, ty, G[6], 192); c.set(tx, ty + 1, G[5]);
    }
    for (let y = 22; y <= 28; y++) for (let x = 4; x <= 36; x++) c.set(x, y, y === 22 ? G[6] : y === 28 ? G[2] : y >= 26 ? G[3] : G[4]);
    for (let x = 5; x <= 35; x += 3) c.set(x, 25, G[2]);
    // Diamante violeta central (brilla solo).
    const dia = [[20, 12], [19, 13], [20, 13], [21, 13], [18, 14], [19, 14], [20, 14], [21, 14], [22, 14], [19, 15], [20, 15], [21, 15], [20, 16], [20, 17]];
    dia.forEach(([x, y], i) => c.set(x, y, i < 4 ? '#f3dcff' : i < 9 ? '#b57dff' : '#6a2fd6', 192));
    const gem = (x, col) => { c.set(x, 24, col[0], 192); c.set(x + 1, 24, col[1]); c.set(x, 25, col[1]); c.set(x + 1, 25, col[2]); };
    gem(19, ['#f3dcff', '#9b5cff', '#5a22b8']);
    const hues = A.gemsOf(spec);
    [9, 29, 14, 24].forEach((x, i) => { const h = hues[i % Math.max(1, hues.length)]; const pal = PAL[h] || PAL.rune; gem(x, i < 2 ? ['#f3dcff', '#9b5cff', '#5a22b8'] : [pal[5] || '#fff', pal[3], pal[1]]); });
    c.outline(0, 0, W, H, side => (side === 'up' ? G[1] : G[0]));
    if (scale === 1) return c;
    const s = new A.Px(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = Math.round(W / 2 + (x - W / 2) / scale), sy = Math.round(H - 6 + (y - H + 6) / scale);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const j = (sy * W + sx) * 4; if (!c.d[j + 3]) continue;
      s.set(x, y, [c.d[j], c.d[j + 1], c.d[j + 2]], c.d[j + 3]);
    }
    return s;
  }
  function stampEye(px, x, y, kind, mirror, cols) {
    const map = EYES[kind] || EYES.normal, w = map[0].length;
    map.forEach((row, j) => [...row].forEach((ch, i0) => {
      const i = mirror ? w - 1 - i0 : i0;
      if (ch === '.') return;
      const c = ch === '#' ? OUT : ch === 'w' ? '#fffdf4' : ch === 'h' ? '#ffffff' : ch === 's' ? '#b8c6d8' : ch === 'b' ? '#3b5fae' : cols.pupil;
      px.set(x + i, y + j, c, ch === 'h' ? 192 : 255);
    }));
  }
  function drawMouth(px, x, y, kind, small) {
    const M = MOUTH, T = TOOTH;
    const put = (rows, map) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') px.set(x - (row.length >> 1) + i, y + j, map[ch]); }));
    const mp = { '#': OUT, 'm': M[1], 'n': M[2], 't': M[4], 'w': T[3], 'v': T[2] };
    if (small) {
      const sm = { o: ['.#.', '#m#', '.#.'], roar: ['###', '#m#', '#t#', '###'], grit: ['###', '#w#', '###'], smile: ['#.#', '.#.'], frown: ['.#.', '#.#'], flat: ['###'], wavy: ['#.#.#', '.#.#.'] };
      put(sm[kind] || sm.flat, mp); return;
    }
    const big = {
      o: ['.###.', '#mmm#', '#mnm#', '#mtm#', '.###.'],
      grit: ['#########', '#wvwvwvw#', '#########'],
      roar: ['.###########.', '#wv#mmmmm#vw#', '#v#mmmmmmm#v#', '#mmmmnnnmmmm#', '#mmmntttnmmm#', '.#mmttttmm#.', '..########..'],
      flat: ['.#######.'],
      serio: ['..###..', '.#...#.'],
      wavy: ['.#...#...#.', '#.#.#.#.#.#', '...#...#...'],
      frown: ['...###...', '.##...##.', '#.......#'],
      smile: ['#.......#', '.##...##.', '..#ttt#..', '...###...']
    };
    put(big[kind] || big.flat, mp);
  }
  /** Dibuja un cuadro de la Forma I en una celda (64 px el jefe, 32 px el aliado). */
  function drawKingI(px, ox, oy, cell, spec, f) {
    // Cada cuadro se dibuja aparte y se recorta a su celda: nada se sale al cuadro vecino.
    const local = new A.Px(cell, cell);
    drawKingICell(local, 0, 0, cell, spec, f);
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const i = (y * cell + x) * 4; if (!local.d[i + 3]) continue;
      px.set(ox + x, oy + y, [local.d[i], local.d[i + 1], local.d[i + 2]], local.d[i + 3]);
    }
  }
  function drawKingICell(px, ox, oy, cell, spec, f) {
    const k = cell / 64, look = A.lookOf(spec.mix, spec.hue), ramp = GEL[look.hybrid ? look.hybrid[0] : look.hue] || GEL.azul;
    const G = Math.round(cell - 4 * k), cx = cell / 2;
    const t = f.t || 0, TT = t * Math.PI * 2;
    // Charco final (derrota).
    if (f.puddle) {
      const P = [{ k: 'ell', x: cx, y: G - 3 * k, rx: 26 * k * f.puddle, ry: 6 * k, d: 3 * k }];
      const body = { x: cx, y: G - 3 * k, rx: 26 * k, ry: 6 * k };
      const sc = sculpt(px, ox, oy, cell, cell, P, look, { body });
      bubbles(px, ox, oy, sc, look, A.fragsOf(spec), Math.round(6 * k), 9, t, [], Math.max(0.5, k * 0.7));
      if (k > 0.75) { stampEye(px, ox + Math.round(cx - 10), oy + Math.round(G - 9), 'closed', false, { pupil: '#141a33' }); stampEye(px, ox + Math.round(cx + 3), oy + Math.round(G - 9), 'closed', true, { pupil: '#141a33' }); }
      return;
    }
    if ((spec.style || f.style || 'loco') === 'loco') { drawLocoCell(px, ox, oy, cell, spec, f); return; }
    const sx = f.sx || 1, sy = f.sy || 1, skew = f.skew || 0, style = spec.style || f.style || 'loco';
    const SH = { loco: [25, 19.5], rey: [24, 16.5], cupula: [21, 19.5], gota: [17.5, 23], monarca: [20, 19], colosal: [25, 16.5] }[style] || [21, 19.5];
    const rx = Math.min(30 * k, SH[0] * k * sx), ry = SH[1] * k * sy, cy = G - ry * 0.9;
    const wob = Math.sin(TT) * 0.6 * k;
    const P = [];
    // Falda ancha que se apoya en el suelo y cúpula principal (la parte alta se inclina con `skew`).
    P.push({ k: 'ell', x: cx, y: G - 4 * k, rx: rx * (style === 'loco' ? 0.98 : 1.1), ry: 6.5 * k * Math.min(1.3, sx), d: 6 * k, z: -2 * k });
    P.push({ k: 'ell', x: cx + skew * ry * 0.25, y: cy + ry * 0.18, rx: rx, ry: ry * 0.82, d: ry * 0.8 });
    P.push({ k: 'ell', x: cx + skew * ry * 0.55, y: cy - ry * 0.12 + wob, rx: rx * 0.84, ry: ry * 0.78, d: ry * 0.85, z: 0.5 * k });
    if (style === 'gota') P.push({ k: 'ell', x: cx + skew * ry * 0.7, y: cy - ry * 0.55 + wob, rx: rx * 0.55, ry: ry * 0.5, d: ry * 0.5, z: 2 * k });
    if (style === 'colosal') { lump(P, cx - rx * 0.62, G - 7 * k, 7 * k, 6 * k); lump(P, cx + rx * 0.62, G - 7 * k, 7 * k, 6 * k); }
    if (style === 'monarca' && k > 0.75) {
      // Capa púrpura por detrás y cuello de armiño bajo la corona (une la Forma I con la III).
      P.push({ k: 'poly', pts: [[cx - rx * 0.7, cy - ry * 0.5], [cx + rx * 0.7, cy - ry * 0.5], [cx + rx * 1.18, G - 1 * k], [cx - rx * 1.18, G - 1 * k]], cx, top: cy - ry * 0.5, bottom: G, sway: 0, z: -40, m: 'cape', noCrease: true });
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.12 + i * 0.127); P.push({ k: 'ell', x: cx + Math.cos(a) * rx * 0.55, y: cy - ry * 0.62 + Math.sin(a) * 2.5 * k, rx: 3.6 * k, ry: 3 * k, d: 3 * k, z: ry * 0.85, m: 'ermine' }); }
    }
    // Bultitos vivos en la superficie (cambian con la respiración).
    if (k > 0.75 && style !== 'rey' && style !== 'loco') for (let i = 0; i < 4; i++) {
      const a = TT * (i % 2 ? 1 : -1) + i * 1.7, lx = cx + skew * ry * 0.4 + Math.cos(a) * rx * 0.55, ly = cy - ry * 0.25 + Math.sin(a * 0.7) * ry * 0.35;
      lump(P, lx, ly, (2.6 + (i % 2)) * k, (2.2 + (i % 3) * 0.4) * k);
    }
    // Gotas que cuelgan del borde.
    const drips = f.drips || 0;
    for (let i = 0; i < drips; i++) {
      const dx = (i % 2 ? 1 : -1) * (0.35 + 0.18 * Math.floor(i / 2)) * rx, dl = (2 + (i % 3)) * k;
      P.push({ k: 'ell', x: cx + dx, y: G - 1 * k + dl * 0.3, rx: 1.6 * k, ry: dl * 0.6, d: 1.4 * k, z: 2 * k });
    }
    const body = { x: cx, y: cy, rx, ry };
    const sc = sculpt(px, ox, oy, cell, cell, P, look, { body, crease: 3, trim: style === 'monarca' ? 1 : 0 });
    if (style === 'monarca' && k > 0.75) chain(px, ox, oy, cx - rx * 0.62, cx + rx * 0.62, cy + ry * 0.48, 2 * k);
    if (style === 'loco') {
      const RAMPS = Object.values(GEL);
      const rgbOf = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const map = new Map();
      for (const rp of RAMPS) rp.forEach((h, i) => { if (i >= 2 && i <= 5) map.set(rgbOf(h).join(','), rp[i - 1]); });
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        if (sc.id[y * cell + x] < 0) continue;
        const j = ((oy + y) * px.w + ox + x) * 4, key = px.d[j] + ',' + px.d[j + 1] + ',' + px.d[j + 2];
        const to = map.get(key); if (to) px.set(ox + x, oy + y, to);
      }
    }
    // Barrido de luz (destello que recorre la gelatina).
    if (f.glint >= 0 && f.glint !== undefined) {
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        const i = y * cell + x; if (sc.id[i] < 0) continue;
        const gx = cx + (f.glint - 0.5) * rx * 1.4, gy = cy - ry * 0.55;
        const d = Math.hypot((x - gx) / (3.2 * k), (y - gy) / (2 * k));
        if (d < 1 && y < cy) px.set(ox + x, oy + y, d < 0.45 ? '#ffffff' : ramp[7], d < 0.45 ? 192 : 255);
      }
    }
    // Núcleo de esencia violeta (ritual, invocación).
    const faceY = cy - ry * 0.12, faceX = cx + skew * ry * 0.55;
    if (f.coreGlow || style === 'colosal') {
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
        const d = Math.hypot(x, y) / (5 * k); if (d > 1) continue;
        const xx = Math.round(cx + x * k), yy = Math.round(cy + ry * (style === 'colosal' && !f.coreGlow ? 0.62 : 0.2) + y * k);
        if (sc.id[yy * cell + xx] < 0) continue;
        px.set(ox + xx, oy + yy, d < 0.45 ? '#f4e6ff' : d < 0.75 ? '#c79bff' : '#8a5cf0', 192);
      }
    }
    const avoid = f.noFace ? [] : [{ x: faceX, y: faceY + 4 * k, r: 13 * k }];
    bubbles(px, ox, oy, sc, look, A.fragsOf(spec), Math.round((k > 0.75 ? 11 : 5)), 4, t, avoid, Math.max(0.55, k * 0.85));
    // Brillo grande arriba a la izquierda (gelatina pulida).
    if (style === 'rey' || style === 'loco') {
      const hx = (style === 'loco' ? cx + rx * 0.62 : cx - rx * 0.42) + skew * ry * 0.5, hy = cy - ry * (style === 'loco' ? 0.05 : 0.52);
      for (let y = -4; y <= 4; y++) for (let x = -7; x <= 7; x++) {
        const d = Math.hypot(x / (6 * k), y / (2.6 * k)); if (d > 1) continue;
        const xx = Math.round(hx + x), yy = Math.round(hy + y + x * 0.25);
        if (xx < 0 || yy < 0 || xx >= cell || yy >= cell || sc.id[yy * cell + xx] < 0) continue;
        px.set(ox + xx, oy + yy, d < 0.5 ? '#ffffff' : ramp[7], d < 0.5 ? 192 : 255);
      }
    }
    // Rostro.
    if (!f.noFace && style === 'loco') drawLocoFace(px, ox, oy, Math.round(faceX), Math.round(faceY - (k > 0.75 ? 4 : 2)), f, k);
    else if (!f.noFace) {
      const cols = { pupil: '#141a33' }, ey = Math.round(faceY - (k > 0.75 ? 3 : 1));
      if (k > 0.75) {
        if (style === 'colosal' && !f.eyes) f = { ...f, eyes: 'angry', mouth: f.mouth || 'grit' };
        const kind = f.eyes === 'angry' ? 'normal' : f.eyes === 'sad' ? 'normal' : (f.eyes || 'normal');
        const lx = Math.round(faceX - 11), rxx = Math.round(faceX + 4);
        const royal = style === 'rey' && [undefined, 'normal', 'angry', 'wide', 'blink'].includes(f.eyes);
        if (royal) {
          // Mirada real: ojos rasgados encendidos en violeta y ceño grueso.
          const open = f.eyes === 'blink' ? 0 : 1;
          stampRoyalEye(px, ox + lx - 2, oy + ey - 1, false, open); stampRoyalEye(px, ox + rxx - 1, oy + ey - 1, true, open);
        } else {
          stampEye(px, ox + lx, oy + ey, kind, false, cols);
          stampEye(px, ox + rxx, oy + ey, kind, true, cols);
        }
        // Cejas: furia (hacia el centro) o tristeza (caídas hacia afuera).
        if (!royal && (f.eyes === 'angry' || f.eyes === 'sad')) {
          const down = f.eyes === 'angry' ? 1 : -1;
          for (let i = 0; i < 7; i++) {
            const yy = ey - 2 + Math.round((down > 0 ? i : 6 - i) * 0.4) - (down > 0 ? 0 : 1);
            px.set(ox + lx + i, oy + yy, OUT); px.set(ox + rxx + 6 - i, oy + yy, OUT);
          }
        }
        if (f.tear !== undefined) for (let j = 0; j < 3; j++) px.set(ox + lx + 1, oy + ey + 9 + j + (f.tear || 0), j === 2 ? '#d2f2ff' : '#7cc8ff', 192);
        if (f.blush) for (const bx of [lx - 2, rxx + 6]) { px.set(ox + bx, oy + ey + 8, "#ff9ac8"); px.set(ox + bx + 1, oy + ey + 8, "#ff9ac8"); px.set(ox + bx + 2, oy + ey + 8, "#ffc6e2"); }
        drawMouth(px, ox + Math.round(faceX), oy + Math.round(ey + (royal ? 9 : 10)), f.mouth || (style === 'rey' ? 'serio' : 'smile'), false);
      } else {
        const lx = Math.round(faceX - 6), rxx = Math.round(faceX + 2);
        const kind = ['blink', 'closed', 'happy', 'hurt'].includes(f.eyes) ? 'blink' : 'small';
        stampEye(px, ox + lx, oy + ey, kind === 'blink' ? 'closed' : 'small', false, cols);
        stampEye(px, ox + rxx, oy + ey, kind === 'blink' ? 'closed' : 'small', true, cols);
        drawMouth(px, ox + Math.round(faceX), oy + Math.round(ey + 5), f.mouth || 'smile', true);
      }
    }
    // Luz de borde celeste (como la referencia) en el lado derecho e inferior.
    if (style === 'loco' && k > 0.75) {
      for (let y = 1; y < cell - 1; y++) for (let x = 1; x < cell - 1; x++) {
        const i = y * cell + x; if (sc.id[i] < 0) continue;
        const edgeR = sc.id[i + 1] < 0, edgeL = sc.id[i - 1] < 0, edgeB = sc.id[i + cell] < 0;
        if (edgeR) px.set(ox + x - 1, oy + y, y < cy ? '#bff6ff' : '#5fe3ff');
        else if (edgeL && y > cy - ry * 0.3) px.set(ox + x + 1, oy + y, '#3fc8f0');
        else if (edgeB && y < G) px.set(ox + x, oy + y - 1, '#4fdcff');
      }
    }
    // Charco bajo el cuerpo.
    puddle(px, ox, oy, cx, G + 0.5 * k, rx * 1.25, 2.6 * k, look);
    if (style === 'loco' && k > 0.75) {
      // Salpicaduras a los lados de la base.
      [[-1, 0], [1, 0.4]].forEach(([sd, ph]) => {
        for (let i = 0; i < 3; i++) {
          const bx = Math.round(cx + sd * (rx + 2 + i * 2.5) * 1), by = Math.round(G - 2 - i * 2.2 - Math.sin(t * 6.28 + ph + i) * 1);
          px.set(ox + bx, oy + by, i === 0 ? ramp[5] : ramp[6]); if (i < 2) px.set(ox + bx, oy + by + 1, ramp[3]);
          if (i === 2) px.set(ox + bx + sd, oy + by - 1, '#ffffff', 192);
        }
      });
    }
    if ((style === 'rey' || style === 'loco') && k > 0.75) {
      // Aura real violeta pegada a la silueta (brilla sola) y burbujas que flotan alrededor.
      const halo = [];
      for (let y = 1; y < G - 1; y++) for (let x = 1; x < cell - 1; x++) {
        if (px.alpha(ox + x, oy + y)) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sc.id[(y + dy) * cell + x + dx] >= 0);
        if (near) halo.push([x, y]);
      }
      for (const [x, y] of halo) if (bayer(x, y) < 0.55) px.set(ox + x, oy + y, (x + y + Math.floor(t * 8)) % 5 ? '#7a3dff' : '#c79bff', 192);
      for (let i = 0; i < 3; i++) {
        const a = TT + i * 2.1, bx = Math.round(cx + Math.cos(a) * (rx + 4 * k) * (i === 1 ? -1 : 1)), by = Math.round(cy - ry * 0.4 - i * 5 * k - ((t * 6 + i * 3) % 6));
        const r = i === 0 ? 2 : 1.5;
        for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (Math.hypot(xx, yy) <= r && !px.alpha(ox + bx + xx, oy + by + yy)) px.set(ox + bx + xx, oy + by + yy, Math.hypot(xx, yy) > r - 0.8 ? ramp[3] : ramp[5]);
        px.set(ox + bx - 1, oy + by - 1, '#ffffff', 192);
      }
    }
    // Corona con rubí (ladeada, saltando o brillando según la pose).
    if (!f.noCrown) {
      const top = cy - ry * 0.9, ccx = cx + skew * ry * 0.8 + (f.crownDx || 0) * k, ccy = Math.max(10 * k, top - 3 * k + (f.crownDy || 0) * k);
      if (style === 'loco') drawLocoCrownAt(px, ox, oy, Math.round(ccx - 11 * k), Math.round(Math.max(k > 0.75 ? 19 : 10, ccy - 1 * k)), (f.crownAng || 0) - 0.42, k > 0.75 ? 1 : 0.38);
      else if (style === 'rey') px.blitRot(royalCrown(spec, k > 0.75 ? 1 : 0.42), 0, 0, 40, 34, ox + Math.round(ccx), oy + Math.round(ccy - 8 * k), f.crownAng || 0);
      else stampCrown(px, spec, ox + Math.round(ccx), oy + Math.round(ccy), f.crownAng || 0, k > 0.75 ? 1 : 0.6);
      if (f.crownGlow) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; px.set(ox + Math.round(ccx + Math.cos(a) * 15 * k), oy + Math.round(ccy + Math.sin(a) * 9 * k), '#fff4c4', 192); }
    }
  }

  root.TMReyFormas = Object.freeze({ drawKingI,  BEAST, TITAN, SCALE, GEL, BUBBLE, CAPE, ERMINE, MOUTH, sculpt, drawBeast, drawTitan, drawMorphI_II, beastParts, titanParts });
})(typeof window !== 'undefined' ? window : globalThis);
