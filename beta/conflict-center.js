/* Vangelium Beta · resolucion de conflictos de personaje.
   Lee las dos versiones, protege ambas en historial y requiere una decision.
   Nunca determina cual es "mejor" ni acredita dinero, items o propiedad. */
(function(){
"use strict";
var cloud=window.__TM_CLOUD_CLIENT__,store=window.__TM_BETA_STORAGE__;
var root=document.getElementById("tm-char-conflict");
if(!cloud||!store||!root)return;
var $=id=>document.getElementById(id);
var busy=false,choice=null;
function say(message,bad){
 $("tm-char-conflict-status").textContent=String(message);
 $("tm-char-conflict-status").dataset.state=bad?"error":"info";
}
function toggle(){
 for(var id of ["tm-char-conflict-compare","tm-char-conflict-use-cloud",
                "tm-char-conflict-use-local","tm-char-conflict-dismiss"])
  $(id).disabled=busy;
}
function clear(){
 choice=null;
 $("tm-char-conflict-results").hidden=true;
 $("tm-char-conflict-actions").hidden=true;
}
function checksum(data){
 var str=JSON.stringify(data),x=2166136261;
 for(var i=0;i<str.length;i++){x^=str.charCodeAt(i);x=Math.imul(x,16777619)}
 return x>>>0;
}
function decode(raw){
 if(typeof raw!=="string")throw Error("La copia no tiene datos.");
 var env=JSON.parse(raw);
 if(!env||env.fmt!=="tm"||!Number.isInteger(env.v)||env.v<0||env.v>99||
    !env.data||!env.data.profile||!env.data.progress||
    !Number.isInteger(env.sum)||env.sum!==checksum(env.data))
   throw Error("Una copia no superó su verificación de integridad.");
 var profile=env.data.profile,id=String(profile.id||"");
 if(!id||id.length>80)throw Error("El personaje no tiene identificador válido.");
 return {raw:raw,id:id,version:env.v,data:env.data,
   name:String(profile.name||"Viajero").slice(0,40),
   xp:Number.isFinite(+profile.xp)?Math.max(0,Math.floor(+profile.xp)):0,
   pets:Array.isArray(env.data.progress.companions)?env.data.progress.companions.length:0};
}
function fromCode(code){
 if(!code.startsWith("TM1:"))throw Error("El juego no produjo un código exportable.");
 var bin=atob(code.slice(4).replace(/\s+/g,""));
 return new TextDecoder("utf-8",{fatal:true}).decode(
  Uint8Array.from(bin,c=>c.charCodeAt(0)));
}
function toCode(raw){
 var bin="",bytes=new TextEncoder().encode(raw);
 for(var i=0;i<bytes.length;i+=8192)
  bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
 return "TM1:"+btoa(bin);
}
function collect(){
 $("btn-export").click();
 var snap=decode(fromCode(String($("export-out").value||"")));
 if(!snap.data.profile.character)throw Error("Primero termina la creación.");
 if(new TextEncoder().encode(JSON.stringify({raw:snap.raw})).length>1000000)
  throw Error("La copia es mayor que 1 MB. No se modificó.");
 return snap;
}
async function sha(data){
 var digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(data)));
 return "sha256:"+Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
}
function verified(key,value){
 store.setItem(key,value);
 if(store.getItem(key)!==value)
  throw Error("No se pudo crear la copia de seguridad local; se canceló el cambio.");
}
function scene(){
 if($("tm-entry")&&!$("tm-entry").hidden)throw Error("Entra con tu personaje antes de comparar.");
 if($("creator")&&!$("creator").hidden)throw Error("Termina el creador antes de comparar.");
 if($("room-chip")&&!$("room-chip").hidden)throw Error("Sal del cooperativo antes de resolver una partida.");
 if($("pause")&&$("pause").hidden)throw Error("Abre Pausa → Cuenta para resolver el conflicto.");
}
async function state(){
 scene();
 var a=await cloud.auth.getUser();
 if(a.error||!a.data.user)throw Error("La sesión caducó. Vuelve a entrar.");
 var uid=a.data.user.id,local=collect();
 if(store.getItem("tm.char.sync.source."+uid)!=="linked:"+local.id)
  throw Error("Este personaje no está seleccionado como vinculado. Abre Vangelium y elige su tarjeta.");
 var res=await cloud.from("tm_character_saves")
  .select("profile_id,revision,fingerprint,payload,updated_at")
  .eq("user_id",uid).eq("profile_id",local.id).maybeSingle();
 if(res.error)throw res.error;
 var row=res.data;
 if(!row||row.profile_id!==local.id)throw Error("No hay guardado vinculado para este personaje.");
 var remote=decode(row.payload&&row.payload.raw);
 if(remote.id!==local.id)throw Error("La nube contiene otro personaje: operación cancelada.");
 var digest=await sha(local.data),serverDigest=await sha(remote.data);
 if(!/^sha256:[0-9a-f]{64}$/.test(row.fingerprint)||serverDigest!==row.fingerprint)
  throw Error("La copia de Supabase no supera la comprobación de integridad.");
 return {uid:uid,pid:local.id,local:local,remote:remote,localHash:digest,
   remoteHash:row.fingerprint,revision:Number(row.revision),updatedAt:row.updated_at};
}
function summary(s,source,when){
 var text=s.name+" · "+s.xp.toLocaleString("es-CL")+" XP · "+s.pets+" mascotas";
 return text+"\n"+source+(when?" · "+when:"");
}
function render(s){
 choice=s.localHash!==s.remoteHash?{
   uid:s.uid,pid:s.pid,rev:s.revision,lh:s.localHash,rh:s.remoteHash
 }:null;
 $("tm-char-conflict-local").textContent=summary(s.local,"En este celular");
 var dt=new Date(s.updatedAt),date=Number.isNaN(dt.getTime())?"Fecha desconocida":
  dt.toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"});
 $("tm-char-conflict-cloud").textContent=summary(s.remote,"En Supabase",date+" · revisión "+s.revision);
 $("tm-char-conflict-results").hidden=false;
 $("tm-char-conflict-actions").hidden=!choice;
 if(choice){
   // Mientras se compara, character-sync no sube nada (ve los resultados abiertos)
   // y nunca sobrescribe una revisión que este celular no haya visto.
 }
 say(choice?"Hay dos versiones distintas. Ambas se respaldarán antes de cambiar cualquiera. No se mezclan objetos, XP ni mascotas.":
  "Las versiones contienen los mismos datos. No hace falta sustituir nada.",false);
}
async function refresh(){
 var s=await state();
 render(s);
}
async function unchanged(){
 if(!choice)throw Error("Primero pulsa Comparar versiones.");
 var info=await state();
 if(info.uid!==choice.uid||info.pid!==choice.pid||info.revision!==choice.rev||
    info.remoteHash!==choice.rh||info.localHash!==choice.lh){
   clear();
   throw Error("Alguna versión cambió durante la comparación. No se modificó nada. Pulsa Comparar otra vez.");
 }
 return info;
}
async function backupBoth(s){
 var stamp=Date.now(),tag=s.uid+"."+encodeURIComponent(s.pid)+"."+stamp;
 verified("tm.char.conflict.local."+tag+"."+s.localHash.slice(7,19),s.local.raw);
 verified("tm.char.conflict.remote."+tag+"."+s.remoteHash.slice(7,19),s.remote.raw);
 for(var snap of [s.remote,s.local]){
   var fp=await sha(snap.data);
   var found=await cloud.from("tm_legacy_backups").select("id")
     .eq("user_id",s.uid).eq("import_key",fp).maybeSingle();
   if(found.error)throw found.error;
   if(found.data)continue;
   var dataSize=new TextEncoder().encode(JSON.stringify({raw:snap.raw})).length;
   if(dataSize>1000000)throw Error("Copia demasiado grande. No se modificó.");
   var saved=await cloud.from("tm_legacy_backups").insert({
     user_id:s.uid,import_key:fp,save_format:"tm",save_version:snap.version,
     payload:{raw:snap.raw},origin:"github_pages",verified:false
   });
   if(saved.error&&saved.error.code!=="23505")
     throw Error("No se pudieron guardar las dos versiones en el historial (límite de copias o red). Ninguna partida fue sustituida.");
 }
}
async function recheck(s){
 var fresh=await state();
 if(fresh.uid!==s.uid||fresh.pid!==s.pid||fresh.revision!==s.revision||
    fresh.remoteHash!==s.remoteHash||fresh.localHash!==s.localHash){
   clear();
   throw Error("Otro dispositivo actualizó la partida durante el respaldo. Nada se sobrescribió. Vuelve a comparar.");
 }
 return fresh;
}
function settle(s,rev,hash){
 verified("tm.char.sync.base."+s.uid+"."+encodeURIComponent(s.pid),
   JSON.stringify({revision:Number(rev),fingerprint:hash}));
 store.setItem("tm.hub.character.revision."+s.uid+"."+encodeURIComponent(s.pid),String(rev));
 clear();
 if(typeof window.__TM_SYNC_REFRESH__==="function")window.__TM_SYNC_REFRESH__();
}
async function useCloud(){
 var s=await unchanged();
 if(!window.confirm("RECUPERAR LA NUBE EN ESTE CELULAR\n\n"+
   summary(s.remote,"Supabase")+"\n\nSe reemplazará la partida activa del celular. Primero guardaremos AMBAS copias en el historial. ¿Continuar?"))return;
 await backupBoth(s);
 await recheck(s);
 // Cerrar la sesión de juego ANTES de cargar. Si se carga con la sesión abierta,
 // el personaje sigue en su posición antigua y el siguiente guardado la vuelve
 // a escribir encima de la versión recuperada (error detectado en pruebas).
 var pause=$("pause"),leave=$("btn-leave"),menu=$("menu");
 if(pause&&!pause.hidden){
   if(!leave)throw Error("No se pudo cerrar la partida en curso. No se cambió nada.");
   leave.click();
   if(!pause.hidden)throw Error("El juego no confirmó la salida. No se cambió nada; ambas versiones están respaldadas.");
 }
 var input=$("import-in"),notice=$("save-status"),button=$("btn-import");
 input.value=toCode(s.remote.raw);
 notice.textContent="";
 try{button.click()}finally{input.value=""}
 if(String(notice.textContent||"").trim()!=="Partida cargada.")
   throw Error("El motor no confirmó la restauración. El progreso anterior está respaldado.");
 settle(s,s.revision,s.remoteHash);
 // Volver a entrar con una sesión NUEVA creada desde la partida recuperada.
 if(menu&&!menu.hidden&&$("btn-solo"))$("btn-solo").click();
 if($("tm-hub-local"))$("tm-hub-local").textContent=summary(s.remote,"Partida recuperada");
 say("Recuperaste la versión de la nube. Ambas versiones quedaron en el historial y el guardado automático sigue activo.",false);
}
async function useLocal(){
 var s=await unchanged();
 if(!window.confirm("CONSERVAR ESTE CELULAR COMO PRINCIPAL\n\n"+
   summary(s.local,"Celular")+
   "\n\nActualizarás la ranura principal de Supabase. Primero se archivarán las dos versiones. ¿Continuar?"))return;
 if(!window.confirm("Confirma nuevamente: ¿sustituir la copia ACTIVA de Supabase por la de ESTE CELULAR? La anterior quedará guardada en el historial."))return;
 await backupBoth(s);
 await recheck(s);
 var saved=await cloud.from("tm_character_saves").update({
   save_version:s.local.version,payload:{raw:s.local.raw},fingerprint:s.localHash,
   revision:s.revision+1,verified:false
 }).eq("user_id",s.uid).eq("profile_id",s.pid).eq("revision",s.revision)
   .select("revision,profile_id,fingerprint,updated_at").maybeSingle();
 if(saved.error)throw saved.error;
 if(!saved.data){
   clear();
   throw Error("El otro celular guardó antes. Supabase bloqueó la sobrescritura; compara de nuevo.");
 }
 if(Number(saved.data.revision)!==s.revision+1||
    saved.data.profile_id!==s.pid||saved.data.fingerprint!==s.localHash){
   clear();
   throw Error("La actualización no pudo verificarse. Comprueba el guardado remoto.");
 }
 settle(s,saved.data.revision,s.localHash);
 say("Esta versión del celular quedó activa en Supabase, revisión "+saved.data.revision+
   ". Ambas versiones quedaron respaldadas y el guardado automático sigue activo.",false);
}
async function run(task){
 if(busy)return;
 busy=true;toggle();
 try{await task()}catch(e){
  say(String(e.message||e).slice(0,260),true);
 }finally{busy=false;toggle()}
}
$("tm-char-conflict-compare").addEventListener("click",()=>run(refresh));
$("tm-char-conflict-use-cloud").addEventListener("click",()=>run(useCloud));
$("tm-char-conflict-use-local").addEventListener("click",()=>run(useLocal));
$("tm-char-conflict-dismiss").addEventListener("click",()=>{
 clear();say("Comparación cerrada. Ninguna partida se modificó.",false);
});
cloud.auth.onAuthStateChange(()=>{
 clear();say("Pulsa Comparar versiones para revisar el personaje de esta cuenta.",false);
});
window.__TM_CONFLICT_RESET__=()=>{
 clear();say("Personaje cambiado. Pulsa Comparar para revisar su progreso.",false);
};
toggle();
})();