/* Torre Multiversal · Centro de cuenta beta (v1).
   La identidad es auth.user.id; un personaje es una partida. Nunca suponer
   que iniciar sesion significa importar automáticamente un personaje.
   Los historiales TM1 no confieren objetos ni moneda oficial.
*/
(function(){
"use strict";
var client=window.__TM_CLOUD_CLIENT__;
var root=document.getElementById("tm-hub");
var storage=window.__TM_BETA_STORAGE__||window.localStorage;
if(!client||!root||!storage)return;
var $=function(id){return document.getElementById(id)};
var account=null, busy=false, records=[], groups=[], recovery=false;
var rawSnapshots=new Map();
var previousAccountId=null;

function status(s,error){
  $("tm-hub-status").textContent=s;
  $("tm-hub-status").dataset.kind=error?"error":"info";
}
function setBusy(flag){
  busy=flag;
  root.querySelectorAll("button").forEach(function(b){b.disabled=flag});
}
async function run(f){
  if(busy)return;
  setBusy(true);
  try{await f()}catch(e){status(displayError(e),true)}
  finally{setBusy(false)}
}
function displayError(error){
  var m=String(error&&error.message||error||"Error desconocido.");
  if(/invalid login credentials|invalid credentials|invalid_grant/i.test(m))
    return "Correo o contraseña incorrectos. Si esta cuenta ya existe, usa «Recuperar contraseña».";
  if(/email not confirmed/i.test(m))return "Falta confirmar el correo. Revisa tu bandeja de entrada.";
  if(/already registered|already been registered/i.test(m))
    return "Este correo ya está registrado. Usa «Entrar», no «Crear cuenta».";
  if(/rate.?limit|429/i.test(m))return "Demasiados intentos. Prueba más tarde.";
  if(/backup quota exceeded|maximum 20/i.test(m))
    return "Esta cuenta alcanzó el máximo de 20 copias. No se eliminó ninguna partida.";
  return m.slice(0,200);
}
function validEmail(value){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)}
function hash(data){
  var s=JSON.stringify(data),v=2166136261;
  for(var i=0;i<s.length;i++){v^=s.charCodeAt(i);v=Math.imul(v,16777619)}
  return v>>>0;
}
function parse(raw){
  if(typeof raw!=="string")throw Error("El guardado no tiene datos.");
  var e=JSON.parse(raw);
  if(!e||e.fmt!=="tm"||!Number.isInteger(e.v)||e.v<0||e.v>99||
     !e.data||typeof e.data!=="object"||!e.data.profile||
     !e.data.progress||!Number.isInteger(e.sum)||
     hash(e.data)!==e.sum)throw Error("El guardado no supera la verificación de integridad.");
  var p=e.data.profile, id=String(p.id||"");
  if(!id||id.length>80)throw Error("El guardado no tiene un identificador de personaje válido.");
  return {raw:raw,data:e.data,id:id,name:String(p.name||"Viajero").slice(0,40),
    xp:Number.isFinite(Number(p.xp))?Math.max(0,Math.floor(Number(p.xp))):0,
    pets:Array.isArray(e.data.progress.companions)?e.data.progress.companions.length:0,
    version:e.v, at:e.at||null};
}
function shortDate(value){
  var d=new Date(value);
  return !Number.isNaN(d.getTime())?d.toLocaleString("es-CL",{dateStyle:"short",timeStyle:"short"}):"Fecha desconocida";
}
function local(){
  try{var raw=storage.getItem("tm.save");return raw?parse(raw):null}
  catch(e){return null}
}
function showAccount(){
  $("tm-auth-view").hidden=!!account;
  $("tm-account-view").hidden=!account;
  $("tm-hub-logout").hidden=!account;
  if(!account){$("tm-hub-email").textContent="";return}
  $("tm-hub-email").textContent=account.email||"Cuenta";
  var value=local();
  var owner=value&&storage.getItem("tm.hub.owner."+encodeURIComponent(value.id));
  $("tm-hub-local").textContent=value?
    (owner&&owner!==account.id?"Otra cuenta del dispositivo · ":"")+
    value.name+" · "+value.xp.toLocaleString("es-CL")+" XP · "+value.pets+" mascotas":
    "No hay partida guardada en este celular";
  $("tm-hub-previous").hidden=!storage.getItem("tm.hub.previous."+account.id);
}
function element(tag,klass,textValue){
  var node=document.createElement(tag);
  if(klass)node.className=klass;
  if(textValue!==undefined)node.textContent=String(textValue);
  return node;
}
function directSource(record){
  return record.kind==="character_slot"?"Guardado por personaje":
      record.kind==="slot"?"Ranura antigua de cuenta":"Copia histórica";
}
async function fetchData(){
  if(!account)return;
  var uid=account.id;
  var res=await Promise.all([
    client.from("tm_legacy_backups").select("id,created_at,save_version,payload,verified").order("created_at",{ascending:false}).limit(20),
    client.from("tm_cloud_saves").select("user_id,payload,profile_id,revision,updated_at").eq("user_id",uid).maybeSingle(),
    client.from("tm_character_saves").select("user_id,payload,profile_id,revision,updated_at").eq("user_id",uid).order("updated_at",{ascending:false}).limit(50)
  ]);
  if(res[0].error)throw res[0].error;
  if(res[1].error)throw res[1].error;
  if(res[2].error)throw res[2].error;
  if(!account||account.id!==uid)return;
  records=[];rawSnapshots.clear();
  var slot=res[1].data;
  if(slot&&slot.payload){
    try{
      var snapshot=parse(slot.payload.raw);
      records.push(Object.assign({},snapshot,{kind:"slot",uid:uid,
        sourceId:uid,revision:slot.revision,stamp:slot.updated_at||"",time:Date.parse(slot.updated_at)||0}));
    }catch(e){
      status("La ranura automática de esta cuenta no es válida. Los respaldos históricos siguen disponibles.",true);
    }
  }
  for(var charSlot of res[2].data||[]){
    try {
      var fresh=parse(charSlot.payload&&charSlot.payload.raw);
      if(fresh.id!==charSlot.profile_id)continue;
      records.push(Object.assign({},fresh,{kind:"character_slot",uid:uid,
        sourceId:charSlot.profile_id,revision:charSlot.revision,
        stamp:charSlot.updated_at||"",time:Date.parse(charSlot.updated_at)||0}));
    } catch(e) { /* Las copias antiguas permanecen disponibles. */ }
  }
  for(var row of res[0].data||[]){
    try{
      var candidate=parse(row.payload&&row.payload.raw);
      records.push(Object.assign({},candidate,{kind:"backup",uid:uid,
        sourceId:row.id,stamp:row.created_at||"",time:Date.parse(row.created_at)||0}));
    }catch(e){/* omit invalid records from primary actions */}
  }
  records.sort(function(a,b){return b.time-a.time});
  var map=new Map();
  records.forEach(function(item){
    if(!map.has(item.id))map.set(item.id,[]);
    map.get(item.id).push(item);
  });
  groups=Array.from(map.values());
  renderCharacters();
  showAccount();
}
function renderCharacters(){
  var area=$("tm-hub-characters");
  area.replaceChildren();
  var empty=$("tm-hub-empty");
  empty.hidden=groups.length!==0;
  $("tm-hub-count").textContent=groups.length===1?"1 personaje encontrado":groups.length+" personajes encontrados";
  var current=local();
  groups.forEach(function(group){
    var newest=group[0];
    var card=element("article","tm-profile");
    card.setAttribute("role","listitem");
    if(current&&newest.id===current.id)card.classList.add("tm-profile-local");
    var top=element("div","tm-profile-head");
    var glyph=element("div","tm-profile-glyph",newest.name.slice(0,1).toUpperCase());
    glyph.setAttribute("aria-hidden","true");
    top.appendChild(glyph);
    var names=element("div","tm-profile-name");
    names.appendChild(element("strong","",newest.name));
    names.appendChild(element("span","",current&&newest.id===current.id?"Personaje que tienes abierto":"Disponible en esta cuenta"));
    top.appendChild(names);
    card.appendChild(top);
    var stats=element("div","tm-profile-stats");
    stats.appendChild(element("span","",newest.xp.toLocaleString("es-CL")+" XP"));
    stats.appendChild(element("span","",newest.pets+" mascotas"));
    card.appendChild(stats);
    card.appendChild(element("p","tm-profile-meta",
      directSource(newest)+" · "+shortDate(newest.stamp)));
    var play=element("button","btn btn-gold tm-hub-primary","Continuar con "+newest.name);
    play.type="button";
    play.addEventListener("click",function(){run(function(){return restore(newest)})});
    card.appendChild(play);
    if(group.length>1){
      var older=element("details","tm-profile-history");
      var heading=element("summary","", "Otras "+(group.length-1)+" versiones guardadas");
      older.appendChild(heading);
      group.slice(1).forEach(function(other){
        var btn=element("button","btn tm-hub-history-item",
          shortDate(other.stamp)+" · "+other.xp.toLocaleString("es-CL")+" XP · "+other.pets+" mascotas");
        btn.type="button";
        btn.addEventListener("click",function(){run(function(){return restore(other)})});
        older.appendChild(btn);
      });
      card.appendChild(older);
    }
    area.appendChild(card);
  });
  if(!groups.length)empty.textContent="Esta cuenta todavía no tiene personajes en la nube. Crea uno o copia la partida del otro celular con «Guardar personaje de este celular».";
}
function archiveCurrent(snapshot){
  // Copia local de seguridad por cuenta y personaje ANTES de cambiar.
  // Nunca se elimina un guardado antiguo al preparar el cambio.
  if(!account||!snapshot)return;
  var owner=storage.getItem("tm.hub.owner."+encodeURIComponent(snapshot.id));
  // Un guardado sin titular conocido va a zona local no asociada.
  // Nunca atribuir a la cuenta B el personaje abierto de la cuenta A.
  var scope=owner||"unassigned";
  var suffix=scope+"."+encodeURIComponent(snapshot.id);
  var key="tm.hub.local."+suffix;
  var previous=storage.getItem(key);
  if(previous&&previous!==snapshot.raw){
    var earlier="tm.hub.local.previous."+suffix;
    storage.setItem(earlier,previous);
    if(storage.getItem(earlier)!==previous)
      throw Error("No se pudo conservar la versión local anterior. No cambiaremos de personaje.");
  }
  storage.setItem(key,snapshot.raw);
  if(storage.getItem(key)!==snapshot.raw)
    throw Error("No se pudo conservar la partida actual por personaje. No cambiaremos de personaje.");
  storage.setItem("tm.hub.previous."+scope,snapshot.raw);
  if(storage.getItem("tm.hub.previous."+scope)!==snapshot.raw)
    throw Error("No se pudo crear el respaldo rápido. No cambiaremos de personaje.");
}
function restoreLocalCopy(snapshot,label){
  if(!account)throw Error("Inicia sesión primero.");
  if(inCoop())throw Error("Sal del cooperativo antes de recuperar un personaje.");
  var current=local();
  if(!window.confirm("Esta copia local contiene "+snapshot.name+" ("+snapshot.xp+
      " XP, "+snapshot.pets+" mascotas).\nOrigen: "+label+
      "\n\n¿Recuperarla en esta beta? No se subirá a Supabase hasta que pulses «Guardar personaje de este celular»."))
    return;
  if(current)archiveCurrent(current);
  importLocal(snapshot);
  showAccount();renderCharacters();
  $("tm-hub-local-copies").hidden=true;
  status("Copia recuperada: "+snapshot.name+". Para asociarla a esta cuenta, pulsa «Guardar personaje de este celular».");
}
function scanLocal(){
  if(!account)throw Error("Inicia sesión para buscar copias locales.");
  var list=$("tm-hub-local-copies");
  list.replaceChildren();
  list.hidden=false;
  var names=[
    ["Partida antes de la última restauración",storage,"tm.hub.previous."+account.id],
    ["Copia temporal de restauración",storage,"tm.hub.temporary."+account.id],
    ["Guardado anterior de nube",storage,"tm.cloud.pre_restore"],
    ["Guardado anterior del autoguardado",storage,"tm.cloud.slot.pre_restore"],
    ["Copia local del juego beta",storage,"tm.save.bak"]
  ];
  if(window.localStorage){
    names.push(["Partida actual del juego oficial",window.localStorage,"tm.save"]);
    names.push(["Copia anterior del juego oficial",window.localStorage,"tm.save.bak"]);
  }
  // Mostrar solo copias de la cuenta actual y las no vinculadas.
  // Jamás revelar automáticamente archivos locales etiquetados para otra cuenta.
  var prefixes=[
    "tm.hub.local."+account.id+".",
    "tm.hub.local.previous."+account.id+".",
    "tm.hub.local.unassigned.",
    "tm.hub.local.previous.unassigned."
  ];
  for(var i=0;i<storage.length;i++){
    var candidateKey=storage.key(i);
    if(candidateKey&&prefixes.some(function(prefix){return candidateKey.startsWith(prefix)})){
      names.push([candidateKey.includes(".previous.")?"Versión anterior de personaje":"Copia local por personaje",storage,candidateKey]);
    }
  }
  var seen=new Set(),current=local(),found=0;
  names.forEach(function(entry){
    var raw;
    try{raw=entry[1].getItem(entry[2]);}catch(e){return}
    if(!raw||seen.has(raw)||(current&&raw===current.raw))return;
    var snapshot;
    try{snapshot=parse(raw)}catch(e){return}
    seen.add(raw);found++;
    var card=element("div","tm-hub-local-copy");
    card.appendChild(element("strong","",snapshot.name+" · "+snapshot.xp.toLocaleString("es-CL")+" XP · "+snapshot.pets+" mascotas"));
    card.appendChild(element("small","",entry[0]));
    var restoreButton=element("button","btn","Recuperar "+snapshot.name+" en esta beta");
    restoreButton.type="button";
    restoreButton.addEventListener("click",function(){run(function(){restoreLocalCopy(snapshot,entry[0])})});
    card.appendChild(restoreButton);
    list.appendChild(card);
  });
  if(!found)list.appendChild(element("p","tm-hub-hint",
      "No hay otras partidas recuperables en este navegador. Comprueba el celular donde jugaste originalmente con ese personaje."));
  status(found?("Encontré "+found+" copia"+(found===1?"":"s")+" local"+(found===1?"":"es")+
    ". Elige la que corresponda. No se ha cambiado ninguna partida."):
    "No encontré copias antiguas en este navegador. La partida puede seguir en el otro celular.");
}
async function refreshAccount(){
  var session=await client.auth.getSession();
  if(session.error)throw session.error;
  var u=null;
  if(session.data&&session.data.session){
    var resp=await client.auth.getUser();
    if(resp.error)throw resp.error;
    u=resp.data.user;
  }
  if((account&&account.id)!==(u&&u.id)){
    account=u;
    records=[];groups=[];
    if(u){await fetchData();status("Cuenta conectada. Elige tu personaje y pulsa «Continuar».")}
    else{renderCharacters();status("Inicia sesión para ver los personajes asociados a tu correo.")}
  }else if(u&&account){account=u;showAccount();}
  else {showAccount();status("Inicia sesión para ver los personajes asociados a tu correo.");}
}
async function socialLogin(provider){
  await run(async function(){
    if(provider!=="google"&&provider!=="apple")throw Error("Proveedor de inicio de sesión no compatible.");
    // El proveedor debe estar habilitado en Supabase y configurado con su OAuth externo.
    // Supabase podría vincular automáticamente identidades con correos verificados.
    var response=await client.auth.signInWithOAuth({
      provider:provider,options:{redirectTo:location.origin+location.pathname}
    });
    if(response.error)throw Error("No está disponible el acceso con "+
      (provider==="google"?"Google":"Apple")+
      ". Comprueba la configuración OAuth o entra con tu correo actual. Detalle: "+response.error.message);
    status("Abriendo la autorización de "+(provider==="google"?"Google":"Apple")+"…");
  });
}
async function signIn(register){
  await run(async function(){
    var email=$("tm-hub-login-email").value.trim();
    var pass=$("tm-hub-login-password").value;
    if(!validEmail(email)||pass.length<8)throw Error("Escribe un correo válido y una contraseña de al menos 8 caracteres.");
    var result=register
      ?await client.auth.signUp({email:email,password:pass,
          options:{emailRedirectTo:location.origin+location.pathname}})
      :await client.auth.signInWithPassword({email:email,password:pass});
    if(result.error)throw result.error;
    $("tm-hub-login-password").value="";
    if(result.data.session){
      await refreshAccount();
      status("Sesión iniciada. Abajo están los personajes de esta cuenta; pulsa «Continuar» en el correcto.");
    }else status("Comprueba tu correo para confirmar la cuenta. Si ya existía, usa «Entrar».");
  });
}
async function resetPassword(){
  await run(async function(){
    var email=$("tm-hub-login-email").value.trim();
    if(!validEmail(email))throw Error("Introduce primero el correo de la cuenta.");
    var response=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    if(response.error)throw response.error;
    status("Si la cuenta existe, llegará un correo para recuperar la contraseña. Ábrelo y regresa a esta beta.");
  });
}
async function confirmPassword(){
  await run(async function(){
    var pass=$("tm-hub-new-password").value;
    if(pass.length<8)throw Error("La nueva contraseña necesita al menos 8 caracteres.");
    var response=await client.auth.updateUser({password:pass});
    if(response.error)throw response.error;
    recovery=false;
    $("tm-hub-reset-view").hidden=true;
    $("tm-hub-new-password").value="";
    await refreshAccount();
    status("Contraseña cambiada. Puedes usar esa cuenta en el otro celular.");
  });
}
async function logout(){
  await run(async function(){
    var localBackupWarning=false,current=local();
    if(current)try{archiveCurrent(current)}catch(e){localBackupWarning=true}
    // Nunca impedir el cierre de sesión por falta de espacio local.
    var result=await client.auth.signOut();
    if(result.error)throw result.error;
    account=null;records=[];groups=[];
    renderCharacters();showAccount();
    status(localBackupWarning?
      "Sesión cerrada. No hubo espacio para una copia adicional; el guardado local anterior no se eliminó.":
      "Sesión cerrada. La partida de este celular no se borró.",localBackupWarning);
  });
}
function toCode(raw){
  var bytes=new TextEncoder().encode(raw),bin="";
  for(var i=0;i<bytes.length;i+=8192)
    bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
  return "TM1:"+btoa(bin);
}
function fromCode(code){
  if(!code.startsWith("TM1:"))throw Error("El exportador del juego no generó un código válido.");
  var bytes=Uint8Array.from(atob(code.slice(4).replace(/\s+/g,"")),function(c){return c.charCodeAt(0)});
  return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}
function exportNow(){
  $("btn-export").click(); // Este exportador almacena la posición antes de crear el código.
  return parse(fromCode($("export-out").value));
}
async function finger(data){
  var encoded=new TextEncoder().encode(JSON.stringify(data));
  var digest=await crypto.subtle.digest("SHA-256",encoded);
  return "sha256:"+Array.from(new Uint8Array(digest)).map(function(n){return n.toString(16).padStart(2,"0")}).join("");
}
async function backupCurrent(){
  if(!account)throw Error("Primero inicia sesión.");
  var user=await client.auth.getUser();
  if(user.error||!user.data.user||user.data.user.id!==account.id)
    throw Error("La sesión cambió. Vuelve a entrar.");
  var current=exportNow();
  if(records.some(function(r){return r.id!==current.id}) &&
    !window.confirm("Esta cuenta ya contiene otro personaje. ¿Guardar también "+
      current.name+" ("+current.xp+" XP) en este correo? Revisa que sea la cuenta correcta."))
    return;
  if(new TextEncoder().encode(JSON.stringify({raw:current.raw})).length>1000000)
    throw Error("El guardado supera el límite de 1 MB.");
  var profile=await client.from("tm_players").upsert({
    user_id:account.id,display_name:current.name,
    legacy_profile_id:current.id,updated_at:new Date().toISOString()
  },{onConflict:"user_id"});
  if(profile.error)throw profile.error;
  var save=await client.from("tm_legacy_backups").insert({
    user_id:account.id,import_key:await finger(current.data),
    save_format:"tm",save_version:current.version,
    payload:{raw:current.raw},origin:"github_pages"
  });
  if(save.error&&save.error.code!=="23505")throw save.error;
  // Solo una vinculación explícita y confirmada marca el dueño local.
  try{storage.setItem("tm.hub.owner."+encodeURIComponent(current.id),account.id)}catch(e){}
  await fetchData();
  status(save.error
    ?"Este personaje ya tenía una copia idéntica en esta cuenta."
    :"Se guardó una copia de "+current.name+" ("+current.xp+" XP) en esta cuenta.");
}
async function getFresh(record){
  if(!account||record.uid!==account.id)throw Error("La cuenta cambió. Vuelve a cargar los personajes.");
  var resp;
  if(record.kind==="character_slot"){
    resp=await client.from("tm_character_saves")
      .select("revision,payload").eq("user_id",account.id).eq("profile_id",record.id).maybeSingle();
    if(resp.error)throw resp.error;
    if(!resp.data||resp.data.revision!==record.revision)
      throw Error("El personaje fue actualizado en otro celular. Pulsa «Actualizar» antes de continuar.");
  } else if(record.kind==="slot"){
    resp=await client.from("tm_cloud_saves")
      .select("revision,payload").eq("user_id",account.id).maybeSingle();
    if(resp.error)throw resp.error;
    if(!resp.data||resp.data.revision!==record.revision)
      throw Error("La ranura cambió desde otro dispositivo. Pulsa «Actualizar» antes de recuperar.");
  }else{
    resp=await client.from("tm_legacy_backups")
      .select("payload").eq("id",record.sourceId).single();
    if(resp.error)throw resp.error;
  }
  var raw=resp.data&&resp.data.payload&&resp.data.payload.raw;
  var parsed=parse(raw);
  if(parsed.id!==record.id)throw Error("La copia cambió. Actualiza la lista antes de continuar.");
  return parsed;
}
function inCoop(){var room=$("room-chip");return !!(room&&!room.hidden)}
function importLocal(snapshot){
  $("import-in").value=toCode(snapshot.raw);
  $("save-status").textContent="";
  $("btn-import").click();
  var result=$("save-status").textContent.trim();
  $("import-in").value="";
  if(result!=="Partida cargada.")throw Error("El juego no confirmó la carga: "+(result||"sin respuesta"));
  if(account)try{storage.setItem("tm.hub.owner."+encodeURIComponent(snapshot.id),account.id)}catch(e){}
  window.dispatchEvent(new Event("tm:character-changed"));
}
async function restore(item){
  if(!account)throw Error("Inicia sesión primero.");
  if(inCoop())throw Error("Sal de la sala multijugador antes de cambiar de personaje.");
  var saved=await getFresh(item),current=local();
  if(current&&current.raw===saved.raw){
    status("Ya tienes exactamente este guardado de "+saved.name+" en el celular. Puedes seguir jugando.");
    return;
  }
  var label=current?current.name+" ("+current.xp+" XP)":"ninguno";
  var question="Vas a continuar con "+saved.name+" ("+saved.xp+" XP, "+
    saved.pets+" mascotas) de la cuenta "+(account.email||"")+"."+
    "\n\nPersonaje actual del celular: "+label+
    "\n\n¿Cargar este personaje? Conservaremos antes el guardado local actual.";
  if(!window.confirm(question)){status("No se cambió ningún personaje.");return}
  if(current)archiveCurrent(current);
  importLocal(saved);
  showAccount();
  renderCharacters();
  status("Personaje recuperado: "+saved.name+" · "+saved.xp+" XP · "+saved.pets+" mascotas. Ya puedes continuar jugando.");
  var resume=$("btn-resume"),pause=$("pause"),creator=$("creator");
  if(resume&&pause&&!pause.hidden&&(!creator||creator.hidden)&&saved.data.profile.character){resume.click();}
}
async function restorePrevious(){
  if(!account)throw Error("No hay sesión.");
  if(inCoop())throw Error("Sal de la sala multijugador antes de cambiar de personaje.");
  var raw=storage.getItem("tm.hub.previous."+account.id);
  if(!raw)throw Error("No hay una partida anterior para recuperar.");
  var previous=parse(raw),now=local();
  if(!window.confirm("¿Volver a "+previous.name+" ("+previous.xp+" XP)? Se conservará una copia del personaje actual."))return;
  if(now)archiveCurrent(now);
  importLocal(previous);
  if(now)storage.setItem("tm.hub.previous."+account.id,now.raw);
  showAccount();renderCharacters();
  status("Recuperaste el personaje anterior "+previous.name+".");
}
async function refresh(){
  await run(async function(){await refreshAccount();if(account)await fetchData();status("Lista actualizada. El personaje del celular no cambió.");});
}
$("tm-hub-google").addEventListener("click",function(){socialLogin("google")});
$("tm-hub-apple").addEventListener("click",function(){socialLogin("apple")});
$("tm-hub-login").addEventListener("click",function(){signIn(false)});
$("tm-hub-register").addEventListener("click",function(){signIn(true)});
$("tm-hub-forgot").addEventListener("click",resetPassword);
$("tm-hub-update-password").addEventListener("click",confirmPassword);
$("tm-hub-logout").addEventListener("click",logout);
$("tm-hub-refresh").addEventListener("click",refresh);
$("tm-hub-backup").addEventListener("click",function(){run(backupCurrent)});
$("tm-hub-scan").addEventListener("click",function(){run(scanLocal)});
$("tm-hub-previous").addEventListener("click",function(){run(restorePrevious)});
client.auth.onAuthStateChange(function(event){
  if(event==="PASSWORD_RECOVERY"){
    recovery=true;
    $("tm-hub-reset-view").hidden=false;
    status("Enlace recibido. Elige tu nueva contraseña para recuperar la cuenta.");
  }
  setTimeout(function(){refreshAccount().then(function(){
    if(recovery){
      $("tm-hub-reset-view").hidden=false;
      status("Escribe una nueva contraseña para recuperar el acceso.");
    }
  }).catch(function(e){status(displayError(e),true)});},0);
});
refreshAccount().catch(function(e){status(displayError(e),true)});
})();