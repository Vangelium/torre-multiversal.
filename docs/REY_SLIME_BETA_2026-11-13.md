# Rey Slime clásico · Corazón del Alba | primera integración jugable en beta

## Incluido en este PR

- **Ritual real:** seleccionar hasta 10 slimes domesticados del inventario existente, ocupar diez posiciones independientes, retirarlos sin pérdida antes de invocar. La invocación **consume irrevocablemente** los diez fragmentos tras una confirmación explícita.
- **Composición:** mezcla de verde / azul / rosa determina el color dominante y una variante prismática si aparecen los tres colores. El azul aumenta vida, el rosa aumenta daño y velocidad. Nivel de fusión derivado del vínculo previo y la procedencia élite. No se inventa un nivel nativo de mascota que el motor anterior no registraba.
- **Animación 3D/pixelada:** los diez fragmentos rodean el centro, se fusionan, crece un Rey Slime con corona, ojos, brillo, saltos y sombras heredadas del mundo. Sin imágenes externas ni dependencia de generación en runtime.
- **Enemigo jugable:** una unidad hostil con vida, IA de embestida, daño, colisiones, ataques reales del jugador, experiencia normal del combate, y retorno al estado guardado al cargar en solitario.
- **Elección tras derrotarlo:** perdonar crea un Rey Slime aliado que sigue al jugador y ataca enemigos en solitario; rematar añade una de tres armas registradas al inventario real: Hoja, Cetro o Dagas del Rey Slime. Se conserva la historia de doce rituales. Al terminar, se permite reunir otros diez.
- **Persistencia:** campo `progress.reySlime` validado por normalizador del guardado TM1, incluido en exportación y sincronización por personaje. Se preservan archivos previos; no se modifica el esquema de Supabase.
- **Interfaz:** chip 👑 junto al reloj de juego, panel con diez casillas, lista de mascotas y decisiones. Los demás controles conservan posición; interfaz adicional ocultable.

## Restricciones importantes

1. **Solo beta y solo partida individual**, sin alterar sincronización y propiedad de enemigos en cooperativo. En modo cooperativo no aparecen ritual ni aliados experimentales.
2. La nueva arma es equipo real del cliente, pero la economía sigue siendo `verified=false`. No habilitar intercambios, rankings económicos o compras basadas en este inventario sin autoridad server-side.
3. **No fusionar a juego público sin pruebas visuales reales** (vertical/horizontal), prueba con diez mascotas en dos celulares, restauración de un ritual incompleto, combate, perdón, arma y regresión de guardados y cooperación.
4. En la primera beta los fragmentos se obtienen **domesticando los slimes normales**, con máximo 12 compañeros almacenables. Las diez posiciones son las de la ceremonia, no nuevos sitios permanentes del mapa.
5. El aliado especial es una unidad personalizada local que ataca por el flujo de daño de compañero. La sincronización multijugador del Rey requiere un protocolo propio y se deja para una segunda fase.

## Pruebas y protocolo

- Ejecutar `node --test tests/rey-slime/king.test.cjs` y `node --check beta/rey-slime.js`.
- QA manual: domar diez slimes, comprobar colores, colocar y retirar sin duplicar, iniciar ritual y observar la fusión, atacar rey, cerrar/abrir durante combate, vencer, elegir perdón y comprobar ataque de aliado, realizar otro ritual y elegir arma. Exportar TM1, reimportar en otro dispositivo, comprobar exactamente una copia de cada recompensa.
- Ejecutar las 28 pruebas existentes de autoguardado y validar no regresión en navegación móvil y en partida cooperativa. **No se consideran aprobadas automáticamente sin ejecutarlas.**
- Branch de implementación separada; no tocar `main` ni producción hasta aceptación.

## Activación de seguridad

El Rey Slime se habilita **solo** desde `https://vangelium.github.io/torre-multiversal./beta/?rey=1`. La beta habitual `/beta/` conserva el flujo anterior; el nuevo módulo está cargado pero no se instala sin `rey=1`. No se modifican los archivos raíz del juego público.
