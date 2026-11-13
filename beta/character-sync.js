/* Torre Multiversal Beta · guardado en la nube POR PERSONAJE · v3 (12-11-2026)
 *
 * Cambio principal frente a v2: el guardado es AUTOMÁTICO por defecto para
 * los personajes vinculados. Antes venía apagado y, si el jugador no lo
 * activaba en Pausa → Cuenta, la nube se quedaba con una versión vieja y el
 * otro celular cargaba progreso atrasado.
 *
 * Reglas que NO cambian:
 *  - Una ranura por (user_id, profile_id) en tm_character_saves.
 *  - Escritura con CAS de revisión (UPDATE ... WHERE revision = N → N+1).
 *  - Si la nube cambió desde la última versión que vio este celular, NO se
 *    sobrescribe: se avisa y se resuelve en «Comparar versiones».
 *  - Antes de cada actualización se guarda en el celular la versión remota
 *    anterior (tm.char.sync.remote.before.*).
 *  - Los datos TM1 son copias personales verified=false. NUNCA economía.
 *
 * Nuevo:
 *  - Guarda cada minuto de juego, al abrir la pausa, al salir al menú, al
 *    minimizar o cerrar el navegador, antes de cambiar de personaje y al
 *    recuperar la conexión.
 *  - Indicador en pantalla: Guardando / Guardado / Sin conexión / Revisar.
 *  - Los fallos de red ya no apagan el guardado: se reintenta solo.
 *  - Solo el jugador puede pausarlo (preferencia propia «auto.v2»).
 */
