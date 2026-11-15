# Rey Slime · beta experimental (`/beta/?rey=1`)

> **Estado (15-11-2026, v4): en beta, NO versión aceptada.** Tres formas (B, C)
> y linajes con Fragmentos Rebeldes (D) listos en beta. Faltan el ritual de
> mundo completo (E) y el cooperativo (F).
> Orden aprobado: A arte → B máquina de tres formas → C combate y clones →
> D linajes y Rebeldes → E ritual de mundo → F cooperativo.

## Correcciones v2.1 (revisión de ChatGPT y del director)

- **Identidad de mascotas:** al colocar un limo se guarda su ficha completa
  (nombre, vínculo, fecha de captura, vida, elemento) y al retirarlo vuelve
  idéntico, también tras guardar, exportar/importar o recuperar desde la nube.
  El guardado del motor (`__tmKingSave`) valida esa ficha con el mismo
  normalizador de mascotas del juego. No se puede duplicar un limo.
- **Herencia de colores:** empate de los dos primeros colores = **híbrido**
  (5 azules + 5 rosas → híbrido azul y rosa, mitad y mitad). Los colores
  secundarios aparecen como **vetas**. El linaje será un sistema aparte (fase D).
- **Corona:** en la fusión nace dentro de la masa, sube teñida por la gelatina
  y sale por la cabeza. Ya no cae del cielo.
- **Sin furia:** se quitó; la escalada llegará con las transformaciones.
- **Súbditos sin recompensa:** su muerte se borra del registro de bajas: no dan
  experiencia ni cuentan para bestiario o expediciones (prueba de control:
  limo normal +17 XP, súbdito +0).
- **Música reemplazable:** `beta/audio/rey-slime.json`. Con `"track": null`
  suena la pista temporal sintetizada; para la definitiva («Guardian's
  Awakening») se sube el archivo a `beta/audio/` y se escribe su nombre en
  `"track"` (opcional `loopStart` y `volume`).

## Fase A · arte de las Formas II y III (para aprobar) · v2 14-11-2026

Rehecho con las referencias del director (hojas «concepto final» y escala):
gelatina translúcida (rampa de 8 tonos, luz de borde, brillo en cada bulto),
burbujas de colores (una por limo + esencia violeta), charco de gel bajo los
pies. Bestia: pecho alto, fauces con colmillos, ojo incandescente, cresta de
púas, cola con maza de púas, patas con dedos. Rey humanoide: torso en V con
músculos marcados, puños con nudillos, hombreras de armiño con colitas negras,
broches de oro con rubí y cadena, capa púrpura con ribete dorado, ojos furiosos.
Escala de juego según la hoja del director: `TMReyFormas.SCALE` (II ≈ 2× el
jugador, III ≈ 3,8×). Las hojas de detalle se ven ampliadas (escala 1).

- `beta/rey-formas.js`: esculpido pixelado de la Bestia gelatinosa y el Rey
  humanoide, con poses de reposo, ataques y transformación, y respuesta a la
  mezcla de colores. **No se carga en el juego** hasta que el arte se apruebe.
- `beta/rey-concepto.html?m=II | III | escala`: hojas de concepto (silueta,
  paleta, reposo, ataques, transformación, variantes y escala).

Versión 2 · 13-11-2026 · Claude (Opus), sobre la base de ChatGPT (`acb7eae`).

## Dónde se invoca

**Fuera de la Torre**, en el **Santuario de la Corona**: un claro circular en el
bosque del Valle del Alba, al norte del campamento (centro aprox. x 94,5 · y 107,5).
El Rey Slime es el jefe del bioma del valle. La pelea ocurre en el propio claro;
los árboles alrededor hacen de muro natural de la arena.

- Si el mapa cambiara, el juego busca solo el claro libre más cercano.
- Al acercarse aparece un aviso; con **USAR** (o tecla F) se abre el ritual.
- El chip 👑 junto al reloj muestra el progreso (`3/10`). Si se toca lejos del
  santuario, aparece una **flecha guía** con la distancia.
- El santuario se marca en el mapa (corona dorada) cuando ya fue explorado.

## Qué hay en el santuario

- Plataforma de piedra antigua con musgo, canales tallados y sello central.
- **Diez pedestales con colisión.** Cada limo colocado salta desde el jugador a su
  pedestal, se queda ahí moviéndose y enciende la runa con su color.
- Obelisco de la Corona al norte (su gema brilla más cuantos más limos hay).
- Dos braseros de fuego azul en la entrada sur (iluminan de noche).

## Ritual (panel)

- Anillo de diez pedestales, lista de limos domados y **presagio**: retrato,
  variante, nivel, vida y fuerza del Rey que saldrá, más la mezcla de colores.
- Invocar se hace **manteniendo pulsado** (sin ventanas del navegador).
- En horizontal el panel se reparte en dos columnas para no tener que desplazarse.

