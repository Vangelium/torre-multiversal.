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

### Última comprobación de seguridad y despliegue
- La beta corrigió el mensaje de éxito ocultado tras la restauración, y usa el parámetro de caché `cloud-save.js?v=beta-recovery-20261110-r3`.
- Confirmado en GitHub: archivos oficiales `main:index.html` SHA `67a7970c...` y `main:game.js` SHA `f552ed0a...` siguen intactos; PR #1 permanece en borrador.
- Supabase mantiene **2 cuentas** y **5 respaldos**. No se eliminaron ni alteraron sus datos.
- Una última revisión del Security Advisor mostró **1 advertencia de configuración Auth** nueva/no detectada antes: `auth_leaked_password_protection` (protección contra contraseñas filtradas deshabilitada). No es la causa demostrada del fallo de acceso. Corregir desde el dashboard de Auth cuando corresponda: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- No fue posible verificar externamente la entrega HTTP de GitHub Pages desde este entorno. Falta abrir la URL beta real tras el cache-busting en ambos teléfonos.

## Confirmación posterior del usuario
El usuario confirmó que **ya consiguió completar el procedimiento de recuperación de una partida en otro móvil** después de las correcciones de beta. Se considera prueba manual positiva del flujo de acceso/restauración entre dispositivos según reporte del usuario. **No** está confirmado todavía, por inspección independiente, que todos los atributos del personaje (mascotas, inventario, progresión) se hayan restituido ni se han probado aún las dos sesiones multijugador simultáneas. No fusionar PR hasta pruebas pendientes.

## Confirmación manual adicional del usuario: cooperativo en dos celulares
En la conversación del 10/11/2026, después de restaurar una partida con la beta, el usuario confirmó que **también realizó la prueba de multijugador desde los dos teléfonos**, uno con su cuenta y otro con la cuenta de su pareja. Registrar como **prueba manual realizada según el usuario**; su mensaje no especificó resultados técnicos de movimiento, combate ni reconexión, por lo que no dar esos subcasos por verificados automáticamente. Pendiente de documentar detalles si surgen fallos. Se conserva el PR #1 en borrador y el juego oficial sin actualización del sistema cloud.

---

## Fase siguiente implementada: ranura de autoguardado opcional (10/11/2026)
- **Supabase real**: migración `20261110234604_tm_optional_cloud_slot_cas_20261110` aplicada y versionada en `supabase/migrations/`. Tabla nueva `tm_cloud_saves`, única por usuario; RLS activado; Auth puede leer/insertar/actualizar su propia ranura; anon no puede escribir.
- Campo `revision` de control de concurrencia con trigger de integridad: solo admite incremento de exactamente 1 y mantiene inmutable el `user_id/profile_id`. En la API, UPDATE filtra por versión anterior, detectando cambios hechos desde otro móvil.
- Se conserva `verified=false`: este slot tampoco otorga moneda ni inventario autoritativo. Las cinco copias históricas de dos cuentas no se alteraron.
- Script independiente `cloud-auto.js` en rama PR #1 y `beta/cloud-auto.js` en main. UI `index.html` en rama y `beta/index.html` en main. Ningún archivo raíz de producción modificado.
- **Opt-in**: autoguardado desactivado hasta que el usuario pulse Activar. Se ejecuta cada **3 minutos**, solo con cuenta conectada y pestaña visible, y se detiene mientras la sala cooperativa está activa.
- **Conflictos**: si otro dispositivo ha cambiado la revisión, se suspende la sincronización en lugar de sobrescribir. Si el personaje difiere de la ranura remota, tampoco sobreescribe; para recuperarlo existe botón **Recuperar ranura** con confirmación y respaldo local previo separado en `tm.cloud.slot.pre_restore` (prefijado en beta).
- **Pruebas simuladas**: sintaxis, creación de ranura, actualización de revisión, conflicto con otro móvil y restauración con respaldo previo, todas correctas. **Pendientes pruebas físicas de autoguardado**, navegador móvil y recuperación tras recargar.
- **Seguridad Supabase**: ninguna alerta nueva en las tablas; permanece advertencia de configuración Auth de comprobación de contraseñas filtradas deshabilitada, pendiente de resolver en el dashboard si está disponible.
- **Importante para Opus**: no migrar aún las ranuras a autoridad económica. No fusionar PR #1 sin validación real y plan de resolución de conflictos; el juego oficial sigue intacto.


---

## Rediseño del Centro de Cuenta (10/11/2026; posterior a prueba de usuarios)
**Problema real reportado:** acceso y recuperación confundían email, perfil del personaje, respaldos históricos, slot automático y códigos TM1. Un usuario trató de recuperar un personaje cuya copia no estaba asociada al correo esperado.

**Diagnóstico directamente desde Supabase:** la cuenta relacionada con ese acceso tiene respaldos de dos personajes históricos (uno con 14.694 XP y 7 mascotas; otro inicial con 0 XP) y una ranura automática del personaje inicial. El personaje solicitado **no aparece bajo ese nombre en esos datos**. Esto NO prueba pérdida de la partida: podría estar en el dispositivo original o un respaldo local del navegador. No modificar las filas históricas, no asignar un personaje artificialmente a un usuario, y no usar metadata editable para autorizar movimientos económicos.

