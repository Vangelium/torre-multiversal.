/* Torre Multiversal · Rey Slime · arte pixelado procedural (v2 · 13-11-2026)
 *
 * Todo se dibuja píxel a píxel con la MISMA paleta del motor (paleta S de
 * game.js), así el Rey, el santuario y los efectos encajan con el resto del
 * valle. Nada se descarga: cada hoja se genera una vez y se guarda en caché.
 *
 * Convenciones del motor que se respetan:
 *  - 16 píxeles = 1 unidad del mundo.
 *  - Alfa 255 = píxel normal (recibe luz del día y de la noche).
 *  - Alfa 192 = píxel que brilla solo (ojos, gemas, runas): el shader no lo
 *    oscurece de noche.
 */
(function (root) {
  'use strict';

  // ── Paleta oficial (copiada de game.js · S) ──────────────────────────────
  const PAL = Object.freeze({
    outline: '#1d1712', white: '#fffdf4',
    verde: ['#163f1c', '#24652c', '#36913b', '#58b84d', '#8ddb6a', '#c9f59b'],
    azul: ['#14254f', '#1f3f80', '#2d5fb3', '#4485d6', '#72b0ee', '#b7dcfb'],
    rosa: ['#4a1430', '#7a2150', '#ad3474', '#d4589a', '#f08cc0', '#ffc6e2'],
    gold: ['#3a1f0a', '#6e3f12', '#a8661c', '#d48a26', '#efb43a', '#ffe17a', '#fff4c4'],
    ruin: ['#1f1e26', '#302f3a', '#45444f', '#5d5c66', '#78767d', '#959196', '#b3aeaf', '#d2ccc8', '#ece8e1'],
    stone: ['#22232a', '#353843', '#4b505d', '#656c7b', '#838b9b', '#a6adbb', '#cbd1dc', '#eef1f5'],
    grass: ['#16391f', '#1f5229', '#2b6e30', '#3d8c38', '#59aa42', '#82c552', '#b2df70', '#dcf29a'],
    rune: ['#2b1550', '#5a2fa0', '#9b6bff', '#d9c2ff'],
    flame: ['#8a2d14', '#d0581a', '#f3922a', '#ffc54d', '#fff2b8'],
    ember: '#e0585c', ruby: ['#5a0f1c', '#9c1f30', '#e0585c', '#ffb3b8'],
    mouth: ['#24060f', '#4a1022', '#c4466e', '#f08cc0']
  });
  const HUES = ['verde', 'azul', 'rosa'];

  const rgbCache = new Map();
  function rgb(hex) {
    let c = rgbCache.get(hex);
    if (!c) {
      const n = parseInt(hex.slice(1), 16);
      c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, c);
    }
    return c;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  // ── Lienzo de píxeles ────────────────────────────────────────────────────
  class Px {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
    set(x, y, hex, a = 255) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || !hex) return;
      const c = typeof hex === 'string' ? rgb(hex) : hex, i = (y * this.w + x) * 4;
      this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
    }
    alpha(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
    clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[(y * this.w + x) * 4 + 3] = 0; }
    rect(x, y, w, h, hex, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex, a); }
    disc(cx, cy, r, hex, a = 255) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, hex, a);
    }
    // Contorno exterior de 1 píxel en una región (selout: color según el lado).
    outline(x0, y0, w, h, pick) {
      const mark = [];
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        if (this.alpha(x, y)) continue;
        const l = this.alpha(x - 1, y), r = this.alpha(x + 1, y), u = this.alpha(x, y - 1), d = this.alpha(x, y + 1);
        if (l || r || u || d) mark.push([x, y, u ? 'down' : d ? 'up' : 'side']);
      }
      for (const [x, y, side] of mark) this.set(x, y, pick(side, x, y));
    }
    blitRot(src, sx, sy, sw, sh, cx, cy, ang) {
      // Copia con rotación por vecino más cercano (sin mezclar colores).
      const c = Math.cos(-ang), s = Math.sin(-ang), R = Math.ceil(Math.hypot(sw, sh) / 2) + 1;
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
        const u = Math.round(c * x - s * y + sw / 2 - 0.5), v = Math.round(s * x + c * y + sh / 2 - 0.5);
        if (u < 0 || v < 0 || u >= sw || v >= sh) continue;
        const i = ((sy + v) * src.w + sx + u) * 4;
        if (!src.d[i + 3]) continue;
        const tx = Math.round(cx + x), ty = Math.round(cy + y);
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        const o = (ty * this.w + tx) * 4;
        this.d[o] = src.d[i]; this.d[o + 1] = src.d[i + 1]; this.d[o + 2] = src.d[i + 2]; this.d[o + 3] = src.d[i + 3];
      }
    }
    canvas() {
      const c = root.document.createElement('canvas');
      c.width = this.w; c.height = this.h;
      c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
      return c;
    }
  }

  // ── Corona ───────────────────────────────────────────────────────────────
  // 24×16 px. Gemas: rubí central + gemas del color de cada tipo de limo que
  // participó en el ritual (la corona «recuerda» a los diez fragmentos).
  function drawCrown(gems, glint, glow) {
    const c = new Px(24, 16), G = PAL.gold;
    const tips = [[2, 6], [7, 3], [12, 0], [17, 3], [22, 6]];
    // Puntas (triángulos) y esferas.
    for (const [tx, ty] of tips) {
      for (let y = ty + 2; y <= 10; y++) {
        const half = Math.floor((y - ty - 2) * 0.55);
        for (let x = tx - half; x <= tx + half; x++) c.set(x, y, x <= tx ? G[4] : G[3]);
      }
      c.set(tx, ty + 1, G[5]); c.set(tx - 1, ty + 1, G[4]); c.set(tx + 1, ty + 1, G[3]);
      c.set(tx, ty, G[6], glow ? 192 : 255);
    }
    // Aro.
    for (let y = 10; y <= 14; y++) for (let x = 1; x <= 22; x++) c.set(x, y, y === 10 ? G[5] : y === 14 ? G[2] : y === 13 ? G[3] : G[4]);
    for (let x = 1; x <= 22; x += 2) c.set(x, 12, G[3]);
    // Gemas.
    const gemAt = (x, pal) => {
      c.set(x, 11, pal[3], 192); c.set(x + 1, 11, pal[2]); c.set(x, 12, pal[2]); c.set(x + 1, 12, pal[1]);
    };
    gemAt(11, PAL.ruby);
    const side = gems.length ? gems : ['verde'];
    const slots = [4, 18, 7, 15];
    side.slice(0, 4).forEach((h, i) => {
      const p = PAL[h] || PAL.verde;
      gemAt(slots[i], [p[0], p[2], p[4], p[5]]);
    });
    c.outline(0, 0, 24, 16, side2 => (side2 === 'up' ? G[1] : G[0]));
    if (glint >= 0) {
      const gx = 2 + Math.round(glint * 19);
      for (let y = 10; y <= 14; y++) if (c.alpha(gx + (y - 10) % 2, y)) c.set(gx + ((y - 10) % 2), y, G[6], 192);
    }
    return c;
  }

  // ── Cuerpo del Rey ───────────────────────────────────────────────────────
  // El cuerpo se REDIBUJA en cada cuadro (no se estira la imagen), así el
  // contorno, el brillo y las burbujas mantienen el píxel nítido.
  // Apariencia por mezcla: dominante, híbrido (empate de los dos primeros) y
  // vetas de los colores secundarios. Coincide con colorsOf de rey-slime.js.
  function lookOf(mix, hue) {
    const m = Array.isArray(mix) && mix.length === 3 ? mix.map(n => Math.max(0, n | 0)) : HUES.map(h => (h === hue ? 10 : 0));
    const order = [0, 1, 2].sort((a, b) => m[b] - m[a] || a - b);
    const hybrid = m[order[0]] > 0 && m[order[0]] === m[order[1]] ? [HUES[order[0]], HUES[order[1]]] : null;
    const veins = order.slice(hybrid ? 2 : 1).filter(i => m[i] > 0).map(i => ({ hue: HUES[i], n: m[i] }));
    return { hue: HUES[order[0]], hybrid, veins };
  }
  // Color de un píxel del cuerpo según la apariencia.
  function colorAt(look, x, y, idx, cx, rx, eq, ry, ox, oy, pal) {
    let p = pal;
    if (look.hybrid) {
      // Mitad y mitad, con una costura ondulada y tramada.
      const t = (x + 0.5 - cx) / rx + Math.sin((y - oy) * 0.32) * 0.12 + (bayer(x, y) - 0.5) * 0.18;
      p = PAL[t < 0 ? look.hybrid[0] : look.hybrid[1]];
    }
    let col = p[idx];
    if (idx >= 2 && look.veins.length) {
      // Vetas finas en diagonal; más vetas cuantos más limos de ese color.
      const t = (x - ox) * 0.6 + (y - oy) * 0.9 + Math.sin((x - ox) * 0.25) * 2;
      look.veins.forEach((v, i) => {
        const period = 17 - Math.min(8, v.n), band = Math.floor(t / 2.2 + i * 3.7) % period;
        if (band === 0 || (band === 1 && bayer(x, y) < 0.35)) col = PAL[v.hue][Math.min(5, idx + 1)];
      });
    }
    return col;
  }
  function paletteFor(spec) {
    if (spec.look) return PAL[spec.look.hybrid ? spec.look.hybrid[0] : spec.look.hue] || PAL.verde;
    const base = PAL[spec.hue] || PAL.verde;
    return base;
  }

  function drawBody(px, ox, oy, cell, spec, f) {
    const S = cell / 64;                      // 64 = tamaño del Rey; 32 = aliado
    const pal = paletteFor(spec);
    const ground = oy + cell - Math.round(3 * S);
    const sx = f.sx || 1, sy = f.sy || 1, skew = f.skew || 0;
    const rx = 22 * S * sx, ryTop = 28 * S * sy, ryBot = 8 * S * sy;
    const cx = ox + cell / 2 + (f.dx || 0) * S;
    const eq = ground - ryBot;
    const L = [-0.52, -0.72, 0.46];
    const inside = (x, y) => {
      const sk = skew * (ground - y);
      const nx = (x + 0.5 - cx - sk) / rx;
      if (y + 0.5 > ground) return null;
      if (y + 0.5 < eq) {
        const ny = (y + 0.5 - eq) / ryTop;
        const q = nx * nx + ny * ny;
        if (q > 1) return null;
        const nz = Math.sqrt(Math.max(0, 1 - q));
        return { nx, ny, nz, top: true, q };
      }
      const ny = (y + 0.5 - eq) / ryBot;
      const q = Math.pow(Math.abs(nx), 2.6) + Math.pow(Math.abs(ny), 3.2);
      if (q > 1) return null;
      return { nx, ny: ny * 0.45, nz: Math.sqrt(Math.max(0.05, 1 - nx * nx)) * 0.8, top: false, q };
    };
    const y0 = Math.floor(eq - ryTop) - 1, y1 = Math.ceil(ground) + 1;
    const x0 = Math.floor(cx - rx - Math.abs(skew) * (ground - y0)) - 2, x1 = Math.ceil(cx + rx + Math.abs(skew) * (ground - y0)) + 2;
    const look = spec.look || lookOf(spec.mix, spec.hue);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = inside(x, y);
      if (!p) continue;
      const len = Math.hypot(p.nx, p.ny, p.nz) || 1;
      let diff = (p.nx * L[0] + p.ny * L[1] + p.nz * L[2]) / len;
      // Luz de rebote abajo a la derecha (volumen) y oscurecimiento del borde.
      const bounce = Math.max(0, p.nx * 0.55 + p.ny * 0.6) * 0.35;
      let v = 0.42 + diff * 0.48 + bounce * 0.4 - Math.pow(p.q, 3) * 0.22;
      // Translucidez: interior un poco más profundo.
      if (p.top && p.q < 0.55 && p.ny > -0.55) v -= 0.07;
      let idx = Math.floor(v * 5.2 + (bayer(x, y) - 0.5) * 0.55);
      idx = clamp(idx, 1, 5);
      const col = colorAt(look, x, y, idx, cx, rx, eq, ryTop, ox, oy, pal);
      px.set(x, y, col);
    }
    return { cx, eq, ground, rx, ryTop, ryBot, inside, pal, S };
  }

  function specular(px, b, f) {
    // Brillo húmedo arriba a la izquierda + reflejo de «ventana».
    const { cx, eq, rx, ryTop, S } = b;
    const hx = cx - rx * 0.45 + (f.skew || 0) * ryTop * 0.6, hy = eq - ryTop * 0.62;
    const hr = Math.max(1.5, 5.5 * S * (f.sx || 1));
    for (let y = Math.floor(hy - hr); y <= hy + hr; y++) for (let x = Math.floor(hx - hr * 1.4); x <= hx + hr * 1.4; x++) {
      const d = ((x + 0.5 - hx) / (hr * 1.4)) ** 2 + ((y + 0.5 - hy) / hr) ** 2;
      if (d > 1 || !px.alpha(x, y)) continue;
      if (d < 0.32) px.set(x, y, PAL.white);
      else if (d < 0.75 && bayer(x, y) > 0.35) px.set(x, y, b.pal[5]);
    }
    const wx = Math.round(cx + rx * 0.42), wy = Math.round(eq - ryTop * 0.5);
    if (S > 0.7) {
      px.set(wx, wy, b.pal[5]); px.set(wx + 1, wy, b.pal[5]); px.set(wx, wy + 1, b.pal[5]);
      px.set(wx + 2, wy + 3, b.pal[4]);
    }
  }

  function bubbles(px, b, spec, f) {
    // Diez burbujas: una por cada limo fusionado, con su color.
    const frags = spec.frags && spec.frags.length ? spec.frags : Array(10).fill(spec.hue);
    const t = f.t || 0, { cx, eq, rx, ryTop, S } = b;
    if (S < 0.7) return;
    frags.slice(0, 10).forEach((h, i) => {
      const ang = i * 2.399 + t * (0.9 + (i % 3) * 0.25) * Math.PI * 2 / 4;
      const rr = 0.25 + ((i * 37) % 10) / 10 * 0.5;
      const x = Math.round(cx + Math.cos(ang) * rx * (0.3 + rr * 0.6));
      const y = Math.round(eq + 1 + Math.sin(ang) * 4 * S - ((i * 7) % 4));
      const p = PAL[h] || PAL.verde;
      if (!px.alpha(x - 1, y - 1) || !px.alpha(x + 2, y + 2)) return;
      const r = i % 3 === 0 ? 2 : 1;
      const em = f.coreGlow ? 192 : 255;
      if (r === 2) {
        px.set(x, y, p[4], em); px.set(x + 1, y, p[3], em); px.set(x, y + 1, p[3], em); px.set(x + 1, y + 1, p[2], em);
        px.set(x - 1, y, p[2], em); px.set(x + 2, y, p[2], em); px.set(x, y - 1, p[2], em); px.set(x + 1, y + 2, p[1], em);
        px.set(x, y, p[5], em);
      } else { px.set(x, y, p[4], em); px.set(x + 1, y, p[2], em); px.set(x, y + 1, p[2], em); }
    });
  }

  function core(px, b, f) {
    // Núcleo real en forma de corazón, apenas visible a través de la gelatina.
    const { cx, eq, ryTop, S, pal } = b;
    if (S < 0.7) return;
    const x0 = Math.round(cx) - 3, y0 = Math.round(eq - ryTop * 0.05);
    const heart = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    const em = f.coreGlow ? 192 : 255;
    heart.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#' || !px.alpha(x0 + i, y0 + j)) return;
      const edge = j === 0 || i === 0 || i === 6 || heart[j][i - 1] !== '#' || heart[j][i + 1] !== '#';
      px.set(x0 + i, y0 + j, f.coreGlow ? (edge ? pal[4] : pal[5]) : (edge ? pal[1] : pal[2]), em);
    }));
    if (f.coreGlow) px.set(x0 + 1, y0, PAL.white, 192);
  }

  function face(px, b, f) {
    const { cx, eq, ryTop, S, pal } = b;
    const sk = (f.skew || 0) * ryTop * 0.55;
    const fx = Math.round(cx + sk + (f.look || 0) * 2 * S), fy = Math.round(eq - ryTop * 0.34);
    const sp = Math.max(3, Math.round(7.5 * S * (f.sx || 1)));
    const O = PAL.outline, W = PAL.white;
    const big = S > 0.7;
    const eye = (x, flip) => {
      switch (f.eyes) {
        case 'blink':
          px.set(x - 1, fy + 1, O); px.set(x, fy + 2, O); px.set(x + 1, fy + 2, O); px.set(x + 2, fy + 1, O);
          break;
        case 'closed':
          px.set(x - 1, fy + 2, O); px.set(x, fy + 2, O); px.set(x + 1, fy + 2, O); px.set(x + 2, fy + 2, O);
          break;
        case 'angry': {
          px.rect(x - 1, fy, big ? 5 : 4, big ? 5 : 3, O);
          px.set(x - 1 + (flip ? 2 : 0), fy, W, 192);
          // Ceja inclinada hacia el centro.
          for (let i = 0; i < 4; i++) px.set(x - 1 + i, fy - 2 + (flip ? 3 - i : i) * 0.5 | 0, O);
          if (big) px.set(x + (flip ? 0 : 1), fy + 2, PAL.ruby[2], 192);
          break;
        }
        case 'wide':
          px.rect(x - 1, fy - 2, big ? 5 : 3, big ? 8 : 4, O);
          px.set(x, fy - 1, W, 192); px.set(x + 1, fy - 1, W, 192); px.set(x, fy, W, 192); px.set(x + 1, fy, W, 192);
          if (big) px.set(x + 2, fy + 4, W, 192);
          break;
        case 'hurt':
          if (flip) { px.set(x + 2, fy, O); px.set(x + 1, fy + 1, O); px.set(x, fy + 2, O); px.set(x + 1, fy + 3, O); px.set(x + 2, fy + 4, O); }
          else { px.set(x - 1, fy, O); px.set(x, fy + 1, O); px.set(x + 1, fy + 2, O); px.set(x, fy + 3, O); px.set(x - 1, fy + 4, O); }
          break;
        case 'dazed': {
          const ring = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1], [1, 1]];
          const k = f.spin || 0;
          ring.forEach(([dx, dy], i) => px.set(x - 1 + dx, fy + dy, (i + k) % 3 === 0 ? W : O, (i + k) % 3 === 0 ? 192 : 255));
          break;
        }
        case 'sad':
          px.rect(x - 1, fy + 1, 4, 3, O);
          px.set(x + (flip ? 1 : 0), fy + 1, W, 192);
          for (let i = 0; i < 4; i++) px.set(x - 1 + i, fy - 1 - ((flip ? i : 3 - i) * 0.5 | 0), O);
          if (f.tear !== undefined) { const ty = fy + 4 + f.tear; px.set(x + (flip ? 2 : -1), ty, PAL.azul[5], 192); px.set(x + (flip ? 2 : -1), ty + 1, PAL.azul[4], 192); }
          break;
        case 'happy':
          px.set(x - 1, fy + 2, O); px.set(x, fy + 1, O); px.set(x + 1, fy + 1, O); px.set(x + 2, fy + 2, O);
          break;
        default:
          if (big) {
            px.rect(x - 1, fy - 1, 5, 7, O); px.set(x - 1, fy - 1, pal[1]); px.set(x + 3, fy - 1, pal[1]);
            px.set(x - 1, fy + 5, pal[1]); px.set(x + 3, fy + 5, pal[1]);
            px.set(x, fy, W, 192); px.set(x + 1, fy, W, 192); px.set(x, fy + 1, W, 192); px.set(x + 1, fy + 1, W, 192);
            px.set(x + 2, fy + 4, pal[4], 192);
            // Ceja real, serena.
            for (let i = 0; i < 4; i++) px.set(x - 1 + i + (flip ? 1 : 0), fy - 3 + ((flip ? i : 3 - i) > 2 ? 1 : 0), pal[0]);
          } else {
            px.rect(x - 1, fy, 3, 4, O); px.set(x - 1, fy, W, 192);
          }
      }
    };
    eye(fx - sp - 1, false);
    eye(fx + sp - 1, true);
    // Boca.
    const my = fy + (big ? 7 : 5), mx = fx;
    const M = PAL.mouth;
    switch (f.mouth) {
      case 'roar': {
        const w = Math.round(6 * S * (f.sx || 1)), h = Math.round(5 * S);
        for (let y = -h; y <= h; y++) for (let x = -w; x <= w; x++) {
          if ((x / w) ** 2 + (y / h) ** 2 > 1) continue;
          px.set(mx + x, my + y + 1, y > h * 0.35 ? M[2] : y > 0 ? M[1] : M[0]);
        }
        for (let x = -w + 1; x < w; x++) px.set(mx + x, my - h, O);
        if (big) { px.set(mx - 2, my - h + 1, W); px.set(mx + 2, my - h + 1, W); }
        break;
      }
      case 'o':
        px.rect(mx - 1, my, 3, 3, M[0]); px.set(mx, my + 1, M[1]);
        break;
      case 'flat':
        for (let x = -2; x <= 2; x++) px.set(mx + x, my + 1, O);
        break;
      case 'frown':
        px.set(mx - 2, my + 2, O); px.set(mx - 1, my + 1, O); px.set(mx, my + 1, O); px.set(mx + 1, my + 1, O); px.set(mx + 2, my + 2, O);
        break;
      case 'wavy':
        for (let x = -3; x <= 3; x++) px.set(mx + x, my + 1 + (x & 1), O);
        break;
      case 'grit':
        px.rect(mx - 3, my, 7, 3, O);
        for (let x = -2; x <= 2; x += 2) px.set(mx + x, my + 1, W);
        break;
      default:
        if (big) {
          px.set(mx - 3, my, O); px.set(mx - 2, my + 1, O); px.set(mx - 1, my + 1, M[1]); px.set(mx, my + 1, M[2]); px.set(mx + 1, my + 1, M[1]); px.set(mx + 2, my + 1, O); px.set(mx + 3, my, O);
          px.set(mx - 1, my + 2, O); px.set(mx, my + 2, O); px.set(mx + 1, my + 2, O);
        } else { px.set(mx - 2, my, O); px.set(mx - 1, my + 1, O); px.set(mx, my + 1, M[2]); px.set(mx + 1, my + 1, O); px.set(mx + 2, my, O); }
    }
    if (f.blush) {
      const by = fy + (big ? 5 : 3);
      [fx - sp - 3, fx + sp + 1].forEach(bx => { px.set(bx, by, PAL.rosa[4]); px.set(bx + 1, by, PAL.rosa[3]); });
    }
  }

  function drawFrame(px, ox, oy, cell, spec, f) {
    if (f.puddle !== undefined) return drawPuddle(px, ox, oy, cell, spec, f);
    const b = drawBody(px, ox, oy, cell, spec, f);
    bubbles(px, b, spec, f);
    specular(px, b, f);
    if (!f.noFace) face(px, b, f);
    // Contorno selectivo: más claro arriba (lado iluminado), oscuro abajo.
    px.outline(ox, oy, cell, cell, (side) => (side === 'up' ? b.pal[1] : b.pal[0]));
    // Gotas que caen del cuerpo (ataque / daño).
    if (f.drips) for (let i = 0; i < f.drips; i++) {
      const x = Math.round(b.cx + (i - f.drips / 2) * 9 * b.S), y = Math.round(b.ground - 2 - (i % 2));
      px.set(x, y, b.pal[3]); px.set(x, y + 1, b.pal[2]);
    }
    if (!f.noCrown) {
      const crown = drawCrown(spec.gems || [spec.hue], f.glint === undefined ? -1 : f.glint, !!f.crownGlow);
      const topY = b.eq - b.ryTop;
      const sk = (f.skew || 0) * (b.ground - topY);
      const scx = b.cx + sk + (f.crownDx || 0) * b.S;
      const scy = topY + (f.crownDy || 0) * b.S + 1 * b.S;
      if (b.S >= 0.7) px.blitRot(crown, 0, 0, 24, 16, scx, scy - 5, f.crownAng || 0);
      else {
        // Corona pequeña del aliado: 12×8 px.
        const small = new Px(12, 8);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
          const i = ((y * 2) * 24 + x * 2) * 4;
          if (crown.d[i + 3]) small.set(x, y, [crown.d[i], crown.d[i + 1], crown.d[i + 2]], crown.d[i + 3]);
        }
        px.blitRot(small, 0, 0, 12, 8, scx, scy - 3, f.crownAng || 0);
      }
      if (f.crownGlow && b.S >= 0.7) {
        for (let a = 0; a < 16; a++) {
          const ang = a / 16 * Math.PI * 2;
          const gx = Math.round(scx + Math.cos(ang) * 15), gy = Math.round(scy - 6 + Math.sin(ang) * 10);
          if (!px.alpha(gx, gy) && (a + (f.glowStep || 0)) % 2 === 0) px.set(gx, gy, PAL.gold[5], 192);
        }
      }
    }
  }

  function drawPuddle(px, ox, oy, cell, spec, f) {
    const pal = paletteFor(spec), S = cell / 64;
    const ground = oy + cell - Math.round(3 * S), cx = ox + cell / 2;
    const rx = 28 * S * f.puddle, ry = 5 * S * (0.6 + f.puddle * 0.4);
    for (let y = Math.floor(ground - ry * 2); y <= ground; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - ground) / (ry * 2);
      if (nx * nx + ny * ny > 1) continue;
      const idx = clamp(Math.floor(2.2 - ny * 2.4 + (bayer(x, y) - 0.5) * 0.6 - nx * 0.6), 1, 5);
      px.set(x, y, pal[idx]);
    }
    for (let i = 0; i < 4; i++) {
      const x = Math.round(cx - rx * 0.6 + i * rx * 0.4), y = Math.round(ground - ry * 0.9 - (i % 2));
      if (px.alpha(x, y)) px.set(x, y, pal[5]);
    }
    if (f.eyes) face(px, { cx, eq: ground - ry, ryTop: 6 * S, S: S * 0.8, pal }, { eyes: f.eyes, mouth: 'wavy', sx: 1 });
    px.outline(ox, oy, cell, cell, (side) => (side === 'up' ? pal[1] : pal[0]));
  }

  // Cuadros de la hoja del Rey (8 columnas × 3 filas).
  const KING_FRAMES = Object.freeze([
    { id: 'idle0', sx: 1.0, sy: 1.0, t: 0.0, glint: -1 },
    { id: 'idle1', sx: 1.025, sy: 0.975, t: 0.25, glint: -1 },
    { id: 'idle2', sx: 1.05, sy: 0.955, t: 0.5, glint: 0.2 },
    { id: 'idle3', sx: 1.025, sy: 0.975, t: 0.75, glint: 0.7 },
    { id: 'blink', sx: 1.025, sy: 0.975, t: 0.3, eyes: 'blink' },
    // Respiración extendida (8 cuadros en total): las burbujas suben y la masa se mece.
    { id: 'idle4', sx: 1.012, sy: 0.988, t: 0.125, glint: -1 },
    { id: 'idle5', sx: 1.038, sy: 0.965, t: 0.375, glint: -1 },
    { id: 'idle6', sx: 1.038, sy: 0.965, t: 0.625, glint: 0.45 },
    { id: 'idle7', sx: 1.012, sy: 0.988, t: 0.875, glint: -1 },
    { id: 'hopCrouch', sx: 1.14, sy: 0.82, t: 0.4, crownDy: 2 },
    { id: 'hopAir', sx: 0.9, sy: 1.12, t: 0.5, crownDy: -2, mouth: 'o' },
    { id: 'hopLand', sx: 1.2, sy: 0.8, t: 0.6, crownDy: 2, drips: 2 },
    { id: 'windup', sx: 1.18, sy: 0.82, t: 0.1, eyes: 'angry', mouth: 'grit', crownDy: 2, crownAng: -0.08 },
    { id: 'charge', sx: 1.08, sy: 0.9, t: 0.2, skew: 0.28, eyes: 'angry', mouth: 'roar', crownAng: 0.18, crownDx: 3, drips: 3 },
    { id: 'slamCrouch', sx: 1.27, sy: 0.72, t: 0.3, eyes: 'angry', mouth: 'grit', crownDy: 3 },
    { id: 'slamAir', sx: 0.84, sy: 1.22, t: 0.4, eyes: 'wide', mouth: 'o', crownDy: -4 },
    { id: 'slamLand', sx: 1.38, sy: 0.6, t: 0.5, eyes: 'hurt', mouth: 'flat', crownDy: 4, crownAng: 0.1, drips: 4 },
    { id: 'dazed0', sx: 1.06, sy: 0.93, t: 0.6, eyes: 'dazed', spin: 0, mouth: 'wavy', crownAng: -0.22, crownDy: 2 },
    { id: 'dazed1', sx: 1.0, sy: 0.97, t: 0.7, eyes: 'dazed', spin: 1, mouth: 'wavy', crownAng: 0.16, crownDy: 1 },
    { id: 'roar', sx: 1.1, sy: 1.05, t: 0.8, eyes: 'angry', mouth: 'roar', crownDy: -3, glint: 0.5 },
    { id: 'hurt', sx: 0.95, sy: 1.04, t: 0.9, eyes: 'hurt', mouth: 'o', crownDy: -2, crownAng: -0.1 },
    { id: 'summon', sx: 1.12, sy: 1.08, t: 0.15, eyes: 'wide', mouth: 'roar', crownGlow: true, coreGlow: true, crownDy: -5 },
    { id: 'death0', sx: 1.18, sy: 0.82, t: 0.35, eyes: 'dazed', spin: 2, mouth: 'wavy', noCrown: true, drips: 4 },
    { id: 'death1', sx: 1.34, sy: 0.56, t: 0.45, eyes: 'closed', mouth: 'wavy', noCrown: true, drips: 5 },
    { id: 'death2', puddle: 0.95, eyes: 'closed' },
    { id: 'defeated0', sx: 1.12, sy: 0.86, t: 0.55, eyes: 'sad', tear: 0, mouth: 'frown', crownAng: 0.38, crownDy: 3, crownDx: 4 },
    { id: 'defeated1', sx: 1.15, sy: 0.83, t: 0.6, eyes: 'sad', tear: 2, mouth: 'frown', crownAng: 0.42, crownDy: 4, crownDx: 4 },
    { id: 'happy', sx: 1.0, sy: 1.0, t: 0.2, eyes: 'happy', mouth: 'smile', blush: true, glint: 0.45 },
    // Masa sin rostro ni corona (fusión de los diez limos).
    { id: 'mass0', sx: 1.0, sy: 0.9, t: 0.0, noFace: true, noCrown: true, coreGlow: true },
    { id: 'mass1', sx: 1.1, sy: 0.82, t: 0.3, noFace: true, noCrown: true, coreGlow: true, skew: 0.08 },
    { id: 'mass2', sx: 0.94, sy: 1.02, t: 0.6, noFace: true, noCrown: true, coreGlow: true },
    { id: 'mass3', sx: 1.06, sy: 0.86, t: 0.9, noFace: true, noCrown: true, coreGlow: true, skew: -0.08 }
  ]);
  const FRAME_INDEX = Object.freeze(Object.fromEntries(KING_FRAMES.map((f, i) => [f.id, i])));

  function gemsOf(spec) {
    const mix = spec.mix || [10, 0, 0];
    return HUES.map((h, i) => [h, mix[i]]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  function fragsOf(spec) {
    if (Array.isArray(spec.frags) && spec.frags.length) return spec.frags;
    const mix = spec.mix || [10, 0, 0], out = [];
    HUES.forEach((h, i) => { for (let k = 0; k < mix[i]; k++) out.push(h); });
    return out;
  }

  const sheetCache = new Map();
  function kingSheet(spec, cell = 64) {
    const key = [spec.hue, (spec.mix || []).join(','), cell].join('|');
    let s = sheetCache.get(key);
    if (s) return s;
    const look = lookOf(spec.mix, spec.hue);
    const full = { hue: look.hue, mix: spec.mix, look, gems: gemsOf(spec), frags: fragsOf(spec) };
    const cols = 8, rows = Math.ceil(KING_FRAMES.length / cols);
    const px = new Px(cols * cell, rows * cell);
    // Forma I v2: se esculpe con el mismo motor de las Formas II y III (rey-formas.js).
    const F = root.TMReyFormas;
    KING_FRAMES.forEach((f, i) => {
      if (F && F.drawKingI) F.drawKingI(px, (i % cols) * cell, Math.floor(i / cols) * cell, cell, spec, f);
      else drawFrame(px, (i % cols) * cell, Math.floor(i / cols) * cell, cell, full, f);
    });
    s = { canvas: px.canvas(), cols, rows, cell, frames: FRAME_INDEX };
    sheetCache.set(key, s);
    return s;
  }

  // Corona suelta (para cuando cae del cielo o sale volando): 4 giros.
  function crownSheet(spec) {
    const key = 'crown|' + (spec.mix || []).join(',');
    let s = sheetCache.get(key);
    if (s) return s;
    const px = new Px(32 * 4, 32);
    const crown = drawCrown(gemsOf(spec), 0.5, true);
    [0, 0.6, Math.PI, -0.6].forEach((a, i) => {
      if (i === 2) {
        // De canto: aplanada.
        for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
          const j = (y * 24 + x) * 4; if (!crown.d[j + 3]) continue;
          const tx = i * 32 + 4 + x, ty = 8 + Math.round(y * 0.5) + 4;
          px.set(tx, ty, [crown.d[j], crown.d[j + 1], crown.d[j + 2]], crown.d[j + 3]);
        }
      } else px.blitRot(crown, 0, 0, 24, 16, i * 32 + 16, 16, a);
    });
    s = { canvas: px.canvas(), frames: 4 };
    sheetCache.set(key, s);
    return s;
  }

  // ── Santuario ────────────────────────────────────────────────────────────
  // Plataforma circular de piedra antigua con musgo, anillo de runas, diez
  // canales tallados hacia el sello central. 192×192 px = 12×12 unidades.
  const PLATFORM = Object.freeze({ size: 232, ring: 4.4 });
  function platform() {
    if (sheetCache.has('platform')) return sheetCache.get('platform');
    const N = PLATFORM.size, px = new Px(N, N), c = N / 2, R = PLATFORM.ring * 16;
    const S = PAL.ruin, M = PAL.grass;
    const noise = (x, y) => {
      let h = (x * 374761393 + y * 668265263) | 0;
      h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
    const hash = (a, b) => { let h = (a * 73856093 ^ b * 19349663) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const smooth = (x, y, sc) => {
      const fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const a = noise(ix, iy), b = noise(ix + 1, iy), c2 = noise(ix, iy + 1), d = noise(ix + 1, iy + 1);
      const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
      return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
    };
    const TAU = Math.PI * 2;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) + Math.PI;
      if (r > c - 2) continue;
      const n = noise(x, y), moss = smooth(x, y, 9) * 0.65 + smooth(x + 40, y + 17, 4) * 0.35;
      // Borde irregular que se funde con la hierba.
      if (r > c - 12 && smooth(x, y, 5) + (r - (c - 12)) / 9 > 1.05) continue;
      let idx, col = null;
      if (r > R + 8) {
        // Anillo exterior: dos hileras de losas grandes.
        const outer = r > R + 22, count = outer ? 34 : 26;
        const fa = a / TAU * count + (outer ? 0.5 : 0), seg = Math.floor(fa);
        const seam = Math.abs(fa - Math.round(fa)) * (TAU * r / count) < 0.9 || Math.abs(r - (R + 22)) < 0.8 || Math.abs(r - (R + 8.6)) < 0.8;
        idx = [5, 5, 6, 4, 5, 6][Math.floor(hash(seg, outer ? 7 : 3) * 6)];
        if (smooth(x, y, 6) > 0.68) idx -= 1;              // desgaste en manchas
        if (n > 0.97) idx += 1; else if (n < 0.03) idx -= 1; // motas sueltas
        if (r > c - 10) idx -= 1;
        if (seam) idx = 2;
        col = S[clamp(idx, 1, 7)];
        if (moss > (seam ? 0.56 : 0.64) && r > R + 12) col = M[moss > 0.72 ? 4 : 3];
        else if (moss > 0.6 && r > R + 12 && bayer(x, y) < (moss - 0.6) * 8) col = M[3];
      } else if (r > R - 8) {
        // Anillo de los pedestales: piedra clara y pulida.
        const edge = r > R + 6.8 || r < R - 6.8;
        const fa = a / TAU * 10 + 0.5, seam = Math.abs(fa - Math.round(fa)) * (TAU * r / 10) < 0.8;
        idx = edge ? 3 : seam ? 4 : (bayer(x, y) < (r - (R - 8)) / 16 ? 6 : 7);
        if (!edge && !seam && smooth(x, y, 7) > 0.72) idx -= 1;
        if (n > 0.985) idx = 5;
        col = S[idx];
      } else {
        // Patio interior: tres hileras concéntricas de losas.
        const band = r < 26 ? 0 : r < 40 ? 1 : 2, count = [8, 14, 20][band];
        const fa = a / TAU * count + band * 0.37, seg = Math.floor(fa);
        const seam = Math.abs(fa - Math.round(fa)) * (TAU * r / count) < 0.8 || Math.abs(r - 26) < 0.7 || Math.abs(r - 40) < 0.7 || Math.abs(r - (R - 8.5)) < 0.7;
        idx = [4, 4, 5, 3, 4][Math.floor(hash(seg, band + 11) * 5)];
        if (smooth(x + 9, y + 3, 5) > 0.7) idx -= 1;
        if (n > 0.975) idx += 1;
        if (seam) idx = 2;
        col = S[clamp(idx, 1, 7)];
        if (moss > 0.74 && r > 30 && !seam) col = M[3];
      }
      px.set(x, y, col);
    }
    // Grietas.
    for (let k = 0; k < 14; k++) {
      let x = c + Math.cos(k * 1.7) * (30 + (k * 13) % 50), y = c + Math.sin(k * 1.7) * (30 + (k * 13) % 50);
      for (let i = 0; i < 9; i++) {
        if (px.alpha(x | 0, y | 0)) px.set(x | 0, y | 0, S[1]);
        x += Math.cos(k * 2.3 + i * 0.9); y += Math.sin(k * 2.3 + i * 0.9);
      }
    }
    // Canales tallados desde cada pedestal al centro.
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 10;
      for (let r = 14; r <= R - 9; r += 0.5) {
        const x = Math.round(c + Math.cos(a) * r), y = Math.round(c + Math.sin(a) * r);
        px.set(x, y, S[1]); px.set(x + 1, y, S[2]);
      }
    }
    // Sello central: anillo de runas (brillan de noche) y corona tallada.
    for (let a = 0; a < 360; a += 1) {
      const t = a * Math.PI / 180;
      for (const rr of [11, 16]) px.set(Math.round(c + Math.cos(t) * rr), Math.round(c + Math.sin(t) * rr), S[2]);
      if (a % 24 < 12) {
        const rr = 13.5;
        px.set(Math.round(c + Math.cos(t) * rr), Math.round(c + Math.sin(t) * rr), PAL.rune[a % 24 < 4 ? 3 : 2], 192);
      }
    }
    const crown = ['#.#.#', '#####', '#####'];
    crown.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '#') { px.set(c - 5 + i * 2, c - 3 + j * 2, S[2]); px.set(c - 4 + i * 2, c - 3 + j * 2, S[2]); px.set(c - 5 + i * 2, c - 2 + j * 2, S[1]); px.set(c - 4 + i * 2, c - 2 + j * 2, S[1]); }
    }));
    const s = { canvas: px.canvas(), size: N };
    sheetCache.set('platform', s);
    return s;
  }

  // Capa de luz de los canales (aditiva). Se redibuja cuando cambia el ritual.
  // slots: [{hue, fill 0..1}] ; center: 0..1 (charco central)
  function channelsLayer(px, slots, center, pulse) {
    const N = PLATFORM.size, c = N / 2, R = PLATFORM.ring * 16;
    px.d.fill(0);
    slots.forEach((s, i) => {
      if (!s || !s.hue) return;
      const p = PAL[s.hue] || PAL.verde, a = -Math.PI / 2 + i * Math.PI * 2 / 10;
      // Runa bajo el pedestal.
      for (let k = 0; k < 12; k++) {
        const t = k / 12 * Math.PI * 2;
        px.set(Math.round(c + Math.cos(a) * R + Math.cos(t) * 6), Math.round(c + Math.sin(a) * R + Math.sin(t) * 6), p[k % 2 ? 4 : 5], 255);
      }
      const fill = clamp(s.fill || 0, 0, 1);
      if (fill <= 0) return;
      const r0 = R - 9, r1 = r0 - (r0 - 14) * fill;
      for (let r = r0; r >= r1; r -= 0.5) {
        const x = Math.round(c + Math.cos(a) * r), y = Math.round(c + Math.sin(a) * r);
        const head = r - r1 < 3;
        px.set(x, y, head ? PAL.white : p[(Math.floor(r + pulse * 6) % 3) + 3], 255);
        px.set(x + 1, y, p[3], 255);
      }
    });
    if (center > 0) {
      const rr = 3 + center * 13;
      for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
        const d = Math.hypot(x, y) / rr;
        if (d > 1 || bayer(x + 64, y + 64) > (1 - d) * 1.4 * center + 0.05) continue;
        px.set(Math.round(c + x), Math.round(c + y), d < 0.4 ? PAL.white : PAL.gold[d < 0.7 ? 5 : 4], 255);
      }
    }
    return px;
  }

  // Pedestal 20×28 px con cuenco de gelatina. Cuadro 0 = apagado; 1–3 = runa
  // encendida en verde / azul / rosa.
  function pedestalSheet() {
    if (sheetCache.has('pedestal')) return sheetCache.get('pedestal');
    const W = 20, H = 30, px = new Px(W * 4, H), S = PAL.stone, M = PAL.grass;
    for (let k = 0; k < 4; k++) {
      const ox = k * W;
      // Base ancha con musgo.
      for (let y = 22; y < 29; y++) for (let x = 2; x < 18; x++) px.set(ox + x, y, y === 22 ? S[5] : x < 6 ? S[4] : x > 14 ? S[2] : S[3]);
      // Columna.
      for (let y = 9; y < 22; y++) for (let x = 5; x < 15; x++) px.set(ox + x, y, x < 7 ? S[5] : x > 12 ? S[2] : (y % 5 === 0 ? S[2] : S[4]));
      // Cuenco.
      for (let y = 4; y < 10; y++) for (let x = 2; x < 18; x++) {
        const nx = (x - 9.5) / 8, ny = (y - 4) / 6;
        if (nx * nx + ny * ny * 0.8 > 1.05 && y > 5) continue;
        px.set(ox + x, y, y === 4 ? S[6] : y === 5 ? S[1] : x < 6 ? S[5] : x > 13 ? S[2] : S[4]);
      }
      for (let x = 4; x < 16; x++) px.set(ox + x, 5, S[1]);
      // Musgo.
      [[3, 27], [4, 26], [15, 27], [16, 28], [5, 23], [13, 21]].forEach(([x, y], i) => px.set(ox + x, y, M[3 + (i % 2)]));
      // Runa frontal.
      const glyph = ['.#.', '###', '.#.', '#.#'];
      const pal = k === 0 ? null : PAL[HUES[k - 1]];
      glyph.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch !== '#') return;
        if (pal) px.set(ox + 9 + i - 1, 13 + j, pal[j === 1 ? 5 : 4], 192);
        else px.set(ox + 9 + i - 1, 13 + j, S[1]);
      }));
      px.outline(ox, 0, W, H, (side) => (side === 'up' ? S[2] : PAL.outline));
    }
    const s = { canvas: px.canvas(), w: W, h: H, frames: 4 };
    sheetCache.set('pedestal', s);
    return s;
  }

  // Estatua de la Corona (monumento al norte del claro), 32×56 px, 2 cuadros
  // (gema apagada / encendida).
  function statueSheet() {
    if (sheetCache.has('statue')) return sheetCache.get('statue');
    const W = 32, H = 58, px = new Px(W * 2, H), S = PAL.stone, G = PAL.gold;
    for (let k = 0; k < 2; k++) {
      const ox = k * W;
      // Escalones.
      for (let y = 50; y < 57; y++) for (let x = 2; x < 30; x++) px.set(ox + x, y, y === 50 ? S[6] : x < 8 ? S[5] : x > 25 ? S[2] : S[4]);
      for (let y = 45; y < 50; y++) for (let x = 6; x < 26; x++) px.set(ox + x, y, y === 45 ? S[6] : x < 10 ? S[5] : x > 22 ? S[2] : S[3]);
      // Obelisco.
      for (let y = 16; y < 45; y++) {
        const half = 6 - Math.floor((45 - y) / 12);
        for (let x = 16 - half; x < 16 + half; x++) px.set(ox + x, y, x < 16 - half + 2 ? S[5] : x > 16 + half - 3 ? S[2] : S[4]);
      }
      // Grabados: diez marcas.
      for (let i = 0; i < 5; i++) { px.set(ox + 14, 22 + i * 4, S[1]); px.set(ox + 17, 24 + i * 4, S[1]); }
      // Corona de piedra con detalles dorados.
      const crown = drawCrown(['verde', 'azul', 'rosa'], -1, k === 1);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
        const j = (y * 24 + x) * 4; if (!crown.d[j + 3]) continue;
        const lum = (crown.d[j] + crown.d[j + 1] + crown.d[j + 2]) / 3;
        const emissive = crown.d[j + 3] < 230;
        const col = emissive && k === 1 ? [crown.d[j], crown.d[j + 1], crown.d[j + 2]] : emissive ? S[3] : rgb(lum > 200 ? S[7] : lum > 150 ? S[6] : lum > 100 ? S[4] : lum > 50 ? S[2] : S[1]);
        px.set(ox + 4 + x, 1 + y, col, emissive && k === 1 ? 192 : 255);
      }
      // Gema del obelisco.
      px.disc(ox + 16, 30, 2.6, k === 1 ? G[5] : S[2], k === 1 ? 192 : 255);
      if (k === 1) { px.set(ox + 15, 29, PAL.white, 192); }
      px.outline(ox, 0, W, H, (side) => (side === 'up' ? S[2] : PAL.outline));
    }
    const s = { canvas: px.canvas(), w: W, h: H, frames: 2 };
    sheetCache.set('statue', s);
    return s;
  }

  // Brasero de fuego azul real, 12×20 px, 4 cuadros.
  function brazierSheet() {
    if (sheetCache.has('brazier')) return sheetCache.get('brazier');
    const W = 12, H = 22, px = new Px(W * 4, H), S = PAL.stone;
    const blue = ['#14254f', '#2d5fb3', '#72b0ee', '#b7dcfb', '#ffffff'];
    for (let k = 0; k < 4; k++) {
      const ox = k * W;
      for (let y = 14; y < 21; y++) for (let x = 4; x < 8; x++) px.set(ox + x, y, x === 4 ? S[5] : S[3]);
      for (let y = 10; y < 14; y++) for (let x = 1; x < 11; x++) px.set(ox + x, y, y === 10 ? S[6] : x < 3 ? S[5] : x > 8 ? S[2] : S[4]);
      for (let x = 3; x < 19 - 10; x++) px.set(ox + x, 21, S[2]);
      // Llama.
      for (let y = 0; y < 10; y++) for (let x = 2; x < 10; x++) {
        const w = (10 - y) * 0.38 + Math.sin((y + k * 2.3) * 0.9) * 0.6;
        const d = Math.abs(x + 0.5 - 6 - Math.sin(y * 0.7 + k) * 0.8);
        if (d > w) continue;
        const heat = 1 - d / (w + 0.01) * 0.6 - (10 - y) / 18;
        const idx = clamp(Math.floor(heat * 5), 1, 4);
        px.set(ox + x, y, blue[idx], 192);
      }
      px.outline(ox, 10, W, 12, () => PAL.outline);
    }
    const s = { canvas: px.canvas(), w: W, h: H, frames: 4 };
    sheetCache.set('brazier', s);
    return s;
  }

  // ── Partículas (8×8 px por cuadro) ──────────────────────────────────────
  // Filas: 0 gotas (verde, azul, rosa, blanca) · 1 chispas doradas (4)
  //        2 polvo (4) · 3 estrella, corazón, luz, runa
  const PARTICLE = Object.freeze({ cell: 8, cols: 4, rows: 4 });
  function particleSheet() {
    if (sheetCache.has('particles')) return sheetCache.get('particles');
    const C = 8, px = new Px(C * 4, C * 4);
    // Gotas.
    ['verde', 'azul', 'rosa', null].forEach((h, i) => {
      const p = h ? PAL[h] : ['#8e8aa6', '#d9d6e8', '#ffffff', '#ffffff', '#ffffff', '#ffffff'];
      const ox = i * C;
      [[3, 1, 4], [2, 2, 3], [3, 2, 4], [4, 2, 3], [2, 3, 3], [3, 3, 3], [4, 3, 2], [5, 3, 2], [2, 4, 2], [3, 4, 3], [4, 4, 2], [5, 4, 1], [3, 5, 1], [4, 5, 1]]
        .forEach(([x, y, k]) => px.set(ox + x, y, p[k]));
      px.set(ox + 3, 2, p[5]);
      px.outline(ox, 0, C, C, () => p[0]);
    });
    // Chispas.
    for (let k = 0; k < 4; k++) {
      const ox = k * C, oy = C, r = [1, 2, 3, 2][k];
      for (let i = -r; i <= r; i++) { px.set(ox + 3 + i, oy + 3, PAL.gold[5], 192); px.set(ox + 3, oy + 3 + i, PAL.gold[5], 192); }
      px.set(ox + 3, oy + 3, PAL.white, 192);
      if (k === 2) { px.set(ox + 1, oy + 1, PAL.gold[4], 192); px.set(ox + 5, oy + 5, PAL.gold[4], 192); px.set(ox + 5, oy + 1, PAL.gold[4], 192); px.set(ox + 1, oy + 5, PAL.gold[4], 192); }
    }
    // Polvo.
    for (let k = 0; k < 4; k++) {
      const ox = k * C, oy = C * 2, r = 1.5 + k * 0.7;
      for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
        const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4.5) / r;
        if (d > 1 || (k === 3 && bayer(x, y) > 1 - d)) continue;
        px.set(ox + x, oy + y, d < 0.5 ? PAL.ruin[7] : PAL.ruin[5]);
      }
    }
    // Estrella, corazón, luz, runa.
    const oy = C * 3;
    ['..#..', '.###.', '#####', '.###.', '.#.#.'].forEach((r, j) => [...r].forEach((ch, i) => ch === '#' && px.set(1 + i, oy + 1 + j, j === 2 && i === 2 ? PAL.white : PAL.gold[5], 192)));
    ['.#.#.', '#####', '#####', '.###.', '..#..'].forEach((r, j) => [...r].forEach((ch, i) => ch === '#' && px.set(C + 1 + i, oy + 1 + j, j < 2 && i === 1 ? PAL.white : PAL.rosa[4], 192)));
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
      const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
      if (d < 3.4 && bayer(x, y) < 1.1 - d / 3.4) px.set(C * 2 + x, oy + y, d < 1.5 ? PAL.white : PAL.gold[5], 192);
    }
    ['.#.', '###', '.#.', '#.#'].forEach((r, j) => [...r].forEach((ch, i) => ch === '#' && px.set(C * 3 + 2 + i, oy + 2 + j, PAL.rune[3], 192)));
    const s = { canvas: px.canvas(), cell: C, cols: 4, rows: 4 };
    sheetCache.set('particles', s);
    return s;
  }

  // ── Calcomanías de suelo (avisos y ondas) ───────────────────────────────
  function ringTex(size, thick, color, dither) {
    const key = ['ring', size, thick, color, dither].join('|');
    if (sheetCache.has(key)) return sheetCache.get(key);
    const px = new Px(size, size), c = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (r > c - 0.5) continue;
      if (r > c - 0.5 - thick) px.set(x, y, color);
      else if (dither && bayer(x, y) < dither * (r / c)) px.set(x, y, color);
    }
    const s = { canvas: px.canvas(), size };
    sheetCache.set(key, s);
    return s;
  }
  function discTex(size, color) {
    const key = ['disc', size, color].join('|');
    if (sheetCache.has(key)) return sheetCache.get(key);
    const px = new Px(size, size), c = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (r <= 1 && bayer(x, y) < 0.35 + (1 - r) * 0.55) px.set(x, y, color);
    }
    const s = { canvas: px.canvas(), size };
    sheetCache.set(key, s);
    return s;
  }
  // Carril de la embestida: flecha punteada 32×128 px (apunta hacia arriba).
  function laneTex() {
    if (sheetCache.has('lane')) return sheetCache.get('lane');
    const W = 32, H = 128, px = new Px(W, H), col = PAL.ember;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = x === 2 || x === W - 3;
      const chev = ((y + Math.abs(x - 16) * 0.9) % 16) < 3 && x > 4 && x < W - 5;
      if (y < 10) { if (Math.abs(x - 16) <= (10 - y) * 1.4 - 0.5) px.set(x, y + 1, col); continue; }
      if (edge && (y >> 2) % 2 === 0) px.set(x, y, col);
      else if (chev) px.set(x, y, '#ff9a62');
    }
    const s = { canvas: px.canvas(), w: W, h: H };
    sheetCache.set('lane', s);
    return s;
  }
  // Grieta del impacto 64×40.
  function crackTex() {
    if (sheetCache.has('crack')) return sheetCache.get('crack');
    const px = new Px(64, 40);
    for (let k = 0; k < 9; k++) {
      let x = 32, y = 20; const a = k / 9 * Math.PI * 2 + 0.3;
      for (let i = 0; i < 16 + (k % 3) * 4; i++) {
        px.set(x | 0, y | 0, PAL.ruin[0]); px.set((x | 0) + 1, y | 0, PAL.ruin[1]);
        x += Math.cos(a + Math.sin(i * 1.3 + k) * 0.5) * 1.6; y += Math.sin(a + Math.sin(i * 1.3 + k) * 0.5) * 0.95;
      }
    }
    const s = { canvas: px.canvas(), w: 64, h: 40 };
    sheetCache.set('crack', s);
    return s;
  }
  // Columna de luz vertical 16×96 (aditiva).
  function beamTex(hex) {
    const key = 'beam|' + hex;
    if (sheetCache.has(key)) return sheetCache.get(key);
    const W = 16, H = 96, px = new Px(W, H), c = rgb(hex);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - W / 2) / (W / 2), fade = y / H;
      const v = (1 - dx * dx) * (0.25 + fade * 0.75);
      if (bayer(x, y) < v) px.set(x, y, dx < 0.25 ? [255, 255, 255] : c);
    }
    const s = { canvas: px.canvas(), w: W, h: H };
    sheetCache.set(key, s);
    return s;
  }
  function shadowTex(w, h) {
    const key = ['shadow', w, h].join('|');
    if (sheetCache.has(key)) return sheetCache.get(key);
    const px = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2);
      if (nx * nx + ny * ny <= 1) px.set(x, y, [20, 16, 30]);
    }
    const s = { canvas: px.canvas(), w, h };
    sheetCache.set(key, s);
    return s;
  }

  // Ícono de arma (24×24) para la recompensa.
  function weaponIcon(id) {
    const key = 'weapon|' + id;
    if (sheetCache.has(key)) return sheetCache.get(key);
    const px = new Px(24, 24), G = PAL.gold, M = ['#26282f', '#4d515c', '#80869a', '#b9bfcc', '#eef1f6'];
    const line = (x0, y0, x1, y1, col, a = 255) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) px.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), col, a);
    };
    if (id === 'cetro-rey-slime') {
      line(5, 20, 15, 10, '#704829'); line(6, 20, 16, 10, '#a87543');
      px.disc(17, 7, 3.5, PAL.rune[2], 192); px.set(16, 6, PAL.white, 192);
      line(14, 11, 20, 5, G[4]);
    } else if (id === 'dagas-rey-slime') {
      line(3, 19, 11, 9, M[3]); line(4, 19, 12, 9, M[4]); line(2, 20, 4, 18, G[3]);
      line(21, 19, 13, 9, M[3]); line(20, 19, 12, 9, M[2]); line(22, 20, 20, 18, G[3]);
      px.set(8, 14, PAL.rune[2], 192); px.set(16, 14, PAL.rune[2], 192);
    } else {
      line(5, 19, 18, 4, M[3]); line(6, 19, 19, 4, M[4]); line(4, 18, 17, 3, M[2]);
      line(3, 16, 8, 21, G[4]); line(2, 21, 4, 19, '#704829');
      px.set(12, 11, PAL.rune[2], 192); px.set(18, 4, PAL.white, 192);
    }
    px.outline(0, 0, 24, 24, () => PAL.outline);
    const s = { canvas: px.canvas(), w: 24, h: 24 };
    sheetCache.set(key, s);
    return s;
  }

  // Ícono del Rey para la interfaz (HTML): un cuadro pequeño del aliado feliz.
  function portrait(spec) {
    const sheet = kingSheet(spec, 64), i = FRAME_INDEX.happy, cell = sheet.cell;
    const c = root.document.createElement('canvas'); c.width = cell; c.height = cell;
    c.getContext('2d').drawImage(sheet.canvas, (i % sheet.cols) * cell, Math.floor(i / sheet.cols) * cell, cell, cell, 0, 0, cell, cell);
    return c;
  }

  root.TMReyArt = Object.freeze({
    PAL, HUES, PLATFORM, PARTICLE, KING_FRAMES, FRAME_INDEX, Px,
    kingSheet, crownSheet, lookOf, colorAt, platform, channelsLayer, pedestalSheet, statueSheet, brazierSheet,
    particleSheet, ringTex, discTex, laneTex, crackTex, beamTex, shadowTex, weaponIcon, portrait, gemsOf, fragsOf
  });
})(typeof window !== 'undefined' ? window : globalThis);
