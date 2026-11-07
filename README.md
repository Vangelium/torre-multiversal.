# Torre Multiversal · publicación en GitHub Pages

Juego web estático. No requiere `npm`, compilación ni servidor Node.

## Publicación inicial desde el celular

1. Crea un repositorio **público** llamado `torre-multiversal` en https://github.com/new (o usa uno propio con permisos de escritura).
2. En el repositorio, pulsa **Add file → Upload files** y carga **el contenido descomprimido de este ZIP** en la raíz, no el ZIP como archivo.
3. Confirma la subida a la rama `main`.
4. Ve a **Settings → Pages**, selecciona **Deploy from a branch**, rama **main**, carpeta **/(root)** y guarda.
5. Cuando GitHub termine de publicar, la URL normalmente será `https://TU_USUARIO.github.io/torre-multiversal/`.

GitHub Pages requiere que la cuenta y el repositorio cumplan sus límites y condiciones. La publicación no es inmediata; mira el estado de Pages/Actions si aún no aparece.

## Actualización

Reemplaza los archivos modificados en `main` y confirma los cambios. **No publiques ZIP como un único archivo**. Si actualizas `game.js`, cambia la versión de `game.js?v=...` en `index.html` para evitar caché vieja del navegador.

## Compatibilidad

- `index.html`, `game.js`, `three.min.js` y los iconos usan rutas relativas para funcionar en subcarpetas de Pages.
- Las invitaciones multiplayer usan automáticamente la URL raíz de la página donde se ejecuta el juego.
- El multijugador usa Supabase como servicio independiente. Esta publicación **no cambia** la configuración, las reglas de acceso ni las cuotas de Supabase. Comprueba crear/unirse a una sala desde dos navegadores reales una vez desplegado.
- GitHub Pages solo sirve archivos estáticos. El archivo `_headers` de Netlify no funciona en GitHub Pages y se ha excluido del paquete.
- Los datos guardados en `localStorage` bajo el dominio antiguo de Netlify no se migran automáticamente a un dominio nuevo.
- La clave `sb_publishable_...` de Supabase es pública, pero hay que proteger las tablas y los permisos con políticas adecuadas (RLS). No pongas contraseñas, claves secretas o tokens administrativos en este repositorio público.

## Contenido

- `index.html`: interfaz y carga del juego.
- `game.js`: lógica de juego, multijugador e invitaciones.
- `three.min.js`: biblioteca gráfica incluida localmente.
- `manifest.webmanifest` y `icon-*.png`: instalación móvil.
- `.nojekyll`: publicación estática sin procesamiento Jekyll.
- `skills/github-pages-juegos/SKILL.md`: procedimiento reutilizable para trabajar con una conexión GitHub MCP.

## Notas de verificación

Cambio funcional único sobre el juego: la URL de las invitaciones deja de ser fija a Netlify y se toma de la página actual en HTTP(S). No se alteraron sistemas de combate, criaturas, clases o multijugador. Se actualizó el parámetro de versión JS para invalidar caché.
