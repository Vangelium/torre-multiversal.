'use strict';
// «El mundo existe porque lo recorres»: etapas, peligro y recompensa.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const G = require('../../beta/glitch.js');

test('las etapas siguen el orden del director: arbusto, árboles, piedras, criaturas, mundo, olvido', () => {
  assert.deepEqual(G.STAGES.map(s => s.id), ['calma', 'arbusto', 'arboles', 'piedras', 'criaturas', 'mundo', 'olvido']);
  assert.equal(G.stageOf(0), 0); assert.equal(G.stageOf(19.9), 0);
  assert.equal(G.stageOf(20), 1); assert.equal(G.stageOf(36), 2); assert.equal(G.stageOf(55), 3);
  assert.equal(G.stageOf(70), 4); assert.equal(G.stageOf(85), 5); assert.equal(G.stageOf(500), 6);
});
test('cada etapa crece suave en 8 segundos', () => {
  assert.equal(G.ramp(20, 1), 0); assert.equal(G.ramp(24, 1), 0.5); assert.equal(G.ramp(40, 1), 1); assert.equal(G.ramp(5, 0), 0);
});
test('el Olvido no daña antes de los 100 s y luego crece cada 15 s', () => {
  assert.equal(G.erosion(99), 0); assert.equal(G.erosion(100), 1); assert.equal(G.erosion(116), 2); assert.equal(G.erosion(131), 3);
});
test('moverse más de un paso corto devuelve el mundo a la normalidad; un temblor no', () => {
  assert.equal(G.moved({ x: 10, y: 10 }, 10.1, 10.1), false);
  assert.equal(G.moved({ x: 10, y: 10 }, 10.5, 10), true);
});
test('la Grieta cuenta la historia en orden y luego numera los fragmentos', () => {
  assert.equal(G.loreLine(0), 'El mundo existe porque lo recorres.');
  assert.match(G.loreLine(G.LORE.length), /Fragmento de Realidad n\.º 6/);
});
