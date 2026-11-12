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

## Incidente beta: sesiones cruzadas entre dos celulares (10/11/2026)
Pruebas reales crearon 2 cuentas Auth confirmadas y 5 respaldos bajo 2 propietarios. Una cuenta acumuló 4 copias de 2 personajes diferentes, incluida una copia de un personaje también presente en la otra cuenta. **Los respaldos no desaparecieron**, pero el flujo de recuperación era ambiguo.

La versión beta actualizada muestra nombre, XP, número de mascotas y fecha de cada copia; inicia con selección vacía, separa claramente la cuenta conectada del personaje local, avisa al mezclar personajes en la misma cuenta y comprueba el resultado de la importación. Corrige la visibilidad CSS de paneles con `[hidden]` y añade recuperación de contraseña. La rama PR contiene los mismos ajustes, sin fusionarlos a producción.

**QA de integración pendiente:** acceso real con dos celulares tras estos cambios. Asegurar redirección Auth `https://vangelium.github.io/torre-multiversal./beta/`; no basta la URL de producción. Los cinco registros existentes se preservaron sin migración destructiva.

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

## 11/11/2026: ranuras por personaje y seguridad
Migraciones reales versionadas en el repo: `20261111075939_tm_character_saves_additive_beta`, `20261111080304_tm_character_saves_remove_anon_grants` (recuperadas desde el historial aplicado), y `20261111173201_tm_character_saves_guard_and_restrict_grants` (aplicada ahora). Tabla `tm_character_saves`, clave compuesta `(user_id, profile_id)`, RLS de propietario, INSERT/SELECT/UPDATE, sin TRUNCATE/DELETE para clientes. Trigger evita cambio de propietario o perfil y exige incremento +1 de revisión.

El centro de cuentas de la beta lista primero `tm_character_saves`; conserva después `tm_cloud_saves` (slot anterior) y `tm_legacy_backups`. El botón **Vincular y guardar este personaje** crea/actualiza su ranura mediante compare-and-swap y guarda la última revisión conocida por usuario y personaje en el namespace local de beta. Ante discrepancias NO sobreescribe; requiere recuperación de la versión remota o respaldo histórico explícito. Esta vinculación es aún una copia cliente no verificada, **no** inventario autoritativo.

QA móvil pendiente. La beta cambia solo `beta/account-center.js` y `beta/index.html` en main; el juego oficial raíz no se fusionó. Se mantiene alerta Auth externa por protección de contraseñas filtradas desactivada.

---

## 11/11/2026, fase adicional: creación independiente de varios personajes (beta)

**Objetivo:** solucionar el bloqueo anterior de «Crear personaje», que no permitía crear un segundo personaje sin riesgo de sustituir el progreso único en `tm.save`.

### Implementación
- Script `entry-gate.js` tanto en la rama de desarrollo como en `main:beta/entry-gate.js`; interfaz `beta/index.html` con botón **+ Crear personaje nuevo**. Caché del script invalidada mediante `v6`.
- La beta conserva el motor `beta/game.js` original. No se cambió ninguna línea del motor ni el sitio oficial raíz.
- **Archivo local por cuenta:** antes de cambiar o iniciar otro perfil, invoca el exportador TM1 del motor para incluir posición/progreso reciente, comprueba checksum y archiva una copia independiente con índice `tm.entry.local.index.<uid>` y entradas `tm.entry.archive.<uid>.*`. Verifica cada escritura. No elimina ni limita artificialmente las copias del archivo.
- **Creación de nuevo personaje:** con sesión verificada, guarda el perfil anterior y los slots locales del motor; registra `tm.entry.pending.<uid>` y, si ya existe un personaje diseñado, limpia *solo* las claves activas de la beta con posibilidad de rollback inmediato ante fallos; recarga la página para que el motor genere nuevo `profile.id`. No reutiliza la ID anterior. No toca `localStorage['tm.save']` del juego oficial.
- **Primer personaje:** si no había aspecto, el motor conserva su nuevo ID actual y muestra directamente el creador, sin recarga ni borrado innecesario.
- **Al pulsar Despertar:** comprueba cuenta, ID, checksum y personaje final; archiva la copia recién creada; crea una nueva fila no verificada `tm_character_saves` para ese `(user_id,profile_id)`, solo si no existe una versión diferente, y después entra en juego. Si falla la nube, conserva la copia local y muestra una ruta para vincularla manualmente. No sobreescribe personajes antiguos.
- **Cambiar personaje:** ahora archiva el estado fresco con el exportador del motor antes de importar otro, en vez de confiar solo en la última versión de `tm.save`. Las copias archivadas se ven en «Buscar personajes de este celular».
- Este diseño sigue siendo **beta**: el motor mantiene una ranura local activa a la vez. El almacenamiento archivado protege las demás al cambiar. La propiedad de objetos/monedas sigue sin autoridad server-side.

