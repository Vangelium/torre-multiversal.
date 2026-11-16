# Vangelium Dynamic Vegetation v1.0 · beta (`/beta/?veg=1`)

> **Estado (16-11-2026): v1.5 (beta v12.5) en beta, desactivado por defecto (`?veg=1`). NO publicado en producción. Pendiente de aprobación.**

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

## v1.4 · Pasto corto hacia arriba y matorrales altos (16-11-2026) — en beta
Pedido de Yonnah: «no me gusta que se encimen con la de atrás… se ven como las 2
juntas o medio bugeadas; me gusta el pasto en línea hacia arriba, pero corto; altos
solo los matorrales, donde se escondan animales o acechadores; el pasto, para que
coman los animales».

**Especies (todas nuevas):**
- **Pasto corto** (4 variantes, 6–11 × 6–8 px): hojas verticales de 1 px, base
  oscura y punta clara, sin contorno negro (como las matas originales del mapa).
- **Flores** (2): pasto corto con dos o tres flores en tallo.
- **Matorral alto** (2, 25–30 px): un manojo denso de hojas verticales con la base
  oscura. Se usan pocos (9) y separados, en el centro de las colonias.
- Se eliminaron la hierba alta suelta, los helechos y las matas redondas.

**Nunca se encima una planta con otra:** cada planta ocupa su rectángulo en pantalla
y no se coloca si toca otro. 281 plantas (9 matorrales, 232 de pasto, 40 flores).

**Profundidad real:** las plantas nuevas se dibujan **de pie** mirando a la cámara
(inclinada 45°; mismo tamaño en pantalla que antes), así que tapan lo que está detrás
y no lo que está delante. Un slime detrás de un matorral queda escondido; si el
jugador queda detrás, el juego muestra su silueta tramada (como con los árboles).
El matorral no se agacha ante las criaturas (pueden esconderse); ante el jugador,
un poco (35 %).

**Preparado para el juego:** `window.__TM_VEG__.thickets` lista los matorrales
(posición y radio) para conectar después acechadores que viven en ellos y animales
que pastan.

Pruebas: 85/85 en `node --test` (nuevas: pasto corto vertical sin contorno, matorrales
pocos y separados); 11/11 en el navegador. Evidencias en `docs/evidencias/vegetacion-v12.4/`.

---

## v1.5 · Más pasto, cortar con el arma y recolectar (16-11-2026) — en beta
Pedido de Yonnah: «quiero más pasto; que se puedan cortar con un arma y que al cortarlas
boten algo para craftear más adelante».

**Más pasto.** Zona de radio 26 (antes 18), colonias más tupidas y matas de pasto corto
un poco más altas (8–10 px) y llenas. 794 plantas (670 de pasto, 108 flores, 16 matorrales; antes 281); siguen sin encimarse.
Para no cargar de más, el pasto corto usa 2 tramos (el matorral, 5).

**Cortar.** Cada golpe del arma (cualquier ataque cuerpo a cuerpo) corta lo que está en
el arco de enfrente, según hacia dónde mira el personaje. El pasto y las flores caen de
un golpe; el **matorral alto aguanta 3** (se sacude con cada uno). La planta queda como
**rastrojo** (su base cortada) y saltan recortes verdes. Vuelve a crecer sola: pasto
≈ 2,5 min, matorral ≈ 5 min (en la partida; al recargar todo está crecido). El matorral
cortado deja de servir de escondite hasta que rebrota.

**Lo que suelta** (cae al suelo, flota un poco y se recoge al pasar cerca; va a la bolsa):
| Planta | Suelta |
|---|---|
| Pasto corto | fibra de pasto (55 %), semillas (12 %) |
| Flores | semillas silvestres (70 %), fibra (35 %) |
| Matorral alto | 2 cañas de matorral, 2 fibras, semillas (35 %) |

Los tres materiales nuevos (`fibra`, `semilla`, `cana`) se guardan en
`progress.materials` como el resto de la bolsa (máx. 99 c/u), sobreviven a guardar,
recargar y exportar, y en **Equipo → Mochila** aparecen en un grupo nuevo,
**«Recolección»**, con su descripción y su uso futuro (cuerdas, vendas, cestas, cebos,
cultivos, flechas, mangos, empalizadas). Cambio en `beta/game.js`: solo la lista de
materiales y ese grupo de la mochila.

**Pruebas (16-11-2026).** 86/86 en `node --test` (nueva: botín, materiales e íconos,
rastrojo). En el navegador 9/9 del corte (más pasto, golpe que corta, recortes y botín,
recoger al pasar, matorral de 3 golpes, guardar y recargar, «Recolección» en la mochila,
rebrote, sin errores) y 11/11 de las comprobaciones generales. Rendimiento en software:
27 ms/cuadro sin vegetación y 31 ms con la v12.5 (7.213 triángulos frente a 3.928). **Sin probar en Android;
en multijugador el corte y el botín son locales de cada jugador (por ahora).**
