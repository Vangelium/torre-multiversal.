# Entrega técnica para Opus | Torre Multiversal
**Corte:** 10 de noviembre de 2026 (Chile)  
**Preparado para revisar tras la jornada del 11 de noviembre, aproximadamente a las 04:00 del 12 de noviembre (America/Santiago).**

## Objetivo
Integrar persistencia en Supabase sin destruir el multijugador existente ni los guardados del navegador. Crear una beta separada de la publicación oficial y preparar la autoridad económica futura.

## Repositorio y entornos
- Repositorio: `Vangelium/torre-multiversal.` (el punto final es parte del nombre).
- **Producción**: https://vangelium.github.io/torre-multiversal./
- **Beta de respaldos**: https://vangelium.github.io/torre-multiversal./beta/
- Rama de integración NO fusionada: `feature/supabase-persistencia-20261110`.
- Pull request en **draft**: https://github.com/Vangelium/torre-multiversal./pull/1
- Supabase real: proyecto `cogwkcmlkurzagygnivy`, organización `TorreMultiversal`, PostgreSQL 17.
- El repositorio público usa GitHub Pages desde `main`, raíz del repositorio. **No usar Netlify**.
- El motor actual en el último corte del repositorio original informa `0.23.0-anomalias`.

## Trabajos ejecutados, confirmados
1. Se recuperó acceso del conector Supabase a la **misma** base de datos que utiliza el cooperativo. Antes, el conector apuntaba a una organización vacía; se corrigió el acceso sin crear otro proyecto.
2. Auditoría inicial: no había tablas en `public`, cuentas Auth ni funciones Edge. El juego ya utilizaba **Supabase Realtime Broadcast**, sin tablas, para salas cooperativas. El guardado local usaba `tm.save`, `tm.save.bak`, exportador `TM1:` y formato 19.
3. Se aplicaron tres migraciones **reales** a Supabase:
   - `20261110220121_tm_restrict_rls_ddl_trigger_execute_20261110`: revocar ejecución web de función de trigger `rls_auto_enable()` sin deshabilitar el trigger.
   - `20261110220144_tm_persistence_foundation_20261110`: crear `tm_players`, `tm_legacy_backups`, `tm_economy_events`, `tm_inventory_lots`, `tm_currency_ledger` con RLS.
   - `20261110222203_tm_personal_backup_quota_20261110`: máximo 20 respaldos por usuario, trigger en esquema privado, borrado solo del dueño.
4. **Security Advisor**: cero alertas tras aplicar cambios. `anon` no puede insertar; `authenticated` no puede insertar directamente moneda, lotes o eventos económicos. Respaldos personales siempre `verified=false`.
5. Código nuevo en PR, no fusionado:
   - `game.js`: crea cliente Auth persistente separado de Realtime sin alterar el transporte cooperativo.
   - `index.html`: añade módulo Beta de cuenta/respaldos en Pausa → Guardado.
   - `cloud-save.js`: registro, login, confirmación por correo (si proveedor la exige), upload, lectura de hasta 20 copias, eliminación confirmada y restore confirmado.
   - `supabase/migrations/`: los tres SQL versionados con fecha y número de migración real.
   - `docs/MIGRACION_SUPABASE.md`: requisitos, seguridad, QA y procedimientos.
6. En `main` se añadió **exclusivamente** la carpeta `beta/` mediante commit `d3e5e128f92aec4e3aa8a9286a7a4ff8768d4384`. No se alteraron los blobs `index.html`, `game.js` ni `three.min.js` del juego oficial. Copias de los ocho recursos estáticos están en beta.
7. **Aislamiento local de beta**: tanto la web principal como /beta/ están bajo el mismo origen `vangelium.github.io`, por tanto comparten localStorage del navegador. Para impedir daños, beta **no** usa `tm.save` directo. Su adaptador usa el prefijo `tm.beta.v1.` y mantiene `tm.save`/bak de producción sin escritura. En la primera carga copia los guardados originales a beta como punto de partida, luego quedan separados. La autenticación beta usa `tm.beta.cloud.auth.v1` y su restore usa solo el adaptador de beta. **No revertir esta protección.**
8. `beta/manifest.webmanifest` identifica la instalación como `Torre Beta` y `beta/index.html` tiene `noindex` y etiqueta visual de pruebas.

