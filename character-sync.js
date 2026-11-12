/* Torre Multiversal Beta · sincronización segura POR PERSONAJE (opt-in).
 * Cada perfil usa (user_id,profile_id) en tm_character_saves, revision CAS.
 * Los datos TM1 son copias personales no verificadas: NUNCA economía.
 * No sobrescribir la nube si esta pestaña no vio exactamente su revisión.
 */
(function(){
"use strict";
var cloud=window.__TM_CLOUD_CLIENT__;
var storage=window.__TM_BETA_STORAGE__;
var panel=document.getElementById("tm-char-sync");
if(!cloud||!storage||!panel)return;
var $=function(id){return document.getElementById(id);};
var intervalMs=120000,started=false,busy=false,pausedReason="",active=null;
var lastTick=0,authUser=null,requestEpoch=0;
function key(suffix,uid,pid){return "tm.char.sync."+suffix+"."+uid+"."+encodeURIComponent(pid)}
function selectedSource(uid){
 return storage.getItem("tm.char.sync.source."+uid)||"";
}
function setStatus(msg,error){
 $("tm-char-sync-status").textContent=String(msg);
 $("tm-char-sync-status").dataset.state=error?"error":"info";
}
function updateControls(){
 $("tm-char-sync-on").hidden=started;
 $("tm-char-sync-off").hidden=!started;
 $("tm-char-sync-on").disabled=busy;
 $("tm-char-sync-off").disabled=busy;
 $("tm-char-sync-now").disabled=busy||!started;
 $("tm-char-sync-check").disabled=busy;
}
function fail(message,permanent){
 started=false;
 if(permanent&&active){
   storage.setItem(key("enabled",active.uid,active.pid),"0");
 }
 pausedReason=message||"La sincronización se pausó.";
 updateControls();
 setStatus(pausedReason,true);
}
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
   throw Error("El exportador devolvió una partida inválida.");
 var p=env.data.profile,profileId=String(p.id||"");
 if(!profileId||profileId.length>80)
   throw Error("Falta un identificador válido para el personaje.");
 return {raw:raw,version:env.v,data:env.data,id:profileId,
   name:String(p.name||"Viajero").slice(0,40),
   xp:Number.isFinite(+p.xp)?Math.max(0,Math.floor(+p.xp)):0,
   pets:Array.isArray(env.data.progress.companions)?env.data.progress.companions.length:0};
}
function base64Decode(code){
 if(!code.startsWith("TM1:"))throw Error("No se pudo exportar la partida.");
 var bin=atob(code.slice(4).replace(/\s+/g,""));
 return new TextDecoder("utf-8",{fatal:true}).decode(
   Uint8Array.from(bin,function(x){return x.charCodeAt(0)}));
}
function collect(){
 // btn-export fuerza al motor a registrar la posición actual.
 var button=$("btn-export"),field=$("export-out");
 if(!button||!field)throw Error("El exportador de partidas no está disponible.");
 button.click();
 var parsed=decodeRaw(base64Decode(String(field.value||"")));
 if(!parsed.data.profile.character)
   throw Error("Termina la creación del personaje antes de sincronizar.");
 if(new TextEncoder().encode(JSON.stringify({raw:parsed.raw})).length>1000000)
   throw Error("El guardado supera 1 MB: no se ha enviado.");
 return parsed;
}
async function sha(data){
 var bytes=new TextEncoder().encode(JSON.stringify(data));
 var digest=await crypto.subtle.digest("SHA-256",bytes);
 return "sha256:"+Array.from(new Uint8Array(digest)).map(function(x){
   return x.toString(16).padStart(2,"0");
 }).join("");
}
function checkScene(){
 var chooser=$("tm-entry"),creator=$("creator"),coop=$("room-chip"),hud=$("hud");
 if(chooser&&!chooser.hidden)return "Selecciona un personaje en Vangelium para comenzar.";
 if(creator&&!creator.hidden)return "Termina primero el creador.";
 if(coop&&!coop.hidden)return "El autoguardado está pausado mientras juegas en cooperativo.";
 if(hud&&hud.hidden)return "Entra a jugar antes de sincronizar.";
 return "";
}
function verifiedWrite(k,value){
 storage.setItem(k,value);
 if(storage.getItem(k)!==value)
   throw Error("No queda espacio para crear una copia local de seguridad. La nube no se modificó.");
}
function getBase(uid,pid){
 try{
  var raw=storage.getItem(key("base",uid,pid)),obj=raw?JSON.parse(raw):null;
  if(obj&&Number.isInteger(obj.revision)&&obj.revision>=1&&
     /^sha256:[a-f0-9]{64}$/.test(obj.fingerprint))return obj;
 }catch(_){}
 return null;
}
function keepBase(uid,pid,remote){
 verifiedWrite(key("base",uid,pid),JSON.stringify({
  revision:Number(remote.revision),fingerprint:remote.fingerprint
 }));
}
async function getRemote(uid,pid){
 var result=await cloud.from("tm_character_saves")
  .select("profile_id,revision,fingerprint,payload,updated_at")
  .eq("user_id",uid).eq("profile_id",pid).maybeSingle();
 if(result.error)throw result.error;
 return result.data;
}
async function getUser(){
 var resp=await cloud.auth.getUser();
 if(resp.error)throw resp.error;
 return resp.data&&resp.data.user||null;
}
function currentContext(account,local){
 if(!account||!local)return null;
 if(selectedSource(account.id)!=="linked:"+local.id)return null;
 var uid=account.id,pid=local.id;
 return {uid:uid,pid:pid,name:local.name,
   enabled:storage.getItem(key("enabled",uid,pid))==="1"};
}
function same(a,b){return a&&b&&a.uid===b.uid&&a.pid===b.pid}
function renderWho(ctx){
 $("tm-char-sync-name").textContent=ctx?
  ctx.name+" · Guardado individual de esta cuenta":
  "Elige un personaje vinculado desde el inicio de Vangelium.";
}
async function inspect(allowStart){
 var user=await getUser();
 var exportData=collect();
 var ctx=currentContext(user,exportData);
 if(!ctx)throw Error("Esta partida todavía no está seleccionada como personaje vinculado. Usa Vangelium → Continuar con tu personaje; no se envió nada.");
 var remote=await getRemote(ctx.uid,ctx.pid);
 if(!remote)throw Error("No hay guardado vinculado de este personaje en la cuenta. Usa Vincular primero.");
 var digest=await sha(exportData.data);
 var previous=getBase(ctx.uid,ctx.pid);
 if(remote.profile_id!==ctx.pid)
   throw Error("La ranura remota pertenece a otro personaje. Guardado cancelado.");
 var snapshot=decodeRaw(remote.payload&&remote.payload.raw);
 if(snapshot.id!==ctx.pid)
   throw Error("La ranura remota contiene un perfil diferente; no se puede sincronizar.");
 if(!/^sha256:[a-f0-9]{64}$/.test(remote.fingerprint)||remote.fingerprint!==await sha(snapshot.data))
   throw Error("La copia remota falló su comprobación de integridad. No se tocó.");
 return {ctx:ctx,local:exportData,remote:remote,digest:digest,previous:previous,allowStart:allowStart};
}
async function ensureBaseline(info){
 var b=info.previous,r=info.remote;
 if(b&&b.revision===Number(r.revision)&&b.fingerprint===r.fingerprint)return;
 if(info.digest===r.fingerprint){
   keepBase(info.ctx.uid,info.ctx.pid,r);
   return;
 }
 fail("Conflicto: la nube y este celular tienen versiones diferentes de "+info.local.name+
   ". No sobrescribí nada. Pulsa «Comparar versiones» en Pausa → Cuenta para decidir.",true);
 throw Error("VERSION_CONFLICT");
}
async function performSave(force){
 var ctx=active;
 var reason=checkScene();
 if(reason){if(force)setStatus(reason,true);return}
 if(!ctx||!started)return;
 var localUser=await getUser();
 if(!localUser||localUser.id!==ctx.uid){
   fail("Cambiaste de cuenta. El guardado se pausó para no mezclar personajes.",true);return;
 }
 var info=await inspect(false);
 if(!same(ctx,info.ctx)){
   fail("Cambió el personaje activo. La sincronización anterior fue detenida.",true);return;
 }
 try{await ensureBaseline(info)}catch(e){if(e.message==="VERSION_CONFLICT")return;throw e}
 if(info.digest===info.remote.fingerprint){
   keepBase(ctx.uid,ctx.pid,info.remote);
   if(force)setStatus(info.local.name+" ya estaba al día en la nube.");
   return;
 }
 if(!info.previous||info.previous.revision!==Number(info.remote.revision)||
    info.previous.fingerprint!==info.remote.fingerprint){
   fail("Otro dispositivo actualizó la nube. No se ha sobrescrito.",true);return;
 }
 var epoch=requestEpoch;
 // Retener la versión remota ANTES de cada actualización.
 verifiedWrite(key("remote.before",ctx.uid,ctx.pid),info.remote.payload.raw);
 var update=await cloud.from("tm_character_saves")
   .update({save_version:info.local.version,
      payload:{raw:info.local.raw},fingerprint:info.digest,
      revision:Number(info.remote.revision)+1,verified:false})
   .eq("user_id",ctx.uid).eq("profile_id",ctx.pid)
   .eq("revision",info.remote.revision)
   .select("revision,profile_id,fingerprint,updated_at").maybeSingle();
 if(update.error)throw update.error;
 if(!update.data){
   fail("Un segundo celular guardó antes que este. Pausé la sincronización y conservé el progreso local.",true);
   return;
 }
 if(epoch!==requestEpoch||!same(active,ctx)){
   // Nunca tocar las preferencias de otro personaje si cambió mientras
   // Supabase respondía. El bloqueo CAS ya protegió la revisión remota.
   setStatus("La cuenta o personaje cambió durante el envío. Comprueba la nube antes de continuar.",true);
   return;
 }
 if(Number(update.data.revision)!==Number(info.remote.revision)+1 ||
    update.data.profile_id!==ctx.pid || update.data.fingerprint!==info.digest){
   fail("No se confirmó la versión nueva. Se pausó la sincronización.",true);
   return;
 }
 keepBase(ctx.uid,ctx.pid,update.data);
 storage.setItem("tm.hub.character.revision."+ctx.uid+"."+encodeURIComponent(ctx.pid),String(update.data.revision));
 lastTick=Date.now();
 var when=update.data.updated_at?new Date(update.data.updated_at):new Date();
 setStatus("Guardado en nube: "+ctx.name+" · revisión "+update.data.revision+
   " · "+when.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})+".");
}
async function run(callback){
 if(busy)return;
 busy=true;updateControls();
 try{await callback()}
 catch(e){if(e.message!=="VERSION_CONFLICT"){
   fail("No se pudo sincronizar. Ninguna partida local fue borrada: "+String(e.message||e).slice(0,175),true);
 }}
 finally{busy=false;updateControls()}
}
async function enable(){
 var reason=checkScene();
 if(reason){setStatus(reason,true);return}
 var info=await inspect(true);
 active=info.ctx;renderWho(active);
 if(info.previous && (info.previous.revision!==Number(info.remote.revision)||
      info.previous.fingerprint!==info.remote.fingerprint) &&
      info.digest!==info.remote.fingerprint){
   fail("La nube tiene otra versión de este personaje. Pulsa «Comparar versiones» antes de activar el autoguardado.",true);
   return;
 }
 await ensureBaseline(info);
 if(!window.confirm("Activar el autoguardado de "+info.local.name+
   " cada 2 minutos de juego en solitario?\nLa nube tendrá una ranura para este personaje. Si otro celular cambia el progreso, se pausará automáticamente."))return;
 verifiedWrite(key("enabled",active.uid,active.pid),"1");
 started=true;pausedReason="";
 updateControls();
 setStatus("Autoguardado activado para "+info.local.name+
   ". No afecta a los otros personajes y se detiene ante conflictos.");
}
async function stop(){
 if(!active)return;
 verifiedWrite(key("enabled",active.uid,active.pid),"0");
 started=false;requestEpoch++;
 updateControls();
 setStatus("Autoguardado de "+active.name+" desactivado. Su última copia en la nube permanece.");
}
async function reloadState(){
 var user=await getUser();authUser=user;
 if(!user){
   active=null;started=false;
   renderWho(null);updateControls();setStatus("Inicia sesión para sincronizar un personaje vinculado.");
   return;
 }
 var scene=checkScene();
 // No exportar mientras el juego todavía esté en el selector o creador.
 if(scene&&scene!=="Entra a jugar antes de sincronizar."){
   active=null;started=false;
   renderWho(null);updateControls();setStatus(scene);
   return;
 }
 var local=collect(),ctx=currentContext(user,local);
 if(!ctx){
   active=null;started=false;
   renderWho(null);updateControls();
   setStatus("Este personaje aún no está seleccionado como vinculado. Vuelve al selector y elige su tarjeta.");
   return;
 }
 var changed=!same(active,ctx);
 if(changed){requestEpoch++;active=ctx;}
 renderWho(ctx);
 started=ctx.enabled;
 updateControls();
 if(started){
  var remote=await getRemote(ctx.uid,ctx.pid);
  var base=getBase(ctx.uid,ctx.pid);
  if(!remote||!base||base.revision!==Number(remote.revision)||
     base.fingerprint!==remote.fingerprint){
    fail("La versión de la nube cambió desde el último uso. Sincronización detenida. Revisa tu personaje antes de reactivarla.",true);
    return;
  }
  setStatus("Autoguardado listo para "+ctx.name+". Se sincronizará cada 2 minutos de juego activo.");
 }else setStatus("Autoguardado desactivado para "+ctx.name+". Pulsa Activar si quieres comenzar.");
}
$("tm-char-sync-on").addEventListener("click",function(){run(enable)});
$("tm-char-sync-off").addEventListener("click",function(){run(stop)});
$("tm-char-sync-now").addEventListener("click",function(){run(function(){return performSave(true)})});
$("tm-char-sync-check").addEventListener("click",function(){run(async function(){
 await reloadState();
 // reloadState informa también los conflictos; no ocultar su advertencia.
})});
window.__TM_SYNC_REFRESH__=function(){
 requestEpoch++;
 started=false;
 if(busy){
   setStatus("Terminando una operación anterior antes de cambiar de personaje.");
   setTimeout(function(){reloadState().catch(function(e){setStatus(String(e.message||e),true)})},1200);
   return;
 }
 reloadState().catch(function(e){setStatus(String(e.message||e),true)});
};
cloud.auth.onAuthStateChange(function(){
 requestEpoch++;
 started=false;
 setTimeout(function(){
   reloadState().catch(function(e){setStatus(String(e.message||e),true)});
 },0);
});
setInterval(function(){
 if(!started||busy||!active)return;
 if(document.visibilityState==="hidden")return;
 if(checkScene())return;
 run(function(){return performSave(false)});
},intervalMs);
updateControls();
setTimeout(function(){
 reloadState().catch(function(e){setStatus("Sincronización no disponible: "+String(e.message||e).slice(0,140),true)});
},250);
})();