'use strict';
// Pruebas de la fase D: linajes Renacido I/II/III y Fragmentos Rebeldes.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const R = require('../../beta/rey-slime.js');

const uid = i => 'lim' + String(i).padStart(4, '0');
const frag = (phase, i) => ({ fragmentPhase: phase, originKingId: 'rey-123', identityId: 'id' + String(i).padStart(6, '0') });
function piece(i, hue, phase) {
  const pet = { uid: uid(i), species: 'limo', hue, name: null, bond: 3, at: 1 };
  if (phase) pet.royalFragment = frag(phase, i);
  return R.validPiece({ uid: uid(i), hue, bond: 3, lv: 2, el: 0, pet });
}
const ten = (hues, phases) => hues.map((h, i) => piece(i, h, phases ? phases[i] : 0));

test('la ficha de un fragmento domado se conserva y una ficha falsa se descarta', () => {
  const p = piece(1, 'azul', 3);
  assert.deepEqual(p.pet.royalFragment, frag(3, 1));
  assert.equal(R.fragmentOf({ fragmentPhase: 4, originKingId: 'rey-1', identityId: 'abcd1234' }), null);
  assert.equal(R.fragmentOf({ fragmentPhase: 2, originKingId: 'REY<script>', identityId: 'abcd1234' }), null);
  assert.equal(R.validPiece({ uid: uid(2), hue: 'rosa', pet: { uid: uid(2), species: 'limo', hue: 'rosa', royalFragment: { fragmentPhase: 9 } } }).pet.royalFragment, undefined);
});
test('diez slimes comunes → Silvestre (tabla del diseño)', () => {
  assert.equal(R.compose(ten(Array(10).fill('azul')), 1).lineage, 'silvestre');
  const k = R.compose(ten(['rosa', 'rosa', 'rosa', 'rosa', 'rosa', 'rosa', 'rosa', 'verde', 'verde', 'verde']), 1);
  assert.equal(k.lineage, 'silvestre'); assert.equal(k.hue, 'rosa');
});
test('diez fragmentos de la misma fase → Renacido I, II o III; el color sigue a la mayoría', () => {
  for (const ph of [1, 2, 3]) {
    const k = R.compose(ten(['azul', 'azul', 'azul', 'azul', 'azul', 'rosa', 'rosa', 'rosa', 'rosa', 'rosa'], Array(10).fill(ph)), 1);
    assert.equal(k.lineage, 'renacido-' + ph);
    assert.equal(k.fragments, 10);
    assert.deepEqual(k.mix, [0, 5, 5], 'el color es independiente del linaje (híbrido azul/rosa)');
  }
});
test('un solo fragmento III no crea un Renacido III: es herencia mixta', () => {
  const k = R.compose(ten(Array(10).fill('verde'), [3, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 1);
  assert.equal(k.lineage, 'mixta'); assert.equal(k.fragments, 1);
});
test('fragmentos de distintas fases → herencia mixta', () => {
  assert.equal(R.compose(ten(Array(10).fill('verde'), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2]), 1).lineage, 'mixta');
});
test('el Renacido es más fuerte en cada rango pero conserva las tres formas', () => {
  const base = R.compose(ten(Array(10).fill('azul')), 1);
  const r1 = R.compose(ten(Array(10).fill('azul'), Array(10).fill(1)), 1);
  const r3 = R.compose(ten(Array(10).fill('azul'), Array(10).fill(3)), 1);
  assert.ok(r1.maxHp > base.maxHp && r3.maxHp > r1.maxHp);
  assert.ok(r3.atk > r1.atk && r1.atk >= base.atk);
  assert.equal(R.formOf(r3.maxHp, r3.maxHp), 1, 'empieza en la Forma I como todos');
});
test('el linaje sobrevive al guardado y uno inventado vuelve a Silvestre', () => {
  const k = R.compose(ten(Array(10).fill('azul'), Array(10).fill(2)), 7);
  const saved = R.normalize({ pieces: [], stage: 'battle', king: { ...k, x: 1, y: 1, world: 'valle-alba' } });
  assert.equal(saved.king.lineage, 'renacido-2'); assert.equal(saved.king.fragments, 10);
  const bad = R.normalize({ pieces: [], stage: 'battle', king: { ...k, lineage: 'dios', x: 1, y: 1 } });
  assert.equal(bad.king.lineage, 'silvestre');
});