## Comprobaciones ejecutadas
- `new Function` y verificación sintáctica del JS de integración: correcto.
- Mock de UI Auth y login: correcto.
- Mock del flujo de exportación, importación, preservación de backup anterior y borrado: correcto.
- Las tres migraciones aparecen en el historial de Supabase, cinco tablas con RLS; triggers, policies, índices básicos y permisos inspeccionados.
- Todos los ocho archivos beta existen en `main` con SHA verificable por GitHub. Los tres archivos raíz principales del juego conservaron sus SHA originales.
- **NO CONFIRMADO todavía**: respuesta HTTPS efectiva de GitHub Pages para /beta/ (el entorno de verificación externa no logró cargar el dominio), registro real de correo, sincronización de copias en 2 dispositivos y regresión real del multijugador.

## Configuración Auth realizada por el propietario
- Email Provider se vio habilitado en dashboard.
- El propietario añadió Site URL y Redirect URL de **producción** `https://vangelium.github.io/torre-multiversal./`.
- **FALTA**: añadir también `https://vangelium.github.io/torre-multiversal./beta/` a Authentication → URL Configuration → Redirect URLs, para que los enlaces de confirmación regresen al entorno beta. Verificar email confirmation en el propio dashboard.

## Secuencia de pruebas que Opus NO DEBE OMITIR
1. Abrir URL /beta/ desde celular; verificar arranque y que el sitio principal sigue funcionando.
2. Confirmar que la beta **no modifica** `localStorage['tm.save']` al jugar y restaurar, y que el namespace beta sí se actualiza.
3. Registrar correo de prueba, confirmar y regresar a /beta/, iniciar sesión. Validar RLS y cross-account access.
4. Importar/respaldar TM1, recargar, restaurar en otro dispositivo y comprobar personaje, XP, mascotas, inventario local, bestiario.
5. Probar duplicados, límite 20 copias, borrado, copias corruptas y falla de conexión.
6. Crear/unirse a sala con dos dispositivos y probar movimiento, combate, presencia, salida, reconexión, versiones de protocolo. El cliente original Realtime usa `persistSession:false` y debe continuar.
7. Después de pruebas, decidir el merge controlado del PR #1 a main, con verificación de hashes y respaldo previo.
8. **Nunca** importar moneda, inventario comercial o propiedad desde JSON local como verdad del servidor. Los datos económicos necesitan autoridad del servidor, API con idempotencia y transacciones atómicas antes de comercializar.

## Riesgos y limitaciones
- La beta es una URL **pública**, no un servidor de acceso restringido. No introducir claves `service_role` ni contraseñas en el código del repositorio.
- Supabase free tier y límites de Auth/rate limit; proteger spam y cuentas abusivas.
- Supabase Email Auth puede requerir confirmación y tiene redirecciones; el usuario debe permitir el /beta/ exacto.
- La carpeta `beta/` forma parte de `main` pero es independiente de los tres archivos raíz. El PR de integración todavía está en draft.
- Los índices nuevos pueden aparecer «unused» mientras las tablas estén vacías, lo cual no es falla.
- Los respaldos cloud se guardan como cadena original `payload.raw` dentro de JSONB porque reserializar el sobre TM1 cambia el orden de propiedades y rompe su checksum.
- El progreso de Netlify de otro origen no se transfiere por sí solo a github.io; usar el exportador TM1 desde la instalación original si aún es accesible.

## Próxima implementación después del QA
Autenticación operativa y persistencia real → endpoint validado de inventario y procedencia → transacciones de crafting y obtención de cristales → economía compartida con auditoría e idempotencia → expansión persistente y mundo compartido. Conservar la experiencia móvil y el combate como prioridad.

