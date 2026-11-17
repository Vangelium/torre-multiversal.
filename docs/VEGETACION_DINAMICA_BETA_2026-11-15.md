# Vangelium Dynamic Vegetation v1.0 · beta (`/beta/?veg=1`)

> **Estado (16-11-2026, noche): v2.0 «Flora» (beta v14) lista para subir a beta, desactivada por defecto (`?veg=1`). NO publicada en producción. La v12.5 (corte y recolección) fue aprobada por el director en Android («está bueno, aunque tiene poca vegetación»).**

## Arquitectura
1. **Simulación por celdas** (`VegSim`): rejilla de 48 × 48 celdas de 0,5 u
   (24 × 24 u) que sigue al jugador; al moverse, el estado se desplaza sin
   perder la onda. Cada celda guarda desplazamiento y velocidad (x, y).
2. **Sensores compartidos:** solo las celdas tocadas por algo reciben impulso
   (jugador, criaturas, ataques, ondas). El resto se mueve por acoplamiento con
   sus cuatro vecinas: resorte hacia el reposo + amortiguación + propagación.
   Cada salto pierde energía y llega con retraso. Solo se calcula la caja de
   celdas activas (+2 de margen); bajo el umbral de energía la simulación se
   **duerme** y todo vuelve exacto al reposo. Paso fijo de 30 Hz.
3. **Dibujo:** el estado se sube como textura de 48 × 48 (RGBA8, filtrado
   lineal = interpolación entre celdas) y el **shader del terreno** (el mismo
   material del mapa, sin renderizador nuevo) inclina solo la parte alta de
   cada planta: cada vértice lleva un peso (1 en la punta, 0 en la raíz), así
   que **la raíz nunca se mueve**. Las plantas se reconocen por su región del
   atlas (matas, flores, arbustos) y se marcan una vez por trozo del mapa.
4. **Viento** en el shader (sin costo de simulación): oscilación por especie
   con fase propia por planta y ráfagas lentas.
5. **Niveles de detalle** por distancia al jugador: hasta 8 u reactivo + viento;
   8–15 u solo viento; más allá, quieto.

## Especies
| Tipo | Origen | Comportamiento |
|---|---|---|
| Pasto corto | matas del mapa (`tuft`) | flexible, rápido |
| Pasto alto | **nuevo**, pintado en la zona libre del atlas | más amplitud, más lento |
| Helechos | **nuevo**, pintado en la zona libre del atlas | pesado y elástico |
| Flores | flores del mapa (`flowers`) | delicadas, vibración rápida y pequeña |
| Arbustos | arbustos del mapa (`bush`) | oscilación mínima y lenta |
Para nuevas especies: dibujar el sprite en `ART` (ver v1.1), que entra solo a
`NEW_SPRITES` y darle un número de tipo con su amplitud y frecuencia en el shader.

## Interacciones
Jugador (posición, velocidad y dirección) · criaturas y jefes al moverse
(radio según su tamaño) · ataque cuerpo a cuerpo (abanico al frente) · ondas
expansivas (todas las del Rey Slime; API `window.__TM_VEG__.blast(x, y, r, fuerza)`)
· viento. Los desplazamientos están acotados (sin deformaciones exageradas).

## Zona y configuración
- Solo en el **Valle del Alba**. Zona controlada de pasto alto y helechos: anillo
  de 3,5 a 16 u alrededor de la salida del valle (máx. 600 plantas, fuera de caminos
  y obstáculos). Las matas, flores y arbustos de todo el valle reaccionan.
- Activar: `?veg=1`. Ajustar antes de cargar: `window.__TM_VEG_CONFIG__ = { … }`
  (celdas, tamaño de celda, Hz, resorte, amortiguación, acoplamiento, fuerzas,
  viento, distancias de detalle, densidad de la zona).
- Si la tarjeta gráfica no permite leer texturas en vértices, queda solo el viento.
  Si el shader no compila, vuelve solo al terreno original.

## Pruebas (15-11-2026)
- `node --test tests/vegetacion/*.cjs` (5): dirección correcta, propagación con
  retraso y pérdida, fin natural sin vibración, desplazamiento acotado,
  ventana que sigue al jugador sin perder la onda.
- Navegador (Chromium de escritorio con renderizado por software): 1.672 plantas del
  mapa marcadas + 600 de la zona; la simulación cuesta ≈ 0,01 ms por paso y se duerme
  sola; al forzar un empuje solo cambia la vegetación (el suelo no).
- **Rendimiento (renderizado por SOFTWARE, no representativo de un celular):**
  caminando ≈ 33 ms/cuadro sin el sistema y ≈ 40–42 ms con él. En software el shader
  de vértices lo calcula la CPU; en una GPU real debería costar mucho menos.
