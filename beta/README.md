# Torre Multiversal - Beta de persistencia

Esta carpeta es una copia de pruebas. No se ha fusionado el PR #1 ni se han reemplazado los archivos raíz de GitHub Pages.

Publicación prevista: https://vangelium.github.io/torre-multiversal./beta/

- El motor y los controles corresponden a la rama de desarrollo de cuentas de Supabase (10/11/2026).
- Los datos del navegador usan claves propias `tm.beta.v1.*` para no sobrescribir `tm.save` ni `tm.save.bak` del juego público.
- En la primera carga, si existe un guardado del juego oficial en el mismo dominio, la beta toma una **copia de solo lectura** de `tm.save` y `tm.save.bak` como punto de partida. Después, los guardados se separan.
- La sesión Auth beta usa la clave `tm.beta.cloud.auth.v1`; el cliente Realtime mantiene el protocolo cooperativo existente.
- Las copias de Supabase se almacenan sin certificación económica `verified=false`. Nunca conceder dinero ni materiales a partir de un respaldo importado.
- En Supabase Authentication → URL Configuration se debe permitir como redirect URL exacta `https://vangelium.github.io/torre-multiversal./beta/`, además del sitio principal, antes de probar enlaces de confirmación de email.
- No usar la beta como entorno estable para guardar el único ejemplar de una partida.
- Validar registro, confirmación de correo, copias, restauración, cierre de sesión y multijugador real en dos dispositivos antes de fusionar el PR.

Regreso al juego oficial: https://vangelium.github.io/torre-multiversal./