### Verificación ejecutada
- Sintaxis de JavaScript: válida.
- Simulación de creación de segundo personaje: conserva Yonnah y copia previa, limpia solo slots beta, reinicia el motor, crea Nnn con ID diferente, vincula a la cuenta y entra en modo solitario. Todas las condiciones pasaron. Almacenamiento oficial sin modificar.
- Simulación de creación del **primer personaje**: usa su ID inicial, se vincula y entra sin recarga. Superada.
- Pruebas previas de login, selección de personajes y recuperación por checksum ya pasaron. Falta **QA real en Android** sobre creación, recarga, conexión lenta, cuota de almacenamiento y multijugador.
- **No fusionar PR #1** a producción antes del QA.

---

## 11/11/2026: sincronización automática INDIVIDUAL por personaje

**Implementación real publicada** en main:beta/character-sync.js y versionada en PR #1 como character-sync.js. Archivos de beta/account-center.js, beta/entry-gate.js y beta/index.html actualizados en main y en rama de desarrollo. No se tocaron los archivos raíz de producción.

### Diseño, permisos y protecciones
- Reutiliza public.tm_character_saves con PK (user_id, profile_id), RLS por propietario y trigger CAS de revisión existente; no crea más tablas ni altera respaldos históricos.
- UI principal de Pausa → Cuenta: Activar autoguardado, Pausar autoguardado, Guardar ahora y Comprobar nube. Opt-in expreso, preferencia individual por correo+ID de personaje.
- Intervalo 120 segundos; no escribe si el selector de personaje, el creador, el cooperativo están abiertos o la pestaña está oculta. El motor sigue siendo dueño de las posiciones y guardados.
- Exporta progreso fresco mediante botón del motor (incluye posición actual), comprueba checksum TM1, identidad del personaje, tamaño máximo y calcula SHA-256 de los datos. Esta huella es INTEGRIDAD, NO propiedad autenticada ni valor económico.
- Requiere sesión de Auth y que el jugador haya cargado explícitamente ese personaje desde su ranura vinculada. Seleccionar un respaldo histórico no autoriza autoactualización.
- Compara revisión y fingerprint remotos contra la base local obtenida al cargar o vincular el personaje. Previo a cada escritura valida payload remoto y guarda una copia de la versión remota anterior en tm.char.sync.remote.before.<uid>.<pid>. Exige confirmar que el almacenamiento local funcionó.
- UPDATE condicional por user_id,profile_id,revision, con confirmación de revision+1 y fingerprint. El trigger PostgreSQL exige incremento exacto. Cuando dos móviles quieren actualizar la misma revisión, solo el primero avanza: el otro queda pausado, no sobreescribe.
- Estado por personaje separado; un cambio de cuenta o personaje interrumpe la sincronización anterior. Error de red o discrepancia exige revisión/activación manual.
- El script antiguo cloud-auto.js (una ranura global por cuenta) dejó de cargarse en el HTML de la beta para impedir duplicación de escrituras; su código y sus registros históricos tm_cloud_saves siguen intactos, recuperables desde el selector.

### Pruebas ejecutadas
- Sintaxis JS y presencia de controles.
- Simulación de sesión + guardado: activación, revisión 1 a 2, copia previa local, conflicto con revisión 3 y bloqueo sin pérdida local.
- Dos clientes independientes con misma cuenta y personaje: móvil A guarda revisión 2, móvil B detecta conflicto sin sobrescribirlo.
- Pausa en cooperativo y pestaña oculta: confirmada.
- **QA físico pendiente**: cargar la beta publicada en ambos teléfonos, seleccionar personaje vinculado, activar desde Pausa → Cuenta, avanzar progreso, guardar, recuperar en el segundo teléfono y verificar mascotas/inventario. También comprobar conflictos y pantalla de error. No declarar producción lista hasta QA.
- Datos personales TM1 siguen verified=false, sin autoridad para economía, mascotas comerciales, inventario, monedas, pagos o rankings. Google/Apple OAuth y comparación guiada de divergencias pendientes. PR #1 debe continuar en borrador.

