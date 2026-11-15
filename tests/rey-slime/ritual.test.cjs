'use strict';
// Fase E: Charca del Primer Reflejo, Cuenco de Convergencia y Trono.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const R = require('../../beta/rey-slime.js');

test('un guardado antiguo empieza sin corona, sin cuenco y sin materiales', () => {
  assert.deepEqual(R.normalize({}).rite, { clues: 0, crown: null, crownPlaced: false, bowl: false, stone: 0, gel: 0 });
});
test('la corona no se puede inventar ni colocar sin tenerla', () => {
  assert.equal(R.normalizeRite({ crown: { id: 'falsa' } }).crown, null);
  assert.equal(R.normalizeRite({ crownPlaced: true }).crownPlaced, false);
  assert.equal(R.normalizeRite({ crown: { id: 'corona-abc123', at: 5 }, crownPlaced: true }).crownPlaced, true);
});
test('receta del Cuenco: 6 piedras lisas + 4 gel + 2 hongos lunares, consumo exacto', () => {
  const r = R.craftBowl({ stone: 7, gel: 4 }, { lunar: 3 });
  assert.equal(r.ok, true);
  assert.equal(r.rite.stone, 1); assert.equal(r.rite.gel, 0); assert.equal(r.lunar, 1); assert.equal(r.rite.bowl, true);
});
test('si falta algo no se consume nada (nunca inventario negativo)', () => {
  const before = { stone: 6, gel: 3 };
  const r = R.craftBowl(before, { lunar: 2 });
  assert.equal(r.ok, false); assert.deepEqual(r.miss, ['gel de slime']);
  assert.equal(r.rite.stone, 6); assert.equal(r.rite.gel, 3); assert.equal(r.lunar, 2);
  assert.equal(R.craftBowl({ stone: 30, gel: 30, bowl: true }, { lunar: 9 }).why, 'ya-instalado', 'el cuenco es único');
});
test('el Trono exige corona colocada y cuenco instalado', () => {
  assert.equal(R.throneReady({}).why, 'sin-corona');
  assert.equal(R.throneReady({ crown: { id: 'corona-x1' } }).why, 'corona-sin-colocar');
  assert.equal(R.throneReady({ crown: { id: 'corona-x1' }, crownPlaced: true }).why, 'sin-cuenco');
  assert.equal(R.throneReady({ crown: { id: 'corona-x1' }, crownPlaced: true, bowl: true }).ok, true);
});
test('el reflejo responde al amanecer, o de noche solo con antorcha', () => {
  assert.equal(R.reflectionLit({ f: 0.25, night: 0 }, false), true);
  assert.equal(R.reflectionLit({ f: 0.5, night: 0, phase: 'dia' }, true), false);
  assert.equal(R.reflectionLit({ f: 0.9, night: 1 }, false), false);
  assert.equal(R.reflectionLit({ f: 0.9, night: 1 }, true), true);
});
