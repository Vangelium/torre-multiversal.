'use strict';
// Pruebas de la fase 1 del Rey Slime (IA, santuario, presagio y recompensas).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const R = require('../../beta/rey-slime.js');

const base = { d: 4, hpFrac: 1, summons: 0, minions: 0, slamCd: 0, chargeCd: 0 };

test('invoca súbditos al bajar de 70 % y de 40 % de vida, una vez cada umbral', () => {
  assert.equal(R.pickAttack({ ...base, hpFrac: 0.69 }, 0.5), 'summon');
  assert.notEqual(R.pickAttack({ ...base, hpFrac: 0.69, summons: 1 }, 0.5), 'summon');
  assert.equal(R.pickAttack({ ...base, hpFrac: 0.39, summons: 1 }, 0.5), 'summon');
  assert.notEqual(R.pickAttack({ ...base, hpFrac: 0.39, summons: 2 }, 0.5), 'summon');
});
test('no invoca si ya hay tres súbditos vivos', () => {
  assert.notEqual(R.pickAttack({ ...base, hpFrac: 0.3, minions: 3 }, 0.5), 'summon');
});
test('de cerca usa el rebote corto', () => {
  assert.equal(R.pickAttack({ ...base, d: 1.5 }, 0.1), 'bounce');
});
test('a media distancia elige salto aplastante o embestida según el azar', () => {
  assert.equal(R.pickAttack({ ...base, d: 5 }, 0.1), 'slam');
  assert.equal(R.pickAttack({ ...base, d: 5 }, 0.6), 'charge');
  assert.equal(R.pickAttack({ ...base, d: 5 }, 0.95), 'hop');
});
test('respeta los tiempos de recarga de cada ataque', () => {
  assert.notEqual(R.pickAttack({ ...base, d: 5, slamCd: 2 }, 0.1), 'slam');
  assert.equal(R.pickAttack({ ...base, d: 5, slamCd: 2, chargeCd: 2 }, 0.1), 'hop');
});
test('de lejos embiste si puede; si no, se acerca saltando', () => {
  assert.equal(R.pickAttack({ ...base, d: 9 }, 0.5), 'charge');
  assert.equal(R.pickAttack({ ...base, d: 9, chargeCd: 1 }, 0.5), 'hop');
  assert.equal(R.pickAttack({ ...base, d: 12 }, 0.5), 'hop');
});
test('los diez pedestales forman un anillo uniforme alrededor del centro', () => {
  const pts = Array.from({ length: 10 }, (_, i) => R.pedestalPos(100, 100, i, 4.4));
  for (const p of pts) assert.ok(Math.abs(Math.hypot(p.x - 100, p.y - 100) - 4.4) < 1e-9);
  assert.ok(Math.abs(pts[0].x - 100) < 1e-9 && pts[0].y < 100, 'el primero mira al norte');
  for (let i = 0; i < 10; i++) {
    const a = pts[i], b = pts[(i + 1) % 10];
    assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 2 * 4.4 * Math.sin(Math.PI / 10)) < 1e-9);
  }
});
test('el presagio cuenta los colores colocados', () => {
  assert.deepEqual(R.partialMix([{ hue: 'verde' }, { hue: 'rosa' }, { hue: 'verde' }]), [2, 0, 1]);
  assert.deepEqual(R.partialMix([]), [0, 0, 0]);
});
test('nombre de la apariencia: dominante, híbrido y vetas', () => {
  assert.equal(R.variantName({ hue: 'azul', mix: [0, 10, 0] }), 'azul');
  assert.equal(R.variantName({ hue: 'rosa', mix: [3, 0, 7] }), 'rosa con vetas verdes');
  assert.equal(R.variantName({ hue: 'azul', mix: [0, 5, 5] }), 'híbrido azul y rosa');
  assert.equal(R.variantName({ hue: 'verde', mix: [4, 3, 3] }), 'verde con vetas azules y rosas');
});
test('cada arma posible tiene nombre y tipo para la pantalla de decisión', () => {
  for (const w of R.WEAPONS) { assert.ok(R.WEAPON_INFO[w].name.includes('Rey Slime')); assert.ok(R.WEAPON_INFO[w].kind); }
  for (let s = 1; s < 50; s++) assert.ok(R.WEAPON_INFO[R.chooseWeapon(s)]);
});
