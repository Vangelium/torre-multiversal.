# Combate v2 «Esencias» · beta (`/beta/?combate=1`) · 17-11-2026

> **Estado:** primera de tres entregas del combate nuevo. En beta, apagado por defecto (`?combate=1`).
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
