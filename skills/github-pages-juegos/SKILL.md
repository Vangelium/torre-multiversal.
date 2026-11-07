---
name: github-pages-juegos
description: Publica y actualiza juegos web estáticos en GitHub Pages usando GitHub MCP y validación local.
---

# GitHub Pages para juegos HTML

## Objetivo

Mantener juegos browser en GitHub con historial de versiones y una URL pública jugable, sin depender de Netlify para los archivos estáticos.

## Precondiciones

1. Comprobar identidad con `mcp__GitHub__get_user_login`.
2. Enumerar repositorios permitidos con `mcp__GitHub__list_repositories` / `list_installations`.
3. No suponer permiso de escritura cuando la instalación no tiene repositorios. No inventar el éxito de una publicación.
4. Revisar ZIP antes de subir: nombres y rutas, `index.html` en raíz, enlaces relativos, recursos y credenciales. No subir secretos a repositorio público.
5. Obtener autorización implícita del usuario solo dentro del alcance explícito de su solicitud. Evitar sobrescribir trabajo ajeno o borrar archivos sin comprobación.

## Flujo de publicación

1. Verificar el repositorio de destino, rama predeterminada, permisos y árbol actual. Registrar SHA de inicio.
2. Preparar publicación en la raíz (`index.html`, JS, assets, `.nojekyll`). Para GitHub Pages no hace falta compilación si el sitio ya es estático.
3. Crear blobs (`create_blob`), árbol (`create_tree`), commit (`create_commit`), actualizar la ref (`update_ref`) con SHA esperado. Si hay conflictos, inspeccionar y reconciliar, no hacer force push.
4. Si el conector no permite crear repositorios o gestionar la configuración de Pages, solicitar la **acción puntual** correspondiente a la persona: crear repo en `https://github.com/new`, autorizarlo en la integración de GitHub, activar `Settings → Pages → Deploy from a branch → main / (root)`.
5. Verificar estado en `https://api.github.com/repos/OWNER/REPO/pages` si está disponible mediante lectura autorizada, comprobar enlace publicado y cargar menú/sala desde navegador. Nunca afirmar que está online sin verificación.

## Migración de Netlify

- Un `_headers` no configura cabeceras en GitHub Pages.
- URL de partidas e invitaciones: preferir `new URL('./', location.href).href` para conservar prefijo `/repo/`.
- Mantener Supabase, Realtime y/o backend separados; Pages no puede hospedar backend dinámico.
- No migran automáticamente almacenamiento local ni configuraciones de dominio de autenticación.
- Al modificar `game.js`, cambiar el query `?v=` en `index.html` para mitigar cacheo.

## Diagnóstico

- Repositorios vacíos en MCP: revisar instalación y alcance de acceso, no el código del juego.
- Error 404: repo mal escrito, permiso insuficiente o GitHub Pages sin configurar.
- Pantalla en blanco: comprobar rutas relativas, 404 de assets, error de JS y `Content-Security-Policy` real.
- Salas no conectan: revisar supabase.co, RLS, permisos, red, configuración Realtime y origen del sitio.

## Seguridad

Nunca incluir tokens, credenciales o datos personales en commits. Una clave publishable de Supabase no es credencial secreta, pero debe acompañarse de reglas de acceso.
