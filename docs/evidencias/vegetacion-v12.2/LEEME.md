# Pruebas visuales · Vegetación v1.2 (beta v12.2, 16-11-2026)

Chromium con renderizado por software, partida y personaje fijos (semilla). La
comparación de teléfono usa 412 × 860 con densidad de píxeles 2,625 (como un
Android de gama media). **No son capturas de un Android real.** Las pruebas de la
v12.1 siguen en `../vegetacion-v12/`.

| Archivo | Qué muestra |
|---|---|
| `0_comparacion_telefono.png` | Misma escena a escala de teléfono: sin vegetación · v12.1 · v12.2 |
| `1_recorrido_10s_con_y_sin.mp4` | ~10 s caminando con el teclado por varias colonias, **a velocidad normal**, con y sin vegetación (mismo trayecto) |
| `2_sprites_antes_y_ahora.png` | Las 11 plantas de la v12.1 y de la v12.2, ampliadas ×8 |
| `2b_caminando_cuadros.png`, `2d_caminando_camara_lenta.gif` | Caminata por hierba alta en cámara lenta ×4 con la onda simulada |
| `2c_doblez_al_pasar.png` | Al detenerse vs. en reposo; en rojo, las hojas que se movieron |
| `3_slime_atravesando.gif`, `3b_rastro_del_slime.png` | Un slime cruza la colonia y deja su rastro |
| `4_prueba_reposo.png` | Quieto: 0 pasos de simulación, 0 subidas; ninguna planta cambia |
| `funcional.json` | 11 comprobaciones en el navegador (caminos, ataque, onda del Rey, profundidad, guardado, sin `?veg=1`) |
| `mediciones_rendimiento.json` | Sin vegetación · v11 · v12.1 · v12.2 (ms por cuadro, triángulos, pasos, subidas) |
| `resultados_visuales.json` | Datos de caminata, reposo, slime y onda del Rey |

Para medir en el celular: abrir la beta con `?veg=1&tel=1` y luego con `?tel=1`
(sin vegetación) y comparar el recuadro de telemetría.
