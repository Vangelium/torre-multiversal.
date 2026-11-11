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
