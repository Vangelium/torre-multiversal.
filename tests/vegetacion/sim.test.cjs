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
