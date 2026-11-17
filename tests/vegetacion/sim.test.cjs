'use strict';
// Vangelium Dynamic Vegetation: la simulación por celdas.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { VegSim, DEF } = require('../../beta/vegetacion.js');

const mk = () => { const s = new VegSim(DEF); s.center(50, 50); return s; };
const run = (s, secs, every) => { const h = 1 / DEF.hz; let t = 0; while (t < secs) { s.step(h); if (every) every(t); t += h; } };

test('las plantas se inclinan en la dirección del empuje', () => {
  const s = mk(); s.impulse(50, 50, 1, 3, 1, 0); run(s, 0.1);
  const [dx] = s.at(50.4, 50); assert.ok(dx > 0.02, 'empujar hacia +x inclina hacia +x');
});
test('la onda se propaga a las vecinas con retraso y perdiendo energía', () => {
  const s = mk(); s.impulse(50, 50, 0.6, 4, 1, 0);
  let peakNear = 0, tNear = 0, peakFar = 0, tFar = 0;
  run(s, 1.2, t => {
    const n = Math.hypot(...s.at(50.3, 50)), f = Math.hypot(...s.at(52.3, 50));
    if (n > peakNear) { peakNear = n; tNear = t; }
    if (f > peakFar) { peakFar = f; tFar = t; }
  });
  assert.ok(peakFar > 0, 'la perturbación llega a celdas que nadie tocó');
  assert.ok(peakFar < peakNear, 'llega más débil');
  assert.ok(tFar > tNear, 'llega más tarde');
});
test('el movimiento termina solo: sin vibración permanente y la simulación se duerme', () => {
  const s = mk(); for (let i = 0; i < 20; i++) s.impulse(50 + i * 0.3, 50, 1, 3, 1, 0);
  run(s, 6);
  assert.equal(s.awake, false); assert.equal(s.energy, 0);
  assert.equal(Math.max(...s.dx.map(Math.abs)), 0);
});
test('muchos empujes seguidos no se acumulan sin control (desplazamiento acotado)', () => {
  const s = mk(); const h = 1 / DEF.hz;
  for (let i = 0; i < 300; i++) { s.impulse(50, 50, 1, 6, 1, 0); s.step(h); }
  assert.ok(Math.max(...s.dx.map(Math.abs)) <= DEF.maxDisp + 1e-6);
});
test('al seguir al jugador la ventana se desplaza sin perder la onda', () => {
  const s = mk(); s.impulse(50, 50, 1, 3, 1, 0); run(s, 0.1);
  const before = s.at(50.4, 50)[0];
  s.center(52, 50);
  assert.ok(Math.abs(s.at(50.4, 50)[0] - before) < 1e-6);
});

test('al caminar, la onda se ve en las matas vecinas (más débil y después) y luego todo queda quieto', () => {
  const { DEF: D } = require('../../beta/vegetacion.js');
  const s = new VegSim(D); s.center(0, 0); const h = 1 / D.hz; let x = -2, t = 0, sleepAt = null;
  const peak = { 0.5: [0, 0], 2: [0, 0] };
  for (let i = 0; i < D.hz * 12; i++) {
    t += h;
    if (x < 1) { s.impulse(x, 0, D.player.radius, D.player.force * 0.65, 1, 0); x += 2.6 * h; }
    s.step(h);
    for (const d in peak) { const v = s.at(0, +d), a = Math.hypot(v[0], v[1]); if (a > peak[d][0]) peak[d] = [a, t]; }
    if (!s.awake && sleepAt === null) sleepAt = t;
  }
  assert.ok(peak[0.5][0] > 0.5, 'la mata tocada se dobla claramente: ' + peak[0.5][0]);
  assert.ok(peak[2][0] > 0.12 && peak[2][0] < peak[0.5][0] * 0.5, 'a 2 u la reacción se nota pero es menor: ' + peak[2][0]);
  assert.ok(sleepAt !== null && sleepAt - 1.15 < 6, 'vuelve al reposo en pocos segundos: ' + sleepAt);
  assert.ok(s.dx.every(v => v === 0) && s.vx.every(v => v === 0), 'reposo exacto');
});

test('v2 Flora: las plantillas son pixel art limpio y cada especie tiene todos sus colores', () => {
  const { TPL, FLORA, colorsOf, shapeOf } = require('../../beta/vegetacion.js');
  for (const [id, rows] of Object.entries(TPL)) {
    const w = rows[0].length;
    assert.ok(rows.every(r => r.length === w), id + ': filas de distinto ancho');
    assert.ok(!rows[rows.length - 1].includes('O'), id + ': la base no lleva contorno duro');
    if (!/^T/.test(id)) assert.ok(rows.length <= 18 && w <= 19, id + ': demasiado grande, taparía a los personajes');
    assert.ok(shapeOf(id), id + ': sin tipo (flexión, golpes, rastrojo)');
  }
  for (const sp of FLORA) {
    const col = colorsOf(sp);
    for (const t of sp.art) for (const r of TPL[t]) for (const c of r) assert.ok(c === '.' || col[c], sp.id + '/' + t + ': la letra ' + c + ' no tiene color');
  }
});

