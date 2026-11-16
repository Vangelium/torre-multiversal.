'use strict';
// HUD compacto (?hud=1): solo reacomoda, solo en celulares, y sin el parámetro no hace nada.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '../../beta/hud-compacto.js'), 'utf8');

function run(search) {
  const added = [], classes = new Set();
  const doc = {
    documentElement: { classList: { add: c => classes.add(c) } },
    head: { appendChild: el => added.push(el) },
    createElement: () => ({}), addEventListener() {}
  };
  const win = { document: doc, location: { search } };
  vm.runInNewContext(SRC, { window: win, globalThis: win, URLSearchParams });
  return { win, added, classes };
}

test('sin ?hud=1 no cambia nada', () => {
  const r = run('?rey=1&veg=1');
  assert.equal(r.added.length, 0); assert.equal(r.classes.size, 0); assert.equal(r.win.__TM_HUD_COMPACTO__, undefined);
});

test('con ?hud=1 agrega la clase y los estilos, solo para pantallas angostas', () => {
  const r = run('?hud=1');
  assert.ok(r.classes.has('tm-hud-compacto'));
  assert.equal(r.added.length, 1);
  const css = r.added[0].textContent;
  assert.match(css, /@media \(max-width:520px\)/);
  // Todas las reglas quedan dentro del @media (no afecta escritorio).
  const outside = css.replace(/@media[^{]*\{[\s\S]*\}\s*$/, '').trim();
  assert.equal(outside, '');
});

test('no esconde información: el detalle sigue a un toque y no oculta vida, objetivo ni botones', () => {
  const css = run('?hud=1').added[0].textContent;
  for (const sel of ['#vital', '.vital', '#target-frame', '.hud-top-right', '#btn-goals', '.echo-chip']) {
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => m[1].includes(sel) && !m[1].includes('[hidden]') && /display:none/.test(m[2]));
    assert.equal(rules.length, 0, sel + ' no debe ocultarse');
  }
  // Lo único que se oculta son las líneas largas de la meta (siguen en el panel de metas).
  const hidden = [...css.matchAll(/([^{}]+)\{[^}]*display:none/g)].map(m => m[1]);
  for (const h of hidden) assert.match(h, /goal-progress|goal-next|\[hidden\]/, 'ocultación inesperada: ' + h);
});
