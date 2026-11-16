# Vangelium Dynamic Vegetation v1.0 · beta (`/beta/?veg=1`)

> **Estado (15-11-2026): en beta, desactivado por defecto. NO publicado en producción.**

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
Para nuevas especies: pintar el sprite (`paintSprite`), añadirlo a
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