(function(){
"use strict";
var cloud=window.__TM_CLOUD_CLIENT__;
var storage=window.__TM_BETA_STORAGE__;
var panel=document.getElementById("tm-char-sync");
if(!cloud||!storage||!panel)return;
var $=function(id){return document.getElementById(id)};

var TICK_MS=60000,          // guardado periódico mientras se juega
    MIN_GAP_MS=10000,       // separación mínima entre guardados no urgentes
    MAX_BYTES=1000000;
var busy=false,active=null,state="none",detail="",lastOkAt=0,lastTryAt=0,
    lastOkRevision=0,retryWanted=false,epoch=0,inflight=null;

/* ---------- claves ---------- */
function key(suffix,uid,pid){return "tm.char.sync."+suffix+"."+uid+"."+encodeURIComponent(pid)}
function selectedSource(uid){return storage.getItem("tm.char.sync.source."+uid)||""}
function autoOn(ctx){return storage.getItem(key("auto.v2",ctx.uid,ctx.pid))!=="0"}
function verifiedWrite(k,value){
 storage.setItem(k,value);
 if(storage.getItem(k)!==value)
   throw Error("El celular no tiene espacio para la copia de seguridad previa. La nube no se modificó.");
}

/* ---------- formato TM1 ---------- */
function checksum(data){
 var str=JSON.stringify(data),value=2166136261;
 for(var i=0;i<str.length;i++){value^=str.charCodeAt(i);value=Math.imul(value,16777619)}
 return value>>>0;
}
function decodeRaw(raw){
 var env=JSON.parse(raw);
 if(!env||env.fmt!=="tm"||!Number.isInteger(env.v)||env.v<0||env.v>99||
   !env.data||!env.data.profile||!env.data.progress||
   !Number.isInteger(env.sum)||checksum(env.data)!==env.sum)
   throw Error("La partida no pasó la comprobación de integridad.");
 var p=env.data.profile,profileId=String(p.id||"");
 if(!profileId||profileId.length>80)throw Error("Falta un identificador válido para el personaje.");
 return {raw:raw,version:env.v,data:env.data,id:profileId,
   name:String(p.name||"Viajero").slice(0,40),
   xp:Number.isFinite(+p.xp)?Math.max(0,Math.floor(+p.xp)):0,
   pets:Array.isArray(env.data.progress.companions)?env.data.progress.companions.length:0};
}
function base64Decode(code){
 if(!code.startsWith("TM1:"))throw Error("No se pudo leer la partida actual.");
 var bin=atob(code.slice(4).replace(/\s+/g,""));
 return new TextDecoder("utf-8",{fatal:true}).decode(Uint8Array.from(bin,function(x){return x.charCodeAt(0)}));
}
function collect(){
 // btn-export hace que el motor registre también la posición actual.
 var button=$("btn-export"),field=$("export-out");
 if(!button||!field)throw Error("El exportador de partidas no está disponible.");
 button.click();
 var parsed=decodeRaw(base64Decode(String(field.value||"")));
 field.value="";
 return parsed;
}
async function sha(data){
 var bytes=new TextEncoder().encode(JSON.stringify(data));
 var digest=await crypto.subtle.digest("SHA-256",bytes);
 return "sha256:"+Array.from(new Uint8Array(digest)).map(function(x){return x.toString(16).padStart(2,"0")}).join("");
}

/* Huella del progreso REAL: ignora lo que cambia solo con el juego abierto
   (reloj del mundo, tiempo jugado, segundos de la expedición). Así un
   celular que solo está encendido no sube versiones ni provoca conflictos. */
async function progressSig(data){
 var copy=JSON.parse(JSON.stringify(data)),p=copy.progress||{};
 delete p.clock;delete p.playSec;
 if(p.expeditions&&p.expeditions.active)delete p.expeditions.active.seconds;
 return sha(copy);
}

/* ---------- estado del juego ---------- */
function blocked(){
 var boot=$("boot"),chooser=$("tm-entry"),creator=$("creator"),coop=$("room-chip"),
     comparing=$("tm-char-conflict-results");
 if(boot&&!boot.hidden)return "boot";
 if(chooser&&!chooser.hidden)return "chooser";
 if(creator&&!creator.hidden)return "creator";
 if(coop&&!coop.hidden)return "coop";
 if(comparing&&!comparing.hidden)return "comparing";
 return "";
}

/* ---------- base: última versión de la nube que este celular conoce ---------- */
function getBase(uid,pid){
 try{
  var raw=storage.getItem(key("base",uid,pid)),obj=raw?JSON.parse(raw):null;
  if(obj&&Number.isInteger(obj.revision)&&obj.revision>=1&&/^sha256:[a-f0-9]{64}$/.test(obj.fingerprint)){
    if(!/^sha256:[a-f0-9]{64}$/.test(obj.sig||""))delete obj.sig;
    return obj;
  }
 }catch(_){}
 return null;
}
function keepBase(uid,pid,revision,fingerprint,raw,sig){
 var obj={revision:Number(revision),fingerprint:fingerprint};
 if(sig)obj.sig=sig;
 verifiedWrite(key("base",uid,pid),JSON.stringify(obj));
 storage.setItem("tm.hub.character.revision."+uid+"."+encodeURIComponent(pid),String(revision));
 // Copia exacta de lo que hay en la nube: sirve de respaldo previo
 // sin tener que descargar la partida completa en cada guardado.
 if(typeof raw==="string"){
   try{storage.setItem(key("sent",uid,pid),raw);storage.setItem(key("sent.fp",uid,pid),fingerprint)}
   catch(_){storage.removeItem(key("sent.fp",uid,pid))}
 }
}
function sameBase(base,remote){
 return !!(base&&remote&&base.revision===Number(remote.revision)&&base.fingerprint===remote.fingerprint);
}

/* ---------- nube ---------- */
async function getUser(){
 var resp=await cloud.auth.getUser();
 if(resp.error)throw resp.error;
 return resp.data&&resp.data.user||null;
}
async function remoteLight(ctx){
 var r=await cloud.from("tm_character_saves").select("profile_id,revision,fingerprint,updated_at")
   .eq("user_id",ctx.uid).eq("profile_id",ctx.pid).maybeSingle();
 if(r.error)throw r.error;
 return r.data;
}
async function remoteFull(ctx){
 var r=await cloud.from("tm_character_saves").select("profile_id,revision,fingerprint,payload,updated_at")
   .eq("user_id",ctx.uid).eq("profile_id",ctx.pid).maybeSingle();
 if(r.error)throw r.error;
 if(!r.data)return null;
 var snap=decodeRaw(r.data.payload&&r.data.payload.raw);
 if(snap.id!==ctx.pid||r.data.profile_id!==ctx.pid)
   throw Error("La ranura de la nube contiene otro personaje. No se tocó.");
 if(!/^sha256:[a-f0-9]{64}$/.test(r.data.fingerprint)||r.data.fingerprint!==await sha(snap.data))
   throw Error("La copia de la nube no pasó su comprobación de integridad. No se tocó.");
 r.data.snapshot=snap;
 return r.data;
}
function isNetwork(error){
 var t=String(error&&(error.message||error)||"");
 return (typeof navigator!=="undefined"&&navigator.onLine===false)||
   /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|ERR_INTERNET|ECONN/i.test(t);
}

/* ---------- indicador en pantalla ---------- */
var chip=null,chipLabel=null,chipTimer=null;
function buildChip(){
 var row=document.querySelector(".hud-top-right"),pauseBtn=$("btn-pause");
 if(!row||!pauseBtn)return;
 if(!document.getElementById("tm-save-chip-style")){
  var css=document.createElement("style");css.id="tm-save-chip-style";
  css.textContent=
  ".tm-save-chip{display:inline-flex;align-items:center;gap:6px;min-width:40px;justify-content:center}"+
  ".tm-save-chip svg{width:16px;height:12px;shape-rendering:crispEdges;flex:none}"+
  ".tm-save-chip .tm-save-dot{width:6px;height:6px;flex:none;background:#8b95a1;box-shadow:0 0 0 1px rgba(0,0,0,.6)}"+
  ".tm-save-chip[data-kind=saved] .tm-save-dot{background:#8fd694}"+
  ".tm-save-chip[data-kind=saving] .tm-save-dot{background:#e9c46a;animation:tmSaveBlink .6s steps(2) infinite}"+
  ".tm-save-chip[data-kind=offline] .tm-save-dot{background:#8b95a1}"+
  ".tm-save-chip[data-kind=attention] .tm-save-dot{background:#ff9a62}"+
  ".tm-save-chip[data-kind=attention]{border-color:#c97a4a}"+
  ".tm-save-chip[data-kind=paused] .tm-save-dot{background:transparent;box-shadow:inset 0 0 0 1px #8b95a1}"+
  ".tm-save-chip .tm-save-label{white-space:nowrap}"+
  ".tm-save-chip[data-compact=\"1\"] .tm-save-label{display:none}"+
  "@keyframes tmSaveBlink{50%{opacity:.25}}"+
  "@media (prefers-reduced-motion:reduce){.tm-save-chip[data-kind=saving] .tm-save-dot{animation:none}}";
  document.head.appendChild(css);
 }
 chip=document.createElement("button");
 chip.id="tm-save-chip";chip.type="button";chip.className="chip tm-save-chip";chip.hidden=true;
 chip.innerHTML='<svg viewBox="0 0 8 6" aria-hidden="true"><path fill="currentColor" d="M2 1h3v1h1v1h1v2H1V4H0V3h1V2h1z"/></svg>'+
   '<i class="tm-save-dot" aria-hidden="true"></i><span class="tm-save-label"></span>';
 chipLabel=chip.querySelector(".tm-save-label");
 row.insertBefore(chip,pauseBtn);
 chip.addEventListener("click",openAccountTab);
}
function openAccountTab(){
 var pause=$("pause");
 if(pause&&pause.hidden&&$("btn-pause"))$("btn-pause").click();
 setTimeout(function(){
  if($("tabbtn-save"))$("tabbtn-save").click();
  var twoVersions=state==="conflict"||state==="newer";
  var target=twoVersions?$("tm-char-conflict"):panel;
  if(target&&target.scrollIntoView)target.scrollIntoView({block:"start"});
  // Comparar solo LEE las dos versiones; el jugador decide después.
  var compare=$("tm-char-conflict-compare");
  if(twoVersions&&compare&&!compare.disabled)compare.click();
 },60);
}
var CHIP={
 // Etiquetas cortas: la fila superior del HUD no tiene espacio en celulares.
 saving:["saving","Guardando"],saved:["saved","Guardado"],offline:["offline","Sin red"],
 conflict:["attention","Revisar"],newer:["attention","Revisar"],error:["attention","Revisar"],
 paused:["paused","Pausado"],coop:["paused","En sala"]
};
function paint(){
 if(!chip)buildChip();
 if(!chip)return;
 var spec=CHIP[state];
 if(!active||!spec){chip.hidden=true;return}
 chip.hidden=false;
 chip.dataset.kind=spec[0];
 chipLabel.textContent=spec[1];
 var aria={saving:"Guardando tu personaje en la nube",
   saved:"Personaje guardado en la nube"+(lastOkAt?" a las "+hhmm(lastOkAt):""),
   offline:"Sin conexión: se guardará en la nube cuando vuelva internet",
   conflict:"Otra versión en la nube: toca para revisarla",
   newer:"Otro celular guardó progreso más nuevo: toca para revisarlo",
   error:"No se pudo guardar en la nube: toca para ver el motivo",
   paused:"Guardado en la nube pausado por ti",coop:"Guardado en la nube en pausa durante la sala"}[state];
 chip.setAttribute("aria-label",aria);chip.title=aria;
 // «Guardado» se muestra unos segundos y luego queda solo el icono.
 clearTimeout(chipTimer);
 chip.dataset.compact="0";
 if(state==="saved"||state==="paused"||state==="coop")
   chipTimer=setTimeout(function(){chip.dataset.compact="1"},2600);
}
function hhmm(ms){return new Date(ms).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}

/* ---------- panel de Pausa → Cuenta ---------- */
function setStatus(msg,isError){
 $("tm-char-sync-status").textContent=String(msg);
 $("tm-char-sync-status").dataset.state=isError?"error":"info";
}
function setState(next,message,isError){
 state=next;detail=message||"";
 if(message)setStatus(message,isError);
 paint();
 updateControls();
}
function updateControls(){
 var on=!!(active&&autoOn(active));
 $("tm-char-sync-on").hidden=on||!active;
 $("tm-char-sync-off").hidden=!on;
 $("tm-char-sync-on").disabled=busy;
 $("tm-char-sync-off").disabled=busy;
 $("tm-char-sync-now").disabled=busy||!active;
 $("tm-char-sync-check").disabled=busy;
}
function renderWho(ctx){
 $("tm-char-sync-name").textContent=ctx?ctx.name+" · se guarda solo en tu cuenta":
  "Elige un personaje de tu cuenta al entrar para guardarlo en la nube.";
}

/* ---------- contexto: cuenta + personaje vinculado activo ---------- */
function contextFor(user,local){
 if(!user||!local||!local.data.profile.character)return null;
 if(selectedSource(user.id)!=="linked:"+local.id)return null;
 return {uid:user.id,pid:local.id,name:local.name};
}
function same(a,b){return !!(a&&b&&a.uid===b.uid&&a.pid===b.pid)}

/* Revisa todo con calma (al entrar, al cambiar de personaje, al volver a la app). */
async function reloadState(){
 var user=await getUser();
 if(!user){active=null;renderWho(null);setState("none","Inicia sesión para guardar tu personaje en la nube.");return}
 var why=blocked();
 if(why==="boot"||why==="chooser"||why==="creator"){
   active=null;renderWho(null);setState("none","Elige o termina tu personaje para empezar a guardarlo.");return;
 }
 var local=collect(),ctx=contextFor(user,local);
 if(!ctx){
   active=null;renderWho(null);
   setState("none",local.data.profile.character?
     "Esta partida no está vinculada a tu cuenta. Vuelve al inicio y elige la tarjeta de tu personaje.":
     "Termina de crear tu personaje para guardarlo en la nube.");
   return;
 }
 if(!same(active,ctx))epoch++;
 active=ctx;renderWho(ctx);
 var remote=await remoteFull(ctx);
 if(!remote){setState("error","Este personaje no tiene guardado en la nube. Vincúlalo desde Opciones avanzadas.",true);return}
 var digest=await sha(local.data),base=getBase(ctx.uid,ctx.pid),
     localSig=await progressSig(local.data),remoteSig=await progressSig(remote.snapshot.data);
 if(digest===remote.fingerprint||(sameBase(base,remote)&&localSig===remoteSig)){
   keepBase(ctx.uid,ctx.pid,remote.revision,remote.fingerprint,remote.snapshot.raw,remoteSig);
   lastOkAt=Date.parse(remote.updated_at)||Date.now();lastOkRevision=Number(remote.revision);
   setState(autoOn(ctx)?"saved":"paused",autoOn(ctx)?
     ctx.name+" está al día en la nube (revisión "+remote.revision+").":
     "Guardado automático pausado. La nube tiene la revisión "+remote.revision+".");
   return;
 }
 if(sameBase(base,remote)){
   keepBase(ctx.uid,ctx.pid,remote.revision,remote.fingerprint,remote.snapshot.raw,remoteSig);
   if(!autoOn(ctx)){setState("paused","Guardado automático pausado. Tienes progreso sin subir a la nube.");return}
   setState("saving","Subiendo el progreso de "+ctx.name+"…");
   setTimeout(function(){request("start")},800);
   return;
 }
 if(base&&(digest===base.fingerprint||(base.sig&&localSig===base.sig))){
   setState("newer","Otro celular guardó progreso más nuevo de "+ctx.name+" (revisión "+remote.revision+
     "). Este celular no se sobrescribió. Toca el aviso o pulsa «Comparar versiones» para cargarlo.",true);
   return;
 }
 setState("conflict","La nube y este celular tienen versiones distintas de "+ctx.name+
   ". No sobrescribí nada. Pulsa «Comparar versiones» para elegir cuál conservar.",true);
}

/* Guardado rápido: solo lee revisión y huella de la nube, no la partida entera. */
async function saveNow(reason){
 var ctx=active;
 if(!ctx)return "sin-personaje";
 if(!autoOn(ctx)&&reason!=="manual"){setState("paused");return "pausado"}
 var why=blocked();
 if(why==="coop"){setState("coop","Guardado en pausa mientras juegas en una sala. Se reanuda al salir.");return why}
 if(why)return why;
 if(state==="conflict"||state==="newer"){
   if(reason!=="manual")return "revisar";
 }
 var myEpoch=epoch;
 lastTryAt=Date.now();
 var user=await getUser();
 if(!user||user.id!==ctx.uid){await reloadState();return "cuenta-cambio"}
 var local=collect();
 if(local.id!==ctx.pid){await reloadState();return "personaje-cambio"}
 if(!local.data.profile.character)return "borrador";
 var size=new TextEncoder().encode(JSON.stringify({raw:local.raw})).length;
 if(size>MAX_BYTES){setState("error","La partida supera 1 MB y no se pudo subir. Sigue a salvo en este celular.",true);return "grande"}
 var digest=await sha(local.data),localSig=await progressSig(local.data);
 var base=getBase(ctx.uid,ctx.pid);
 var nothingNew=!!base&&(digest===base.fingerprint||(base.sig&&localSig===base.sig));
 if(nothingNew&&state==="saved"&&reason!=="manual")return "sin-cambios";
 var remote=await remoteLight(ctx);
 if(!remote){setState("error","Este personaje ya no tiene guardado en la nube. No se subió nada.",true);return "sin-ranura"}
 if(digest===remote.fingerprint||(nothingNew&&sameBase(base,remote))){
   keepBase(ctx.uid,ctx.pid,remote.revision,remote.fingerprint,
     digest===remote.fingerprint?local.raw:null,base&&base.sig||localSig);
   lastOkAt=Date.now();lastOkRevision=Number(remote.revision);retryWanted=false;
   setState("saved",ctx.name+" está al día en la nube · revisión "+remote.revision+" · "+hhmm(lastOkAt));
   return "al-dia";
 }
 if(!sameBase(base,remote)){
   if(nothingNew)
     setState("newer","Otro celular guardó progreso más nuevo de "+ctx.name+" (revisión "+remote.revision+
       "). No sobrescribí nada. Pulsa «Comparar versiones» para cargarlo.",true);
   else
     setState("conflict","Otro celular guardó una versión distinta de "+ctx.name+
       ". No sobrescribí nada. Pulsa «Comparar versiones» para elegir.",true);
   return "conflicto";
 }
 setState("saving");
 // Respaldo local de la versión de la nube que se va a reemplazar.
 var previous=storage.getItem(key("sent.fp",ctx.uid,ctx.pid))===remote.fingerprint?
   storage.getItem(key("sent",ctx.uid,ctx.pid)):null;
 if(!previous){
   var full=await remoteFull(ctx);
   if(!full||!sameBase(base,full)){await reloadState();return "cambio-durante"}
   previous=full.snapshot.raw;
 }
 verifiedWrite(key("remote.before",ctx.uid,ctx.pid),previous);
 var update=await cloud.from("tm_character_saves")
   .update({save_version:local.version,payload:{raw:local.raw},fingerprint:digest,
     revision:Number(remote.revision)+1,verified:false})
   .eq("user_id",ctx.uid).eq("profile_id",ctx.pid).eq("revision",remote.revision)
   .select("revision,profile_id,fingerprint,updated_at").maybeSingle();
 if(update.error)throw update.error;
 if(!update.data){
   setState("conflict","Otro celular guardó justo antes que este. No sobrescribí nada; tu progreso sigue en este celular. "+
     "Pulsa «Comparar versiones».",true);
   return "conflicto";
 }
 if(Number(update.data.revision)!==Number(remote.revision)+1||update.data.profile_id!==ctx.pid||update.data.fingerprint!==digest){
   setState("error","La nube no confirmó la versión nueva. Lo intentaré de nuevo.",true);
   retryWanted=true;return "sin-confirmar";
 }
 // El dato ya está en la nube aunque el jugador haya cambiado de personaje:
 // la base se guarda para ESE personaje, nunca para otro.
 keepBase(ctx.uid,ctx.pid,update.data.revision,digest,local.raw,localSig);
 if(myEpoch!==epoch||!same(active,ctx))return "guardado-otro";
 lastOkAt=Date.now();lastOkRevision=Number(update.data.revision);retryWanted=false;
 setState("saved","Guardado en la nube: "+ctx.name+" · revisión "+update.data.revision+" · "+hhmm(lastOkAt));
 return "guardado";
}

/* Cola simple: una operación a la vez; las urgentes esperan a la actual. */
function request(reason){
 if(inflight){
   if(reason==="hidden"||reason==="switch"||reason==="leave"||reason==="manual")
     return inflight.then(function(){return request(reason)});
   return inflight;
 }
 if(!active)return Promise.resolve("sin-personaje");
 var urgent=reason!=="tick";
 if(!urgent&&Date.now()-lastTryAt<MIN_GAP_MS)return Promise.resolve("espera");
 busy=true;updateControls();
 inflight=saveNow(reason).catch(function(error){
   if(isNetwork(error)){
     retryWanted=true;
     setState("offline","Sin conexión. Tu progreso está a salvo en este celular y se subirá cuando vuelva internet.");
     return "sin-red";
   }
   retryWanted=true;
   setState("error","No se pudo guardar en la nube: "+String(error&&error.message||error).slice(0,160)+
     ". Tu partida sigue en este celular; lo intentaré de nuevo.",true);
   return "error";
 }).finally(function(){busy=false;inflight=null;updateControls()});
 return inflight;
}
function refreshSoon(){
 epoch++;
 var go=function(){
   if(inflight){inflight.then(go);return}
   busy=true;updateControls();
   inflight=reloadState().catch(function(e){
     if(isNetwork(e))setState(active?"offline":"none","Sin conexión. Se comprobará la nube cuando vuelva internet.");
     else setState(active?"error":"none",String(e&&e.message||e).slice(0,180),!!active);
   }).finally(function(){busy=false;inflight=null;updateControls()});
 };
 go();
}

/* ---------- botones del panel ---------- */
$("tm-char-sync-on").addEventListener("click",function(){
 if(!active)return;
 storage.removeItem(key("auto.v2",active.uid,active.pid));
 refreshSoon();
});
$("tm-char-sync-off").addEventListener("click",function(){
 if(!active)return;
 if(!window.confirm("¿Pausar el guardado automático de "+active.name+"?\n\nSi juegas en otro celular, este progreso no estará en la nube hasta que lo reactives."))return;
 verifiedWrite(key("auto.v2",active.uid,active.pid),"0");
 setState("paused","Guardado automático de "+active.name+" pausado. Su última copia en la nube se mantiene.");
});
$("tm-char-sync-now").addEventListener("click",function(){request("manual")});
$("tm-char-sync-check").addEventListener("click",refreshSoon);

/* ---------- API para los demás módulos ---------- */
window.__TM_SYNC_REFRESH__=refreshSoon;
window.__TM_SYNC_NOW__=function(reason){
 // Nunca rechaza: quien llama sigue con su flujo aunque no haya red.
 var work=request(reason||"switch");
 var limit=new Promise(function(resolve){setTimeout(function(){resolve("tiempo")},8000)});
 return Promise.race([work,limit]).catch(function(){return "error"});
};
window.__TM_SYNC_STATE__=function(){
 return {state:state,detail:detail,character:active&&active.name,profile:active&&active.pid,
   lastSavedAt:lastOkAt,revision:lastOkRevision};
};

/* ---------- momentos de guardado ---------- */
document.addEventListener("visibilitychange",function(){
 if(document.visibilityState==="hidden")request("hidden");
 else if(active)refreshSoon(); // al volver: ¿jugó otro celular mientras tanto?
});
window.addEventListener("pagehide",function(){request("hidden")});
window.addEventListener("online",function(){if(active&&(retryWanted||state==="offline"))request("online")});
window.addEventListener("offline",function(){if(active)setState("offline","Sin conexión. Tu progreso está a salvo en este celular.")});
var pauseBtn=$("btn-pause");
if(pauseBtn)pauseBtn.addEventListener("click",function(){setTimeout(function(){request("pause")},300)});
var leaveBtn=$("btn-leave");
if(leaveBtn)leaveBtn.addEventListener("click",function(){setTimeout(function(){request("leave")},300)});
// Al entrar al mundo (Jugar solo / crear o unirse a sala) se revisa el estado.
["btn-solo","btn-create","btn-join"].forEach(function(id){
 var b=$(id);if(b)b.addEventListener("click",function(){setTimeout(refreshSoon,700)});
});
// La sala cooperativa aparece/desaparece: reflejarlo en el indicador.
var room=$("room-chip");
if(room&&window.MutationObserver)new MutationObserver(function(){
 if(!active)return;
 if(!room.hidden)setState("coop","Guardado en pausa mientras juegas en una sala. Se reanuda al salir.");
 else refreshSoon();
}).observe(room,{attributes:true,attributeFilter:["hidden"]});
setInterval(function(){
 if(!active||document.visibilityState==="hidden")return;
 if(retryWanted&&state==="offline"&&navigator.onLine===false)return;
 request("tick");
},TICK_MS);
cloud.auth.onAuthStateChange(function(event){
 if(event==="TOKEN_REFRESHED")return;
 setTimeout(refreshSoon,0);
});
updateControls();
setTimeout(refreshSoon,250);
})();