- **No se probó en Android real.** Es la prueba pendiente más importante.

## Limitaciones
- Explosiones propias del motor (bola de fuego, etc.) aún no empujan la vegetación:
  falta conectarlas a `blast`.
- Pasto alto y helechos solo existen en la zona controlada (el mapa no los genera).

---

## v1.1 · Rediseño visual (16-11-2026) — en beta, pendiente de aprobación
Respuesta a la revisión del video real (pasto como «palitos verticales», demasiado
uniforme y brillante, movimiento poco visible).

**Arte.** Se eliminó el pasto procedural de líneas. Las 11 plantas nuevas están
dibujadas a mano píxel por píxel (`ART`, una letra = un píxel) con la **misma paleta
de los arbustos y árboles del juego** (`PAL`): hierba corta (3), hierba alta (2),
helechos (2), matas pequeñas (2) y flores blancas y rosadas (2). Hojas anchas con
luz arriba y sombra abajo; el contorno oscuro solo marca la silueta y la base se
funde con el suelo (sin borde de pegatina).

**Distribución.** Colonias por ruido determinista (dos escalas) con claros,
bordes que se desvanecen, centro de la colonia con hierba alta y helechos, borde
con hierba corta, matas y flores; volteo y amplitud propios por planta. Caminos de
tierra y obstáculos despejados. **228 plantas** en la zona (antes 600).

**Movimiento.** La hoja se dobla hacia donde la empujan y además la punta baja
hacia la raíz (se aplasta), así el doblez se lee aunque la planta sea chica.
Acoplamiento entre celdas 120 → 400 (la onda llega a 2–3 u), contacto más fuerte
(jugador radio 1,3 fuerza 20; criaturas 16; ataque 30). Cada planta lee la onda en
un punto propio (reacción desfasada). Viento solo en ráfagas lentas y suaves. La
simulación solo da pasos si está despierta: en reposo **0 pasos y 0 subidas de
textura**.

**Pruebas (16-11-2026).** 76/76 en `node --test` (nuevas: onda visible a 2 u y
reposo exacto en pocos segundos; arte con paleta del juego y sin base dura).
Mediciones en Chromium con renderizado por software (no representativo de un
celular): sin vegetación ≈ 36–42 ms/cuadro; v1.0 ≈ 43–46 ms; v1.1 ≈ 36–40 ms.
Triángulos: 3.928 sin vegetación, 5.302 con v1.1. Quieto tras caminar: 0 pasos de
simulación, 0 subidas. **Sin probar en Android.**

Pruebas visuales y mediciones en bruto: `docs/evidencias/vegetacion-v12/` (ver `LEEME.md`).

---

## v1.2 · Siluetas limpias, movimiento visible y profundidad (16-11-2026) — en beta, pendiente de aprobación
Respuesta a la revisión de la grabación real en Android de la v12.1 (siluetas con
bordes negros y puntas en zigzag «como alambres»; movimiento demasiado sutil; follaje
que compite con las piernas del personaje).

**Arte.** Todas las plantas redibujadas con hojas anchas y separadas:
- El contorno oscuro va **solo en la silueta exterior**; entre hojas se ve el suelo o
  una sombra verde. Ningún contorno negro queda dentro de una planta (hay una prueba).
- Volumen por valor: base más oscura que el suelo, cuerpo medio, puntas más claras
  que el suelo (se leen sin necesidad de líneas negras).
- Hierba alta con hojas que se abren y una que se arquea; helechos con frondas
  rayadas en chevrón (foliolos); matas de hoja ancha; flores sobre una mata baja,
  con tallos finos sin contorno.

**Movimiento a velocidad normal.**
- Toda la planta se calcula desde su **raíz** (antes cada vértice leía la onda en su
  propio punto, y la punta reaccionaba antes de que el personaje llegara).
- Amplitudes mayores (hierba alta 0,62 u en la punta, helecho 0,45, corta 0,30,
  flor 0,22, mata 0,16) y la planta se aplasta hacia la raíz al ser empujada, en
  proporción a su flexibilidad (los arbustos sólidos casi no).
- **Corrección:** los ataques no empujaban la hierba en la v12 (se leía un campo del
  avatar que no existe); ahora se detecta cada acción de ataque.

**Profundidad.** La hierba que está justo delante del jugador o de las 4 criaturas
más cercanas se agacha (hasta 55 %) y se abre hacia los lados: tapa pies y parte de
las piernas, nunca el cuerpo. Los arbustos no se agachan.

**Distribución.** Se conservan las colonias; espaciado 0,62 → 0,72 para que las matas
no se amontonen en garabatos: **169 plantas** (antes 228; v11 tenía 600).