**Cambio real publicado SOLO en la beta**:
- `beta/index.html`: pestaña **Cuenta** en lugar de Guardado. Estructura móvil limpia: entrar con el correo → ver cuenta conectada y personaje local → tarjetas separadas de cada personaje de la nube → botón directo **Continuar con [personaje]**. Los controles TM1 y el autoguardado experimental quedan disponibles bajo «Transferencia manual» / «Opciones avanzadas».
- `beta/account-center.js`: script único para pantalla principal, sin ejecutarse junto con el antiguo `cloud-save.js` (archivo anterior queda preservado como referencia). Consulta `tm_legacy_backups` + `tm_cloud_saves`, verifica checksum, agrupa por ID de perfil, ordena las versiones por fecha, muestra XP, mascotas, fecha y origen, y ofrece una acción de restauración por personaje, sin selección oculta en combo.
- Antes de cambiar, preserva la partida local en `tm.hub.previous.<user_id>` y pide confirmación. Usa exclusivamente el importador TM1 del juego; comprueba el texto «Partida cargada.» y pulsa reanudar solo cuando procede. Ningún cambio al juego oficial.
- El usuario puede **Guardar personaje de este celular** en su cuenta. Si ya tiene copias de otro personaje, advierte explícitamente antes de mezclar copias.
- Si falta un personaje en la nube, el botón **Buscar partidas anteriores de este celular** inspecciona el respaldo beta `tm.save.bak`, los backups locales previos a importaciones, y copias originales de la web oficial (SOLO LECTURA). Si encuentra el personaje, permite recuperarlo en beta con confirmación y copia previa; después el usuario debe pulsar Guardar personaje para subirlo a su cuenta.
- Recuperación de contraseña y cambio de cuenta se mantuvieron, con mensajes explícitos de error.
- CSP, motor `game.js`, Supabase Realtime y los archivos raíz oficiales de `main` quedaron intactos. Autoguardado permanece opt-in bajo «Avanzado».

**Pruebas en mocks**: inicio de sesión y recuperación de personaje histórico con juego reanudado (éxito); agrupación de varias copias en dos personajes (éxito); exploración de copia local del juego oficial y restauración en beta sin modificar el archivo original (éxito). **Pendiente**: validación física de esta nueva UX en los celulares de la pareja y una posible copia local del personaje solicitado. La nube no puede recuperar datos nunca subidos.

**Regla de ingeniería:** No fusionar PR #1 hasta pruebas móviles; usar la beta y documentar si los personajes de cada cuenta están bien asociados. Evitar que el usuario confunda cuenta de correo con personaje y el slot automático con los respaldos históricos.

---

## 11 de noviembre de 2026: vinculación real por personaje (beta, sin migrar cuentas existentes)
- Al revisar Supabase apareció la tabla `public.tm_character_saves` (PK `user_id, profile_id`), creada previamente mediante migraciones reales **20261111075939** y **20261111080304**; ambas se archivaron ahora en GitHub copiando sus sentencias exactas de `supabase_migrations.schema_migrations`, sin reejecutarlas. **La tabla sigue sin filas hasta que un jugador pulse Vincular y guardar.**
- Se descubrió que `authenticated` tenía privilegios innecesarios, incluidos TRUNCATE, DELETE y TRIGGER. Aplicada y versionada migración **20261111173201_tm_character_saves_guard_and_restrict_grants**. Ahora tiene solo SELECT, INSERT y UPDATE; `anon` sin permiso INSERT. Trigger `tm_private.tm_character_saves_guard` impide cambiar `user_id` o `profile_id`, exige `revision=OLD.revision+1`, restaura `verified=false` y fecha del servidor. RLS previa exige `auth.uid()=user_id`.
- En `account-center.js` de la rama PR #1 y `beta/account-center.js` de main se integra `tm_character_saves` como fuente prioritaria. Agrupa por ID de perfil y presenta una sola tarjeta por personaje. Las copias antiguas `tm_legacy_backups` y `tm_cloud_saves` se mantienen accesibles, pero no sustituyen la ranura vinculada.
- Botón principal **Vincular y guardar este personaje**: valida cuenta y checksum TM1, detecta el ID, crea ranura por personaje o actualiza mediante CAS de revisión (evita conflictos). Si otro móvil tiene una versión distinta y este navegador no posee la revisión vigente, se niega a sobrescribir. El jugador puede crear una **copia histórica** desde Opciones avanzadas antes de resolver el conflicto. Nunca borrar filas antiguas por automatización.
- Al tocar **Continuar con [personaje]**, se recupera la ranura recién consultada, preserva la anterior en `tm.hub.previous.<uid>`, memoriza revisión local cuando la fuente es `tm_character_saves`, y reanuda el juego si la escena del personaje ya existe. Detecta una revisión desactualizada y no carga datos obsoletos. Los respaldos y copias locales no se convierten automáticamente en slots vinculados sin pulsar guardar.
- **Seguridad**: guardar desde el cliente sigue siendo un JSON de usuario `verified=false`; todavía NO es prueba criptográfica de propiedad ni autoridad para moneda, mascotas comerciales, objetos o clasificaciones. Perfiles duplicados entre cuentas aún son posibles (por ejemplo, una copia histórica replicada); no declarar resuelto el problema de propiedad global hasta disponer de validación server-side.
- **Pruebas simuladas ejecutadas**: creación, actualización de revisión, bloqueo desde otro móvil, guardado histórico independiente; restauración con preservación local, reanudación sin importación redundante y rechazo de revisión obsoleta. Todas pasaron. **Pruebas físicas beta pendientes**: vincular un personaje real en el celular origen, abrirlo desde otro móvil, modificar progreso y actualizar, comprobar bloqueo de escritura obsoleta, multijugador. El sitio oficial permanece intacto y PR #1 sigue en draft.