## Cinemática de fusión (≈ 10 s, se puede saltar)

1. Franjas de cine, la cámara viaja al santuario; los animales del claro huyen.
2. Las diez runas se encienden una a una (columnas de luz y campanas).
3. La luz recorre los canales; cada limo salta al centro y se funde en una masa
   que crece y brilla (sonido «gloop» que sube de tono).
4. La masa tiembla, chispas en espiral y un haz de luz; todo retumba.
5. **La corona nace dentro de la masa**, sube teñida por la gelatina y sale por la cabeza: destello, ondas expansivas, polvo, cámara temblando.
6. El Rey aparece, ruge y entra el **título**: «REY SLIME · verde con vetas azules · Nivel N».
7. La cámara vuelve al jugador, aparece la barra del jefe y empieza su música.

Durante la cinemática el mundo se detiene (nadie puede atacar al jugador).

## Rey Slime · fase 1

Arte: hoja de 28 cuadros dibujados píxel a píxel (no se estira la imagen):
respira, parpadea, salta, se agacha, embiste inclinado, se aplasta al caer, se
marea, ruge, invoca, se desinfla y llora vencido. Lleva **diez burbujas dentro,
una por cada limo fusionado, con su color**. La corona tiene gemas de los colores
que participaron. Los híbridos se ven mitad y mitad; los colores secundarios, como vetas.

| Movimiento | Aviso para esquivar | Detalle |
|---|---|---|
| Salto de avance | — | Se mueve saltando, con polvo al caer |
| Rebote corto (cerca) | Se agacha temblando y en rojo + círculo pequeño | Daño en área pequeña |
| Embestida | Carril de flechas en el suelo 0,85 s | **Si choca con un árbol o pedestal queda aturdido 1,8 s** |
| Salto aplastante | Sale de pantalla; **círculo rojo que se llena** y pitidos | Onda, grieta, gotas; luego **aturdido 1,6 s** |
| Llamado real | Ruge con la corona brillando | Lanza gotas que se vuelven 3 súbditos (al 70 % y al 40 %) |

- Si el jugador cae o se aleja demasiado, el Rey vuelve a su trono y recupera vida.
- Barra de jefe con daño «retrasado», 10 segmentos, avisos («¡Aturdido! Es tu
  oportunidad») y parpadeo con poca vida. Oculta metas y expedición durante la pelea.
- Música propia (Re menor, 148 ppm) por el bus de música: respeta Ajustes.

## Derrota y decisión

Destello, la corona sale volando, el Rey se desinfla en un charco, vuelve a su
trono, se recompone y la corona regresa torcida. Luego aparece la elección
(mantener pulsado):

- **Perdonar** → corazones; se encoge y salta hacia ti. Queda como aliado
  pequeño que te sigue a saltos y embiste a tus enemigos.
- **Rematar** → brilla, estalla en chispas y el arma aparece y vuela hacia ti.
  La pantalla ya dice qué arma tocará antes de elegir.

## Archivos

- `beta/rey-art.js` — arte procedural con la paleta oficial del juego.
- `beta/rey-audio.js` — efectos y música sintetizados (WebAudio del juego).
- `beta/rey-slime.js` — reglas, santuario, IA, cinemáticas e interfaz.
- `beta/rey-formas.js` — arte de las Formas II y III (ahora se carga en la beta).
- `beta/rey-combate.js` — transformaciones, IA de las Formas II y III, clones y cámara.
- `beta/index.html` — estilos `#tm-rey-css` y carga de los scripts.
- `beta/game.js` — un solo cambio: la instalación recibe el material de sprites
  iluminados del motor (`{ds}`) para que el Rey reciba la luz del día y la noche.

## Pruebas

- `node --test tests/rey-slime/*.cjs` → 55/55 (18 originales + 10 de la fase 1 + 10 de regresión v2.1 + 10 de las formas + 7 de linaje).
- Recorrido de las tres formas en navegador (vertical 412×860 y horizontal 860×412):
  golpe enorme → se detiene en 66 % → transformación → ataques de la Bestia →
  clones y absorción → Forma III → puñetazo, martillo, 20 clones con 3
  atacando → derrota real con una sola baja registrada. Sin errores.
- Recorrido completo en navegador real (vertical 412×860 y horizontal 860×412):
  ritual → cinemática → ataques → derrota → perdón / arma, sin errores.
- Pelea real con golpes del jugador hasta matar al Rey: da experiencia y el arma.
- `tests/beta-sync` (28 pruebas de guardado en la nube) sin cambios.
- La beta sin `?rey=1` no instala nada del Rey.

## Límites

- Solo partida individual. En cooperativo no aparece el santuario.
- Las pruebas usan Chromium de escritorio; falta probar en celulares reales
  (rendimiento, sonido, tacto) antes de llevarlo al juego público.