test('las mediciones guardadas son JSON estricto (sin NaN ni Infinity)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const files = [['vegetacion-v12', 'mediciones_rendimiento.json'], ['vegetacion-v12', 'resultados_visuales.json'],
    ['vegetacion-v12.2', 'mediciones_rendimiento.json'], ['vegetacion-v12.2', 'resultados_visuales.json'], ['vegetacion-v12.2', 'funcional.json'], ['vegetacion-v12.3', 'resultados_visuales.json'], ['vegetacion-v12.3', 'funcional.json'], ['vegetacion-v2-flora', 'resultados.json']];
  for (const [d, f] of files) {
    const txt = fs.readFileSync(path.join(__dirname, '../../docs/evidencias', d, f), 'utf8');
    assert.ok(!/\bNaN\b|\bInfinity\b/.test(txt), f + ' contiene NaN o Infinity');
    JSON.parse(txt);
  }
});

test('v12.2: sin contornos negros interiores (solo la silueta exterior lleva contorno)', () => {
  const { TPL } = require('../../beta/vegetacion.js');
  for (const [id, rows] of Object.entries(TPL)) {
    const h = rows.length, w = rows[0].length, f = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
    let interior = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y][x] === 'O' && f(x - 1, y) && f(x + 1, y) && f(x, y - 1) && f(x, y + 1)) interior++;
    assert.equal(interior, 0, id + ': tiene ' + interior + ' píxeles de contorno negro dentro de la planta');
  }
});

test('v12.2: el doblez es visible (amplitudes) y la hierba se agacha delante de los personajes', () => {
  const { DEF: D, SHAPE } = require('../../beta/vegetacion.js');
  assert.ok(SHAPE.H.amp >= 0.45 && SHAPE.R.amp >= 0.3 && SHAPE.G.amp >= 0.25, JSON.stringify(SHAPE));
  assert.ok(SHAPE.F.amp < SHAPE.H.amp && SHAPE.TC.amp < 0.1 && SHAPE.TX.amp < 0.1, 'flores más rígidas que la hierba alta; cactus y cristal casi rígidos');
  assert.ok(D.near && D.near.player > 0 && D.near.squash > 0 && D.near.squash < 1, 'agacharse sin desaparecer');
});

test('v12.3: la textura lleva desplazamiento y velocidad; en reposo todo vale 128 (nada se mueve)', () => {
  const { DEF: D, VegSim: VS, encodeField, VMAX } = require('../../beta/vegetacion.js');
  const s = new VS(D); s.center(0, 0);
  const data = new Uint8Array(D.cells * D.cells * 4);
  encodeField(s, data);
  assert.ok(data.every(v => v === 128), 'reposo exacto en los cuatro canales');
  s.impulse(0, 0, D.player.radius, D.player.force, 1, 0); s.step(1 / D.hz);
  encodeField(s, data);
  let vx = 0, dx = 0;
  for (let k = 0; k < data.length; k += 4) { vx = Math.max(vx, Math.abs(data[k + 2] - 128)); dx = Math.max(dx, Math.abs(data[k] - 128)); }
  assert.ok(vx > 20 && dx > 2, 'al empujar aparecen velocidad (para el atraso de la punta) y desplazamiento: ' + vx + ' / ' + dx);
  assert.ok(VMAX > 0 && data.every(v => v >= 0 && v <= 255));
  for (let i = 0; i < D.hz * 12; i++) s.step(1 / D.hz);
  encodeField(s, data);
  assert.ok(data.every(v => v === 128), 'tras el rebote vuelve exacto al reposo');
});

test('v12.3: una onda que llega al borde de la ventana no deja la hierba doblada para siempre', () => {
  const { DEF: D, VegSim: VS } = require('../../beta/vegetacion.js');
  const s = new VS(D); s.center(0, 0);
  const half = D.cells * D.cell / 2;
  // Empujes fuertes cerca de los cuatro bordes y luego se desplaza la ventana.
  for (const [x, y] of [[half - 1.2, 0], [-half + 1.2, 0], [0, half - 1.2], [0, -half + 1.2]]) s.impulse(x, y, 1.5, 40, 1, 1);
  for (let i = 0; i < 10; i++) s.step(1 / D.hz);
  s.center(1.5, -1.5);
  for (let i = 0; i < D.hz * 15 && s.awake; i++) s.step(1 / D.hz);
  assert.equal(s.awake, false, 'la simulación se duerme (energía ' + s.energy + ')');
  assert.ok(s.dx.every(v => v === 0) && s.dy.every(v => v === 0), 'todo vuelve exacto a 0');
});
