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

test('el arte nuevo es pixel art limpio con la paleta del juego (sin base de pegatina)', () => {
  const { ART, PAL, NEW_SPRITES } = require('../../beta/vegetacion.js');
  const kinds = new Set(NEW_SPRITES.map(q => q[4]));
  for (const k of ['corta', 'alta', 'helecho', 'mata', 'flor']) assert.ok(kinds.has(k), 'falta la variedad ' + k);
  for (const [id, rows] of Object.entries(ART)) {
    const w = rows[0].length;
    assert.ok(rows.every(r => r.length === w), id + ': filas de distinto ancho');
    assert.ok(rows.every(r => [...r].every(c => c === '.' || PAL[c])), id + ': color fuera de la paleta');
    assert.ok(!rows[rows.length - 1].includes('O'), id + ': la base no lleva contorno duro');
    assert.ok(rows.length <= 18 && w <= 19, id + ': demasiado grande, taparía a los personajes');
  }
});

test('las mediciones guardadas son JSON estricto (sin NaN ni Infinity)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const dir = path.join(__dirname, '../../docs/evidencias/vegetacion-v12');
  for (const f of ['mediciones_rendimiento.json', 'resultados_visuales.json']) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/\bNaN\b|\bInfinity\b/.test(txt), f + ' contiene NaN o Infinity');
    JSON.parse(txt);
  }
});