**Telemetría del juego** (`?tel=1`): recuadro con FPS, ms por cuadro (promedio y
p95), estado de la simulación, pasos/s, subidas de textura/s, plantas y calidad.
Funciona con la vegetación activada (`?veg=1&tel=1`) y desactivada (`?tel=1`), para
medir en el mismo celular. No cambia nada del juego.

**Pruebas (16-11-2026).** 79/79 en `node --test`; 11/11 comprobaciones en el
navegador (caminos despejados, ataque real con teclado a un slime dentro de la
hierba, onda del Rey, profundidad, guardado + recarga con `?veg=1`, sin `?veg=1`
nada se instala y el shader queda original). Grabación de ~10 s caminando con el
teclado por varias colonias, con y sin vegetación. Rendimiento en software (muy
variable): sin vegetación ≈ 39–50 ms/cuadro, v12.1 ≈ 45 ms, v12.2 ≈ 41–45 ms; triángulos
3.928 / 5.302 / 4.947. **Sin probar en Android:** usar `?veg=1&tel=1` frente a `?tel=1`.

Pruebas visuales y mediciones: `docs/evidencias/vegetacion-v12.2/`.

---

## v1.3 · Pulido de movimiento y helechos (16-11-2026) — en beta
Tras la prueba real en Android de la v12.2 (≈ 60 FPS, 16,6 ms por cuadro, calidad
alta con la vegetación activa; se conserva como base). Pendiente según esa revisión:
hojas algo rígidas y helechos angulosos.

- **Hojas menos rígidas.** La textura del campo ahora lleva también la **velocidad**
  (canales b y a). En el shader la punta se **atrasa** respecto del tallo (inercia,
  como un látigo, con atraso propio por planta) y **aletea** un instante mientras la
  empujan: la hoja se curva en vez de inclinarse entera. Las plantas nuevas tienen
  **5 tramos** (antes 3), así que el doblez se ve curvo. Ambos efectos valen 0 en
  reposo (prueba nueva: los cuatro canales vuelven exactos a 128).
- **Helechos redibujados:** frondas más cortas que se arquean y caen dentro del
  sprite (antes chocaban con el borde y quedaban rectas y angulosas).
- **Telemetría compacta:** dos líneas pequeñas y semitransparentes (FPS, ms, p95,
  calidad; estado de la hierba). Los datos completos siguen en
  `window.__TM_VEG_TEL__.data`.
- **Corrección importante:** si la onda llegaba al borde de la ventana de simulación
  (24 × 24 u alrededor del jugador), ese valor quedaba congelado: algunas plantas
  podían quedar levemente dobladas y la simulación **no volvía a dormirse nunca**
  (gasto continuo, aunque pequeño). Pasaba desde que la onda llega más lejos (v12.1).
  Ahora el borde se mantiene en 0; hay una prueba que lo reproduce.
- Sin cambios en distribución (169 plantas), profundidad ni guardado.

Pruebas: 81/81 en `node --test`; 11/11 en el navegador. Evidencias en
`docs/evidencias/vegetacion-v12.3/`. **Falta medir en Android sin vegetación
(`?tel=1`)** para comparar con los 60 FPS observados con ella.


---

## v1.4 y v1.5 (beta v12.4 y v12.5) · Corte y recolección — registro
Esta sección no llegó a GitHub con la v12.5 (solo se subió el código). Resumen:
- Las plantas se cortan con el arma: el pasto y las flores caen de un golpe; el matorral alto aguanta 3.
- Queda el rastrojo, saltan trocitos y la planta vuelve a crecer (pasto ≈ 2,5 min, matorral ≈ 5 min).
- Lo que sueltan cae al suelo y se recoge al pasar cerca; va a la mochila, grupo «Recolección».
- Un matorral cortado no sirve de escondite.

---

## v2.0 «Flora» (beta v14) · Vegetación en todo el mundo, plantas por bioma y semillas (16-11-2026)
Pedido del director tras probar la v12.5 en Android: «tiene poca vegetación; debería estar esparcida por el
mundo combinada con los biomas; cada bioma con sus propias plantas; cada planta de color diferente debería
ser otra planta con su nombre y semilla, para plantarla en la granja que se construirá después».

**Todo el mundo.** Ya no hay una zona alrededor del campamento: la vegetación cubre el Valle del Alba y
cada piso de la Torre. Se arma por **trozos de 16 × 16 u** alrededor del jugador (radio 24 u; los trozos a
más de 40 u se quitan). Al llegar a un mundo se arman los cercanos de una vez; después, como mucho 5 ms
por cuadro. Un trozo se arma en unos 3 ms en el navegador de pruebas.

