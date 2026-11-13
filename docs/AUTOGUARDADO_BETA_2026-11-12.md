# Guardado automático en la nube por personaje · beta · 12-11-2026

Autor: Claude (Opus). Primera tarea del traspaso: «cambiar de celular sin perder nada».

## Problema encontrado
1. El guardado en la nube venía **apagado**. Si el jugador no lo activaba en
   Pausa → Cuenta, la nube quedaba con una versión vieja y el otro celular
   cargaba progreso atrasado.
2. Guardaba cada 2 minutos y nunca al cerrar o minimizar el navegador.
3. Un error de red lo apagaba para siempre.
4. El motor cambia solo el reloj del mundo, el tiempo jugado y los segundos de
   expedición: un celular solo encendido subía versiones y creaba conflictos.
5. «Recuperar nube» cargaba la partida con la sesión abierta: el personaje
   seguía en su lugar antiguo y el siguiente guardado pisaba lo recuperado.

## Cambios
- `beta/character-sync.js` (v3): automático por defecto; guarda cada minuto,
  al pausar, al salir, al minimizar/cerrar, antes de cambiar de personaje y al
  volver internet. Ignora los datos que cambian solos. Indicador en el HUD
  (Guardado / Guardando / Sin red / Revisar / Pausado / En sala). Al volver a la
  app detecta si otro celular guardó algo más nuevo. Solo el jugador puede
  pausarlo (clave nueva `tm.char.sync.auto.v2.*`; la antigua `enabled` se ignora).
- `beta/conflict-center.js`: «Recuperar nube» sale al menú, carga y vuelve a
  entrar con sesión nueva. Ya no apaga el guardado automático.
- `beta/account-center.js`: sube el progreso antes de cambiar de personaje.
- `beta/index.html`: textos del panel y versiones de caché.

## Se mantiene
CAS por revisión, nunca sobrescribir una revisión no vista, copia local previa
(`tm.char.sync.remote.before.*`), `verified=false`, juego oficial intacto,
pausa en cooperativo. Sin cambios en Supabase (tablas, RLS ni triggers).

## Pruebas
`tests/beta-sync/test_dos_celulares.py`: 28/28 en Chromium con nube simulada.
Pendiente: prueba con dos celulares reales contra el Supabase real.
