/* Torre Multiversal · Centro de cuenta beta (v1).
   Un correo es identidad, un personaje es una partida. Nunca suponer
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
  $("tm-hub-local").textContent=value?value.name+" · "+value.xp.toLocaleString("es-CL")+" XP · "+value.pets+" mascotas":"No hay partida guardada en este celular";
  $("tm-hub-previous").hidden=!storage.getItem("tm.hub.previous."+account.id);
}
function element(tag,klass,textValue){
  var node=document.createElement(tag);
  if(klass)node.className=klass;
  if(textValue!==undefined)node.textContent=String(textValue);
  return node;
}
function directSource(record){
  if(record.kind==="character")return "Guardado vinculado a tu cuenta";
  return record.kind==="slot"?"Ranura experimental":"Copia histórica";
}
function revisionKey(uid,pid){
  return "tm.hub.character.revision."+uid+"."+encodeURIComponent(pid);
}
function noteRevision(uid,pid,rev){
  storage.setItem(revisionKey(uid,pid),String(rev));
}
async function rememberLinked(uid,snapshot,rev){
  noteRevision(uid,snapshot.id,rev);
  var fp=await finger(snapshot.data);
  storage.setItem("tm.char.sync.base."+uid+"."+encodeURIComponent(snapshot.id),
    JSON.stringify({revision:Number(rev),fingerprint:fp}));
  storage.setItem("tm.char.sync.source."+uid,"linked:"+snapshot.id);
  storage.setItem("tm.gateway.selected."+uid,snapshot.id);
  if(typeof window.__TM_SYNC_REFRESH__==="function")
    setTimeout(window.__TM_SYNC_REFRESH__,0);
  if(typeof window.__TM_CONFLICT_RESET__==="function")window.__TM_CONFLICT_RESET__();
}
function resetRevision(uid,pid){
  if(storage.removeItem)storage.removeItem(revisionKey(uid,pid));
  storage.setItem("tm.char.sync.source."+uid,"other:"+pid);
  if(typeof window.__TM_SYNC_REFRESH__==="function")
    setTimeout(window.__TM_SYNC_REFRESH__,0);
  if(typeof window.__TM_CONFLICT_RESET__==="function")window.__TM_CONFLICT_RESET__();
}
function enterWorld(saved){
  var creator=$("creator"),pause=$("pause"),menu=$("menu");
  if(!saved.data.profile.character){
    status("Este respaldo es un borrador sin aspecto terminado. Debes terminar su creación antes de jugar.",true);
    return;
  }
  if(creator&&!creator.hidden){
    var cancel=$("cr-cancel");
    if(cancel)cancel.click();
    if(!creator.hidden)throw Error("El creador anterior no pudo cerrarse. La partida continúa protegida.");
  }
  // Tras salir de una sesión, hay que crear una sesión NUEVA con el perfil
  // recuperado. Reanudar la anterior mantenía atributos del jugador antiguo.
  if(menu&&!menu.hidden){$("btn-solo").click();return;}
  if(pause&&!pause.hidden)$("btn-resume").click();
}

async function fetchData(){
  if(!account)return;
  var uid=account.id;
  var res=await Promise.all([
    client.from("tm_legacy_backups")
      .select("id,created_at,save_version,payload,verified")
      .order("created_at",{ascending:false}).limit(20),
    client.from("tm_cloud_saves")
      .select("user_id,payload,profile_id,revision,updated_at")
      .eq("user_id",uid).maybeSingle(),
    client.from("tm_character_saves")
      .select("user_id,profile_id,payload,revision,fingerprint,updated_at")
      .eq("user_id",uid).order("updated_at",{ascending:false}).limit(50)
  ]);
  for(var query of res)if(query.error)throw query.error;
  if(!account||account.id!==uid)return;
  records=[];rawSnapshots.clear();
  for(var personal of res[2].data||[]){
    try{
      var linked=parse(personal.payload&&personal.payload.raw);
      if(linked.id!==personal.profile_id)continue;
      records.push(Object.assign({},linked,{kind:"character",uid:uid,
        sourceId:personal.profile_id,revision:personal.revision,
        stamp:personal.updated_at||"",time:Date.parse(personal.updated_at)||0}));
    }catch(e){/* Invalid slots are not available to load. */}
  }
  var slot=res[1].data;
  if(slot&&slot.payload){
    try{
      var snapshot=parse(slot.payload.raw);
      if(snapshot.id===slot.profile_id)
        records.push(Object.assign({},snapshot,{kind:"slot",uid:uid,
          sourceId:uid,revision:slot.revision,stamp:slot.updated_at||"",
          time:Date.parse(slot.updated_at)||0}));
    }catch(e){/* Old experimental slot might be invalid; backups remain accessible. */}
  }
  for(var row of res[0].data||[]){
    try{
      var candidate=parse(row.payload&&row.payload.raw);
      records.push(Object.assign({},candidate,{kind:"backup",uid:uid,
        sourceId:row.id,stamp:row.created_at||"",time:Date.parse(row.created_at)||0}));
    }catch(e){/* Omit damaged history copies. */}
  }
  var rank={character:3,slot:2,backup:1};
  records.sort(function(a,b){
    return (rank[b.kind]-rank[a.kind]) || b.time-a.time;
  });
  var byProfile=new Map();
  records.forEach(function(item){
    if(!byProfile.has(item.id))byProfile.set(item.id,[]);
    byProfile.get(item.id).push(item);
  });
  groups=Array.from(byProfile.values());
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
    names.appendChild(element("span","",
      newest.kind==="character"?"Vinculado a esta cuenta":
      (current&&newest.id===current.id?"Personaje abierto · copia recuperable":"Copia recuperable de esta cuenta")));
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
  if(!groups.length)empty.textContent="Esta cuenta todavía no tiene personajes respaldados. Si el personaje está en otro celular, abre esta beta allí y pulsa «Guardar personaje de este celular».";
}
function restoreLocalCopy(snapshot,label){
  if(!account)throw Error("Inicia sesión primero.");
  if(inCoop())throw Error("Sal del cooperativo antes de recuperar un personaje.");
  var current=local();
  if(!window.confirm("Esta copia local contiene "+snapshot.name+" ("+snapshot.xp+
      " XP, "+snapshot.pets+" mascotas).\nOrigen: "+label+
      "\n\n¿Recuperarla en esta beta? No se subirá a Supabase hasta que pulses «Guardar personaje de este celular»."))
    return;
  if(current){
    var previousKey="tm.hub.previous."+account.id;
    storage.setItem(previousKey,current.raw);
    if(storage.getItem(previousKey)!==current.raw)
      throw Error("No se pudo preservar la partida actual. Se canceló la recuperación.");
  }
  importLocal(snapshot);
  resetRevision(account.id,snapshot.id);
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
    var result=await client.auth.signOut();
    if(result.error)throw result.error;
    account=null;records=[];groups=[];
    renderCharacters();showAccount();
    status("Sesión cerrada. La partida de este celular no se borró.");
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
  if(!account)throw Error("Inicia sesión primero.");
  if(inCoop())throw Error("Sal del cooperativo para guardar un personaje.");
  var uid=account.id;
  var user=await client.auth.getUser();
  if(user.error||!user.data.user||user.data.user.id!==uid)
    throw Error("La sesión cambió. Vuelve a entrar.");
  var current=exportNow();
  if(records.some(function(r){return r.id!==current.id}) &&
    !window.confirm("Esta cuenta contiene otro personaje. ¿Vincular también "+
      current.name+" ("+current.xp+" XP) a este correo? No se eliminarán los demás."))
    return;
  if(new TextEncoder().encode(JSON.stringify({raw:current.raw})).length>1000000)
    throw Error("El guardado supera el límite de 1 MB.");
  var fingerprint=await finger(current.data);
  var query=await client.from("tm_character_saves")
    .select("revision,fingerprint,profile_id")
    .eq("user_id",uid).eq("profile_id",current.id).maybeSingle();
  if(query.error)throw query.error;
  var existing=query.data;
  if(!existing){
    var added=await client.from("tm_character_saves").insert({
      user_id:uid,profile_id:current.id,save_version:current.version,
      payload:{raw:current.raw},fingerprint:fingerprint,revision:1,verified:false
    }).select("revision,profile_id,fingerprint").single();
    if(added.error){
      if(added.error.code==="23505")throw Error("Otro dispositivo creó este personaje. Pulsa Actualizar y vuelve a comprobarlo.");
      throw added.error;
    }
    await rememberLinked(uid,current,added.data.revision);
    await fetchData();
    status("Personaje vinculado: "+current.name+" ("+current.xp+" XP). Ya aparecerá al entrar desde otro celular.");
  }else if(existing.fingerprint===fingerprint){
    await rememberLinked(uid,current,existing.revision);
    await fetchData();
    status(current.name+" ya está guardado en esta cuenta. No hace falta duplicarlo.");
  }else{
    var known=Number(storage.getItem(revisionKey(uid,current.id))||"0");
    if(known!==Number(existing.revision)||known<1){
      await fetchData();
      status("Hay una versión diferente de "+current.name+" en la nube. No la sobrescribí. Para conservar el progreso de este celular, crea una copia histórica en Opciones avanzadas. Luego elige qué versión cargar.",true);
      return;
    }
    if(!window.confirm("¿Actualizar "+current.name+" en tu cuenta con la partida de este celular? La nube pasará de revisión "+known+" a "+(known+1)+"."))
      return;
    var updated=await client.from("tm_character_saves").update({
      save_version:current.version,payload:{raw:current.raw},
      fingerprint:fingerprint,revision:known+1
    }).eq("user_id",uid).eq("profile_id",current.id).eq("revision",known)
      .select("revision,profile_id,fingerprint").maybeSingle();
    if(updated.error)throw updated.error;
    if(!updated.data){
      await fetchData();
      status("Otra sesión guardó antes. No se sobrescribió la nube. Actualiza tus personajes.",true);
      return;
    }
    await rememberLinked(uid,current,updated.data.revision);
    await fetchData();
    status("Guardado actualizado: "+current.name+" ("+current.xp+" XP). Revisión "+updated.data.revision+".");
  }
  // Perfil de conveniencia, NO propiedad económica del personaje.
  var profile=await client.from("tm_players").upsert({
    user_id:uid,display_name:current.name,
    legacy_profile_id:current.id,updated_at:new Date().toISOString()
  },{onConflict:"user_id"});
  if(profile.error)
    status("El personaje se guardó, pero no se pudo actualizar el alias de la cuenta.",true);
}
async function backupHistorical(){
  if(!account)throw Error("Inicia sesión primero.");
  var u=await client.auth.getUser();
  if(u.error||!u.data.user||u.data.user.id!==account.id)
    throw Error("Tu sesión cambió. Inicia sesión otra vez.");
  var current=exportNow();
  if(new TextEncoder().encode(JSON.stringify({raw:current.raw})).length>1000000)
    throw Error("El respaldo supera el límite beta de 1 MB.");
  var result=await client.from("tm_legacy_backups").insert({
    user_id:account.id,import_key:await finger(current.data),
    save_format:"tm",save_version:current.version,
    payload:{raw:current.raw},origin:"github_pages"
  });
  if(result.error&&result.error.code!=="23505")throw result.error;
  await fetchData();
  status(result.error?"Esta versión ya existe en tu historial.":
    "Copia histórica guardada sin sustituir tu personaje vinculado.");
}
async function getFresh(record){
  if(!account||record.uid!==account.id)throw Error("La cuenta cambió. Vuelve a cargar los personajes.");
  var resp;
  if(record.kind==="character"){
    resp=await client.from("tm_character_saves")
      .select("revision,payload,profile_id").eq("user_id",account.id)
      .eq("profile_id",record.id).maybeSingle();
    if(resp.error)throw resp.error;
    if(!resp.data||Number(resp.data.revision)!==Number(record.revision)||
       resp.data.profile_id!==record.id)
      throw Error("Este personaje se actualizó desde otro celular. Pulsa «Actualizar» antes de continuar.");
  }else if(record.kind==="slot"){
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
}
async function restore(item){
  if(!account)throw Error("Inicia sesión primero.");
  if(inCoop())throw Error("Sal de la sala multijugador antes de cambiar de personaje.");
  var saved=await getFresh(item),current=local();
  if(item.kind==="character"&&!saved.data.profile.character)
    throw Error("Este perfil es un borrador incompleto, no un personaje listo para jugar.");
  // Exportar siempre el último estado ANTES de salir o sustituir un personaje.
  try{current=exportNow()}catch(_){/* Conservar el último respaldo local si falló el exportador. */}
  if(current&&current.raw===saved.raw){
    if(item.kind==="character")await rememberLinked(account.id,saved,item.revision);
    else resetRevision(account.id,saved.id);
    status("Ya tienes este personaje en el celular. Puedes seguir jugando.");
    enterWorld(saved);
    return;
  }
  var label=current?current.name+" ("+current.xp+" XP)":"ninguno";
  var question="Vas a continuar con "+saved.name+" ("+saved.xp+" XP, "+
    saved.pets+" mascotas) de la cuenta "+(account.email||"")+"."+
    "\n\nPersonaje actual del celular: "+label+
    "\n\n¿Cargar este personaje? Conservaremos antes el guardado local actual.";
  if(!window.confirm(question)){status("No se cambió ningún personaje.");return}
  var uid=account.id;
  if(current){
    var key="tm.hub.previous."+uid;
    storage.setItem(key,current.raw);
    if(storage.getItem(key)!==current.raw)
      throw Error("No se pudo proteger el guardado anterior. No se realizó el cambio.");
  }
  var pause=$("pause"),leave=$("btn-leave");
  if(pause&&!pause.hidden){
    if(!leave)throw Error("No se pudo cerrar correctamente la sesión actual.");
    leave.click();
    if(!pause.hidden)throw Error("El juego no confirmó la salida; restauración cancelada.");
  }
  importLocal(saved);
  if(item.kind==="character")await rememberLinked(account.id,saved,item.revision);
  else resetRevision(account.id,saved.id);
  showAccount();
  renderCharacters();
  status("Personaje recuperado: "+saved.name+" · "+saved.xp+" XP · "+saved.pets+" mascotas. Ya puedes continuar jugando.");
  enterWorld(saved);
}
async function restorePrevious(){
  if(!account)throw Error("No hay sesión.");
  if(inCoop())throw Error("Sal de la sala multijugador antes de cambiar de personaje.");
  var raw=storage.getItem("tm.hub.previous."+account.id);
  if(!raw)throw Error("No hay una partida anterior para recuperar.");
  var previous=parse(raw),now=local();
  if(!window.confirm("¿Volver a "+previous.name+" ("+previous.xp+" XP)? Se conservará una copia del personaje actual."))return;
  if(now)storage.setItem("tm.hub.temporary."+account.id,now.raw);
  importLocal(previous);
  resetRevision(account.id,previous.id);
  if(now)storage.setItem("tm.hub.previous."+account.id,now.raw);
  showAccount();renderCharacters();
  status("Recuperaste el personaje anterior "+previous.name+".");
}
async function refresh(){
  await run(async function(){await refreshAccount();if(account)await fetchData();status("Lista actualizada. El personaje del celular no cambió.");});
}
$("tm-hub-login").addEventListener("click",function(){signIn(false)});
$("tm-hub-register").addEventListener("click",function(){signIn(true)});
$("tm-hub-forgot").addEventListener("click",resetPassword);
$("tm-hub-update-password").addEventListener("click",confirmPassword);
$("tm-hub-logout").addEventListener("click",logout);
$("tm-hub-refresh").addEventListener("click",refresh);
$("tm-hub-backup").addEventListener("click",function(){run(backupCurrent)});
$("tm-hub-history-backup").addEventListener("click",function(){run(backupHistorical)});
$("tm-hub-switch").addEventListener("click",function(){
  run(async function(){
    if(!account)throw Error("Inicia sesión antes de cambiar de personaje.");
    var pause=$("pause"),leave=$("btn-leave"),go=$("tm-entry-open-btn");
    if(!go)throw Error("El selector Vangelium no está disponible.");
    if(inCoop()&&!window.confirm("¿Salir del cooperativo para cambiar de personaje?"))return;
    var before;
    try{before=exportNow()}catch(_){before=local()}
    if(before){
      var key="tm.hub.previous."+account.id;
      storage.setItem(key,before.raw);
      if(storage.getItem(key)!==before.raw)
        throw Error("No pude conservar el personaje actual. No se cambió la partida.");
    }
    if(pause&&!pause.hidden){
      if(!leave)throw Error("No pude cerrar la partida actual.");
      leave.click(); // El motor guarda la posición y cierra la sesión previa.
      if(!pause.hidden)throw Error("No se confirmó la salida. No se cambió de personaje.");
    }
    go.click();
  });
});
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