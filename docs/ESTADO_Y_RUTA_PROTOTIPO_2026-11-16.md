# Torre Multiversal · Estado del proyecto y ruta al prototipo jugable

**Fecha:** 16-11-2026 · **Revisó:** Claude (Opus), leyendo el repositorio `Vangelium/torre-multiversal.` (rama `main` en `fb17468` y las 4 ramas `feature/*`).
**Para:** Yonnah (director) y ChatGPT (sube los cambios a GitHub).

> Leyenda: **✅ verificado hoy** (lo comprobé en el código o con las pruebas) · **🟡 en beta** (existe, pero falta probarlo en celular o aprobarlo) · **⚪ solo diseño** (decidido o propuesto, sin código).

---

## 1. Foto general

| Dónde | Qué tiene | Estado |
|---|---|---|
| **Juego público** (`/`, `index.html` + `game.js` de la raíz) | Valle y Torre, combate, cooperativo de hasta 4, doma de 5 especies, día/noche, élites, anomalías (v0.23) | ✅ existe · no recibe nada de lo nuevo desde el 7-11 |
| **Beta** (`/beta/`) | Todo lo anterior + cuentas y guardado en la nube, varios personajes, Rey Slime de 3 formas, glitch del mundo, vegetación, HUD compacto | 🟡 casi todo sin validar en dos celulares reales |
| **Pruebas automáticas** | Rey Slime, glitch, vegetación | ✅ **81 de 81 pasan** en `main` (corridas hoy) |

**Conclusión:** el juego tiene mucho contenido, pero está repartido entre la versión pública, la beta, 4 ramas y funciones escondidas detrás de banderas (`?veg=1`, `?hud=1`). Para tener un **prototipo jugable**, lo que más falta no es contenido nuevo: es **juntar, probar y encender por defecto** lo que ya existe.

---

## 2. Lo que quedó a medias

### A. Orden del repositorio (lo más urgente, y no toca el juego)

1. **Vegetación v12.4 y v12.5 nunca se subieron.** La rama `feature/vegetacion-v12-beta-20261116` llega solo hasta la v13 (HUD compacto). El corte de plantas, el rastrojo, lo que sueltan (fibra, semillas, caña) y el grupo «Recolección» de la mochila **no están en GitHub**. Están en el zip `torre-beta-v12.5-vegetacion.zip` que tiene Yonnah.
2. **Las migraciones de Supabase solo existen en la rama del PR #1** (`feature/supabase-persistencia-20261110`, 8 archivos en `supabase/migrations/`), junto con `docs/ENTREGA_A_OPUS_2026-11-12.md` y `docs/MIGRACION_SUPABASE.md`. Esa rama va 60 commits atrás de `main`. Si se pierde, se pierde el único registro de cómo está armada la base de datos.
3. **La portada animada de VANGELIUM** (`beta/vangelium-intro.js`) solo existe en la rama del PR #5 (`feature/guardados-por-personaje-beta-20261111`, 48 commits atrás). Nunca llegó a `main`.
4. **La rama `feature/rey-slime-ritual-beta-20261113` está superada.** Todo lo del Rey Slime que hay en `main:beta/` es más nuevo. Se puede cerrar sin perder nada, pero **no hay que borrarla** sin aprobación.
5. **El código fuente del motor no está en el repositorio.** `game.js` es un archivo minificado de 1,17 MB y `beta/game.js` es una copia modificada de él. El zip de fuentes (`torre-multiversal-fuente (1).zip`, del 7-11) nunca se subió. Hoy todos los cambios al motor se hacen sobre el archivo ya compilado: funciona, pero es frágil y cada vez será más difícil. **Pregunta para Yonnah: ¿todavía tienes ese zip de fuentes?**

### B. Cuentas y guardado en la nube (P0 del brief maestro) 🟡

- **Hecho en beta:** cuenta con correo y contraseña, varios personajes por cuenta, una tarjeta por personaje, autoguardado cada minuto y al salir, aviso si otro celular guardó algo más nuevo, respaldos separados en «avanzado» y protección de la última copia.
- **Según Yonnah (10-11):** recuperó una partida en otro celular y jugó en cooperativo con dos teléfonos. Fue antes de las últimas correcciones.
- **Falta:** la prueba completa en dos celulares con las correcciones del 11 y 12-11 (secuencia corta en la sección 4). Faltan también Google/Apple y activar en Supabase la protección contra contraseñas filtradas, que es un ajuste del panel.

### C. Rey Slime «Corazón del Alba» 🟡

- **Hecho en beta:** ritual de 10 limos (charca, corona, cuenco y trono), tres formas jugables con transformaciones, clones, Puñetazo del Rey, linajes, Fragmentos Rebeldes, perdonar o matar (aliado o arma), música y guardado.
- **Falta:** el cooperativo (fase F; hoy solo funciona en partida individual), la prueba en celular real (rendimiento, sonido, tacto) y **tu aprobación final del arte de las tres formas**. El arma del Rey es local (`verified=false`).

### D. Glitch «el mundo existe porque lo recorres» 🟡

- **Hecho en beta:** etapas (arbusto, árboles, piedras, criaturas y mundo), Grieta, Fragmento de Realidad, el Olvido y la pista hacia la charca del Rey.
- **Falta:** ajustar tiempos y daño después de probarlo en el celular, y decidir qué más desbloquean los Fragmentos.

