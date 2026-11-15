'use strict';
// El normalizador del guardado dentro de beta/game.js conserva linaje y ritual de mundo.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '../../beta/game.js'), 'utf8');
const i = src.indexOf('function __tmKingSave(s){');
const j = src.indexOf('return r}', i) + 'return r}'.length;
// eslint-disable-next-line no-new-func
const kingSave = new Function('sb', 'O5', src.slice(i, j) + '\nreturn __tmKingSave;')((a) => a, null);

test('el motor conserva corona, cuenco, pistas y materiales', () => {
  const r = kingSave({ rite: { clues: 15, crown: { id: 'corona-abc', at: 9 }, crownPlaced: true, bowl: true, stone: 4, gel: 2 } });
  assert.deepEqual(r.rite, { clues: 15, crown: { id: 'corona-abc', at: 9 }, crownPlaced: true, bowl: true, stone: 4, gel: 2 });
});
test('el motor rechaza una corona inventada y topes fuera de rango', () => {
  const r = kingSave({ rite: { crown: { id: '<x>' }, crownPlaced: true, stone: 999, gel: -4, clues: 99 } });
  assert.deepEqual(r.rite, { clues: 15, crown: null, crownPlaced: false, bowl: false, stone: 30, gel: 0 });
});
test('el motor conserva el linaje del Rey', () => {
  const king = { hue: 'azul', mix: [0, 10, 0], level: 3, seed: 5, x: 1, y: 1, world: 'valle-alba', hp: 100, maxHp: 500, atk: 20, speed: 1.2, lineage: 'renacido-2', fragments: 10 };
  const r = kingSave({ stage: 'battle', king });
  assert.equal(r.king.lineage, 'renacido-2'); assert.equal(r.king.fragments, 10);
  assert.equal(kingSave({ stage: 'battle', king: { ...king, lineage: 'falso' } }).king.lineage, 'silvestre');
});
