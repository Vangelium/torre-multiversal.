'use strict';
// Torre Multiversal · Vegetación v2.0 «Flora»: catálogo por bioma, semillas y reparto por el mundo.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path');
const V = require('../../beta/vegetacion.js');
const { FLORA, BIOMES, BY_BIOME, TPL, Field, keyOf, dropsOf, spriteList, stubble, shapeOf } = V;

/** Mapa falso de 96 × 96: dos biomas separados en x = 48, un lago, un camino de tierra y un árbol. */
function fakeTerrain(id = 'torre-prueba', biomes = ['tundra', 'cristal']) {
  const w = 96, h = 96, T = { id, w, h, kind: new Uint8Array(w * h), level: new Uint8Array(w * h), biome: new Uint8Array(w * h), biomes, obstacles: [], spawns: [{ x: 48, y: 88 }], portals: [], lamps: [] };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    T.biome[k] = i < 48 ? 0 : 1;
    if (Math.hypot(i - 70, j - 30) < 8) T.kind[k] = 1;            // lago
    if (j > 60) T.level[k] = 1;                                      // escalón
  }
  T.inBounds = (i, j) => i >= 0 && j >= 0 && i < w && j < h;
  T.dirtAt = (i, j) => (i >= 20 && i <= 22) ? 1 : 0;               // camino vertical de tierra
  T.obstacles.push({ x: 30, y: 30, r: 0.8 });
  T.obstacleCells = () => { const a = new Array(w * h); T.obstacles.forEach((o, n) => { const k = Math.floor(o.y) * w + Math.floor(o.x); (a[k] = a[k] || []).push(n); }); return a; };
  return T;
}

test('Flora: cada bioma tiene pasto, flores y matorral, y nombres e ids únicos', () => {
  assert.ok(FLORA.length >= 30, 'al menos 30 especies');
  for (const b of Object.keys(BIOMES)) {
    const L = BY_BIOME[b];
    assert.ok(L.pasto.length >= 1 && L.flor.length >= 2 && L.matorral.length >= 1, b + ': le faltan plantas');
  }
  assert.equal(new Set(FLORA.map(s => s.id)).size, FLORA.length);
  assert.equal(new Set(FLORA.map(s => s.name)).size, FLORA.length);
  assert.equal(new Set(FLORA.map(s => s.seedKey)).size, FLORA.length);
});

test('Flora: cada flor de otro color es otra especie (dentro de un bioma no se repite el color)', () => {
  for (const b of Object.keys(BIOMES)) {
    const cols = BY_BIOME[b].flor.map(s => s.petals.b);
    assert.equal(new Set(cols).size, cols.length, b + ': dos flores con el mismo color');
  }
});

test('Flora: cada especie suelta su propia semilla y todas están registradas en la mochila del juego', () => {
  const g = fs.readFileSync(path.join(__dirname, '../../beta/game.js'), 'utf8');
  for (const sp of FLORA) {
    assert.ok(dropsOf(sp).some(d => d[0] === sp.seedKey), sp.id + ': no suelta su semilla');
    for (const t of sp.art) assert.ok(dropsOf(sp, t).some(d => d[0] === sp.seedKey), sp.id + '/' + t);
    assert.ok(g.includes(JSON.stringify(sp.seedKey) + ':Object.freeze({name:' + JSON.stringify(sp.seedName)), sp.seedKey + ' falta en beta/game.js');
  }
  assert.ok(g.includes('["Semillas",l=>!!l.sem]'), 'la mochila no tiene el grupo Semillas');
});

test('Flora: imágenes, rastrojos e íconos de semilla caben y no se repiten', () => {
  const L = spriteList(), ids = L.map(q => q[0]);
  assert.equal(new Set(ids).size, ids.length);
  const px = L.reduce((s, [, r]) => s + (r[0].length + 2) * (r.length + 2), 0);
  assert.ok(px < 30000, 'demasiados píxeles para la franja libre del atlas: ' + px);
  for (const t of Object.keys(TPL)) { const k = shapeOf(t).keep; assert.ok(k < TPL[t].length && stubble(TPL[t], k).length === k, t); }
});

