# Torre Multiversal — Rey Slime: Corazón del Alba

**Diseño e implementación de referencia del Ritual de los Diez Ecos**  
**Estado:** diseño concreto + prototipo interactivo independiente. **NO instalado en el juego publicado.**  
**Base de referencia:** distribución web v0.23, último paquete revisado en esta sesión.  
**Referencias visuales:** «Rey Slime, corazón del alba» y «Tres formas del rey slime azul» del proyecto, todavía sujetas a aprobación artística definitiva.

## 1. Regla rectora

> Diez slimes se unen y dejan de existir como individuos. El color de la mayoría determina la apariencia, los fragmentos reales aportan su linaje y la Corona del Rey les otorga una voluntad única. La curiosidad permite encontrar el ritual; no aparece un tutorial dentro del mundo que lo explique todo.

La invocación **no otorga propiedad territorial**. Es un acontecimiento en una instancia/sector público del Valle del Alba. No afecta la futura economía global ni los cuatro jefes todavía pendientes.

## 2. Corona del Rey — «La Charca del Primer Reflejo»

- **Lugar:** una charca lateral escondida tras un grupo de raíces, próxima al agua de una zona segura del Valle del Alba. El punto concreto debe seleccionarse de forma determinista a partir de la semilla del mapa, evitando portales, casas, entradas y recursos existentes.
- **Tres pistas ambientales:** pequeñas huellas gelatinosas, tres piedras marcadas que parecen reflejarse en el agua con una orientación imposible, y un brillo dorado invertido cuando el jugador examina el reflejo.
- **Condición:** puede resolverse al amanecer; de noche, también con antorcha. No depende obligatoriamente de esperar ocho ciclos lunares ni de una mecánica meteorológica nueva.
- **Acción de descubrimiento:** al investigar el reflejo tras reconocer las pistas, emerge la Corona del Rey. La primera vez se entrega como **reliquia única** vinculada al mundo/partida. No se crea una copia si otro jugador interactúa después.
- **Señal de misterio:** slimes salvajes próximos se vuelven hacia la charca durante unos segundos, sin mostrar mensaje ni indicador de misión. El bestiario no revela directamente la solución.
- **Relación con las anomalías:** puede haber similitud visual entre algunas runas y la corona, pero el misterio del monolito no queda resuelto ni bloqueado por esta misión. No reutilizar el contador de las tres anomalías como puerta obligatoria.

## 3. Cuenco de Convergencia — primer crafteo

**Receta inicial propuesta, ajustable:** 6 piedras lisas + 4 unidades de gel de slime + 2 hongos lunares.

- **Piedras lisas:** nuevo nodo de recolección superficial junto a ríos; no desmonta estructuras.
- **Gel de slime:** nuevo recurso de especie obtenido por combate/recolección bajo límites definidos; un slime domesticado **no** debe explotarse como surtidor sin coste.
- **Hongos lunares:** reutilizan el recurso nocturno del proyecto; verificar ID y condiciones de recolección en los módulos originales antes de conectar la receta.
- **Estación:** molde ritual accesible en el entorno; no hace falta implementar ya herrería, tiendas ni una moneda.
- **Cuenco:** objeto fabricado único del ritual. Se instala en el Trono y puede permanecer instalado entre invocaciones. Repetir la invocación exige de nuevo **diez slimes**, no diez slimes fantasma almacenados.

**Invariante:** consumir materiales y crear el cuenco debe ocurrir en una sola operación de inventario; si falla, los materiales permanecen. Los materiales son una propuesta nueva, no se debe afirmar que están programados en v0.23.

## 4. El Trono de los Diez Ecos

- Altar circular antiguo con **10 nichos visibles** alrededor de un pedestal central.
- La corona se coloca **en el suelo del centro**, no arriba de una estatua.
- Los diez slimes se depositan en el anillo, conservando **ID único, dueño, color y fase de fragmento**.
- Antes del ritual, cada slime depositado se **mueve**, no se duplica: pasa del inventario de criaturas/custodia a un nicho. Se puede retirar y recuperar sin penalización.
- La UI solicita confirmación explícita: «Los diez slimes se fusionarán y dejarán de existir como criaturas separadas».
- Al confirmar, los diez ID se **consumen definitivamente**, se registra un único `fusionEventId` y se inicia la secuencia visual.
- Si la invocación se interrumpe tras el consumo, se reconstruye la **misma** fusión pendiente. No se emiten slimes ni otro Rey al reconectar.