**Reparto determinista.** Cada celda de una rejilla fina (0,42 u) y de una gruesa para los matorrales
(3 u) decide su planta con ruido fijo del mundo: la misma planta siempre aparece en el mismo sitio, aunque
te alejes y vuelvas. Una planta queda solo si ninguna vecina con más prioridad la pisa (regla local que no
depende del orden en que se arman los trozos): **sin costuras entre trozos y sin plantas encimadas**.
Respeta agua, piedra, escaleras, bordes de escalón, caminos de tierra, árboles y rocas, el campamento,
los portales, los faroles y el Santuario de la Corona.

**Cada bioma, sus plantas.** 31 especies en 6 biomas. Cada flor de otro color es otra especie.
Las manchas de flores son de una misma especie, con alguna mezclada; la hierba alta crece en el centro
de las colonias. La densidad de cada bioma sigue la del motor (la ciénaga es frondosa y las dunas, ralas).

| Bioma | Pasto | Flores | Matorral (escondite) |
|---|---|---|---|
| Pradera del Alba | Pasto del alba, Hierba alta del valle | Margarita del alba, Clavelina rosa, Botón de oro, Campanilla azul | Zarzal del valle |
| Bosque de Ámbar | Hierba dorada | Farolillo de ámbar, Cardo bermejo, Estrella de miel | Zarza de ámbar |
| Tundra Helada | Pasto de escarcha | Campanita de hielo, Estrella de nieve, Lirio de escarcha | Enebro nevado |
| Dunas de Ceniza | Hierba de ceniza | Flor de brasa, Cardo de arena | Cactus de ceniza |
| Ciénaga Sombría | Junco negro | Lirio de pantano, Ojo de sapo, Flor fantasma | Cañaveral |
| Bosque de Cristal | Hierba prisma | Rosa de cuarzo, Campana celeste, Lágrima de amatista | Arbusto de cristal |

**Semillas.** Cada especie suelta **su propia semilla** («Semillas de margarita del alba», «Semillas de
cañaveral»…). En la mochila hay un grupo nuevo, **«Semillas»**, aparte de «Recolección». Se guardan con
la partida y en la nube como cualquier material (`progress.materials["sem-<especie>"]`). Las semillas
silvestres de la v12.5 se conservan. Sirven para la granja (todavía no existe).

**Las plantas fijas del mapa se reemplazan.** Las matas y flores que el motor pinta en el suelo no se
podían cortar; ahora se ocultan (sin costo de dibujo) y las reemplazan las vivas: todo lo que parece
planta se puede cortar. Los arbustos redondos del mapa siguen como estaban.

**Lo que suelta cada tipo.** Pasto: fibra y a veces su semilla. Junco: fibra, a veces caña y semilla.
Flores: su semilla (70 %) y a veces fibra. Matorrales: 2 cañas, 2 fibras y a veces semilla; el cañaveral da
3 cañas; el cactus y el arbusto de cristal aguantan 4 golpes y no dan caña.

**Archivos.** `beta/vegetacion.js` (catálogo, reparto y trozos), `beta/game.js` (31 semillas y el grupo
«Semillas» de la mochila; nada más), `beta/index.html` (versiones de caché),
`tests/vegetacion/flora.test.cjs` (nuevo), `tests/vegetacion/sim.test.cjs` (pruebas de arte actualizadas).

**Pruebas.** 88 de 88 (19 de vegetación, más Rey Slime y glitch). Las nuevas comprueban con un mapa
falso: reparto determinista, ninguna planta en dos trozos, sin plantas encimadas (también a través de los
bordes), cada planta en su bioma, nada en agua, tierra, árboles, escalones ni campamento, y que cada
semilla existe en la mochila del juego. En el navegador: Valle y pisos 3, 7 y 12 (los 6 biomas), cortar
una margarita da sus semillas, se guardan, aparecen en la mochila y un matorral cortado sigue cortado al
alejarse y volver. Sin errores en consola.

**Rendimiento (navegador sin tarjeta gráfica).** Valle: 23,6 ms por cuadro sin vegetación y 27,9 con
ella; piso 7: 23,1 y 28,4. Es parecido a la v12.5 (unos 4 ms) pese a tener el triple de plantas. Falta
medir en Android con `?veg=1&tel=1` y con `?tel=1`. La telemetría muestra ahora plantas vivas, trozos y
biomas.

**Limitaciones.**
- En el cooperativo todos ven las mismas plantas, pero el corte y lo que sueltan solo pasan en tu pantalla.
- Al recargar la partida, lo cortado vuelve a aparecer crecido.
- Las semillas todavía no se plantan: falta la granja.

Evidencias: `docs/evidencias/vegetacion-v2-flora/` (catálogo de especies, Valle, los 6 biomas, mochila y
`resultados.json`).