### E. Vegetación 🟡 (apagada por defecto, `?veg=1`)

- **Falta:** subir la v12.4 y la v12.5, medir en Android con y sin vegetación, tu aprobación del aspecto y de la cantidad de pasto, que el corte se vea en cooperativo, que las explosiones empujen el pasto y que las plantas cortadas sigan cortadas al recargar.
- **Sin uso todavía:** fibra, semillas y caña se juntan, pero aún no sirven para nada porque no hay crafteo.

### F. HUD compacto 🟡 (apagado por defecto, `?hud=1`)

- **Falta:** tu aprobación en el celular para dejarlo encendido siempre.

### G. Diseñado pero sin código ⚪

Árbol de habilidades y roles, botón de mascota que se arrastra a un ataque, crafteo, jefes de bioma, cinemática de la Torre, tutorial, flujo de sprites (`sprites/`, `manifest.json`), economía en el servidor y monetización.

---

## 3. Ruta propuesta al prototipo jugable

**Definición de «prototipo jugable»:** un solo enlace, sin banderas, que un amigo abre en su celular y juega 20 a 30 minutos sin ayuda:
crear personaje → valle → pelear y domar → recolectar → encontrar la charca y la corona → ritual → **Rey Slime de tres formas** → perdonarlo o quedarse con el arma → el progreso queda guardado en su cuenta.

Casi todo eso ya existe. Faltan las uniones.

### Etapa 1 · Ordenar la casa (sin tocar el juego)
1. Subir la v12.5 de vegetación a su rama.
2. Copiar a `main` solo `supabase/migrations/`, `docs/ENTREGA_A_OPUS_2026-11-12.md` y `docs/MIGRACION_SUPABASE.md` desde la rama del PR #1, sin tocar los archivos del juego.
3. Subir este documento a `docs/`.
4. Si existe el zip de fuentes, subirlo a una rama aparte (`fuentes/motor-v0.15`) para revisarlo.

### Etapa 2 · Una sola beta, todo encendido
1. Pasar la v12.5 a `main:beta/`.
2. Encender por defecto lo que apruebes: el HUD compacto y la vegetación, esta última solo si el Android aguanta. El glitch y el Rey Slime ya no dependen de banderas en el código actual.
3. Hacer una prueba física corta en dos celulares (sección 4), arreglar lo que falle y repetir.

### Etapa 3 · Cerrar el ciclo de juego
1. **Crafteo mínimo** para que lo recolectado sirva. Propuesta: vendas de fibra que curan, cebo de semillas que ayuda a domar y flechas de caña. Son 3 recetas y nada más.
2. **Tutorial de 3 pasos** dentro del juego (moverse y atacar, domar, la pista de la corona), sin ventanas de texto largas.
3. **El Rey Slime como meta del prototipo:** el juego guía hacia él y al derrotarlo aparece una pantalla de «fin del prototipo».

### Etapa 4 · Publicar
Pasar la beta a la versión pública, con copia del juego actual para poder volver atrás y con tu aprobación explícita.

### Queda para después del prototipo
Rey Slime en cooperativo, Google/Apple, roles y árbol de habilidades, botón de mascota arrastrable, nuevos jefes, economía y monetización.

---

## 4. Prueba física mínima (dos celulares, unos 10 minutos)

1. Celular A: entrar a `/beta/` con tu cuenta y continuar con tu personaje.
2. Jugar 2 minutos (ganar XP o un objeto) y esperar a que diga «Guardado».
3. Celular B: entrar con la **misma** cuenta. ¿Aparece **una sola** tarjeta del personaje, con el progreso de A?
4. Continuar en B y verificar que **no** se abre el creador de personaje.
5. Jugar 1 minuto en B, volver a A y recargar. ¿Avisa que hay algo más nuevo?
6. B con la cuenta de tu pareja: crear sala cooperativa y unirse desde A.
7. Anotar qué falló (o grabar la pantalla).

---

## 5. Mensaje para ChatGPT (Etapa 1)

> Trabajamos en el repositorio `Vangelium/torre-multiversal.`. Haz esto sin tocar `index.html` ni `game.js` de la raíz y sin borrar ninguna rama:
> 1. En la rama `feature/vegetacion-v12-beta-20261116`, agrega lo que trae `torre-beta-v12.5-vegetacion.zip` (`beta/vegetacion.js`, `beta/game.js`, `beta/index.html`, `tests/vegetacion/sim.test.cjs`, `docs/VEGETACION_DINAMICA_BETA_2026-11-15.md` y `docs/evidencias/vegetacion-v12.5/`). Deberían pasar 86 de 86 pruebas.
> 2. En `main`, copia desde la rama `feature/supabase-persistencia-20261110` solo la carpeta `supabase/migrations/` y los archivos `docs/ENTREGA_A_OPUS_2026-11-12.md` y `docs/MIGRACION_SUPABASE.md`. Nada más de esa rama.
> 3. En `main`, agrega este documento como `docs/ESTADO_Y_RUTA_PROTOTIPO_2026-11-16.md`.
> 4. No cierres ni fusiones PRs todavía. Avísame qué commits quedaron.