### Secuencia visual, duración orientativa 6 segundos

| Momento | Evento |
|---|---|
| 0–1 s | Los diez slimes vibran y orientan sus cuerpos hacia el pedestal. |
| 1–3 s | Se estiran y fluyen al centro, mezclando colores de gelatina. |
| 3–4,5 s | La masa unificada crece. La Corona del Rey queda suspendida **dentro** del cuerpo. |
| 4,5–5,5 s | La corona asciende lentamente por el interior hasta su superficie superior. |
| 5,5–6 s | Se forma el Rey, aparece su identidad, comienza la música de combate. |

**Música:** *Guardian's Awakening.mp3*, creación aportada para el proyecto, incorporada a la demo con reproducción opcional tras un gesto del usuario. El juego real necesita mezcla adaptativa, control de volumen, bucle, compresión y recuperación después de pausar.

## 5. Color y herencia

El **color** y el **linaje** son dos variables independientes. La mayoría define color principal, el resto aporta vetas, iris, espinas o variantes de clones. Empates de los dos colores más frecuentes forman un Rey híbrido visible.

| Diez componentes | Apariencia | Linaje |
|---|---|---|
| 10 azules comunes | Azul | Silvestre |
| 7 rosas y 3 verdes | Rosa con rasgos verdes | Silvestre |
| 5 azules y 5 rosas | Híbrido azul/rosa | Silvestre |
| 10 fragmentos reales de fase I | Según los colores presentes | Renacido I |
| 10 fragmentos reales de fase II | Según los colores presentes | Renacido II |
| 10 fragmentos reales de fase III | Según los colores presentes | Renacido III |
| Fragmentos de distintas fases y/o slimes normales | Según mayoría/empate | Herencia mixta/vestigios |

**No confundir**: «fragmento fase III» no significa que el nuevo Rey se salte sus primeras dos transformaciones. Todos conservan las tres formas, con variaciones de silueta, habilidades y dificultad. Un solo fragmento III no puede generar un Rey III.

### Fragmentos rebeldes

- Los clones iniciales del jefe obedecen al Rey; **no todos** se pueden domesticar automáticamente.
- Una minoría puede desarrollar independencia mediante el proceso de vínculo que ya diseñamos. Si es capturada, conserva `fragmentPhase`, color, origen real y `identityId` propio.
- Un jugador puede guardar suficientes fragmentos para reunir diez, aunque inicialmente solo uno esté activo como compañero especial.
- Los fragmentos elegidos para fusionarse **se pierden igualmente**, aunque tengan experiencia o historial. Debe mostrarse una confirmación adicional si son compañeros de alto vínculo.
- Las criaturas que sobreviven al jefe **no** se convierten automáticamente en recompensas duplicadas.

## 6. Combate que hereda el Rey

| Transformación | Máximo de clones simultáneos | Comportamiento |
|---|---:|---|
| Slime clásico | 5 | Rebotes, división, megasalto limitado. |
| Bestia gelatinosa | 10 | Saltos extensos, absorción y expulsión, espinas. |
| Rey humanoide | 20 | Combina los cinco poderes, incluido Puñetazo del Rey. |

El límite es de **clones activos a la vez**, no de 20 invocaciones por segundo. No dan experiencia ni cristales infinitos. En móvil, compartir decisiones de IA por escuadrón y limitar ataques simultáneos; el jugador siempre debe tener rutas de escape.

Al derrotar al jefe vuelve a su forma original, se detiene la música de combate y se presenta el desenlace acordado: **perdonarlo para incorporarlo como compañero o ejecutarlo para recibir un arma aleatoria de la familia Armas de Rey Slime, asociada a una de las razas**. La equivalencia entre razas y variantes de arma todavía **no está fijada**; los IDs de la demo son provisionales. Ambos caminos dan experiencia e insignia de victoria (los valores y tablas se definen con el sistema definitivo de jefes).

## 7. Integración técnica con la versión actual

