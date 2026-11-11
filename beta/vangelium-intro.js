/* VANGELIUM Games: intro de transición en la beta.
   Sin escrituras a partidas, cuentas o Supabase. 100% prescindible. */
(function(){
  "use strict";
  var overlay=document.getElementById("tm-vangelium-intro");
  var enter=document.getElementById("tm-vg-enter");
  if(!overlay||!enter)return;
  var preview=new URLSearchParams(location.search).has("intro");
  var key="tm.vangelium.intro.seen.v1",seen=false;
  try{seen=sessionStorage.getItem(key)==="1";}catch(_){}
  if(!preview&&seen)return;
  overlay.hidden=false;
  var earlier=document.activeElement;
  function close(){
    if(overlay.hidden)return;
    overlay.hidden=true;
    try{sessionStorage.setItem(key,"1");}catch(_){}
    if(earlier&&earlier.isConnected&&typeof earlier.focus==="function")earlier.focus();
  }
  enter.addEventListener("click",close);
  overlay.addEventListener("keydown",function(event){
    if(event.key==="Escape"){event.preventDefault();close();}
    if(event.key==="Tab"){
      // El diálogo tiene un único control interactivo: foco en Entrar.
      event.preventDefault();enter.focus();
    }
  });
  enter.focus();
})();