## 11/11/2026: nuevo acceso Vangelium ANTES de jugar (beta separada)
Se completó una nueva puerta de entrada visual para la beta, cumpliendo parte del flujo de estudio Vangelium → acceso → personajes → entrar. El motor 3D y cliente Realtime no fueron modificados. Esta fase todavía usa **correo y contraseña**, no Google/Apple OAuth (pendiente de configurar los providers y revisar callbacks).

### Archivos y despliegue
- Nueva UI/CSS responsive en `beta/index.html` (y equivalente `index.html` de la rama del PR).
- Nuevo JavaScript `beta/entry-gate.js` (y `entry-gate.js` en PR).
- URL de pruebas: https://vangelium.github.io/torre-multiversal./beta/?revision=14
- Menú de la beta: botón adicional **Cambiar cuenta o personaje** para volver al selector sin recargar.
- Gate independiente con alto z-index que solo se oculta tras selección o entrada local confirmada. El motor sigue arrancando detrás. No se tocó `game.js` de raíz ni `beta/game.js`.
- Se mantiene enlace explícito **Abrir juego oficial**, sin autenticar, en caso de incidencia.

### Comportamiento y restricciones
- Muestra branding VANGELIUM, email/password, registro, recuperación, sesión activa, lista de personajes vinculados y respaldos históricos.
- Consulta exclusivamente filas del usuario mediante `tm_character_saves`, `tm_legacy_backups` y `tm_cloud_saves` bajo RLS. Agrupa por ID de perfil. Prioriza ranuras vinculadas; presenta otras versiones bajo detalle desplegable. No interpreta un correo como propiedad criptográfica del personaje.
- Cada tarjeta tiene **Continuar con [personaje]**: consulta de nuevo la copia elegida y verifica versión CAS cuando corresponde, valida TM1 y checksum, conserva la partida local en `tm.gateway.previous.<user_id>` y `tm.hub.previous.<user_id>`, acciona el importador oficial y espera confirmación de «Partida cargada.» antes de iniciar modo solo. Guarda la revisión local para continuar con la ranura vinculada.
- Las copias antiguas y slots experimentales ofrecen **Vincular [personaje] a esta cuenta** con confirmación, insertando una nueva fila de personaje solo si no existe. **Nunca sobrescribe una versión existente diferente**. Lo mismo para copias locales.
- **Buscar personajes de este celular** recorre almacenamiento de beta y guardados/copia de seguridad del juego oficial en **solo lectura**; permite recuperación explícita, no importa ni vincula sin confirmar.
- Modo local disponible con advertencia de que no guarda en la nube. **Crear personaje** solo abre el creador cuando no hay otro personaje con aspecto en el guardado local; no crea múltiples perfiles independientes aún (trabajo posterior de Opus). No intentar forzar creación y perder otro personaje.
- Previene la superposición del creador que el motor puede abrir al arrancar si la beta no tiene un personaje inicial. Si importa un personaje ya diseñado, cierra el overlay del creador antes de pulsar Jugar solo; si falta aspecto, mantiene abierto el creador. Respeta arranque del motor, detiene la acción si el boot aún no termina o hay error, y muestra error legible si no se puede inicializar Auth.
- Mantener import/export TM1 y menú Pausa → Cuenta como herramientas avanzadas, no sustituir la persistencia existente mientras dure la beta.

### Verificación / QA
- Test de sintaxis JavaScript, IDs únicos y presencia de todos los elementos.
- Pruebas simuladas: correo inválido/credenciales erróneas, login correcto, dos personajes diferentes, carga de personaje y reanudación, copia previa local, vinculación directa desde respaldo, control de revisión y cierre del creador inicial con personaje recuperado. Todas pasaron.
- NO se ha verificado todavía carga HTTP real de GitHub Pages mediante navegador remoto ni prueba física del nuevo selector en Android/iPhone. **No fusionar PR #1.**
- Evitar mezclas accidentales de personajes: el acceso no sube ni restaura partidas sin botón y confirmación.
- Pendiente: creación independiente de varios personajes, integración auténtica de Google/Apple OAuth, persistencia automática por personaje (no confundir con ranura opt-in antigua), autoridad de inventario y economía del servidor, regresión cooperativa.
