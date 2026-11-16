/*
 * Torre Multiversal · beta · HUD compacto para celular (?hud=1)
 *
 * Problema: en un teléfono vertical los paneles superiores (vida, meta, expedición,
 * eco, objetivo, avisos) llegaban a ocupar ~240 px de 860 de alto.
 * Solución: solo reacomoda lo que ya existe, sin tocar la lógica del juego:
 *   fila 1 · reloj, coronas, Bestias / Mapa / Equipo / menú (igual que antes, un poco más bajos)
 *   fila 2 · vida y nivel a la izquierda · objetivo (criatura marcada) a la derecha
 *   fila 3 · una sola línea de chips: meta · expedición · eco (texto recortado; al tocar
 *            se abre el mismo detalle de siempre)
 * Los avisos bajan justo debajo de esa fila y la telemetría (?tel=1) va abajo al centro.
 * Solo se aplica en pantallas de hasta 520 px de ancho. Sin ?hud=1 no cambia nada.
 */
(function (root) {
  'use strict';
  if (!root.document || !root.location) return;
  const q = new URLSearchParams(root.location.search);
  if (q.get('hud') !== '1') return;
  const S = 'env(safe-area-inset-top,0px)';
  const css = `
@media (max-width:520px) {
  html.tm-hud-compacto .hud-top-right { top:calc(${S} + 6px) !important; gap:4px !important; }
  html.tm-hud-compacto .hud-top-right .chip { min-height:34px !important; height:34px !important; padding-top:0 !important; padding-bottom:0 !important; }
  html.tm-hud-compacto .hud-top-right .icon-btn, html.tm-hud-compacto #btn-pause { width:38px !important; height:38px !important; }
  html.tm-hud-compacto .time-hud { top:calc(${S} + 6px) !important; }
  html.tm-hud-compacto .time-hud .chip, html.tm-hud-compacto #tm-rey-open { min-height:34px !important; height:34px !important; }

  html.tm-hud-compacto .hud-left-stack {
    top:calc(${S} + 48px) !important; gap:4px !important;
    width:calc(100vw - 20px - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px)) !important;
    grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) auto !important; grid-auto-flow:row dense !important; align-items:stretch !important;
  }
  html.tm-hud-compacto .hud-left-stack > * { grid-column:1 / -1; }
  html.tm-hud-compacto .hud-left-stack > .vital { justify-self:start; padding:2px 6px !important; min-height:0 !important; }
  html.tm-hud-compacto .hud-left-stack > .goal-tracker,
  html.tm-hud-compacto .hud-left-stack > .expedition-hud,
  html.tm-hud-compacto .hud-left-stack > .echo-chip { grid-column:auto; margin-top:6px; }
  html.tm-hud-compacto .hud-left-stack > .goal-tracker, html.tm-hud-compacto .hud-left-stack > .expedition-hud { margin-top:6px; }

  /* Meta: una línea («◆ Conoce el valle · 0/3»); el detalle sigue al tocar. */
  html.tm-hud-compacto .goal-tracker {
    display:flex !important; align-items:center; gap:6px; min-height:28px !important; height:28px; padding:0 7px !important;
    line-height:1 !important; white-space:nowrap; overflow:hidden;
  }
  html.tm-hud-compacto .goal-tracker #goal-progress, html.tm-hud-compacto .goal-tracker #goal-next { display:none !important; }
  html.tm-hud-compacto .goal-tracker .goal-eyebrow { order:2; margin-left:auto; font-size:0 !important; letter-spacing:0; flex:none; }
  html.tm-hud-compacto .goal-tracker .goal-eyebrow b { font-size:10px !important; }
  html.tm-hud-compacto .goal-tracker #goal-summary { order:1; min-width:0; overflow:hidden; text-overflow:ellipsis; font-size:11px !important; }
  html.tm-hud-compacto .goal-tracker #goal-summary::after { content:none !important; }

  /* Expedición y eco: chips de una línea, recortados. */
  html.tm-hud-compacto .expedition-hud, html.tm-hud-compacto .echo-chip {
    display:block !important; min-height:28px !important; height:28px; padding:0 7px !important; line-height:24px !important;
    font-size:10px !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis; min-width:0;
  }
  html.tm-hud-compacto .expedition-hud[hidden], html.tm-hud-compacto .echo-chip[hidden] { display:none !important; }

  /* Objetivo (criatura marcada): a la altura de la vida, más bajo. */
  html.tm-hud-compacto .target-frame { top:calc(${S} + 48px) !important; padding:2px 7px 3px !important; gap:2px !important; }

  /* Barra del Rey Slime: justo debajo de la fila de chips (antes 104 px). */
  /* En la pelea las metas se ocultan: la barra sube justo debajo de la vida
     (o debajo de la fila de chips si el eco está visible) y los avisos van debajo de ella. */
  html.tm-hud-compacto .tm-rey-boss { top:calc(${S} + 90px) !important; }
  html.tm-hud-compacto body:has(.echo-chip:not([hidden])) .tm-rey-boss { top:calc(${S} + 128px) !important; }
  html.tm-hud-compacto body.tm-rey-fight .toasts { top:calc(${S} + 154px) !important; }
  html.tm-hud-compacto body.tm-rey-fight:has(.echo-chip:not([hidden])) .toasts { top:calc(${S} + 192px) !important; }

  /* Avisos debajo de los chips, más angostos; telemetría abajo al centro. */
  html.tm-hud-compacto .toasts { top:calc(${S} + 130px) !important; width:min(80vw,340px) !important; }
  html.tm-hud-compacto .toasts > * { font-size:11px !important; padding:3px 8px !important; }
  html.tm-hud-compacto #tm-veg-tel { top:auto !important; bottom:calc(env(safe-area-inset-bottom,0px) + 4px) !important; left:50% !important; transform:translateX(-50%); }
}`;
  const add = () => {
    root.document.documentElement.classList.add('tm-hud-compacto');
    const st = root.document.createElement('style'); st.id = 'tm-hud-compacto-css'; st.textContent = css;
    root.document.head.appendChild(st);
  };
  if (root.document.head) add(); else root.document.addEventListener('DOMContentLoaded', add);
  root.__TM_HUD_COMPACTO__ = { css };
})(typeof window !== 'undefined' ? window : globalThis);