---

## 11/11/2026: comparador visual de conflictos y elección sin pérdida de copias

**Publicación beta:** `main:beta/conflict-center.js` y `beta/index.html`; equivalentes `conflict-center.js` e `index.html` en rama PR #1. Se modificaron `character-sync.js`, `entry-gate.js` y `account-center.js` para dirigir al comparador y limpiar vistas antiguas tras cambiar personaje. Los archivos raíz del juego oficial en `main` no cambiaron.

**Flujo UX**: en Pausa → Cuenta → Comparar versiones se muestran nombre, XP, mascotas y origen de los dos guardados de un mismo personaje; para la nube, además fecha y revisión. Las estadísticas no constituyen una regla automática de calidad. Ningún cambio por consultar. Si son distintos, ofrecer:
1. Recuperar versión de Supabase en este celular (requiere confirmación).
2. Conservar versión del celular como principal y actualizar Supabase (requiere doble confirmación).
3. Cancelar sin modificar nada.

**Guardarraíles**:
- La comparación exige sesión Auth, selección explícita de personaje VINCULADO (uid + profile ID), misma identidad local/remota, integridad de checksum TM1 y de SHA-256 de los datos remotos, no cooperativo, no creador y menú Pausa abierto.
- Ambas opciones comprueban de nuevo el estado antes de actuar; si cambió la partida local o la revisión remota, abortan y obligan a comparar otra vez.
- Antes de sustituir un guardado: copiar ambas versiones por separado en almacenamiento local de la beta con escritura verificada, además de crear (o detectar copia ya existente de) ambas versiones en `tm_legacy_backups` usando import_key=SHA-256(data), `verified=false`. Se respeta el límite de 20 respaldos por cuenta: si la nube no puede proteger las dos copias, NO se permite sobrescribir ninguna.
- Recuperar nube: usar importador del motor, comprobar confirmación «Partida cargada.», mantener la versión anterior en historial, fijar revisión base y pausar autoguardado hasta reactivación voluntaria.
- Conservar celular: UPDATE `tm_character_saves` filtrado por uid, pid y revisión previa CAS; el trigger PostgreSQL exige +1 y prohíbe cambiar identidad. Si otro teléfono escribió durante el proceso, 0 filas: rechazar y conservar respaldos.
- El comparador limpia su pantalla tras cambio de cuenta o personaje y nunca combina automáticamente inventario/monedas/mascotas. Los datos son respaldos personales no verificados y NO constituyen autoridad económica.

**Pruebas automatizadas simuladas realizadas**:
- Comparación visual correcta; elegir nube ⇒ restaura local, archiva dos versiones, 0 UPDATE.
- Elegir celular ⇒ revisión remota +1, archiva dos versiones, 1 UPDATE CAS.
- Falta de cupo/backups ⇒ abortar sin cargar ni actualizar.
- Cambio de revisión entre comparación y selección ⇒ abortar sin escritura.
- Estructura DOM, sintaxis JS y caché versionada de los cuatro scripts.
**Prueba real Android/iOS pendiente**. No fusionar PR #1 hasta verificaciones físicas y evaluación del esquema de economía autoritativa. No se eliminó ningún respaldo histórico.

---

## 11/11/2026 (20:56–20:58 Chile): auditoría del vídeo real 1000013708.mp4 (82,29 s) y corrección del onboarding

**Hallazgos observados, no supuestos:**
- 00–10 s: el selector mezcla tarjetas del mismo personaje con varias versiones locales de Nnn y Viajero, con un botón de "Jugar" por copia; falta distinguir una partida activa de un respaldo.
- 12–18 s: la cuenta muestra tarjetas en nube de Viajero y Raro y respaldos de Yonnah, mientras el menú "Buscar en este celular" repite entidades. En el selector original se ofrecían backups/slots como personajes listos.
- 20–28 s: al elegir "Jugar con Viajero" desde la copia local (sin confirmar su apariencia), aparece otra vez el creador. El motor tiene arranque automático del creador si profile.character está vacío y el wrapper anterior lo ocultaba manualmente vía creator.hidden, sin cerrar el estado del propio motor.
- 28–56 s: el usuario atraviesa pantalla de creador y el menú legacy "Cambiar cuenta o personaje / Jugar solo / Crear partida", aunque ya eligió un personaje en la puerta de Vangelium.
- 56–82 s: el motor finalmente entra al mundo, lo que demuestra que el fallo principal ocurre en el onboarding/cambio de sesión, no en la renderización 3D.

