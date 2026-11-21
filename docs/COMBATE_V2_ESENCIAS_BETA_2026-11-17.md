# Combate v2 «Esencias» · beta (`/beta/?combate=1`) · 17-11-2026

> **Estado:** entregas 1 y 2 de 3 del combate nuevo (esencias + árbol por rol), **funcionando en cooperativo** (17-11-2026). En beta, apagado por defecto (`?combate=1`).
> NO publicado en producción. Falta probarlo en Android.

## Por qué
El director lo dijo claro: «el combate se siente fome y aburrido; no tiene progresión de habilidades ni mejoras,
ni habilidades para escoger u obtener de alguna criatura al matarla, ni árbol por clase, ni combos con gracia».
La revisión del motor lo confirmó: subir de nivel solo da +4 de vida y +2 % de daño; el combo de tres golpes se
desbloquea en el nivel 3 y ahí se acaba; no hay pausa de impacto, críticos ni contador de combo; la «técnica
exclusiva» de cada rol figura como pendiente.

**Plan aprobado por el director (3 entregas):**
1. **Esta:** habilidades de criaturas + golpes con impacto.
2. Árbol de habilidades por rol (un punto por nivel, 3 ramas por rol y la técnica exclusiva de cada uno).
3. Combos avanzados: esquiva perfecta con cámara lenta y contraataque, habilidades dentro de los combos y ajuste.

## Esencias y habilidades de criaturas
- Cada criatura que **vences tú** tiene un **40 %** de soltar su **esencia** (las de élite sueltan **3**). Los clones
  y el entrenamiento no cuentan. La esencia salta, flota y vuela hacia ti; al tocarte se suma.
- Con **3 esencias** aprendes la habilidad de esa criatura; sube de nivel con 8, 16, 28 y 45 (niveles I a V).
  Cada nivel da **+25 % de daño, −6 % de recarga y +10 % de duración**. El daño también crece con tu nivel de
  Ascensión, igual que el del arma.
- La primera habilidad que aprendes va sola a la ranura libre. Hay **2 ranuras**.
- **Controles:** teclas **R** y **G**; en el celular, dos botones nuevos a la izquierda de los ataques, con la
  recarga en reloj, el nivel (I–V) y el nombre. **Mantener pulsado** un botón, tocar una ranura vacía o tocar **✦**
  (tecla **H**) abre el panel **Habilidades**: «Aprendidas» (equipar o quitar) y «Por descubrir» (qué criatura da
  cada una y cuántas esencias llevas).

