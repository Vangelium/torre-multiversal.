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

## Guardados por personaje (11-11-2026, etapa beta)
- Nueva tabla aditiva `tm_character_saves`: clave compuesta `(user_id, profile_id)`, RLS por cuenta, datos no verificados.
- La tabla antigua `tm_cloud_saves` y `tm_legacy_backups` permanecen intactas y consultables.
- Autoguardado opt-in por cuenta **y personaje**. Tras cambiar de personaje debe activarse para el nuevo; no reutilizar las preferencias previas.
- Antes de fusionar: probar dos teléfonos, dos usuarios y múltiples personajes, cambios concurrentes, inicio/cierre de sesión, red cortada y multijugador. Nada de publicación automática.

## Presentación de Vangelium y OAuth (iteración beta)
- `vangelium-intro.js` muestra una portada animada **una vez por sesión**; usar `?intro=1` para volver a verla. No toca guardados ni sesiones.
- Google y Apple usan `signInWithOAuth` con retorno al directorio beta. Sus botones ya están conectados, **pero no funcionarán hasta configurar ambos proveedores externos y la URL autorizada de redirección** en Supabase.
- Sigue disponible entrar/crear cuenta con correo y contraseña. No confiar en coincidencias de correo para fusionar automáticamente identidades de proveedores.
- Corregido el botón de actualizar ranura, que antes retornaba sin consultar mientras la operación se marcaba ocupada.
- No hay cambios en `main`; no fusionar antes de probar dos teléfonos y la recuperación de todos los personajes.

## Seguridad al cambiar entre tres o más personajes
- Antes de cualquier restauración o cierre de sesión, el centro de cuenta conserva una copia local por **`user_id + profile_id`**; además conserva la versión anterior inmediata de esa copia.
- «Buscar personajes y copias de este celular» descubre esas copias separadas y las muestra al usuario de la cuenta correspondiente.
- No son sustitutos de sincronización en nube: pérdida total del móvil o borrado de datos del navegador puede hacerlas inaccesibles.
- Supabase puede asociar automáticamente identidades cuando los proveedores verifican el mismo correo; nunca asumir que Apple Private Relay y Gmail corresponden a una misma cuenta.
