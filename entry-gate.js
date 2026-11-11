/* Vangelium: acceso anterior al menu del juego (solo beta).
 * El acceso no escribe partidas sin un clic explicito del jugador.
 * Los respaldos TM1 son datos personales NO verificados, sin valor economico.
 */
(function(){
"use strict";
var cloud=window.__TM_CLOUD_CLIENT__;
var wrap=document.getElementById("tm-entry");
var storage=window.__TM_BETA_STORAGE__;
if(!wrap||!cloud||!storage)return;
var $=function(id){return document.getElementById(id)};
var user=null,rows=[],busy=false,localRecords=[],recovery=false;
function notice(message,isError){
  $("tm-entry-status").textContent=message;
  $("tm-entry-status").dataset.state=isError?"error":"info";
}
function view(name){
  for(var x of ["loading","login","characters","reset"]){
    $("tm-entry-"+x).hidden=x!==name;
  }
}
function controls(state){
  busy=state;
  wrap.querySelectorAll("button").forEach(function(b){b.disabled=state});
}
async function run(fn){
  if(busy)return;
  controls(true);
  try{await fn()}catch(error){notice(messageOf(error),true)}
  finally{controls(false)}
}
function messageOf(error){
 var t=String(error&&error.message||error||"Ocurrió un error.");
 if(/invalid login credentials|invalid credentials|invalid_grant/i.test(t))
   return "Correo o contraseña incorrectos. Utiliza «Recuperar contraseña» si ya tenías cuenta.";
 if(/already registered|already been registered/i.test(t))
   return "Ese correo ya está registrado. Utiliza «Entrar», no «Crear cuenta».";
 if(/email not confirmed/i.test(t))
   return "Primero confirma tu correo con el enlace que recibiste.";
 if(/rate.?limit|429/i.test(t))return "Demasiados intentos. Inténtalo más tarde.";
 return t.slice(0,210);
}
function checksum(data){
 var s=JSON.stringify(data),hash=2166136261;
 for(var i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return hash>>>0;
}
function decode(raw){
 if(typeof raw!=="string")throw Error("El respaldo no contiene datos.");
 var env=JSON.parse(raw);
 if(!env||env.fmt!=="tm"||!Number.isInteger(env.v)||env.v<0||env.v>99||
    !env.data||!env.data.profile||!env.data.progress||
    !Number.isInteger(env.sum)||env.sum!==checksum(env.data))
   throw Error("Respaldo inválido o dañado.");
 var p=env.data.profile,id=String(p.id||"");
 if(!id||id.length>80)throw Error("El respaldo no tiene un ID de personaje válido.");
 return {raw:raw,data:env.data,id:id,name:String(p.name||"Viajero").slice(0,40),
   xp:Number.isFinite(+p.xp)?Math.max(0,Math.floor(+p.xp)):0,
   pets:Array.isArray(env.data.progress.companions)?env.data.progress.companions.length:0,
   version:env.v};
}
function node(tag,className,label){
 var n=document.createElement(tag);
 if(className)n.className=className;
 if(label!==undefined)n.textContent=String(label);
 return n;
}
function rawLocal(){
 try{var raw=storage.getItem("tm.save");return raw?decode(raw):null}
 catch(e){return null}
}
function toCode(raw){
 var binary="",encoded=new TextEncoder().encode(raw);
 for(var i=0;i<encoded.length;i+=8192)binary+=String.fromCharCode.apply(null,encoded.subarray(i,i+8192));
 return "TM1:"+btoa(binary);
}
function prettyTime(s){
 var dt=new Date(s);
 return Number.isNaN(dt.getTime())?"Fecha desconocida":dt.toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"});
}
function ranking(kind){return kind==="linked"?3:kind==="automatic"?2:1}
async function loadCharacters(){
 if(!user)throw Error("Debes iniciar sesión.");
 var uid=user.id;
 var out=await Promise.all([
  cloud.from("tm_character_saves").select("profile_id,revision,payload,updated_at")
   .eq("user_id",uid).order("updated_at",{ascending:false}).limit(50),
  cloud.from("tm_legacy_backups").select("id,payload,created_at")
   .order("created_at",{ascending:false}).limit(20),
  cloud.from("tm_cloud_saves").select("profile_id,revision,payload,updated_at")
   .eq("user_id",uid).maybeSingle()
 ]);
 for(var v of out)if(v.error)throw v.error;
 if(!user||user.id!==uid)return;
 rows=[];
 for(var item of out[0].data||[]){
   try{
    var p=decode(item.payload&&item.payload.raw);
    if(p.id===item.profile_id)rows.push(Object.assign({},p,{source:"linked",sourceId:p.id,
      revision:item.revision,stamp:item.updated_at,time:Date.parse(item.updated_at)||0,owner:uid}));
   }catch(e){}
 }
 for(var copy of out[1].data||[]){
   try{
    var p=decode(copy.payload&&copy.payload.raw);
    rows.push(Object.assign({},p,{source:"historical",sourceId:copy.id,
      stamp:copy.created_at,time:Date.parse(copy.created_at)||0,owner:uid}));
   }catch(e){}
 }
 if(out[2].data){
   try{
    var s=out[2].data,p=decode(s.payload&&s.payload.raw);
    if(p.id===s.profile_id)rows.push(Object.assign({},p,{source:"automatic",sourceId:uid,
      revision:s.revision,stamp:s.updated_at,time:Date.parse(s.updated_at)||0,owner:uid}));
   }catch(e){}
 }
 rows.sort(function(a,b){return ranking(b.source)-ranking(a.source)||b.time-a.time});
 render();
}
function cardButton(label,callback,secondary){
 var b=node("button",secondary?"tm-entry-minor":"tm-entry-mainbtn",label);
 b.type="button";
 b.addEventListener("click",function(){run(callback)});
 return b;
}
function render(){
 var container=$("tm-entry-list");
 container.replaceChildren();
 $("tm-entry-account").textContent=user&&user.email||"";
 var groups=new Map();
 for(var item of rows){
   if(!groups.has(item.id))groups.set(item.id,[]);
   groups.get(item.id).push(item);
 }
 $("tm-entry-count").textContent=groups.size===1?"1 personaje disponible":groups.size+" personajes disponibles";
 for(var versions of groups.values()){
   var choice=versions[0],card=node("article","tm-entry-character");
   var top=node("div","tm-entry-charhead"),portrait=node("div","tm-entry-avatar",choice.name.slice(0,1).toUpperCase());
   portrait.setAttribute("aria-hidden","true");
   top.appendChild(portrait);
   var meta=node("div","tm-entry-charmeta");
   meta.appendChild(node("strong","",choice.name));
   meta.appendChild(node("span","",choice.xp.toLocaleString("es-CL")+" XP · "+choice.pets+" mascotas"));
   top.appendChild(meta);card.appendChild(top);
   var tag=choice.source==="linked"?"Personaje vinculado":
     choice.source==="automatic"?"Ranura de autoguardado":"Respaldo recuperable";
   card.appendChild(node("p","tm-entry-tag",tag+" · "+prettyTime(choice.stamp)));
   card.appendChild(cardButton("Continuar con "+choice.name,function(){return openRemote(choice)}));
   if(versions.length>1){
     var details=node("details","tm-entry-history");
     details.appendChild(node("summary","",versions.length-1+" versiones anteriores"));
     versions.slice(1).forEach(function(older){
       details.appendChild(cardButton(
          prettyTime(older.stamp)+" · "+older.xp+" XP · "+older.pets+" mascotas",
          function(){return openRemote(older)},true));
     });
     card.appendChild(details);
   }
   container.appendChild(card);
 }
 $("tm-entry-empty").hidden=groups.size!==0;
 showLocal();
}
function availableLocal(){
 var result=[],seen=new Set(),lookups=[
  ["Partida de esta beta",storage,"tm.save"],
  ["Copia de seguridad de esta beta",storage,"tm.save.bak"]
 ];
 if(user){
   lookups.push(["Antes de cambiar personaje",storage,"tm.hub.previous."+user.id]);
   lookups.push(["Antes de entrar desde Vangelium",storage,"tm.gateway.previous."+user.id]);
   lookups.push(["Antes de restaurar desde nube",storage,"tm.cloud.pre_restore"]);
   lookups.push(["Antes de restaurar ranura",storage,"tm.cloud.slot.pre_restore"]);
 }
 if(window.localStorage){
   lookups.push(["Partida del juego oficial (solo lectura)",window.localStorage,"tm.save"]);
   lookups.push(["Respaldo del juego oficial (solo lectura)",window.localStorage,"tm.save.bak"]);
 }
 for(var lookup of lookups){
   try{
     var raw=lookup[1].getItem(lookup[2]);if(!raw||seen.has(raw))continue;
     var parsed=decode(raw);seen.add(raw);
     result.push(Object.assign({},parsed,{sourceLabel:lookup[0]}));
   }catch(e){}
 }
 return result;
}
function showLocal(){
 var list=$("tm-entry-local-list");list.replaceChildren();
 localRecords=availableLocal();
 if(!localRecords.length){
   list.appendChild(node("p","tm-entry-help","No se encontraron partidas en este navegador. Prueba en el celular donde jugaste antes."));
   return;
 }
 for(var item of localRecords){
   var card=node("div","tm-entry-local-card");
   card.appendChild(node("strong","",item.name+" · "+item.xp+" XP · "+item.pets+" mascotas"));
   card.appendChild(node("small","",item.sourceLabel));
   card.appendChild(cardButton("Jugar con "+item.name,function(){return openLocal(item)},true));
   if(user)card.appendChild(cardButton("Vincular "+item.name+" a este correo",
     function(){return attachLocal(item)},true));
   list.appendChild(card);
 }
}
async function ensureEngine(){
 var boot=$("boot");
 // No ejecutar comandos del motor hasta que termine su arranque.
 for(var k=0;k<150;k++){
   if(boot&&boot.hidden)return;
   if(boot&&boot.classList.contains("is-error"))
     throw Error("El motor informó un error. Comprueba la conexión y recarga la beta.");
   await new Promise(function(resolve){setTimeout(resolve,200)});
 }
 throw Error("El juego aún está cargando. Revisa la conexión e inténtalo otra vez.");
}
async function confirmUser(){
 if(!user)throw Error("Inicia sesión primero.");
 var r=await cloud.auth.getUser();
 if(r.error||!r.data.user||r.data.user.id!==user.id)
   throw Error("La sesión de cuenta cambió. Vuelve a entrar.");
}
async function newest(record){
 await confirmUser();
 var result;
 if(record.source==="linked"){
   result=await cloud.from("tm_character_saves").select("revision,payload,profile_id")
     .eq("user_id",user.id).eq("profile_id",record.id).maybeSingle();
   if(result.error)throw result.error;
   if(!result.data||Number(result.data.revision)!==Number(record.revision))
     throw Error("Este personaje cambió en otro dispositivo. Pulsa Actualizar y vuelve a elegir.");
 }else if(record.source==="automatic"){
   result=await cloud.from("tm_cloud_saves").select("revision,payload,profile_id")
     .eq("user_id",user.id).maybeSingle();
   if(result.error)throw result.error;
   if(!result.data||Number(result.data.revision)!==Number(record.revision))
     throw Error("La ranura se actualizó en otro dispositivo. Pulsa Actualizar.");
 }else{
   result=await cloud.from("tm_legacy_backups").select("payload").eq("id",record.sourceId).single();
   if(result.error)throw result.error;
 }
 var data=decode(result.data&&result.data.payload&&result.data.payload.raw);
 if(data.id!==record.id)throw Error("El contenido de esta partida cambió. Actualiza la lista.");
 return data;
}
function rememberChoice(record){
 if(!user)return;
 storage.setItem("tm.gateway.selected."+user.id,record.id);
 var key="tm.hub.character.revision."+user.id+"."+encodeURIComponent(record.id);
 if(record.source==="linked")
   storage.setItem(key,String(record.revision));
 else if(storage.removeItem)storage.removeItem(key);
}
async function useSnapshot(snapshot,source){
 await ensureEngine();
 var old=rawLocal();
 if(!old||old.raw!==snapshot.raw){
   if(old){
     var pre="tm.gateway.previous."+(user?user.id:"local");
     storage.setItem(pre,old.raw);
     if(user)storage.setItem("tm.hub.previous."+user.id,old.raw);
     if(storage.getItem(pre)!==old.raw)
       throw Error("No pude proteger la partida anterior. Se canceló el cambio.");
   }
   var code=toCode(snapshot.raw);
   $("import-in").value=code;
   $("save-status").textContent="";
   $("btn-import").click();
   var result=String($("save-status").textContent||"").trim();
   $("import-in").value="";
   if(result!=="Partida cargada.")
     throw Error("El motor no confirmó la restauración: "+(result||"sin respuesta."));
 }
 if(source)rememberChoice(source);
 wrap.hidden=true;
 // Importar sin aspecto puede abrir el creador. Nunca saltarse esa pantalla.
 var creator=$("creator");
 if(creator&&!creator.hidden)return;
 if(snapshot.data.profile.character){
   $("btn-solo").click();
 }else{
   $("btn-character").click();
 }
}
async function openRemote(record){
 if(!user||user.id!==record.owner)throw Error("Esta partida no corresponde a la cuenta conectada.");
 var snapshot=await newest(record),old=rawLocal();
 var text="Cargar "+snapshot.name+" ("+snapshot.xp+" XP, "+snapshot.pets+" mascotas)"+
   "\nCuenta: "+(user.email||"")+
   "\nOrigen: "+(record.source==="linked"?"Personaje vinculado":"Copia recuperable")+
   "\nPartida local que será sustituida: "+(old?old.name+" ("+old.xp+" XP)":"ninguna")+
   "\n\nSe guardará antes una copia local. ¿Continuar?";
 if(old&&old.raw===snapshot.raw)text="Continuar con "+snapshot.name+" en este dispositivo.";
 if(!window.confirm(text))return;
 await useSnapshot(snapshot,record);
}
async function openLocal(record){
 var raw=availableLocal().find(function(x){return x.raw===record.raw});
 if(!raw)throw Error("Esta copia ya no está disponible. Pulsa Buscar en este celular.");
 if(!window.confirm("Abrir "+raw.name+" ("+raw.xp+" XP)?"+
   "\nEsta copia es local, no está necesariamente vinculada al correo."+
   "\nEl progreso anterior de la beta se conservará antes de cambiarlo."))return;
 await useSnapshot(raw,null);
}
async function fingerprint(data){
 var bytes=new TextEncoder().encode(JSON.stringify(data));
 var hash=await crypto.subtle.digest("SHA-256",bytes);
 return "sha256:"+Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,"0")}).join("");
}
async function attachLocal(record){
 await confirmUser();
 var fresh=availableLocal().find(function(x){return x.raw===record.raw});
 if(!fresh)throw Error("La copia local cambió. Pulsa Buscar en este celular.");
 if(!window.confirm("Vincular "+fresh.name+" ("+fresh.xp+" XP) a "+(user.email||"")+
   "?\n\nNo se borrarán otros personajes. Esto guarda una copia personal, sin verificar objetos o monedas."))return;
 var existing=await cloud.from("tm_character_saves").select("profile_id,revision,fingerprint")
    .eq("user_id",user.id).eq("profile_id",fresh.id).maybeSingle();
 if(existing.error)throw existing.error;
 var digest=await fingerprint(fresh.data);
 if(existing.data){
   if(existing.data.fingerprint!==digest)
     throw Error("Este personaje ya tiene otro progreso en la nube. Cárgalo o entra a Cuenta para crear una copia histórica. No se sobrescribió.");
 }else{
   var bytes=new TextEncoder().encode(JSON.stringify({raw:fresh.raw}));
   if(bytes.length>1000000)throw Error("Esta partida supera el límite beta de 1 MB.");
   var inserted=await cloud.from("tm_character_saves").insert({
    user_id:user.id,profile_id:fresh.id,save_version:fresh.version,
    payload:{raw:fresh.raw},fingerprint:digest,revision:1,verified:false
   }).select("profile_id,revision").single();
   if(inserted.error)throw inserted.error;
 }
 await loadCharacters();
 notice("Personaje vinculado. Ya puedes elegir "+fresh.name+" desde esta cuenta.");
}
async function authReady(){
 var session=await cloud.auth.getSession();
 if(session.error)throw session.error;
 if(!session.data.session){
   user=null;view("login");
   notice("Entra con tu correo para recuperar tus personajes.");
   return;
 }
 var res=await cloud.auth.getUser();
 if(res.error)throw res.error;
 user=res.data.user;
 if(!user){view("login");return}
 $("tm-entry-user").textContent=user.email||"Cuenta conectada";
 view("characters");
 await loadCharacters();
 notice("Elige un personaje para continuar. Las partidas locales permanecen protegidas.");
}
async function signIn(register){
 await run(async function(){
   var email=$("tm-entry-email").value.trim(),password=$("tm-entry-password").value;
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||password.length<8)
     throw Error("Escribe un correo válido y una contraseña de al menos 8 caracteres.");
   var result=register?
     await cloud.auth.signUp({email:email,password:password,
       options:{emailRedirectTo:location.origin+location.pathname}}):
     await cloud.auth.signInWithPassword({email:email,password:password});
   if(result.error)throw result.error;
   $("tm-entry-password").value="";
   if(result.data&&result.data.session){
     await authReady();
   }else notice("Revisa tu correo y confirma la cuenta. Después pulsa Entrar.");
 });
}
async function forgot(){
 await run(async function(){
   var email=$("tm-entry-email").value.trim();
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
     throw Error("Escribe tu correo registrado primero.");
   var result=await cloud.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
   if(result.error)throw result.error;
   notice("Si existe una cuenta con ese correo, recibirás un enlace de recuperación.");
 });
}
async function reset(){
 await run(async function(){
   var password=$("tm-entry-new-password").value;
   if(password.length<8)throw Error("La contraseña debe tener al menos 8 caracteres.");
   var result=await cloud.auth.updateUser({password:password});
   if(result.error)throw result.error;
   recovery=false;$("tm-entry-new-password").value="";
   await authReady();notice("Contraseña actualizada. Ya puedes continuar.");
 });
}
async function signOut(){
 await run(async function(){
   var result=await cloud.auth.signOut();
   if(result.error)throw result.error;
   user=null;rows=[];view("login");
   notice("Cuenta desconectada. La partida local no se borró.");
 });
}
async function refresh(){
 await run(async function(){
   await authReady();
   notice("Personajes actualizados. No cambió ninguna partida local.");
 });
}
$("tm-entry-login-btn").addEventListener("click",function(){signIn(false)});
$("tm-entry-register-btn").addEventListener("click",function(){signIn(true)});
$("tm-entry-forgot-btn").addEventListener("click",forgot);
$("tm-entry-reset-btn").addEventListener("click",reset);
$("tm-entry-logout-btn").addEventListener("click",signOut);
$("tm-entry-refresh-btn").addEventListener("click",refresh);
$("tm-entry-scan-btn").addEventListener("click",function(){run(async function(){
  showLocal();$("tm-entry-local").open=true;
  notice("Copias locales revisadas. Las partidas originales no se modificaron.");
})});
$("tm-entry-guest-btn").addEventListener("click",function(){run(async function(){
 await ensureEngine();
 if(!window.confirm("Continuar sin cuenta? El progreso se guardará SOLO en este celular de prueba."))
   return;
 wrap.hidden=true;
 $("btn-solo").click();
})});
$("tm-entry-new-btn").addEventListener("click",function(){run(async function(){
 await ensureEngine();
 var current=rawLocal();
 if(current&&current.data.profile.character){
   throw Error("Para crear un segundo personaje sin sobrescribir tu partida, primero debemos habilitar la creación independiente. Conserva este personaje y usa Vincular.");
 }
 if(!window.confirm("Abrir creador de personajes? La partida local actual quedará como punto de partida."))return;
 wrap.hidden=true;$("btn-character").click();
})});
cloud.auth.onAuthStateChange(function(event){
 if(event==="PASSWORD_RECOVERY"){
   recovery=true;view("reset");
   notice("Escribe una nueva contraseña para recuperar tu cuenta.");
   return;
 }
 setTimeout(function(){
   if(!recovery&&!wrap.hidden)authReady().catch(function(e){notice(messageOf(e),true)});
 },0);
});
authReady().catch(function(error){
 view("login");notice(messageOf(error),true);
});
})();