| Criatura | Habilidad | Qué hace | Daño (nivel I) | Recarga |
|---|---|---|---|---|
| Limo | Salto pegajoso | Saltas hacia tu objetivo y caes encima: daño en área y los deja pegados un instante. | 22 | 7 s |
| Gotita | Mordisco de enjambre | Una nube de gotitas muerde a los enemigos cercanos varias veces seguidas. | 6 | 8 s |
| Lanudo | Embestida | Bajas la cabeza y embistes en línea recta, golpeando y empujando todo lo que pillas. | 20 | 6 s |
| Escarabajo | Pinza | Un pellizco brutal de cerca que aturde. Ideal para abrir la guardia de los acorazados. | 34 | 6 s |
| Avispa | Aguijón | Disparas un aguijón veloz que envenena: pierden vida poco a poco. | 14 | 4.5 s |
| Búho | Picado nocturno | Marcas a tu objetivo y un búho de sombra cae en picado sobre él. | 32 | 9 s |
| Conejo cantor | Canto del alba | Un canto que te cura el 20 % de tu vida en 3 segundos (más al subir de nivel). | — | 18 s |
| Liebre trueno | Derribo | Cruzas a toda velocidad a través de tus enemigos y los tumbas un instante. | 16 | 7 s |
| Tejón | Madriguera | La tierra avanza bajo el suelo hasta tu objetivo y estalla bajo sus pies. | 26 | 8 s |
| Retoño | Raíces | Brotan raíces a tu alrededor que enredan a los enemigos: no pueden moverse ni atacar. | 10 | 12 s |
| Halcón | Picado | Un halcón cae desde lo alto sobre tu objetivo, muy rápido y preciso. | 28 | 7 s |
| Jabalí de ámbar | Carga | Escarbas el suelo y cargas en línea recta, arrasando con lo que encuentres. | 28 | 9 s |
| Zorro ilusionista | Ilusiones | Te desdoblas y apareces detrás de tu objetivo. Tus 3 golpes siguientes son críticos. | 12 | 10 s |
| Seta | Nube de esporas | Lanzas una nube de esporas que envenena a quien se quede dentro. | 6 | 11 s |
| Bellotero | Bellotas | Llueven bellotas alrededor de tu objetivo; cada una golpea donde cae. | 12 | 8 s |
| Lobo | Aullido de caza | Aúllas: durante 8 s haces un 30 % más de daño y tus habilidades se recargan más rápido. | — | 20 s |
| Armiño | Mordisco helado | Un mordisco de escarcha que deja lento a tu objetivo. | 24 | 6 s |
| Gólem de hielo | Pinchos de hielo | Una hilera de pinchos de hielo brota hacia delante y deja lentos a los que toca. | 18 | 9 s |
| Espíritu | Ventisca | Una niebla helada te rodea: quien entra se congela poco a poco y va lento. | 4 | 14 s |
| Escorpión | Aguijón venenoso | Clavas un aguijón que envenena fuerte: pierden mucha vida durante 5 s. | 14 | 7 s |
| Gusano de arena | Embestida subterránea | Avanzas bajo la arena a toda velocidad y sales de golpe con un mordisco enorme. | 40 | 12 s |
| Salamandra | Ceniza ardiente | Escupes una bola de ceniza que estalla y deja el suelo ardiendo un rato. | 20 | 9 s |
| Buitre | Carroñero | Durante 10 s te curas con el 20 % del daño que haces. | — | 20 s |

Son 14 tipos de efecto: golpe cercano, proyectil, carga en línea, salto con caída en área, enjambre, picado desde
el cielo, erupción bajo tierra, raíces, ilusión (teletransporte detrás del objetivo + críticos asegurados),
zona en el suelo, lluvia de proyectiles, aura (más daño, recarga rápida o robo de vida), curación y línea de pinchos.
Todos con efectos visuales propios en pixel art dibujado por código.

## Golpes con impacto
- **Pausa de impacto:** cada golpe propio congela la acción un instante (20 ms; 60 ms en remates, críticos y
  golpes fuertes; 90 ms en las habilidades grandes). **Solo en partida individual**: en cooperativo el mundo no
  se detiene por un golpe.
- **Temblor de cámara** en remates, críticos y habilidades grandes (se respeta «reducir movimiento» del sistema).
- **Críticos:** 6 % base (+1 % cada 10 golpes de combo, hasta +10 %), ×1,75 de daño, con «¡CRÍTICO!» y destellos.
- **Contador de combo** a la derecha: golpes seguidos sin recibir daño (se corta a los 3 s sin golpear o si te
  golpean). Tramos: 10 golpes **+5 %** de daño («¡Buen ritmo!»), 25 **+10 %** («¡Imparable!»), 50 **+15 %**
  («¡Furia!») y 100 **+25 %** («¡Leyenda!»).

## Cómo se integra (sin reescribir el motor)
- `beta/combate.js` (nuevo, como el Rey Slime y la vegetación). El daño de las habilidades entra por el **mismo
  camino que los golpes del arma**: se añaden a los golpes que devuelve `session.combat.step`. Así funciona igual
  en solitario, como anfitrión y como invitado.
- Como **invitado** en una sala ajena, el anfitrión solo acepta golpes cerca de tu arma y de hasta 40 de daño (×
  nivel): las habilidades se recortan a eso. Los efectos de control (aturdir, enraizar, ralentizar) y la curación
  solo funcionan cuando tu partida es la que manda (solitario o anfitrión).
- Las cargas y saltos usan el empuje del propio motor (`session.kb`), que respeta colisiones.
- Guardado: `progress.habilidades = { v, ess, lv, slots }`, normalizado en `beta/game.js` igual que en el módulo
  (hay una prueba que compara los dos). Viaja con la partida y con la nube como el resto del progreso.

