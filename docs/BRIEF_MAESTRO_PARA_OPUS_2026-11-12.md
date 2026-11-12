# TORRE MULTIVERSAL | BRIEF MAESTRO PARA OPUS
**Fecha de corte:** 12 de noviembre de 2026 (America/Santiago)
**Dirección del proyecto:** VANGELIUM Games. Juego principal y prioridad absoluta del estudio.
**Naturaleza:** traspaso de proyecto + instrucciones de continuidad. Distinguir rigurosamente implementado, beta no validada e ideas de diseño.

## 0. Encargo ejecutivo a Opus
Asume la dirección técnica, auditoría y ejecución del desarrollo de **Torre Multiversal**. El objetivo es terminar un RPG cooperativo móvil/web profesional, divertido, recuperable entre dispositivos, escalable y eventualmente comercializable. El propietario supervisa desde celular y dispone de tiempo y presupuesto muy limitados. **No le devuelvas trabajo que puedas ejecutar con GitHub/Supabase conectados**. No gastes dinero, actives pagos, cambies de plan, ni despliegues cambios riesgosos sin su autorización explícita.

**Lo primero NO es agregar criaturas ni efectos: es dejar impecable y confiable la identidad cuenta → personajes → partida y resolver los fallos observados en el video.** Luego asegurar multijugador, controles, retención y desarrollo de contenido.

En cada intervención: verificar repo/ramas/PR/commits; modificar únicamente la beta o rama dedicada; enseñar diff; ejecutar pruebas reproducibles; preservar partida original; entregar resumen técnico, cambios, riesgos, demostración de funcionamiento y rollback. No declarar «terminado» usando exclusivamente mocks. No fusionar las ramas experimentales hasta QA real y aprobación.

## 1. Recursos canónicos y hechos verificados al corte
- Repositorio: https://github.com/Vangelium/torre-multiversal.
- Juego público GitHub Pages: https://vangelium.github.io/torre-multiversal./
- Beta de cuentas, acceso y guardados: https://vangelium.github.io/torre-multiversal./beta/
- Proyecto Supabase asociado: `cogwkcmlkurzagygnivy`. **Nunca exponer service_role, claves secretas, tokens, credenciales ni datos personales en GitHub Pages.**
- Rama pública: `main`; commit inspeccionado `c9d71ec4cad7b14f8a8c5a039401ccd8a9d95f01`, 12-11-2026. El último workflow de GitHub Pages inspeccionado terminó con `success`; esto **no** prueba el funcionamiento móvil final.
- `main` conserva aplicación oficial raíz (`index.html`, `game.js`, `three.min.js`, etc.) y `beta/` aislada.
- PR #1, **DRAFT**, `feature/supabase-persistencia-20261110`: https://github.com/Vangelium/torre-multiversal./pull/1
- PR #5, **DRAFT**, `feature/guardados-por-personaje-beta-20261111`: https://github.com/Vangelium/torre-multiversal./pull/5
- Documento técnico preexistente, **lectura obligatoria** (historial detallado, migraciones, seguridad, bugs del video y mocks):
  https://github.com/Vangelium/torre-multiversal./blob/feature/supabase-persistencia-20261110/docs/ENTREGA_A_OPUS_2026-11-12.md
