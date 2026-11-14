'use strict';
// Regresiones encontradas en la revisión de la v2 (13-11-2026).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const R = require('../../beta/rey-slime.js');

const pet = (uid, hue, extra = {}) => ({ uid, species: 'limo', hue, name: 'Gelatón', bond: 17, at: 1731500000000, hp: 63, el: 5, ...extra });
const tenOf = (hues) => hues.map((h, i) => ({ uid: 'frag' + String(i).padStart(4, '0'), hue: h }));

test('colocar y retirar devuelve EXACTAMENTE la misma mascota (nombre, vida, fecha, vínculo, elemento)', () => {
  const original = pet('gelaton01', 'azul');
  const pets = [JSON.parse(JSON.stringify(original))];
  const s = R.normalize(null);
  R.takePiece(s, pets, 'gelaton01');
  assert.equal(pets.length, 0);
  R.giveBack(s, pets, 0);
  assert.deepEqual(pets[0], original);
});
test('la ficha sobrevive a guardar y cargar (normalize) antes de retirarla', () => {
  const original = pet('gelaton02', 'rosa');
  const pets = [JSON.parse(JSON.stringify(original))];
  let s = R.normalize(null);
  R.takePiece(s, pets, 'gelaton02');
  s = R.normalize(JSON.parse(JSON.stringify(s)));          // guardar → cerrar → cargar
  s = R.normalize(JSON.parse(JSON.stringify(s)));          // recuperar desde la nube
  R.giveBack(s, pets, 0);
  assert.deepEqual(pets[0], original);
});
test('una mascota sin nombre sigue sin nombre y conserva su vida', () => {
  const original = pet('gelaton03', 'verde', { name: null, hp: 12 });
  const pets = [JSON.parse(JSON.stringify(original))];
  const s = R.normalize(null);
  R.takePiece(s, pets, 'gelaton03'); R.giveBack(s, pets, 0);
  assert.equal(pets[0].name, null); assert.equal(pets[0].hp, 12); assert.equal(pets[0].at, original.at);
});
test('no se puede duplicar un limo que ya volvió al inventario', () => {
  const pets = [pet('gelaton04', 'verde')];
  const s = R.normalize(null);
  R.takePiece(s, pets, 'gelaton04');
  pets.push(pet('gelaton04', 'verde'));
  assert.throws(() => R.giveBack(s, pets, 0), /ya está/);
  assert.equal(s.pieces.length, 1);
});
test('una ficha manipulada que no coincide con la pieza se descarta', () => {
  const s = R.normalize({ pieces: [{ uid: 'gelaton05', hue: 'azul', bond: 3, pet: pet('otrouid99', 'rosa') }] });
  assert.equal(s.pieces[0].pet, undefined);
});
test('cinco azules y cinco rosados forman un híbrido azul/rosa', () => {
  const k = R.compose(tenOf([...Array(5).fill('azul'), ...Array(5).fill('rosa')]), 7);
  assert.deepEqual(R.colorsOf(k.mix).hybrid, ['azul', 'rosa']);
});
test('cuatro verdes, cuatro azules y dos rosados: híbrido verde/azul con vetas rosas', () => {
  const c = R.colorsOf([4, 4, 2]);
  assert.deepEqual(c.hybrid, ['verde', 'azul']); assert.deepEqual(c.veins, ['rosa']);
});
test('siete rosados y tres verdes: Rey rosa con rasgos verdes, sin híbrido', () => {
  const c = R.colorsOf([3, 0, 7]);
  assert.equal(c.hue, 'rosa'); assert.equal(c.hybrid, null); assert.deepEqual(c.veins, ['verde']);
});
test('mezcla de tres colores sin empate: dominante con dos vetas', () => {
  const c = R.colorsOf([4, 3, 3]);
  assert.equal(c.hue, 'verde'); assert.equal(c.hybrid, null); assert.deepEqual(c.veins, ['azul', 'rosa']);
});
test('diez del mismo color: sin híbrido ni vetas', () => {
  const c = R.colorsOf([0, 10, 0]);
  assert.equal(c.hue, 'azul'); assert.equal(c.hybrid, null); assert.deepEqual(c.veins, []);
});