test('Reparto: determinista, sin repetidas entre trozos y sin plantas encimadas', () => {
  const T = fakeTerrain(), F1 = new Field(T), F2 = new Field(T);
  const all = [];
  for (let cy = 0; cy < 6; cy++) for (let cx = 0; cx < 6; cx++) {
    const a = F1.chunk(cx, cy), b = F2.chunk(cx, cy);
    assert.deepEqual(a.map(keyOf), b.map(keyOf), 'el trozo ' + cx + ',' + cy + ' cambia entre dos visitas');
    all.push(...a);
  }
  assert.ok(all.length > 2000, 'hay pocas plantas: ' + all.length);
  const keys = all.map(keyOf); assert.equal(new Set(keys).size, keys.length, 'una planta quedó en dos trozos');
  // Sin solapes (también a través del borde de los trozos).
  const small = all.filter(p => !p.thick), thick = all.filter(p => p.thick);
  const ov = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const grid = new Map(); for (const p of small) { const k = Math.floor(p.x) + ',' + Math.floor(p.y); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
  let bad = 0;
  for (const p of small) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const q of grid.get((Math.floor(p.x) + dx) + ',' + (Math.floor(p.y) + dy)) || []) if (q !== p && ov(p.box, q.box)) bad++;
  assert.equal(bad, 0, 'matas encimadas');
  for (const t of thick) for (const p of small) assert.ok(!ov(t.box, p.box), 'una mata dentro de un matorral');
  for (const t of thick) for (const u of thick) if (t !== u) assert.ok(Math.hypot(t.x - u.x, t.y - u.y) >= 3.2 - 1e-9, 'matorrales pegados');
});

test('Reparto: respeta biomas, agua, tierra, obstáculos, escalones y el campamento', () => {
  const T = fakeTerrain(), F = new Field(T, { exclude: [{ x: 48, y: 88, r: 3.2 }] }), all = [];
  for (let cy = 0; cy < 6; cy++) for (let cx = 0; cx < 6; cx++) all.push(...F.chunk(cx, cy));
  for (const p of all) {
    const k = Math.floor(p.y) * T.w + Math.floor(p.x);
    assert.equal(p.sp.biome, T.biomes[T.biome[k]], p.sp.id + ' fuera de su bioma');
    assert.equal(T.kind[k], 0, 'planta en el agua');
    assert.ok(!(p.x > 19.3 && p.x < 23.7), 'planta sobre el camino de tierra (' + p.x.toFixed(2) + ')');
    assert.ok(Math.hypot(p.x - 30, p.y - 30) > 0.8, 'planta dentro del árbol');
    assert.ok(Math.hypot(p.x - 48, p.y - 88) > 3.2, 'planta en el campamento');
    assert.ok(Math.abs(p.y - 61) >= 0.3, 'planta en el borde de un escalón');
  }
  const biomes = new Set(all.map(p => p.sp.biome)); assert.deepEqual([...biomes].sort(), ['cristal', 'tundra']);
  const kinds = new Set(all.map(p => p.sp.kind)); for (const k of ['pasto', 'flor', 'matorral']) assert.ok(kinds.has(k), 'falta ' + k);
});

test('Reparto: el Valle (sin biomas) usa la pradera y otro mundo da otro reparto', () => {
  const T = fakeTerrain('valle-alba', null); T.biomes = null;
  const a = new Field(T).chunk(2, 2);
  assert.ok(a.length > 50 && a.every(p => p.sp.biome === 'pradera'));
  const b = new Field(fakeTerrain('torre-9', ['pradera', 'pradera'])).chunk(2, 2);
  assert.notDeepEqual(a.map(keyOf), b.map(keyOf));
});