- Issues canónicos: [#2 Plan maestro](https://github.com/Vangelium/torre-multiversal./issues/2), [#3 P0 recuperación](https://github.com/Vangelium/torre-multiversal./issues/3), [#4 UX de entrada](https://github.com/Vangelium/torre-multiversal./issues/4).
- `beta/README.md`, `docs/PUBLICACION.md`, `docs/CHANGELOG.md` y migraciones SQL del PR #1 son referencias obligatorias.
- Las últimas modificaciones publicadas en la beta intentan corregir los fallos de recuperación del video; **no están validadas en dos móviles reales**. No confundir despliegue exitoso con QA exitoso.
- La rama pública evolucionó hasta contenido identificado como **v0.23 Las anomalías**; confirmar versión embebida en archivos, porque el changelog de `main` puede estar desactualizado. Evitar afirmar que alguna feature futura ya existe.

## 2. Qué hay en el juego / informado como implementado
### Experiencia jugable
- RPG de exploración de valle y Torre, personajes con progresión, combate activo con ataques básico/fuerte, esquiva y equipo, interfaz de pixel art y render Three.js. Móvil y escritorio.
- Salas cooperativas de hasta **4 jugadores** mediante Supabase Realtime. El usuario confirmó anteriormente que multijugador y web funcionaban, pero cambios posteriores requieren regresión.
- Doma de cinco especies reportada en v0.15: **slime, lanudo, jabalí de ámbar, zorro ilusionista y liebre trueno**. Confianza/conducta, compañeras, participación en combate, vínculo y guardado.
- Evolución reportada: cuidados de mascotas; ciclo día/noche con reloj sincronizado por anfitrión, antorcha, búho real, hongos lunares, luciérnagas y misterios/monolito.
- Élite v0.22: aura, nombre, rasgos **furioso, acorazado, veloz, vampírico**, salud reforzada, botín, doma con hongo lunar; compañeros élite conservan rasgos adaptados.
- Anomalías v0.23: **oveja maldita**, **conejo-pájaro**, **arbusto defectuoso** y pistas ambientales; comprobar en el código actual y no dar por comprobado móvil/cooperativo por resultados históricos.
- Varias entregas anteriores informaron centenas de tests automáticos y decenas de navegador. **Son resultados comunicados, no sustituyen una ejecución nueva.**
- El repositorio web es primordialmente distribución con JS grande; faltan fuentes modulares, sistema de build y batería original íntegra en `main`. Auditar antes de refactorizar. Conservar historial y compatibilidad de guardados.

### Cuenta y persistencia (beta, NO producción validada)
- Supabase Auth separada del cliente Realtime; autenticación actual con **correo y contraseña**, recuperación de acceso y RLS. **Google/Apple OAuth todavía pendiente**, igual que la cinemática real.
- Selector VANGELIUM, varios personajes por cuenta, creación de segundo personaje con ID distinta, vinculación de guardado por `(user_id, profile_id)` en `tm_character_saves`, respaldo histórico en `tm_legacy_backups`, y ranura experimental antigua `tm_cloud_saves`.
- Aislamiento local bajo prefijo `tm.beta.v1.*`; la beta no debe modificar la partida oficial `tm.save` del mismo origen. Archivos locales `tm.entry.archive.<uid>.*`, índice y backups previos protegen cambio de personaje.
- Exportaciones TM1, checksum y fingerprint; control de revisión CAS para evitar sobrescritura entre dos celulares, sincronización voluntaria por personaje aprox. cada 120 segundos; bloqueos mientras hay cooperativo, creador o app no visible.
- Comparador local/nube con opciones recuperar nube, conservar celular o cancelar; archivos preventivos; límite de 20 backups históricos por cuenta. Datos de respaldo **`verified=false`**, nunca permitir que otorguen moneda, objetos, ranking o mascotas con propiedad económica.
- Gestor separado de **personajes** vs. **copias históricas** vs. **copias locales** vs. **ranura experimental**. Borrado individual sujeto a confirmación y no borrar última copia ni partida activa. Estas protecciones son nuevas y necesitan pruebas reales.
- Los PR #1 y #5 siguen en borrador; no deben fusionarse por comodidad ni suponerse independientes sin evaluar su solapamiento.

## 3. Incidente crítico de recuperación y experiencia de usuario
El usuario probó cuentas y teléfonos cruzados; una partida/personaje específico (ej. «Nnn») no aparecía donde lo esperaba. Se compartió el video `1000013708.mp4` (aprox. 82 s) y se observaron:
1. Personajes repetidos por mostrar respaldos como si fueran personajes independientes.
2. Selección de partida local inacabada («Viajero») seguida de aparición indebida del creador.
3. Tras elegir personaje, reaparecía menú antiguo de creación/selección/partida y había que recorrer pasos extra.
4. Copias difíciles de distinguir y de borrar; riesgo de mezclar cuentas, perfiles, dispositivos o de perder el único guardado.
5. El usuario exige una experiencia **intuitiva, limpia, profesional**, no un panel de herramientas de respaldo disfrazado de menú principal.

Se publicaron correcciones entre el 11 y el 12/11 en `main:beta/`: una sola tarjeta por personaje vinculado completo, respaldos en panel avanzado, cierre del creador por su mecanismo real `cr-cancel`, entrada directa a `btn-solo`, restauración con cierre de sesión previa, gestor de copias y protección de última copia. **Las pruebas de mocks pasaron; falta verificar los dos celulares reales y la recuperación de «Nnn».** Si una copia nunca se subió a la nube, no afirmar que puede recuperarse desde Supabase: buscar localmente en el celular original o TM1 exportado, sin inventar pertenencia a otra cuenta.

**Definición de terminado P0**: En dos celulares con dos cuentas reales, registrar, confirmar, iniciar/cerrar sesión, crear personajes A/B, jugar, conservar XP/equipo/mascotas/ubicación, cambiar personaje, intercambiar teléfonos, restaurar la cuenta y continuar sin reabrir creador ni contaminar estado. Mostrar 1 tarjeta por personaje, backups solo en avanzadas, errores comprensibles y borrado seguro. Probar también offline, recarga, caché, conflictos, revisiones obsoletas, navegador reiniciado y sala cooperativa. Guardar evidencia de pasos y resultados.

## 4. UX final aprobada (alcance P1–P4)
**VANGELIUM Games** → logo/splash corto → **cinemática omisible de la Torre** → menú principal visual con el mundo/la Torre animados → **Jugar** → sesión Google o Apple / acceso alternativo por email → si hay sesión válida, **Personajes** → si hay personajes, tarjeta con nombre, apariencia, nivel, última ubicación y **Continuar**; si no hay, ir **directo al creador** → mundo en último guardado válido. Repetir creador solo para nuevo personaje o borrador incompleto elegido expresamente. No recrear personajes al reconectar. Una cuenta puede poseer varios perfiles, cada uno con guardado independiente.

Requisitos: sesiones persistentes, retorno OAuth correcto para `/beta/`, indicadores «Guardando / Guardado / Sin conexión / Error», teclado táctil funcional, modo gráfico móvil, tiempos de carga moderados, confirmaciones solo donde hay riesgo; nunca pedir contraseñas de Google/Apple dentro del juego. Google/Apple solo tras configuración segura de proveedores; acceso por email queda operativo hasta entonces. Identidad de usuario ≠ dirección de correo ≠ ID personaje. Apple puede ocultar correo. No fusionar usuarios por coincidencia textual de email.

## 5. Diseño jugable aprobado o propuesto, NO darlo por integrado
### A. Roles, equipamiento y progresión
- El **rol emerge del equipo y la manera de jugar**, no de bloquear prematuramente al jugador a una clase rígida. Roles: **invocador/domador** (prioridad creativa), arqueros/pistoleros, espadachines, magos, curanderos, tanques/defensores, asesinos. Subclases y sinergias.
- Árbol general de habilidades y ramas por rol, puntos al subir nivel, decisiones claras y reversibles bajo reglas definidas; combos, habilidades que se noten visualmente y variedad táctica.
- El invocador/domador debe sentirse diferente: invocación y vínculo activo con criaturas, aprendizaje y coordinación.

### B. Sistema de mascotas
- Botón de mascota junto a **ataque básico** y **ataque fuerte**. El usuario ideó **arrastrar el botón de mascota** a uno de los ataques para asociar la orden/movimiento de la criatura.
- Criaturas aprenden movimientos a través de uso, encuentros y vínculo; posibilidad de órdenes y habilidades elegidas, comportamientos emergentes y respuesta al cuidado/huida/alimentación. Evitar automatismos de combate que quiten agencia.
- Doma por comportamiento y confianza, progresión de vínculo y características heredadas/raras. Analizar persistencia, multijugador, balance y límites de inventario antes de integrar.

### C. Rey Slime / ritual de fragmentos
- Idea central solicitada: **capturar 10 fragmentos/slimes** y colocarlos en **10 posiciones definidas**. Se desplazan al centro, **se fusionan y crecen**, elevando la **corona** desde el suelo por el cuerpo hasta completar el Rey Slime. Tras usarlo, se pueden reunir otros 10.
- **Colores** (azules, rosados, verdes y mezclas), **niveles**, procedencia y fragmentos asociados a otros reyes modifican forma, características, potencial, habilidades o variantes del Rey. Formalizar reglas de balance, probabilidades y herencia, no asumir una mezcla genérica.
- Diseño narrativo de desenlace: **perdonar** al Rey Slime puede convertirlo en aliado/mascota; **matarlo** puede dar un arma aleatoria de familia «Armas de Rey Slime». Hay conceptos visuales previos, pero NO está garantizada implementación de combate, arte final, invocación o loot.
- El usuario rechazó una versión anterior de Albor y priorizó un **Rey Slime clásico — Corazón del Alba**. No integrar automáticamente artes/prototipos rechazados.

### D. Mundos, biomas y contenido
- Jefes de bioma con personalidad/mecánicas propias, diseñados uno por uno y conectados a descubrimientos. Progresar más allá de las anomalías; no introducir jefe sin IA, VFX, señales de ataque, drops, persistencia y pruebas.
- Evolución día/noche, ecosistemas, enemigos impredecibles y secretos con pistas, no listas de tareas planas.
- Loop deseado: **explorar → descubrir/pelear/domesticar → ganar recursos/evolucionar → desbloquear nuevas posibilidades → volver**. Riesgo/recompensa, sorpresa genuina, combates entretenidos y progreso visible.

### E. Sandbox, oficio y economía viva (futuro, no funcional)
- El mapa se descubre y transforma mediante jugadores; descubrir territorio da reconocimiento, no propiedad automática.
- Recursos, ecosistemas, extracción, cultivo, crianza, fabricación, construcción, comercio, logística y oficios, con procedencia trazable.
- Mundo compartido por sectores / `world_id`, validación servidor (RLS, RPC/Edge Functions), transacciones idempotentes y antifraude; **jamás usar datos TM1 no verificados como saldo económico o inventario transable**.
- Monetización eventual: diamantes, cosméticos/apariencias, pases anuales, sin pagar por victoria; no activar pagos antes de economía autoritativa, medición de jugadores, pruebas de transacciones y aprobación humana. Presupuesto actual limitado: usar lo ya conectado, no comprar herramientas ni planes.

### F. Arte/animación
- Slimes ya existentes deben igualarse o mejorar, **nunca reemplazarse por sprites más simples**. Esenciales: idle, movimiento, recibir daño, atacar, habilidades, muerte, transformaciones y VFX claros en móvil.
- Pipeline de arte planeado: `sprites/`, spritesheets con tamaño/fps/frames/alpha correctos, `manifest.json`, `animations.json`, `behaviors.json`, validador de rutas/frame-counts y adaptadores para juego actual. Probar primero **un slime** de extremo a extremo sin romper red, combate ni rendimiento. No confundir assets propuestos con material integrado.

## 6. Plan de ejecución / puertas de calidad
### P0 (AHORA): Inventario y recuperación segura
1. Leer este brief, el traspaso técnico preexistente completo, PRs, issues, main y beta. Tomar inventario de commits, esquemas SQL, scripts reales, divergencias entre ramas y cobertura de QA. Unificar la base sin fusiones prematuras ni código duplicado que escriba dos ranuras.
2. Reproducir el error del video; comprobar que las correcciones más recientes se despliegan y funcionan con caché renovada. Corregir UX y lógica raíz con pasos mínimos.
3. Probar dos dispositivos/cuentas y 2+ personajes por cuenta. Recuperar casos reales cuando existan copias válidas; distinguir «no está en esta cuenta» de «perdido».
4. Resolver autenticación, vinculación y recuperación sin corrupción, autoguardado por perfil, resolución de conflictos y borrado seguro. Reforzar tests automáticos y checklist de QA móvil.
5. Mantener PR experimental en DRAFT hasta evidencia. Preparar plan de promoción a producción reversible y pedir aprobación para publicarla.

### P1: Estabilidad multiplataforma y cooperativa
- Regresión 1–4 jugadores, reconexiones, cambios de rol/mascota, entidades sincronizadas, rendimiento en Android/iPhone, pausa y reanudación, indicadores reales de guardado, offline y latencia. Verificar que no aparezcan 2 partidas locales «activas» del mismo personaje.

### P2: Entrada profesional y experiencia de juego
- Flujo VANGELIUM aprobado, Google OAuth (cuando esté configurado), Apple cuando sea viable, selector limpio, diseño y cinemática omisible.
- Tutorial mínimo y primeras sesiones; medir dónde abandonan los jugadores.

### P3: Profundidad y retención
- Arbol de habilidades, roles emergentes, domador/invocador, mascota vinculada a comandos de ataque, mejoras importantes visibles, Rey Slime y jefes de bioma por entregas independientes; revisar satisfacción de loop y balance con testers antes de proliferar contenido.

### P4: Plataforma económica y negocio
- Diseñar fuente única de verdad de inventario/moneda en servidor; pruebas antifraude, trazabilidad y rollback; iniciar cosméticos/diamantes/pases solo con presupuesto y permiso.

**Gates de lanzamiento:** G0 inventario + respaldos; G1 persistencia validada; G2 jugabilidad móvil y red estables; G3 retención probada; G4 economía y compras en sandbox; G5 lanzamiento controlado. No afirmar G1–G5 completados hasta evidencias.

## 7. Reglas no negociables de seguridad, desarrollo y comunicación
- Nunca borrar partidas existentes, respaldos históricos, cuentas ni perfiles durante pruebas. **Nada de DELETE masivo.** Para borrado individual, confirmación del propietario, prueba de otra copia válida y log de qué se borró.
- Nunca editar `main/index.html` o `main/game.js` directamente para experimentar. Trabajar en rama/beta; docs-only en main puede ser aceptable. No reescribir código grande sin copia, diff, migración y rollback.
- Respetar snapshots y hashes TM1, identidad estable por ID y sincronización por revisión; jamás sobrescribir progreso más reciente a ciegas.
- No exponer claves privadas; RLS por `auth.uid()`; las operaciones económicas deben ejecutarse desde servidor autoritativo. Backups `verified=false`.
- Preservar el cooperativo (Supabase Realtime independiente de Auth) y la evolución ecológica/mascotas sin degradación de rendimiento.
- El director trabaja **desde teléfono**; cuando haga falta prueba física, pedir la secuencia más corta y concreta; todo lo demás debe ejecutar Opus. Evitar menús técnicos visibles para el jugador; dejar controles avanzados apartados.
- Para cada entrega: **(a)** qué estaba roto/por qué, **(b)** archivos y commit, **(c)** cómo se probó (mock vs navegador vs dos dispositivos), **(d)** riesgos y datos preservados, **(e)** rollback, **(f)** siguiente objetivo único. Diferenciar siempre «hecho», «en beta», «propuesto».
- El objetivo no es sumar funciones sin fin, sino publicar **un primer juego comercial terminado, entretenido y confiable**.

## 8. Primera acción que debe realizar Opus en esta conversación
**Abrir el repo y el documento técnico del PR #1, revisar `beta/entry-gate.js`, `beta/account-center.js`, `beta/character-sync.js`, `beta/conflict-center.js`, `beta/index.html`, `beta/README.md`, la migración de `tm_character_saves` y los commits de las correcciones de video.** Entregar diagnóstico corto de lo ya corregido vs. lo aún defectuoso; luego **arreglar P0 en beta**, probar y devolver un cambio funcional verificable, sin tocar la versión oficial. La prioridad visible para jugadores: cuenta correcta → personajes únicos → continuar directamente → recuperar el último guardado del personaje correcto → cambiar de móvil sin perder nada.

> Nota de procedencia: este brief consolida decisiones del propietario, documentación existente y lectura del repositorio/PR/Issues efectuada el 12-11-2026. Las funciones indicadas como «reportadas», «propuestas» o «pendientes de QA» requieren comprobación independiente. La documentación técnica detallada del PR #1 es parte inseparable del traspaso.
