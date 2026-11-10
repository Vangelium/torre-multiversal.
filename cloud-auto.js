/* Torre Multiversal: una ranura de autoguardado por cuenta, opt-in.
 * Solo es un respaldo PERSONAL NO VERIFICADO; no acredita items ni moneda.
 * El control de revisiones evita sobreescribir guardados hechos en otro movil.
 */
(function () {
  "use strict";
  var client = window.__TM_CLOUD_CLIENT__;
  var root = document.getElementById("tm-auto");
  var storage = window.__TM_BETA_STORAGE__;
  if (!client || !root || !storage) return;

  var el = function (id) { return document.getElementById(id); };
  var account = null, enabled = false, busy = false;
  var knownRevision = null, knownFingerprint = null, knownProfile = null;
  var selectedRemote = null;
  var frequencyMs = 180000;

  function info(msg, bad) {
    el("tm-auto-status").textContent = msg;
    el("tm-auto-status").dataset.state = bad ? "error" : "ok";
  }
  function key(suffix, id) {
    return "tm.autosync." + suffix + "." + id;
  }
  function turnOff(message, bad) {
    enabled = false;
    if (account) storage.setItem(key("enabled", account.id), "0");
    buttons();
    if (message) info(message, bad);
  }
  function buttons() {
    el("tm-auto-enable").hidden = enabled;
    el("tm-auto-stop").hidden = !enabled;
    el("tm-auto-restore").disabled = !account || !selectedRemote || busy;
    el("tm-auto-enable").disabled = !account || busy;
    el("tm-auto-stop").disabled = busy;
    el("tm-auto-refresh").disabled = !account || busy;
  }
  function throwError(res) {
    if (res && res.error) throw res.error;
    return res && res.data;
  }
  function fnv(str) {
    var x = 2166136261;
    for (var i = 0; i < str.length; ++i) {
      x ^= str.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return x >>> 0;
  }
  function decodeRaw(raw) {
    var e = JSON.parse(raw);
    if (!e || e.fmt !== "tm" || !Number.isInteger(e.v) || e.v < 0 || e.v > 99 ||
        !e.data || typeof e.data !== "object" || !e.data.profile ||
        !e.data.progress || !Number.isInteger(e.sum) ||
        fnv(JSON.stringify(e.data)) !== e.sum) {
      throw new Error("Formato o comprobacion de integridad invalida.");
    }
    var profile = e.data.profile;
    if (!profile.id || String(profile.id).length > 80) {
      throw new Error("Esta partida no tiene un ID de personaje utilizable.");
    }
    return {raw: raw, data: e.data, version: e.v,
      id: String(profile.id), name: String(profile.name || "Viajero").slice(0,40)};
  }
  function fromBase64(code) {
    if (!code.startsWith("TM1:")) throw new Error("Fallo al exportar la partida.");
    var bin = atob(code.slice(4).replace(/\s+/g, ""));
    var bytes = Uint8Array.from(bin, function (char) { return char.charCodeAt(0); });
    return new TextDecoder("utf-8", {fatal:true}).decode(bytes);
  }
  function toBase64(raw) {
    var bytes = new TextEncoder().encode(raw), binary = "";
    for (var i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
    return "TM1:" + btoa(binary);
  }
  async function hashData(data) {
    var bytes = new TextEncoder().encode(JSON.stringify(data));
    var digest = await crypto.subtle.digest("SHA-256", bytes);
    return "sha256:" + Array.from(new Uint8Array(digest)).map(function (x) {
      return x.toString(16).padStart(2,"0");
    }).join("");
  }
  async function getLocal(exportCurrent) {
    var raw;
    if (exportCurrent) {
      // El exportador oficial recoge la posicion actual; no altera el motor.
      el("btn-export").click();
      raw = fromBase64(el("export-out").value);
    } else {
      raw = storage.getItem("tm.save");
      if (!raw) throw new Error("Este celular aun no tiene una partida local.");
    }
    var value = decodeRaw(raw);
    if (new TextEncoder().encode(JSON.stringify({raw:raw})).length > 1000000)
      throw new Error("El guardado supera 1 MB y no se puede sincronizar.");
    value.fingerprint = await hashData(value.data);
    return value;
  }
  async function getRemote() {
    var query = await client.from("tm_cloud_saves")
      .select("profile_id,save_version,revision,fingerprint,payload,updated_at")
      .eq("user_id", account.id).maybeSingle();
    return throwError(query);
  }
  function remember(remote) {
    knownRevision = remote.revision;
    knownFingerprint = remote.fingerprint;
    knownProfile = remote.profile_id;
    storage.setItem(key("revision",account.id), String(remote.revision));
    storage.setItem(key("fingerprint",account.id), remote.fingerprint);
    storage.setItem(key("profile",account.id), remote.profile_id);
  }
  function display(remote) {
    selectedRemote = remote;
    if (!remote) {
      el("tm-auto-cloud").textContent = "Ranura remota: vacia. Todavia no hay guardado automatico.";
    } else {
      var preview;
      try { preview = decodeRaw(remote.payload.raw); }
      catch (_) { preview = {name:"Copia no valida"}; }
      var when = new Date(remote.updated_at);
      el("tm-auto-cloud").textContent =
        "Ranura de esta cuenta: " + preview.name +
        " | revision " + remote.revision +
        " | " + (Number.isNaN(when.getTime())?"Fecha desconocida":when.toLocaleString("es-CL"));
    }
    buttons();
  }
  async function checkAccount() {
    if (busy) return;
    var response = await client.auth.getUser();
    var next = response.error ? null : response.data.user;
    var changed = (next && next.id) !== (account && account.id);
    if (changed) {
      account = next;
      enabled = false;
      knownRevision = null; knownFingerprint = null; knownProfile = null;
      selectedRemote = null;
    }
    if (!account) {
      display(null);
      info("Accede con tu correo en Respaldo en la nube para activar la sincronizacion.");
      return;
    }
    var remote = await getRemote();
    display(remote);
    if (!changed || !remote) {
      if (!remote && storage.getItem(key("enabled",account.id)) === "1")
        turnOff("La ranura ya no existe. La sincronizacion esta pausada.",true);
      return;
    }
    if (storage.getItem(key("enabled",account.id)) === "1") {
      var rev = Number(storage.getItem(key("revision",account.id)));
      var profile = storage.getItem(key("profile",account.id));
      if (rev === remote.revision && profile === remote.profile_id) {
        knownRevision = rev;
        knownFingerprint = storage.getItem(key("fingerprint",account.id));
        knownProfile = profile;
        enabled = true;
        buttons();
        info("Autoguardado activo. Solo se subiran cambios de esta cuenta y personaje.");
      } else turnOff("La nube cambio desde otro dispositivo. Compara la ranura antes de reactivar.",true);
    } else info("Autoguardado desactivado. Tus respaldos historicos siguen intactos.");
  }
  async function saveCurrent(activate) {
    if (!account) throw new Error("Primero entra en tu cuenta.");
    if (!activate && !enabled) return;
    var userResult = await client.auth.getUser();
    if (userResult.error || !userResult.data.user || userResult.data.user.id !== account.id)
      throw new Error("La sesion ha cambiado. Inicia sesion nuevamente.");
    var current = await getLocal(true);
    var remote = await getRemote();
    display(remote);

    if (!remote) {
      if (!activate && knownRevision !== null) {
        turnOff("Otra sesion elimino la ranura. Se detuvo el autoguardado.",true);
        return;
      }
      var added = await client.from("tm_cloud_saves").insert({
        user_id:account.id, profile_id:current.id, save_version:current.version,
        payload:{raw:current.raw}, fingerprint:current.fingerprint,
        revision:1, verified:false
      }).select("revision,profile_id,fingerprint,updated_at").single();
      if (added.error) {
        turnOff("Conflicto al crear la ranura. Comprueba el guardado remoto.",true);
        throw added.error;
      }
      remember(added.data);
      enabled = true;
      storage.setItem(key("enabled",account.id),"1");
      info("Primer guardado sincronizado: " + current.name + ". El progreso local se conservo.");
      buttons();
      return;
    }
    if (remote.profile_id !== current.id) {
      turnOff("Esta cuenta tiene una ranura de otro personaje. Restáurala antes de activar autoguardado; no se mezclaron partidas.",true);
      return;
    }
    if (activate) {
      if (remote.fingerprint !== current.fingerprint) {
        turnOff("La nube y este movil tienen partidas diferentes. Usa Cargar ranura en este movil para conservar la copia remota; no se sobrescribio nada.",true);
        return;
      }
      remember(remote);
      enabled = true;
      storage.setItem(key("enabled",account.id),"1");
      info("Autoguardado activado para " + current.name + ".");
      buttons();
      return;
    }
    if (knownRevision === null || knownProfile !== current.id) {
      turnOff("Esta sesion no tiene una revision validada. Revisa la ranura antes de guardar.",true);
      return;
    }
    if (remote.revision !== knownRevision) {
      if (remote.fingerprint === current.fingerprint) {
        remember(remote);
        info("La nube ya tiene esta misma partida. Sincronizacion al dia.");
        return;
      }
      turnOff("Otro dispositivo guardo una version nueva. Sincronizacion pausada para evitar sobreescribirla.",true);
      return;
    }
    if (remote.fingerprint === current.fingerprint) {
      remember(remote);
      return;
    }
    var updated = await client.from("tm_cloud_saves").update({
      save_version:current.version, payload:{raw:current.raw},
      fingerprint:current.fingerprint,revision:knownRevision+1
    }).eq("user_id",account.id).eq("revision",knownRevision)
      .select("revision,profile_id,fingerprint,updated_at").maybeSingle();
    if (updated.error || !updated.data) {
      turnOff("Conflicto de versiones. No se ha sobreescrito la nube.",true);
      if (updated.error) throw updated.error;
      return;
    }
    remember(updated.data);
    info("Guardado sincronizado: " + current.name + " | version " + knownRevision + ".");
  }
  async function restoreSlot() {
    if (!account) throw new Error("Primero entra con la cuenta deseada.");
    var room = el("room-chip");
    if (room && !room.hidden) throw new Error("Sal de la sala multijugador antes de restaurar.");
    var remote = await getRemote();
    if (!remote) throw new Error("Esta cuenta no tiene ranura para recuperar.");
    if (!remote.payload || typeof remote.payload.raw !== "string")
      throw new Error("La ranura de la nube no tiene datos validos.");
    var restored = decodeRaw(remote.payload.raw);
    var original = storage.getItem("tm.save");
    var localName = "ninguno";
    if (original) try {localName=decodeRaw(original).name;}catch(_){}
    if (!window.confirm("Recuperar " + restored.name +
      " desde la nube? Se reemplazara el personaje local " + localName +
      ", pero se guardara una copia previa. No se tocara la partida del juego oficial.")) {
      info("Restauracion cancelada; tu personaje local sigue intacto.");
      return;
    }
    if (original !== null) {
      storage.setItem("tm.cloud.slot.pre_restore",original);
      if (storage.getItem("tm.cloud.slot.pre_restore") !== original)
        throw new Error("No se pudo resguardar el personaje actual; restauracion cancelada.");
    }
    el("import-in").value = toBase64(restored.raw);
    el("save-status").textContent = "";
    el("btn-import").click();
    var feedback = String(el("save-status").textContent || "").trim();
    el("import-in").value = "";
    if (feedback !== "Partida cargada.") {
      throw new Error("El juego no confirmo la restauracion: " + (feedback||"sin respuesta"));
    }
    turnOff();
    remember(remote);
    info("Recuperaste " + restored.name + ". Para comenzar a guardar automaticamente, pulsa Activar. Tu partida anterior quedo en el dispositivo.");
  }
  async function operation(callback) {
    if (busy) return;
    busy=true;
    buttons();
    try { await callback(); }
    catch (e) {info(String(e.message||e).slice(0,220),true);}
    finally {busy=false;buttons();}
  }
  el("tm-auto-enable").addEventListener("click",function(){
    operation(function(){return saveCurrent(true);});
  });
  el("tm-auto-stop").addEventListener("click",function(){
    operation(async function(){turnOff("Autoguardado desactivado en este dispositivo. La ranura remota sigue intacta.");});
  });
  el("tm-auto-restore").addEventListener("click",function(){
    operation(restoreSlot);
  });
  el("tm-auto-refresh").addEventListener("click",function(){
    operation(async function(){
      var remote = await getRemote();
      display(remote);
      info("Estado de la ranura actualizado. No se cambio tu partida.");
    });
  });
  client.auth.onAuthStateChange(function(){
    setTimeout(function(){checkAccount().catch(function(e){info(String(e.message||e),true);});},0);
  });
  setInterval(function(){
    if (!enabled || busy || !account) return;
    if (document.visibilityState === "hidden") return;
    var room = el("room-chip");
    if (room && !room.hidden) return;
    operation(function(){return saveCurrent(false);});
  },frequencyMs);
  buttons();
  checkAccount().catch(function(e){info(String(e.message||e),true);});
})();