**Archivos:** `beta/combate.js` (nuevo), `beta/game.js` (normalizador de `habilidades` e instalación con
`?combate=1`; nada más), `beta/index.html` (carga del módulo y versiones de caché),
`tests/combate/esencias.test.cjs` (nuevo).

## Pruebas
- **94 de 94** pruebas automáticas (6 nuevas de combate + vegetación, Rey Slime y glitch). Las nuevas comprueban:
  una habilidad por cada criatura del bestiario del motor, aprender con 3 esencias y subir hasta V, ranuras sin
  duplicados, el mismo normalizador aquí y en `game.js` (también con datos rotos), daño por nivel, tramos de combo,
  críticos y que el motor instala el módulo.
- **En el navegador:** se lanzaron las 23 habilidades contra criaturas reales del Valle, sin errores en consola;
  las de daño golpean (el registro de `applyHit` lo confirma). Esencia real al vencer un limo, se guarda en la
  partida, el botón vacío abre el panel y todo convive con `?veg=1&rey=1&glitch=1&hud=1`.
- **Rendimiento:** sin diferencia medible en reposo (24,0 ms por cuadro sin el módulo y 24,1 ms con él, en el
  navegador sin tarjeta gráfica).

## Limitaciones conocidas
- No hay botones de mando (gamepad) para las habilidades todavía.
- Como invitado en cooperativo: sin control ni curación, y daño recortado (lo decide el anfitrión).
- El balance es inicial: hay que jugarlo y ajustar daños y recargas.

Evidencias: `docs/evidencias/combate-v2-esencias/`.


---

## Entrega 2 · Árbol de habilidades por rol (17-11-2026)
Pedido del director: «Continúa» tras aprobar el plan (2.ª entrega: árbol por rol).

**Puntos.** Cada nivel de Ascensión da **1 punto** (nivel 10 = 9 puntos; hasta 49). Cada rol tiene su propio
árbol y guarda sus puntos: cambiar de rol (Pausa → Combate) cambia de árbol sin perder nada. **Reiniciar puntos
es gratis** (pide confirmación con un segundo toque).

**Estructura.** 7 roles × 3 ramas × 5 nodos = 105 nodos. Los nodos de efecto acumulable tienen 3 rangos; los de
mecánica, 1. Para aprender un nodo hace falta al menos un rango en el anterior de su rama, y el último de cada
rama pide 6 puntos en esa rama. Llenar un árbol cuesta 31 puntos (nivel 32).

**Técnica exclusiva.** La tercera rama de cada rol empieza con su técnica, la que figuraba como «pendiente» desde
el principio. Se aprende desde el nivel 2 y sube de nivel (I → V) con cada 2 puntos más en esa rama. Va sola a una
ranura libre y se usa con los mismos botones que las habilidades de criaturas.