**INSTRUCCIÓN DE ENTREGA:** No fusionar código incompleto. Revisar primero este documento, `docs/MIGRACION_SUPABASE.md`, las tres migraciones reales y la beta. Nunca asumir que «se ve bien» equivale a «multijugador probado».

## Incidente de pruebas reales y correcciones (10/11/2026, noche)
El propietario probó con dos teléfonos, uno propio y otro de su pareja. Reportó que al intercambiar sesiones no aparecía el personaje esperado y un acceso mostraba error de credenciales/registro.

**Datos comprobados directamente en Supabase, sin exponer identidades:** existen exactamente **2 usuarios Auth confirmados y con inicio de sesión**, **2 registros tm_players** y **5 respaldos** no verificados distribuidos 1+4 entre ambas cuentas. Entre los respaldos hay un personaje de **14.694 XP con 7 mascotas en las dos cuentas**, y un personaje nuevo de **0 XP / 0 mascotas** también presente entre los cuatro respaldos de una de ellas. No hubo pérdida total de datos. Tampoco se observó un error RLS en la auditoría.

**Diagnóstico:** las cuentas son independientes de los guardados locales por teléfono. Iniciar sesión no importa un guardado automáticamente. Antes la lista de copias solo mostraba fecha y versión y permitía seleccionar implícitamente la más reciente, lo que favorecía restaurar el personaje equivocado. La UI además tenía una regla CSS `.tm-cloud-panel { display:grid }` que podía contrarrestar el atributo `hidden` dependiendo del navegador. El error real de contraseña exacto no se pudo reconstruir con certeza, pero los logs mostraban algunas respuestas Auth 400/403 durante las pruebas; ambas cuentas están confirmadas.

**Cambios aplicados:** se actualizó la **beta pública** `main:beta/cloud-save.js`, `main:beta/index.html` y su equivalente de la rama PR #1; NINGÚN archivo raíz de producción fue modificado. La nueva interfaz:
1. Muestra la cuenta conectada y el personaje local por separado.
2. Lista cada copia por **nombre, XP, mascotas y fecha**, con selección explícita vacía por defecto.
3. Advierte si se intenta subir una partida que pertenece a un perfil distinto de los respaldos de esa cuenta; requiere confirmación.
4. Muestra un mensaje claro si las credenciales son inválidas o la cuenta ya existía, recordando usar **Entrar** en el otro teléfono.
5. Incluye **Recuperar contraseña**, correo de recuperación y formulario para actualizar la contraseña al abrir el enlace PASSWORD_RECOVERY. Es esencial permitir en Supabase Auth → Redirect URLs el enlace **https://vangelium.github.io/torre-multiversal./beta/**.
6. Antes de restaurar pide confirmación con los datos de ambos personajes; conserva un respaldo previo en `tm.beta.v1.tm.cloud.pre_restore`, ejecuta el importador oficial y confirma su mensaje `Partida cargada.` en vez de anunciar éxito sin comprobarlo.
7. Mantiene los paneles ocultos con `.tm-cloud [hidden] {display:none!important}`.

**Pruebas después del arreglo:** sintaxis JS, presencia de IDs y simulación funcional de login incorrecto, login válido, selector con detalles, aviso de personaje diferente, restauración confirmada con copia local anterior y recuperación de contraseña: **todas superadas**. Siguen pendientes las pruebas físicas con ambos teléfonos tras recargar la beta actualizada. No fusionar PR ni publicar el sistema de economía autoritativa hasta superar esas pruebas.

**Instrucciones de reproducción:** entrar con el mismo correo de la cuenta que tiene el respaldo, pulsar **Entrar** y no Crear cuenta, elegir copia por XP y mascotas, pulsar Restaurar y aceptar el cambio local. No eliminar respaldos previos. Si el acceso dice credenciales inválidas, usar Recuperar contraseña; no recrear la cuenta.
