# Torre Multiversal — fuente histórica recuperada

**Origen:** archivos `Torre Multiversal.html` y `Torre Multiversal.md` entregados por el usuario el 16-11-2026.

**Importante:** estos archivos representan una versión histórica del juego, **no la implementación actual** de `main` ni la beta. No sustituir `index.html` ni `game.js` en producción con ellos. La versión exacta de origen no puede demostrarse con este archivo por sí solo; el nombre de rama `fuentes/motor-v0.15` se utiliza como etiqueta organizativa y NO certifica su versión.

- `Torre Multiversal.html`: copia **idéntica al original adjunto**, HTML autónomo con CSS y JavaScript legibles integrados.
- `motor-original.js`: extracción literal del script inline del HTML; sirve para revisión y refactorización posterior.
- `estilos-original.css`: extracción literal de la hoja `<style>` del HTML.
- `Torre Multiversal.md`: texto de interfaz extraído, **no** el motor.

## Verificación

- SHA-256 de `Torre Multiversal.html`: `2cb2cac2ce30cff878b8fa0475a1ff11f3b22c4020fe25faf7f9369cdcb781a0`
- JavaScript extraído pasa `node --check`. Esta comprobación **no** garantiza que funcione el juego ni la compatibilidad de partidas.
- En la fuente archivada se observa `localStorage` (`torre_multiversal_v2`), arte 2D generado con Canvas y render con Three.js r128 desde CDN. No se encontraron implementaciones de Supabase ni multijugador, ni vegetación dinámica v12.5 o Rey Slime moderno.

## Uso recomendado

Recuperar gradualmente módulos de la fuente y compararlos con la beta actual. Introducir componentes mediante pruebas y cambios aislados, conservando los datos de cuentas y guardados. Nunca fusionar esta rama directamente en producción.