| Rol | Ramas (★ = técnica) | Técnica exclusiva |
|---|---|---|
| Espadachín | **Filo**: Filo templado → Ojo del duelista → Remate firme → Corte profundo → Juicio final<br>**Guardia**: Postura → Aliento → Contragolpe → Coraza viva → Espinas de acero<br>**Maestría**: ★ Tormenta de acero → Ritmo → Sed de batalla → Técnica pulida → Maestro de armas | Tormenta de acero: Giras con la espada tres veces y golpeas a todos los que te rodean. |
| Arquero / pistolero | **Puntería**: Pulso firme → Ojo de halcón → Primer disparo → Punta afilada → Tiro de gracia<br>**Movilidad**: Respiro → Cuero curtido → Disparo en retirada → Sin pausa → Cazador nato<br>**Cazador**: ★ Lluvia de flechas → Rastreador → Botín → Trampero → Leyenda del arco | Lluvia de flechas: Disparas al cielo y una lluvia de flechas cae alrededor de tu objetivo. |
| Mago | **Elementos**: Chispa → Foco → Combustión → Canalizar → Archimago<br>**Barrera**: Escudo arcano → Maná vital → Reflejo → Sifón → Égida<br>**Arcano**: ★ Meteoro → Runas → Eco arcano → Poder crudo → Tormenta arcana | Meteoro: Invocas un meteoro: cae sobre tu objetivo, golpea a todos alrededor y deja el suelo ardiendo. |
| Curandero | **Luz**: Luz cálida → Gracia → Renacer → Vigor → Milagro<br>**Protección**: Velo → Templanza → Castigo → Fe → Paciencia<br>**Santuario**: ★ Aura sanadora → Plegaria → Bendición → Devoción → Santo | Aura sanadora: Curas un 30 % de vida en 4 s a ti y, si eres quien hospeda la partida, a tus aliados cercanos. |
| Defensor / tanque | **Muralla**: Placas → Tenacidad → Espinas → Roca → Inquebrantable<br>**Martillo**: Peso → Golpe sordo → Aplastar → Impacto → Derribar<br>**Bastión**: ★ Bastión → Aguante → Victoria → Disciplina → Fortaleza | Bastión: Provocas a los enemigos cercanos para que te ataquen a ti y recibes un 40 % menos de daño durante 5 s. |
| Asesino | **Letalidad**: Punta envenenada → Filo cruel → Emboscada → Precisión → Ejecutor<br>**Sombras**: Paso ligero → Sangría → Desaparecer → Cazador nocturno → Frenesí<br>**Danza**: ★ Danza de cuchillas → Gemelas → Tajo vital → Velocidad → Muerte silenciosa | Danza de cuchillas: Saltas de enemigo en enemigo hasta cuatro veces; cada tajo es un golpe crítico. |
| Invocador / domador | **Vínculo**: Afinidad → Instinto → Dominio → Comunión → Señor de bestias<br>**Espíritu**: Pelaje → Savia → Hambre → Camada → Tótem<br>**Manada**: ★ Manada espectral → Aullido interior → Presa → Colmillos → Alfa | Manada espectral: Invocas lobos de luz que muerden a los enemigos cercanos durante 6 s. |

**Efectos posibles (19):** más daño (general, cuerpo a cuerpo, a distancia, de habilidades), probabilidad y daño
crítico, menos recarga, robo de vida, regeneración, armadura (menos daño recibido), espinas (devuelves daño),
ejecutar (+daño a enemigos con menos del 30 % de vida), primer golpe (+daño a enemigos sanos), contragolpe (tras
esquivar), combo más largo, curarte y recargar habilidades al vencer, más esencias y remates que aturden.
Topes: armadura 60 %, recarga 45 %, crítico +50 %, robo de vida 25 %.

**Aviso de puntos.** Al subir de nivel aparece «¡Nivel N! Tienes X puntos de habilidad» y el botón ✦ muestra
cuántos puntos libres hay. Al abrir el panel con puntos libres se abre directo en la pestaña **Árbol**: tres
columnas, cada nodo con su rango, y abajo el detalle del nodo elegido (qué hace ahora, qué hará con el siguiente
rango, qué falta para aprenderlo) y el resumen de todo tu árbol.

**Dónde actúa cada efecto.** Daño, críticos, ejecutar, primer golpe, contragolpe y combo: en todos los golpes
propios (en cooperativo como invitado, con el tope que pone el anfitrión). Armadura, espinas, regeneración, robo
de vida, curación, provocación y aturdir: solo cuando tu partida es la que manda (solitario o anfitrión).

**Archivos.** `beta/combate.js` (árbol, técnicas y pantalla), `beta/game.js` (el normalizador de `habilidades`
guarda también `tal`, los puntos por rol), `beta/index.html` (versión de caché), `tests/combate/esencias.test.cjs`
(2 pruebas nuevas).

**Pruebas.** 96 de 96. Las nuevas comprueban: los 7 roles del árbol son los mismos del motor; 105 nodos con
efecto conocido; la tercera rama abre con la técnica; la curva de experiencia es idéntica a la del motor en los
50 niveles; requisitos (sin puntos, saltar nodos, otro rol, rango máximo, 6 puntos para el último); topes;
nivel de la técnica; reinicio; y el mismo normalizador aquí y en `game.js` también con `tal` roto. En el
navegador: los 7 roles aprendieron su técnica y la lanzaron contra criaturas reales (daño confirmado), la
armadura y las espinas del defensor funcionan, el aviso de nivel y el árbol se ven bien en vertical. Sin errores
en consola. Las 23 habilidades de criaturas siguen funcionando.

