/* Torre Multiversal Beta · «Pantalla tranquila» en vertical · v1 (13-11-2026)
 *
 * En celular vertical, las metas y la expedición ocupan una sola línea cada
 * una. Cuando cambian (nueva meta, progreso, expedición) se despliegan unos
 * segundos para que el jugador las lea y luego vuelven a una línea.
 * Tocar cualquiera de ellas sigue abriendo su ventana completa (motor).
 * No se elimina información: solo se pliega.
 */
(function(){
"use strict";
var SHOW_MS=6000,timers=new WeakMap();
var portrait=window.matchMedia("(orientation: portrait) and (max-width: 600px)");
function pulse(el,ms){
 if(!el)return;
 el.classList.add("tm-hud-open");
 clearTimeout(timers.get(el));
 timers.set(el,setTimeout(function(){el.classList.remove("tm-hud-open")},ms||SHOW_MS));
}
function watch(el,getText){
 if(!el||!window.MutationObserver)return;
 var last=getText();
 new MutationObserver(function(){
   var now=getText();
   if(now===last)return;
   last=now;
   if(now)pulse(el);
 }).observe(el,{childList:true,subtree:true,characterData:true});
}
function goalText(){
 var g=document.getElementById("btn-goals");
 return g?[ "goal-summary","goal-count","goal-progress"].map(function(id){
   var x=document.getElementById(id);return x?x.textContent:"";
 }).join("|"):"";
}
function start(){
 var goals=document.getElementById("btn-goals");
 watch(goals,goalText);
 // El cuadro de expedición lo crea el motor después; se busca al aparecer.
 var hooked=null;
 var stack=document.querySelector(".hud-left-stack")||document.getElementById("hud");
 function hookExpedition(){
   var exp=document.querySelector(".hud .expedition-hud");
   if(exp&&exp!==hooked){hooked=exp;watch(exp,function(){return exp.textContent});}
 }
 hookExpedition();
 if(stack&&window.MutationObserver)new MutationObserver(hookExpedition).observe(stack,{childList:true,subtree:true});
 // Al entrar al mundo: mostrar la meta completa unos segundos.
 var hud=document.getElementById("hud");
 if(hud&&window.MutationObserver){
   var wasHidden=hud.hidden;
   new MutationObserver(function(){
     if(wasHidden&&!hud.hidden){
       pulse(goals,7000);
       var exp=document.querySelector(".hud .expedition-hud");
       if(exp)pulse(exp,7000);
     }
     wasHidden=hud.hidden;
   }).observe(hud,{attributes:true,attributeFilter:["hidden"]});
 }
 document.documentElement.classList.toggle("tm-portrait-calm",portrait.matches);
 var onChange=function(e){document.documentElement.classList.toggle("tm-portrait-calm",e.matches)};
 if(portrait.addEventListener)portrait.addEventListener("change",onChange);else portrait.addListener(onChange);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
