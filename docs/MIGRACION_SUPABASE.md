# Estado real tras recuperar el acceso (10/11/2026)

✅ Proyecto correcto `cogwkcmlkurzagygnivy`, organización `TorreMultiversal`, PostgreSQL 17, estado ACTIVE_HEALTHY.

✅ Se aplicaron al proyecto real dos migraciones, confirmadas mediante `list_migrations`:

- `20261110220121_tm_restrict_rls_ddl_trigger_execute_20261110`: elimina los privilegios públicos de ejecución de `public.rls_auto_enable()`. El event trigger `ensure_rls` permanece activo.
- `20261110220144_tm_persistence_foundation_20261110`: cinco tablas nuevas `tm_players`, `tm_legacy_backups`, `tm_economy_events`, `tm_inventory_lots` y `tm_currency_ledger`, con RLS y restricciones de escritura.

**Verificación**: cinco tablas presentes, todas con RLS activado y cero filas iniciales; `anon` no puede insertar en ninguna; `authenticated` solo puede insertar en `tm_players` y `tm_legacy_backups` bajo política por propietario. Los usuarios autenticados NO pueden insertar directamente movimientos económicos, lotes o eventos. La función restringida NO es ejecutable por `anon` ni `authenticated`. La auditoría de seguridad de Supabase devuelve cero advertencias.

**Todavía NO completado**: integración Auth del navegador, respaldo real y migración del progreso, endpoints transaccionales económicos, pruebas E2E y activación de guardado remoto. El juego público `main` y su Realtime Broadcast no se han modificado.

**Registro**: el SQL en `supabase/sql/DRAFT_tm_persistence_foundation.sql` representa la migración de base que **ya se aplicó**, aunque permanezca con nombre DRAFT en esta rama de trabajo. Nunca ejecutar nuevamente el texto sin comparar estado e historial.

---

# Torre Multiversal | Migración segura a Supabase
**Estado:** infraestructura inicial aplicada en el proyecto real. Cliente web todavía sin modificar.

## Diagnóstico confirmado (10/11/2026)
- Repositorio activo: `Vangelium/torre-multiversal.`, web estática por GitHub Pages.
- `game.js` identifica `0.23.0-anomalias` y empaqueta `@supabase/supabase-js`.
- La sala cooperativa usa Supabase Realtime **Broadcast**, con canales `tm:lobby` / `tm:<sala>` y un cliente con `persistSession:false`. **No reemplazar el transporte actual**.
- Servicio al que apunta la web: `https://cogwkcmlkurzagygnivy.supabase.co`.
- El guardado principal sigue local: `localStorage["tm.save"]`, respaldo `tm.save.bak`, `fmt:tm`, formato versión **19**. El checksum actual detecta corrupción accidental, **no autentica balances ni objetos**.
- El conector Supabase tiene acceso a la organización `TorreMultiversal`, pero `list_projects` devuelve **cero proyectos**. No se puede inspeccionar el esquema del proyecto utilizado por el juego ni aplicar cambios allí desde esta conexión.

## Límite de seguridad fundamental
NO crear otro proyecto para sustituir el existente. NO borrar, reiniciar ni modificar salas Realtime. NO aceptar inventario, cristales, monedas o terrenos importados desde `localStorage` como valores certificados. El navegador puede alterar un respaldo. Los saldos y objetos económicos deben derivar de hechos del servidor y de funciones transaccionales idempotentes.

## Primera fase preparada
`supabase/sql/DRAFT_tm_persistence_foundation.sql` es **solo un borrador** que crea de manera aislada:
- `tm_players`: identidad asociada a `auth.users`.
- `tm_legacy_backups`: respaldo de progreso previo como datos **no verificados**, con importación idempotente y RLS por usuario.
- `tm_economy_events`, `tm_inventory_lots`, `tm_currency_ledger`: estructura mínima de procedencia y auditoría; **sin permisos de escritura para el navegador**.
- Todas las tablas expuestas incluyen RLS y políticas de lectura por propietario.

Esta etapa **no** crea todavía dinero ni recursos y **no** conecta el cliente. La economía exige servicios de servidor antes de estar habilitada.

## Pasos para aplicar al proyecto correcto
1. Recuperar acceso del conector al proyecto `cogwkcmlkurzagygnivy`: usar la cuenta propietaria o invitar a la cuenta vinculada. No crear una base alternativa.
2. Inspeccionar **tablas, políticas, funciones, migraciones, configuración Auth, Data API y advisories** existentes; revisar el borrador para resolver conflictos.
3. Obtener un respaldo restaurable del estado real y aprobar una ventana de aplicación. Registrar el cambio mediante migración en el proyecto existente.
4. Usar Auth de manera independiente del canal de salas. Si se permite registro anónimo, debe habilitarse en Supabase Auth y persistirse la sesión; antes de almacenar bienes valiosos, ofrecer vinculación a una cuenta recuperable para no perder datos al cambiar de móvil.
5. Agregar un adaptador de guardado **sin activarlo en producción**: leer `tm.save` local, validar estructura `fmt/v/sum`, cargar copia inmutable en `tm_legacy_backups`, y mantener intacto el guardado local.
6. Introducir funciones servidor para recolección, drops, crafting, transferencias y comercio. Un evento económico debe usar clave de idempotencia única, transacción atómica y autoridad de servidor; no tomar el JSON legado como origen confiable.
7. Probar con dos dispositivos y usuarios, desconexiones, reintentos, colisiones, rol sin permisos, versión de protocolo incompatibles y rollback. Solo entonces activar progresivamente el almacenamiento remoto y desarrollar economía compartida.

## Criterios de salida
- GitHub Pages y salas de 1 a 4 jugadores continúan operativos.
- No desaparece ninguna partida ni se sobrescribe `tm.save` automáticamente.
- Ningún cliente puede concederse ítems o moneda mediante llamadas REST ni Broadcast.
- Doble envío del mismo evento no duplica nada.
- Pueden verificarse RLS, importación, reingreso y restore en condiciones reales.
- Sin secretos `service_role` en GitHub ni en el JavaScript público.

**Aviso:** el presente borrador SQL todavía no se ha probado contra el esquema real, porque el conector no expone ese proyecto. Inspeccionar antes de aplicar.