### Importante

El ZIP web v0.23 contiene `index.html`, `game.js` empaquetado y cinco recursos. **No contiene los módulos fuente con su constructor y sus pruebas originales.** Esta demo no debe incorporarse por simple copia al `game.js` empaquetado ni publicarse en `main` sin integrar con el motor, las sesiones y el guardado.

### Nuevas estructuras mínimas

```text
world.rituals.slimeKing = {
  schemaVersion: 1,
  crownDiscoverEventId, crownHolderOrAltar,
  bowlInstalled, altarSectorId,
  slots[10]: { creatureId, depositorId, placedAt } | null,
  activeFusion: { eventId, status, inputIds[10], result },
  lastVictory, cooldownUntil, history[]
}
creature.royalFragment = { fragmentPhase: 1|2|3, originKingId, independent: true }
```

`result` guarda composición cromática, los diez `sourceIds`, fases y linaje; el evento no se vuelve a ejecutar al recibir un paquete repetido. `game.js` debe obtenerlo del estado de sesión del **anfitrión**, no confiar en la estimación local de un invitado.

### Compatibilidad y seguridad

- La versión actual guarda el mundo en el navegador/anfitrión: eso no es seguro contra clientes maliciosos, pero puede permitir una primera implementación cooperativa sin mercado. **No prometer transacciones económicas seguras hasta tener servidor autoritativo.**
- Evitar duplicación en cambios de anfitrión: `fusionEventId` e `inputIds` persistidos antes de reproducir animación; acuse de aplicación idempotente al resto.
- En una fusión cooperativa, reservar por ID único. Si se cancela antes del inicio, devolver cada slime a su **depositante**; si se desconecta, conservar la reserva sin reasignarla a otro jugador. **Cada depositante debe consentir explícitamente el sacrificio de sus propias criaturas antes de aceptar el inicio**; el anfitrión no puede gastar slimes ajenos sin permiso.
- Mantener los guardados previos migrando el estado `slimeKing` a valores iniciales. No renombrar ni sobrescribir campos existentes de día/noche, élites, anomalías, equipamiento o compañeras.
- Implementar barrera de versiones cooperativas y prueba de cambio de anfitrión antes de publicar. La versión exacta del protocolo se decide al integrar.
- No dar recompensa o invocación repetida al pulsar dos veces, reintentar tras desconexión o recargar.
- Mantener corredores, puntos de interés y salida de jefes seguros; el altar nunca debe impedir progresar en el Valle.

## 8. Criterios de aceptación para integración real

1. Corona única que no puede duplicarse en cooperativo.
2. Receta consume y produce cantidades exactas; nunca inventario negativo.
3. Diez criaturas distintas, sean normales o fragmentos, pueden colocarse y retirarse sin duplicación.
4. Una fusión iniciada consume las diez definitivamente, aunque falle/reinicie la animación.
5. Composición del Rey corresponde a color dominante y a linaje, y soporta empates.
6. Diez fragmentos de fase III producen Renacido III; uno solo no.
7. Aparecen 5/10/20 clones según fase, con control de rendimiento móvil y sin premios repetibles.
8. Se puede terminar el combate solo o en grupo sin bloquear movimientos ni cámara.
9. Perdonar y ejecutar entregan **solo una** recompensa del desenlace correspondiente.
10. Se puede volver a invocar usando diez slimes NUEVOS sin regenerar mágicamente los consumidos.
11. Guardados antiguos, día/noche, doma y anomalías mantienen comportamiento.
12. Pruebas reales en móvil vertical, escritorio y una sesión cooperativa con relevo de anfitrión.

## 9. Qué está realmente construido en esta entrega

Incluye `ritual-core.js` (máquina de estado, receta, reserva, consumo, combinación, desenlace), `app.js` y `index.html` (demo visual local con cuatro pantallas y secuencia de fusión), pruebas automatizadas y referencias previas. **No incluye** el mapa jugable real, combate con hitboxes, sprites aprobados, capturas de criaturas reales, servidor ni integración en `main`.

Las recompensas y el stock de capturas en la demo son **simulados**, para que puedas experimentar con muchas combinaciones sin consumir el progreso real de tu partida.
