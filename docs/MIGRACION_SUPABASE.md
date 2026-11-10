# Torre Multiversal | Migración Supabase

**Última verificación:** 10 de noviembre de 2026  
**Proyecto:** `cogwkcmlkurzagygnivy` | Organización: TorreMultiversal  
**Despliegue actual:** GitHub Pages desde `main`  
**Código nuevo:** `feature/supabase-persistencia-20261110` (PR #1 en **borrador**, **no desplegado**).

## 1. Diagnóstico de producción
- Juego web de HTML, Three.js y JavaScript empaquetado; el código web identifica versión `0.23.0-anomalias` cuando se efectuó la auditoría.
- El multijugador ya usa Supabase Realtime **Broadcast**. Sus salas no dependen de tablas nuevas; el cliente original se crea con `persistSession:false`.
- La partida local usa `localStorage['tm.save']`, respaldo `tm.save.bak`, sobre `TM1:` y formato de datos **19**; el usuario puede exportar/importar en Pausa → Guardado.
- Un guardado local y su checksum FNV-1a pueden manipularse desde el navegador; nunca deben convertirse en moneda, ítems o derechos de propiedad certificados.
- Al auditar inicialmente el servidor: 0 tablas en `public`, 0 usuarios Auth, 0 Edge Functions y 0 migraciones existentes.
- La migración de dominio de Netlify a GitHub Pages **no** traslada automáticamente `localStorage` entre dominios. Los jugadores anteriores deben exportar el código en el dominio anterior e importarlo en el nuevo.

## 2. Cambios aplicados a la base de datos
Las siguientes migraciones **YA ESTÁN APLICADAS EN EL PROYECTO REAL** y se incluyen bajo `supabase/migrations/` usando los identificadores exactos de historial:

| Migración | Resultado |
|---|---|
| `20261110220121_tm_restrict_rls_ddl_trigger_execute_20261110.sql` | Revoca EXECUTE público de `public.rls_auto_enable()`, conservando el event trigger de RLS. |
| `20261110220144_tm_persistence_foundation_20261110.sql` | Crea las cinco tablas de persistencia con RLS y permisos restrictivos. |
| `20261110222203_tm_personal_backup_quota_20261110.sql` | Cuota máxima de 20 copias por cuenta; función de trigger protegida en esquema no expuesto; permite al usuario eliminar solo sus propias copias. |

Tablas: `tm_players`, `tm_legacy_backups`, `tm_economy_events`, `tm_inventory_lots`, `tm_currency_ledger`.

### Seguridad verificada
- RLS habilitado en **todas** las tablas.
- `anon` no tiene permisos de escritura.
- `authenticated` solo puede insertar/actualizar su propio perfil e insertar/leer/eliminar sus respaldos personales según las políticas. No puede crear lotes, eventos ni movimientos monetarios.
- El trigger de cuota no tiene permiso EXECUTE para `anon` ni `authenticated`; está fuera de esquemas expuestos.
- **Supabase Security Advisor: cero advertencias** tras las tres migraciones.
- Los avisos informativos de índices aún sin uso son normales porque las tablas están vacías; deberán revisarse cuando haya datos.
- No se modificaron los objetos o políticas existentes de Realtime.

## 3. Código implementado en rama de desarrollo (no disponible en sitio público)
- `game.js`: crea un cliente independiente de Supabase Auth con sesión persistida bajo `tm.cloud.auth.v1`. No modifica la conexión Realtime original.
- `index.html`: incluye el módulo «Respaldo en la nube (Beta)» en Pausa → Guardado y carga `cloud-save.js`.
- `cloud-save.js`:
  - Registro, inicio/cierre de sesión por correo y contraseña, confirmación por correo si el proveedor la exige.
  - Obtiene copia desde el exportador TM1 actual del juego y guarda `payload.raw` como cadena inalterada.
  - Verifica el checksum local antes de enviar, calcula SHA-256 del **estado de juego** para deduplicar, limita los backups al tamaño permitido.
  - Lista hasta 20 copias de la cuenta; permite eliminar una copia con confirmación sin afectar `tm.save`.
  - Restaura únicamente con confirmación; guarda la versión local anterior en `tm.cloud.pre_restore` y utiliza el **importador oficial** del juego.
  - Bloquea restauración si detecta sala cooperativa activa; deja los guardados del navegador operativos si falla la nube.
  - Los backups se clasifican como `verified=false`: son históricos personales, **no** fuente de verdad para la economía.
- Nota crucial: PostgreSQL `jsonb` reordena claves; almacenar el sobre TM1 como objeto reserializado rompería el checksum. Guardar y recuperar exactamente la cadena original.

## 4. Pruebas realizadas
- Sintaxis de `game.js` y `cloud-save.js` compilada correctamente.
- Presencia de todos los elementos de UI requeridos y carga local compatible con CSP.
- Pruebas JavaScript con servicios simulados: estado no conectado, login, creación/listado de copia personal, recuperación y preservación del guardado local previo.
- Consultas directas a Supabase: historial de migraciones, tablas, permisos, políticas, triggers y Advisor verificados.

## 5. Pruebas pendientes antes de fusionar el PR
1. En Supabase Dashboard → **Authentication → URL Configuration** configurar el Site URL y permitir como redirección `https://vangelium.github.io/torre-multiversal./`. Revisar habilitación de Email Auth.
2. Probar creación de cuenta real con correo de prueba y confirmación. Nunca publicar contraseñas.
3. Probar respaldo y recuperación en dos navegadores diferentes, incluido Android, y comparar avatar, experiencia, mascotas, bestiario y equipos.
4. Probar exportación/importación desde el antiguo dominio de Netlify mediante el código TM1 si existe progreso allí.
5. Probar límites de cuota, login fallido, acceso cruzado entre usuarios, red desconectada, datos corruptos, tamaño máximo y colisiones de guardados.
6. Probar salas cooperativas reales de 2–4 jugadores, combate, sincronización, desconexión/reconexión, permisos Auth y el bloqueo de restauración en cooperativo.
7. Verificar que los guardados locales existentes sigan disponibles sin cuenta, con cuenta y tras cerrar sesión.
8. Fusionar únicamente si se cumplen todos los criterios, con posibilidad de revertir la UI sin borrar tablas ni datos.

## 6. Pendiente de arquitectura autoritativa
La economía futura, el inventario comercial, los cristales y las propiedades necesitan operaciones transaccionales idempotentes en el servidor (RPC/Edge Functions o backend dedicado), con autorización real, cotas y pruebas de concurrencia. La actual copia de un guardado local **no** es una migración autoritativa de esas entidades.

**Regla de lanzamiento:** mantener `main` intacta hasta tener pruebas de integración reales.