Evidencias nuevas: `7_arbol_defensor.png`, `8_aviso_nivel.png`, `9_tecnica_meteoro.png`, `10_tecnica_manada.png`.


---

## Cooperativo · todo lo nuevo funciona con amigos (17-11-2026)
Pedido del director: «necesito que todo funcione bien en el multijugador, es importante para jugar con amigos».

**Cómo.** Un canal de eventos propio (`x…`) dentro de la misma cola fiable que usa el motor (se reenvían hasta que
llegan, como los golpes y los emotes). Un solo envoltorio por sesión para la vegetación y el combate. El motor
deja pasar estos eventos (hay una prueba con su propio filtro de protocolo). Cada jugador saluda con su versión
(`xv`); si el anfitrión no tiene el combate nuevo, el invitado vuelve al camino anterior (con el tope del motor).

| Evento | Quién → quién | Qué hace |
|---|---|---|
| `xc` / `xr` | cualquiera → todos | Plantas cortadas: al instante y una foto de lo cortado para quien entra después |
| `xs` | cualquiera → todos | Habilidad lanzada: los demás ven sus efectos (proyectiles, raíces, pinchos, meteoro…) |
| `xd` | cualquiera → todos | Aviso de desplazamiento (cargas, saltos, ilusiones, danza): nadie lo toma por «movimiento imposible» |
| `xk` | invitado → anfitrión | Golpe de habilidad (y daño extra del árbol): el anfitrión valida y aplica daño, aturdir, raíces y lentitud |
| `xm` | invitado → anfitrión | Armadura, espinas y Bastión del invitado: el anfitrión los aplica a los golpes que recibe |
| `xh` | invitado → anfitrión | Curación del invitado (robo de vida, Canto del alba, regeneración, al vencer) |
| `xa` | invitado → anfitrión | Aura sanadora del invitado: cura a los aliados cercanos |
| `xt` | invitado → anfitrión | Bastión del invitado: los enemigos cercanos van por él |

**Validación del anfitrión (contra trampas):** el jugador debe estar en la sala, vivo y en el mismo mapa; la
criatura debe existir y estar a 12 u o menos; daño máximo por golpe 260 (× nivel); 24 golpes por segundo;
aturdir ≤ 1,5 s, raíces ≤ 3 s, lentitud ≤ 4 s; curación ≤ 25 % de la vida por segundo; aura y provocación,
una vez cada 6 s; armadura ≤ 60 %, espinas ≤ 40 %, Bastión ≤ 60 % y 8 s; desplazamientos anunciados ≤ 8 u
durante 1,6 s y sobre suelo válido.

**El invitado ve su golpe al instante** (número, destello y combo) y el motor no lo cuenta dos veces. Sus
esencias funcionan igual (el motor sabe que la criatura la venció él).

**Probado con dos jugadores de verdad** (anfitrión + invitado conectados con la red simulada del motor,
`?net=fake`, en dos pestañas): saludo de versión; el invitado ve las plantas que corta el anfitrión y las que ya
estaban cortadas al entrar; el Picado del invitado a 5,5 u mata al limo en el mundo del anfitrión; el anfitrión
ve los efectos de las habilidades del invitado; el Canto del alba del invitado le sube la vida en el anfitrión
(40 → 62); armadura 15 % (40 → 34 de daño) y espinas 15 % (6 de daño al atacante); Bastión del invitado
(guardia 40 % y 2 enemigos provocados); la Carga (6 u) y las Ilusiones (5 u) del invitado sin correcciones del
anfitrión; esencia del invitado al vencer. Sin errores en consola.

**Sigue siendo solo de partida individual (como antes):** la pausa de impacto (el mundo no se detiene por el golpe
de uno), el ritual y la pelea del Rey Slime, y la recompensa y el peligro del glitch del mundo.
