# Pruebas visuales · Vegetación v1.1 (beta v12, 16-11-2026)

Capturas hechas en Chromium a tamaño de teléfono (412 × 860), misma partida y
mismo personaje en todas (semilla fija). **No son capturas de un Android real.**

| Archivo | Qué muestra |
|---|---|
| `1_comparacion_antes_despues.png` | Misma escena: sin vegetación · v11 (la del video) · v12 |
| `2_caminando_hierba_alta.gif` | Caminata por hierba alta, cámara lenta ×4, con recuadro de la onda simulada |
| `2b_caminando_cuadros.png` | Seis cuadros de esa caminata |
| `2c_doblez_al_pasar.png` | Al detenerse vs. en reposo; en rojo, las hojas que se movieron |
| `3_slime_atravesando.gif` | Un slime cruza la colonia (cámara lenta ×4) |
| `3b_rastro_del_slime.png` | Rastro del slime marcado en rojo |
| `4_prueba_reposo.png` | Dos capturas con 2 s de diferencia y su diferencia: ninguna planta cambia |
| `mediciones_rendimiento.json` | ms por cuadro, triángulos, pasos de simulación y subidas de textura (renderizado por software) |
| `resultados_visuales.json` | Datos de las pruebas de caminata, reposo, slime y onda del Rey |

Los JSON son estrictos (sin `NaN`). `pasos_sim = null` en la v11 significa que esa
versión no los contaba, no que fueran cero.