- La economía sigue `verified=false`; el arma es equipo del cliente.

## Linajes y Fragmentos Rebeldes · fase D (en beta, 15-11-2026)

Según `docs/REY_SLIME_DISENO_CORAZON_DEL_ALBA.md` §5. Color y linaje son
independientes.

| Diez componentes | Linaje | Efecto |
|---|---|---|
| Diez slimes comunes | Silvestre | Normal |
| Diez fragmentos reales de la misma fase N | Renacido N | Vida ×1,2 / 1,4 / 1,6 · fuerza ×1,1 / 1,2 / 1,3 · recarga más rápida · luz de borde dorada / violeta / celeste · II y III: un clon más por oleada · **III: el Puñetazo del Rey deja un eco que golpea otra vez en el mismo cono** |
| Fragmentos de distintas fases o mezclados con comunes | Herencia mixta | +3 % vida y +1,5 % fuerza por fragmento |

Un solo fragmento III **no** crea un Renacido III. Todos empiezan en la Forma I
y pasan por las tres. El linaje aparece en el presagio, el título y la barra.

**Fragmentos Rebeldes.** Cada clon nace con la fase de la forma que lo creó.
Una minoría (12 %, máximo 4 por pelea) se vuelve independiente: no ataca, se
aleja del Rey, brilla de vez en cuando y el Rey no puede reabsorberla. Al caer
el Rey, los obedientes se disuelven y los rebeldes **se quedan en el claro**:
se doman con el proceso normal de vínculo, y la ficha nueva guarda
`royalFragment { fragmentPhase, originKingId, identityId }`. No se entregan
solos ni dan experiencia. Viven solo en esa sesión si no se doman.

**Confirmación.** El panel avisa que los diez slimes dejarán de existir como
criaturas separadas. Si hay compañeros de vínculo alto (25 o más) o fragmentos
reales, hay que marcar una casilla que los nombra antes de poder invocar.

**Guardado.** `beta/game.js` (normalizador de compañeros y `__tmKingSave`)
conserva `royalFragment`, `lineage` y `fragments`, validados.

## Formas II y III · fases B y C (en beta, 14-11-2026)

Archivo nuevo `beta/rey-combate.js`; `rey-slime.js` lo llama en puntos fijos
(`this.forms`). Reglas puras en `rey-slime.js` (probadas con node).

**Transformaciones (fase B).** Al 66 % de vida pasa a la Forma II y al 33 % a
la III. Un golpe enorme se detiene en el umbral (no salta formas ni lo mata
antes de la III); lo mismo con quemaduras y otros daños continuos. Durante la
transformación (2,8 s) no recibe daño ni ataca, reabsorbe a sus clones, la
masa se retuerce en tres etapas, sale una onda que aparta al jugador (solo
hacia suelo libre), destello, cartel con el nombre de la forma y la barra de
jefe cambia a «FORMA II / III». En su trono nunca recupera la forma anterior.
La forma se deduce de la vida guardada, así que sobrevive a recargar.

**Forma II · Bestia gelatinosa.** Avanza a saltos pesados; mordisco en
embestida (carril en el suelo; si choca queda aturdida); megasalto (círculo
grande que se llena y luego queda pegada al suelo); espinas en círculo con
aviso; absorbe a sus clones (cada uno la cura 2,5 %) y luego expulsa gotas en
todas direcciones que se ven venir y se esquivan.

**Forma III · Rey humanoide.** Pasos que retumban. **Puñetazo del Rey en tres
tiempos:** 1) carga, el puño brilla violeta; 2) dirección, aparece el cono
rojo en el suelo y ya no cambia; 3) golpe en cono con ondas y grietas. Después
queda abierto un segundo. También martillo doble (círculo alrededor) y gancho
corto.

**Clones (fase C).** Tope de vivos 5 / 10 / 20 según la forma. Director: solo
2 / 2 / 3 atacan a la vez; el resto rodea al jugador a distancia. Ningún clon
da experiencia ni cuenta para el bestiario.

**Música.** La pista temporal acelera y suma capas en cada forma (sub-bajo en
la II, metales en la III). La pista final, cuando llegue, suena igual en todas.

**Cámara de jefe.** En las Formas II y III la cámara encuadra al jugador y al
Rey, y se levanta para que el Rey humanoide no quede tapado por la barra.

**Límites de esta entrega.**
- **El Puñetazo del Rey derriba hasta 4 árboles del cono** (v3.1): se quitan su
  colisión y su dibujo y el sector del mapa se rehace al momento, con hojas,
  astillas y grieta. Es solo para esa sesión: al recargar, el bosque vuelve a
  crecer (no se guarda ni cambia la huella del mapa). Sin tocar `game.js`.
- Al morir, la cinemática de derrota usa el arte de la Forma I (el Rey se
  encoge y se desinfla).
- Falta probar en celulares reales.
