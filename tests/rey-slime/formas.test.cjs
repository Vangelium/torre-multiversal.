'use strict';
// Pruebas de las tres formas del Rey Slime (fases B y C).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const R = require('../../beta/rey-slime.js');

test('la forma depende de la vida: I sobre 66 %, II hasta 33 %, III debajo', () => {
  assert.equal(R.formOf(1000, 1000), 1);
  assert.equal(R.formOf(661, 1000), 1);
  assert.equal(R.formOf(660, 1000), 2);
  assert.equal(R.formOf(331, 1000), 2);
  assert.equal(R.formOf(330, 1000), 3);
  assert.equal(R.formOf(1, 1000), 3);
});
test('un golpe enorme no salta formas: se detiene en el umbral y se transforma', () => {
  const g = R.gateHp(1, 900, -50, 1000, false);
  assert.deepEqual(g, { hp: 660, morph: true });
  assert.equal(R.formOf(g.hp, 1000), 2);
  const g2 = R.gateHp(2, 500, 0, 1000, false);
  assert.deepEqual(g2, { hp: 330, morph: true });
  assert.equal(R.formOf(g2.hp, 1000), 3);
});
test('mientras se transforma no recibe daño', () => {
  assert.deepEqual(R.gateHp(2, 660, 400, 1000, true), { hp: 660, morph: false });
});
test('en la Forma III el daño es normal y puede morir', () => {
  assert.deepEqual(R.gateHp(3, 100, 0, 1000, false), { hp: 0, morph: false });
});
test('en su trono nunca recupera vida de una forma anterior', () => {
  assert.equal(R.formCeil(1, 1000), 1000);
  assert.equal(R.formCeil(2, 1000), 660);
  assert.equal(R.formCeil(3, 1000), 330);
  assert.equal(R.formOf(R.formCeil(2, 1000), 1000), 2);
  assert.equal(R.formOf(R.formCeil(3, 1000), 1000), 3);
});
test('topes de clones 5 / 10 / 20 y atacantes simultáneos 2 / 2 / 3', () => {
  assert.deepEqual(R.FORMS.slice(1).map(f => f.cap), [5, 10, 20]);
  assert.deepEqual(R.FORMS.slice(1).map(f => f.active), [2, 2, 3]);
});
test('el director deja atacar solo a N clones, conserva a los que ya atacaban y completa con los más cercanos', () => {
  const clones = [{ id: 1, x: 9, y: 0 }, { id: 2, x: 1, y: 0 }, { id: 3, x: 2, y: 0 }, { id: 4, x: 3, y: 0, dead: true }, { id: 5, x: 5, y: 0 }];
  assert.deepEqual([...R.directClones(clones, new Set(), 0, 0, 2)].sort(), [2, 3]);
  const keep = R.directClones(clones, new Set([1]), 0, 0, 2);
  assert.ok(keep.has(1) && keep.has(2) && keep.size === 2);
  assert.equal(R.directClones(clones, new Set([4]), 0, 0, 3).has(4), false, 'un clon muerto no ataca');
  assert.equal(R.directClones(clones, new Set([1, 2]), 0, 0, 0).size, 0, 'durante la transformación nadie ataca');
});
const b2 = { d: 5, clones: 4, summonCd: 1, absorbCd: 1, spineCd: 0, biteCd: 0, jumpCd: 0 };
test('Forma II: invoca si le faltan clones, absorbe si tiene, espinas de cerca y megasalto a distancia', () => {
  assert.equal(R.pickAttackII({ ...b2, clones: 1, summonCd: 0 }, 0.9), 'summon');
  assert.equal(R.pickAttackII({ ...b2, absorbCd: 0 }, 0.1), 'absorb');
  assert.equal(R.pickAttackII({ ...b2, d: 1.5 }, 0.4), 'spines');
  assert.equal(R.pickAttackII({ ...b2, d: 1.5, spineCd: 3 }, 0.4), 'bite');
  assert.equal(R.pickAttackII(b2, 0.3), 'megajump');
  assert.equal(R.pickAttackII({ ...b2, jumpCd: 3 }, 0.3), 'bite');
  assert.equal(R.pickAttackII({ ...b2, jumpCd: 3, biteCd: 3 }, 0.3), 'hop');
});
const b3 = { d: 5, clones: 6, summonCd: 1, punchCd: 0, hammerCd: 0, hookCd: 0 };
test('Forma III: Puñetazo del Rey a media distancia, gancho y martillo de cerca', () => {
  assert.equal(R.pickAttackIII({ ...b3, clones: 2, summonCd: 0 }, 0.9), 'summon');
  assert.equal(R.pickAttackIII(b3, 0.3), 'punch');
  assert.equal(R.pickAttackIII({ ...b3, d: 4, punchCd: 2 }, 0.3), 'hammer');
  assert.equal(R.pickAttackIII({ ...b3, d: 1.5 }, 0.3), 'hook');
  assert.equal(R.pickAttackIII({ ...b3, d: 1.5, hookCd: 1 }, 0.3), 'hammer');
  assert.equal(R.pickAttackIII({ ...b3, d: 12, punchCd: 2 }, 0.3), 'walk');
});
test('cono del puñetazo: alcanza al frente, no a los lados ni detrás', () => {
  const H = 30 * Math.PI / 180;
  assert.ok(R.inCone(0, 0, 1, 0, 4, 0, 6.5, H));
  assert.ok(R.inCone(0, 0, 1, 0, 4, 1.5, 6.5, H));
  assert.ok(!R.inCone(0, 0, 1, 0, 4, 4, 6.5, H), 'fuera del ángulo');
  assert.ok(!R.inCone(0, 0, 1, 0, -3, 0, 6.5, H), 'detrás');
  assert.ok(!R.inCone(0, 0, 1, 0, 7, 0, 6.5, H), 'más allá del alcance');
});
