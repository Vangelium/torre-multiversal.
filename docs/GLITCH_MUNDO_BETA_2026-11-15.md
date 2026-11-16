# «El mundo existe porque lo recorres» · beta (`/beta/?glitch=1`)

> **Estado (15-11-2026): en beta, NO versión aceptada.** Idea del director.
> Se combina con el Rey: `/beta/?rey=1&glitch=1`.

## Historia
La Torre arma cada multiverso alrededor del viajero. Si dejas de moverte, deja
de sostenerlo y el mundo empieza a olvidarse… empezando por lo pequeño.

## Etapas (tiempo quieto)
| Quieto | Qué falla |
|---|---|
| 20 s | **El arbusto más cercano**: tiembla, se corta en franjas y cambia de color |
| 35 s | **Árboles** alrededor (radio que crece de 2,5 a 8) |
| 50 s | **Piedras**. Aparece la **Grieta** (ver recompensa) |
| 65 s | **Criaturas**: tiemblan, cambian de color y parpadean |
| 80 s | **El mundo**: suelo en bloques, velo de líneas, desgarros, interfaz que tiembla y música apagada |
| 100 s | **El Olvido**: el borde de la pantalla se blanquea y recibes daño cada 2 s (1, luego 2, 3… cada 15 s) |
| Te mueves | Todo vuelve de golpe con un sonido de «reinicio» |

Cada etapa crece suave en 8 s. Con «reducir movimiento», la mitad de fuerte y sin temblores de interfaz.

## Recompensa: la Grieta
Desde la etapa de las piedras aparece una grieta de colores a 4,5–7 pasos, en
suelo libre y al mismo nivel. **Solo se ve mientras estás quieto**: hay que
recordar dónde estaba, caminar hasta ella (el mundo vuelve a la normalidad) y
quedarse quieto encima 8 s (a los 2,5 s vuelve a verse y crece). Al abrirse:
**Fragmento de Realidad** (+1, guardado por perfil en el almacenamiento beta),
una línea de la historia y vida completa. La grieta dura 3 minutos.

## Cuándo no corre
Menús o pausa, jugador caído, pelea del Rey o cinemática, y criaturas que te
persiguen a menos de 9 pasos. Si empieza un combate, el mundo se restablece.
Recompensa y peligro solo en partida individual; en cooperativo, solo lo visual.

## Técnica
- `beta/glitch.js`; `beta/game.js` solo agrega la instalación con `?glitch=1`.
- Árboles, arbustos y piedras están horneados en el mapa: el efecto va en el
  shader del terreno (se reconocen por su región del atlas y se miden por distancia).
- Las criaturas se alteran solo durante el dibujo y se restauran después.
- El daño del Olvido entra dentro del paso del mundo, como un golpe normal; el
  empujón de ese golpe no cuenta como moverse.
- Pruebas: `node --test tests/glitch/*.cjs` (5) y recorrido en navegador de
  las seis etapas, la vuelta a la normalidad y la apertura de la Grieta.

## Seguridad gráfica (v2, 15-11-2026)
- El shader del terreno **solo se modifica cuando el glitch empieza** (20 s quieto), nunca en el juego normal.
- Solo si la tarjeta gráfica tiene margen (≥ 200 vectores de uniforms en vértices y ≥ 64 en fragmentos).
- Si el shader modificado no compila en ese celular, vuelve solo al terreno original y no lo intenta más
  (los demás efectos del glitch siguen funcionando).

## Pendiente / propuesto
- Qué desbloquean los Fragmentos de Realidad (por ejemplo, pistas de la Charca del Primer Reflejo, fase E).
- Ajustar tiempos y daño tras probar en el celular.
