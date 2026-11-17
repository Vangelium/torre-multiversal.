'use strict';
// Torre Multiversal · Combate v2 «Esencias»: reglas puras, guardado y enganches con el motor.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path');
const K = require('../../beta/combate.js');
const GAME = fs.readFileSync(path.join(__dirname, '../../beta/game.js'), 'utf8');

test('hay una habilidad por cada criatura del bestiario, con datos completos', () => {
  const i = GAME.indexOf('vs=Object.freeze({limo:dt(');
  const species = [...GAME.slice(i, i + 30000).matchAll(/([a-zA-Z_]+):dt\(\{place:"/g)].map(m => m[1]);
  assert.ok(species.length >= 23, 'no encontré el bestiario');
  for (const s of species) assert.ok(K.BY_SPECIES[s], 'falta la habilidad de ' + s);
  const kinds = new Set(['golpe', 'proyectil', 'carga', 'salto', 'enjambre', 'picado', 'erupcion', 'raices', 'ilusion', 'zona', 'lluvia', 'aura', 'cura', 'linea']);
  for (const sk of K.SKILLS) {
    assert.ok(kinds.has(sk.kind), sk.id + ': tipo desconocido ' + sk.kind);
    assert.ok(sk.name && sk.desc && sk.glyph && sk.col && sk.col.length === 3, sk.id + ': faltan datos');
    assert.ok(sk.cd >= 4 && sk.cd <= 20, sk.id + ': recarga fuera de rango');
    if (!['aura', 'cura'].includes(sk.kind)) assert.ok(sk.dmg > 0 && sk.dmg <= 40, sk.id + ': daño fuera de rango');
  }
  assert.equal(new Set(K.SKILLS.map(s => s.id)).size, K.SKILLS.length);
  assert.equal(new Set(K.SKILLS.map(s => s.name)).size, K.SKILLS.length);
});

test('esencias: con 3 se aprende y va sola a una ranura libre; luego sube hasta el nivel V', () => {
  let s = K.normalize(null), r;
  r = K.addEssence(s, 'lanudo', 2); s = r.save; assert.equal(r.learned, false); assert.equal(s.lv.embestida, undefined);
  r = K.addEssence(s, 'lanudo', 1); s = r.save; assert.equal(r.learned, true); assert.equal(s.lv.embestida, 1); assert.equal(s.slots[0], 'embestida');
  r = K.addEssence(s, 'jabali', 3); s = r.save; assert.equal(s.slots[1], 'carga', 'segunda ranura libre');
  r = K.addEssence(s, 'zorro', 3); s = r.save; assert.equal(r.slot, -1, 'sin ranura libre no reemplaza nada'); assert.deepEqual(s.slots, ['embestida', 'carga']);
  r = K.addEssence(s, 'lanudo', 5); s = r.save; assert.equal(r.levelUp, 2);
  r = K.addEssence(s, 'lanudo', 1000); s = r.save; assert.equal(s.lv.embestida, 5); assert.equal(K.levelOf(s.ess.lanudo), 5);
  assert.equal(K.addEssence(s, 'dragon', 3).skill, null, 'especie desconocida no hace nada');
  for (let i = 1; i < K.NEED.length; i++) assert.ok(K.NEED[i] > K.NEED[i - 1]);
});

test('equipar: intercambia ranuras, no duplica y no deja equipar lo no aprendido', () => {
  let s = K.normalize({ lv: { embestida: 1, carga: 2, ilusiones: 1 }, slots: ['embestida', 'carga'] });
  s = K.equip(s, 0, 'carga'); assert.deepEqual(s.slots, ['carga', 'embestida']);
  s = K.equip(s, 1, 'ilusiones'); assert.deepEqual(s.slots, ['carga', 'ilusiones']);
  s = K.equip(s, 0, 'pinza'); assert.deepEqual(s.slots, ['carga', 'ilusiones'], 'no aprendida');
  s = K.equip(s, 1, null); assert.deepEqual(s.slots, ['carga', null]);
});

test('el guardado se normaliza igual aquí y en beta/game.js (y resiste datos rotos)', () => {
  const i = GAME.indexOf('function __tmSkillSave('), j = GAME.indexOf('function __tmKingSave(', i);
  assert.ok(i > 0 && j > i, 'falta el normalizador en game.js');
  const gameNorm = new Function(GAME.slice(i, j) + ';return __tmSkillSave;')();
  const cases = [null, 7, 'x', [], { ess: { lanudo: 5.7, 'MAL': 3, zorro: -2, jabali: 1e9 }, lv: { embestida: 9, carga: 0, x: 2 }, slots: ['embestida', 'embestida', 'carga'] },
    { lv: { embestida: 2 }, slots: ['nada', 'embestida'] }, { ess: Object.fromEntries(Array.from({ length: 100 }, (_, k) => ['e' + k, k])) }];
  for (const c of cases) assert.deepEqual(gameNorm(c), K.normalize(c), JSON.stringify(c));
  const n = K.normalize(cases[4]);
  assert.equal(n.ess.jabali, 9999); assert.equal(n.lv.embestida, 5); assert.equal(n.lv.x, 2); assert.deepEqual(n.slots, ['embestida', null]);
  assert.ok(GAME.includes('habilidades:__tmSkillSave(null)') && GAME.includes('habilidades:__tmSkillSave(o.habilidades)'));
});

test('nivel, combo y críticos', () => {
  const sk = K.BY_ID.embestida;
  assert.equal(K.skillDamage(sk, 1), 20); assert.equal(K.skillDamage(sk, 5), 40); assert.equal(K.skillDamage(sk, 3, 1.5), 45);
  assert.ok(K.scale(sk, 5).cd < K.scale(sk, 1).cd);
  assert.equal(K.comboTier(9), null); assert.equal(K.comboTier(10)[1], 0.05); assert.equal(K.comboTier(60)[1], 0.15); assert.equal(K.comboTier(500)[1], 0.25);
  assert.equal(K.critChance(0), K.CRIT.base); assert.ok(K.critChance(1000) <= K.CRIT.base + K.CRIT.maxBonus + 1e-9);
});

test('el motor instala el combate solo con ?combate=1 y la página carga el módulo antes que game.js', () => {
  assert.ok(GAME.includes('get("combate")==="1"&&typeof window.__TM_COMBAT_INSTALL__==="function"&&window.__TM_COMBAT_INSTALL__(o'));
  const html = fs.readFileSync(path.join(__dirname, '../../beta/index.html'), 'utf8');
  const a = html.indexOf('src="combate.js'), b = html.indexOf('src="game.js');
  assert.ok(a > 0 && b > a);
});