**Cambios en la beta (no producción):**
1. `beta/entry-gate.js`: selector principal muestra **exclusivamente personajes vinculados completos** (`profile.character` verdadero). Las copias históricas, la ranura vieja y las partidas locales van a **Gestionar copias de la nube** / **Copias de este celular**, agrupadas por ID de personaje. Se eliminan repeticiones de la página principal.
2. El `decode(TM1)` detecta explícitamente `ready`: una copia sin aspecto es un **borrador**, no se anuncia como personaje listo para jugar. Solo si el jugador elige completar el borrador se entra al creador.
3. Antes de iniciar juego con perfil terminado, si el motor arrancó su creador provisional se llama al **botón real `cr-cancel`** para ejecutar `creator.close()` y limpiar el estado interno y animación; nunca se usa simplemente `creator.hidden=true` para forzar cierre. Después se usa el importador de la partida y `btn-solo` para entrar sin menú adicional.
4. Las partidas locales se agrupan por identificador; copias archivadas idénticas se reutilizan en vez de acumularse. Los ítems iguales al personaje vinculado se ofrecen solo bajo la sección de copias, no como nuevos personajes.
5. Eliminación **individual con confirmación** de `tm_legacy_backups` via RLS SELECT/DELETE del propio usuario, solo cuando existe otro backup de ese personaje. Eliminar una copia no elimina la fila principal de `tm_character_saves`.
6. Borrado de ranura experimental antigua `tm_cloud_saves`, también limitado al dueño y condicionado en UI a que exista otra copia o personaje vinculado. Migración REAL aplicada y versionada `20261112001434_tm_cloud_saves_allow_owner_delete_legacy_slot.sql` concede DELETE a authenticated con policy auth.uid() = user_id; anon no obtiene DELETE.
7. Eliminación de archivos archivados `tm.entry.archive.<uid>.*` con confirmación: solo si otra copia local o nube existe para ese personaje; se verifica eliminación, NO permite eliminar guardado activo `tm.save` ni `tm.save.bak` del motor. No modifica archivos originales fuera de beta.
8. `beta/account-center.js`: en Pausa→Cuenta se destacan las funciones del personaje activo y la sincronización; las otras tarjetas y los respaldos se movieron a Opciones avanzadas. Nuevo botón **Elegir otro personaje**: archiva progresos, ejecuta `btn-leave` para cerrar la sesión del motor antes de invocar selector. Al restaurar desde Pausa sale de la sesión previa ANTES de importar y crea sesión solo nueva; no reanuda sesión vieja con otro perfil.
9. `beta/index.html`: estilos sobrios, entrada limpia, "Gestionar copias" colapsado, `tm-hub-switch`, y etiquetas de credenciales y backup separadas. Se subió versión de recursos con cache-busting.

**Pruebas simuladas completas y resultados:**
- Perfil listo vinculado + borrador local con mismo nombre: aparece UNA tarjeta principal, importación del perfil vinculado, `cr-cancel` invocado una vez, `btn-solo` una vez, creador cerrado. PASS.
- Cuenta con respaldos de Yonnah (2) y Raro (slot experimental): se agrupan en gestor distinto (2 grupos). PASS.
- Borrado de una copia histórica entre varias: DELETE solo esa fila, perfil vinculado intacto y otras copias intactas. PASS.
- Copia archivada local ÚNICA de Nnn: se rechaza borrarla. Después de agregar backup remoto, se permite borrar ese archivo y no se toca `tm.save`. PASS.
- SQL policy/grants verificados, no se eliminó ninguna fila de usuario durante la implementación.
- Pendiente: prueba en los dos navegadores Android reales, confirmación de importador + creador en navegador, recuperación real de Nnn desde copias locales y reanudación del cooperativo. No fusionar PR.

**Seguridad operativa:** no ejecutar borrado masivo ni convertir TM1 en inventario o monedas oficiales. El código root de producción main permanece inalterado. El usuario debe probar exclusivamente beta hasta validar.
