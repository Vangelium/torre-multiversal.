# HUD compacto para celular · beta (`/beta/?hud=1`)

> **Estado (16-11-2026): en beta, desactivado por defecto. NO publicado en producción.
> Pendiente de aprobación tras probarlo en Android.**

## Problema
En un teléfono vertical (412 × 860 px CSS) los paneles superiores —vida, meta,
expedición, eco, objetivo y avisos— bajaban hasta **239 px** (28 % de la pantalla),
y los avisos y la telemetría tapaban todavía más.

## Solución (`beta/hud-compacto.js`)
Solo reacomoda con CSS lo que ya existe; no cambia la lógica del juego ni oculta datos.
- Fila 1: reloj, coronas, Bestias / Mapa / Equipo / menú (34–38 px de alto, siguen tocables).
- Fila 2: vida y nivel a la izquierda; objetivo (criatura marcada) a la derecha.
- Fila 3: **una sola línea** con meta · expedición · eco, recortada con «…». Al tocar,
  se abre el mismo detalle de siempre (panel de metas / progreso de la expedición).
- Se ocultan solo las líneas largas de la meta (siguen en el panel de metas).
- Avisos justo debajo de los chips; telemetría (`?tel=1`) abajo al centro.
- Pelea con el Rey Slime: la barra del jefe sube bajo la vida (o bajo el eco si está
  visible) y los avisos quedan debajo de la barra.
- Solo se aplica en pantallas de hasta 520 px de ancho; en escritorio no cambia nada.

## Resultado medido (Chromium, 412 × 860)
| | Antes | Compacto |
|---|---|---|
| Borde inferior de los paneles | 239 px | **124 px** |
| Avisos empiezan en | 214 px | 130 px |
| Telemetría | 267 px (sobre el juego) | abajo al centro |

## Pruebas
`tests/hud/hud.test.cjs` (3): sin `?hud=1` no hace nada; con `?hud=1` todas las reglas
quedan dentro de `@media (max-width:520px)`; no oculta vida, objetivo, botones ni chips.
En el navegador 9/9: modo activo, la meta abre el panel de metas, la expedición muestra
su progreso, el eco se puede tocar, botones superiores tocables, nada se superpone,
sin errores, escritorio idéntico, sin `?hud=1` sin cambios. Capturas en
`docs/evidencias/hud-compacto-v1/`. **Sin probar en Android.**
