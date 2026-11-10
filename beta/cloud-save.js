/* Torre Multiversal: copias personales en la nube, fase beta.
 * No participa en Supabase Realtime, combate, ni economia autoritativa.
 * El JSON legacy se conserva como cadena: jsonb reordena propiedades,
 * y el checksum heredado depende del orden original.
 */
(function () {
  "use strict";
  var client = window.__TM_CLOUD_CLIENT__;
  var root = document.getElementById("tm-cloud");
  if (!client || !root) return;

  var el = function (id) { return document.getElementById(id); };
  var authPanel = el("tm-cloud-auth");
  var readyPanel = el("tm-cloud-ready");
  var accountLabel = el("tm-cloud-account");
  var statusNode = el("tm-cloud-status");
  var listNode = el("tm-cloud-list");
  var localStorage = window.__TM_BETA_STORAGE__ || { getItem: function () { throw new Error("Almacenamiento beta no disponible"); }, setItem: function () { throw new Error("Almacenamiento beta no disponible"); } };
  var activeUser = null;
  var backupDetails = new Map();
  var busy = false;
  var passwordRecoveryMode = false;

  function announce(message, isError) {
    statusNode.textContent = message;
    statusNode.dataset.state = isError ? "error" : "ok";
  }
  function lock(value) {
    busy = value;
    root.querySelectorAll("button").forEach(function (btn) {
      btn.disabled = value || ((btn.id === "tm-cloud-restore" || btn.id === "tm-cloud-delete") && !listNode.value);
    });
  }
  function errorMessage(err) {
    if (!err) return "Error desconocido.";
    var s = String(err.message || err);
    if (/rate.?limit|429/i.test(s)) return "Demasiados intentos. Espera antes de repetir.";
    if (/invalid login credentials|invalid credentials|invalid_grant/i.test(s)) return "Correo o contraseña incorrectos. En otro móvil debes pulsar Entrar, no Crear cuenta. También puedes recuperar tu contraseña.";
    if (/user already registered|already been registered/i.test(s)) return "Ese correo ya está registrado. Pulsa Entrar, no Crear cuenta.";
    if (/email not confirmed/i.test(s)) return "Primero confirma tu correo con el enlace de Supabase.";
    if (/backup quota exceeded|maximum 20/i.test(s)) return "Alcanzaste el límite de 20 copias. Elimina una antigua antes de crear otra.";
    return s.slice(0, 230);
  }
  function checksum(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function decodeExport(code) {
    if (typeof code !== "string" || code.slice(0, 4) !== "TM1:") {
      throw new Error("No se generó un código de partida válido.");
    }
    var binary = atob(code.slice(4).replace(/\s+/g, ""));
    var bytes = Uint8Array.from(binary, function (c) { return c.charCodeAt(0); });
    var raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    var parsed = JSON.parse(raw);
    validateEnvelope(parsed);
    return { raw: raw, save: parsed };
  }
  function validateEnvelope(env) {
    if (!env || env.fmt !== "tm" || !Number.isInteger(env.v) || env.v < 0 ||
        env.v > 99 || !env.data || typeof env.data !== "object" ||
        !env.data.profile || !env.data.progress ||
        !Number.isInteger(env.sum) ||
        checksum(JSON.stringify(env.data)) !== env.sum) {
      throw new Error("El respaldo no tiene un formato ni una suma de verificación válidos.");
    }
    return env;
  }
  function encodeImport(raw) {
    var bytes = new TextEncoder().encode(raw);
    var bin = "";
    for (var i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return "TM1:" + btoa(bin);
  }
  function makeFingerprint(raw) {
    var data = new TextEncoder().encode(raw);
    return crypto.subtle.digest("SHA-256", data).then(function (hash) {
      return "sha256:" + Array.from(new Uint8Array(hash)).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }
  function isCoopActive() {
    var room = el("room-chip");
    return !!(room && !room.hidden);
  }
  async function withBusy(fn) {
    if (busy) return;
    lock(true);
    try { await fn(); }
    catch (err) { announce(errorMessage(err), true); }
    finally { lock(false); }
  }
  async function refreshAuth() {
    var result = await client.auth.getSession();
    if (result.error) throw result.error;
    if (!result.data.session) {
      activeUser = null;
    } else {
      var userResult = await client.auth.getUser();
      if (userResult.error) throw userResult.error;
      activeUser = userResult.data.user;
    }
    authPanel.hidden = !!activeUser;
    readyPanel.hidden = !activeUser;
    if (activeUser) {
      var local = localSummary();
      accountLabel.textContent = "Cuenta conectada: " + (activeUser.email || "Cuenta temporal") +
        " | Personaje en este celular: " + (local && local.valid ? local.name + " (" + local.xp + " XP)" : "ninguno");
      await loadBackups();
    } else {
      listNode.replaceChildren();
      backupDetails.clear();
      updateSelection();
      announce("No has iniciado sesión. Tu partida local sigue intacta.");
    }
  }
  function summaryOf(raw) {
    try {
      var envelope = validateEnvelope(JSON.parse(raw));
      var profile = envelope.data.profile || {};
      var progress = envelope.data.progress || {};
      return {
        id: String(profile.id || ""),
        name: String(profile.name || "Viajero").slice(0, 40),
        xp: Number.isFinite(Number(profile.xp)) ? Math.max(0, Math.floor(Number(profile.xp))) : 0,
        pets: Array.isArray(progress.companions) ? progress.companions.length : 0,
        valid: true
      };
    } catch (_) { return {id: "", name: "Copia dañada", xp: 0, pets: 0, valid: false}; }
  }
  function localSummary() {
    try {
      var raw = localStorage.getItem("tm.save");
      return raw ? summaryOf(raw) : null;
    } catch (_) { return null; }
  }
  function updateSelection() {
    var selection = listNode.value;
    el("tm-cloud-restore").disabled = busy || !selection;
    el("tm-cloud-delete").disabled = busy || !selection;
    var item = backupDetails.get(selection);
    if (!item) {
      el("tm-cloud-selected").textContent = "Selecciona una copia para ver su personaje antes de restaurarla.";
      return;
    }
    var current = localSummary();
    el("tm-cloud-selected").textContent = !item.valid
      ? "Esta copia tiene errores de formato. No la restaures."
      : "Copia: " + item.name + ", " + item.xp + " XP, " + item.pets + " mascotas. " +
        (current && current.valid && current.id !== item.id
          ? "Aviso: reemplazará el personaje local " + current.name + "."
          : "La partida de este celular no cambia hasta que pulses Restaurar.");
  }
  async function loadBackups() {
    if (!activeUser) return;
    var result = await client.from("tm_legacy_backups")
      .select("id,created_at,save_version,origin,verified,payload")
      .order("created_at", {ascending: false}).limit(20);
    if (result.error) throw result.error;
    listNode.replaceChildren();
    backupDetails.clear();
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleccionar personaje y fecha…";
    listNode.appendChild(placeholder);
    var rows = result.data || [];
    rows.forEach(function (item) {
      var details = summaryOf(item.payload && item.payload.raw);
      backupDetails.set(item.id, details);
      var option = document.createElement("option");
      option.value = item.id;
      var time = new Date(item.created_at);
      var when = Number.isNaN(time.getTime()) ? "Fecha desconocida" : time.toLocaleString("es-CL");
      option.textContent = details.valid
        ? details.name + " · " + details.xp + " XP · " + details.pets + " mascotas · " + when
        : "Copia no válida · " + when;
      listNode.appendChild(option);
    });
    listNode.value = "";
    updateSelection();
    if (!rows.length) announce("Esta cuenta no tiene copias. En el móvil donde está el personaje, inicia sesión y pulsa Respaldar partida actual.");
    else announce("Hay " + rows.length + " copias en esta cuenta. Elige una por nombre, XP y mascotas. Iniciar sesión no cambia la partida local.");
  }
  async function signIn(mode) {
    await withBusy(async function () {
      var email = el("tm-cloud-email").value.trim();
      var password = el("tm-cloud-password").value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
        throw new Error("Introduce un correo válido y una contraseña de al menos 8 caracteres.");
      }
      var result = mode === "register"
        ? await client.auth.signUp({
            email: email,
            password: password,
            options: { emailRedirectTo: location.origin + location.pathname }
          })
        : await client.auth.signInWithPassword({ email: email, password: password });
      if (result.error) throw result.error;
      el("tm-cloud-password").value = "";
      if (result.data.session) {
        await refreshAuth();
        announce("Sesión iniciada. El personaje de este móvil sigue local; selecciona Restaurar copia para traer otro, o Respaldar partida actual para enviarlo a la nube.");
      } else {
        announce("Revisa tu correo para confirmar la cuenta. El enlace debe volver a esta pagina.");
      }
    });
  }
  async function backup() {
    await withBusy(async function () {
      if (!activeUser) throw new Error("Inicia sesión primero.");
      var user = await client.auth.getUser();
      if (user.error || !user.data.user || user.data.user.id !== activeUser.id) {
        throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      }
      // Usa el exportador EXISTENTE: guarda la posicion actual y calcula el checksum.
      var exportButton = el("btn-export");
      var out = el("export-out");
      exportButton.click();
      var result = decodeExport(out.value);
      var payload = { raw: result.raw };
      // Comparar con JSON final para no superar el CHECK SQL de 1 MiB.
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 1000000) {
        throw new Error("La copia supera el limite beta de 1 MB. Usa el codigo local.");
      }
      var newProfile = summaryOf(result.raw);
      var mismatched = [...backupDetails.values()].some(function (item) {
        return item.valid && item.id && item.id !== newProfile.id;
      });
      if (mismatched && !window.confirm(
          "Atención: esta cuenta ya tiene copias de otro personaje. ¿Quieres guardar también " +
          newProfile.name + " (" + newProfile.xp + " XP)? No cambies de correo por error.")) {
        announce("Respaldo cancelado. Cambia a la cuenta correcta antes de subir esta partida.");
        return;
      }
      var name = String(result.save.data.profile.name || "Viajero").slice(0, 40);
      var profileId = String(result.save.data.profile.id || "").slice(0, 60);
      var up = await client.from("tm_players").upsert({
        user_id: activeUser.id,
        display_name: name || "Viajero",
        legacy_profile_id: profileId || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (up.error) throw up.error;
      var hash = await makeFingerprint(JSON.stringify(result.save.data));
      var saved = await client.from("tm_legacy_backups").insert({
        user_id: activeUser.id,
        import_key: hash,
        save_format: "tm",
        save_version: result.save.v,
        payload: payload,
        origin: "github_pages"
      });
      if (saved.error && saved.error.code !== "23505") throw saved.error;
      await loadBackups();
      announce(saved.error
        ? "Esta versión de la partida ya tiene una copia en tu cuenta."
        : "Respaldo creado. El progreso local se conserva intacto.");
    });
  }
  async function restore() {
    await withBusy(async function () {
      if (!activeUser) throw new Error("Inicia sesión primero.");
      if (isCoopActive()) {
        throw new Error("Sal de la sala multijugador antes de restaurar una partida.");
      }
      var id = listNode.value;
      if (!id) throw new Error("No seleccionaste ningún respaldo.");
      var q = await client.from("tm_legacy_backups")
        .select("payload,save_version,created_at")
        .eq("id", id).single();
      if (q.error) throw q.error;
      var raw = q.data && q.data.payload && q.data.payload.raw;
      if (typeof raw !== "string") throw new Error("El respaldo no conserva su contenido original.");
      validateEnvelope(JSON.parse(raw));
      var choice = summaryOf(raw);
      if (!choice.valid) throw new Error("La copia está dañada; no se restauró nada.");
      var local = localSummary();
      var message = "Cuenta: " + activeUser.email + "\nCopia elegida: " +
        choice.name + " · " + choice.xp + " XP · " + choice.pets + " mascotas.\n" +
        "Personaje actual del móvil: " + (local && local.valid ? local.name + " (" + local.xp + " XP)" : "ninguno") +
        ".\n¿Reemplazar la partida de este dispositivo? Se guardará antes una copia local.";
      if (!window.confirm(message)) {
        announce("Restauración cancelada. Tu partida no cambió.");
        return;
      }
      var current = localStorage.getItem("tm.save");
      // No proceder si el navegador no puede preservar el guardado previo.
      if (current !== null) {
        localStorage.setItem("tm.cloud.pre_restore", current);
        if (localStorage.getItem("tm.cloud.pre_restore") !== current) {
          throw new Error("No se pudo proteger la partida actual. No se hizo la restauración.");
        }
      }
      el("import-in").value = encodeImport(raw);
      el("save-status").textContent = "";
      el("btn-import").click();
      var feedback = (el("save-status").textContent || "").trim();
      if (feedback !== "Partida cargada.") {
        throw new Error("No se pudo restaurar la partida: " + (feedback || "el importador no confirmó el resultado."));
      }
      el("import-in").value = "";
      announce("Restaurado: " + choice.name + " (" + choice.xp + " XP, " + choice.pets + " mascotas). La partida anterior quedó respaldada en este móvil.");
      await loadBackups();
      updateSelection();
    });
  }

  async function deleteBackup() {
    await withBusy(async function () {
      if (!activeUser) throw new Error("Inicia sesión primero.");
      var id = listNode.value;
      if (!id) throw new Error("No seleccionaste ningún respaldo.");
      if (!window.confirm("¿Eliminar esta copia de tu cuenta? No podrás recuperarla de Supabase. Tu progreso local no se borrará.")) {
        announce("Eliminación cancelada. No cambió ningún respaldo.");
        return;
      }
      var result = await client.from("tm_legacy_backups").delete().eq("id", id);
      if (result.error) throw result.error;
      await loadBackups();
      announce("Copia eliminada. Tu guardado local no cambió.");
    });
  }

  async function requestPasswordRecovery() {
    await withBusy(async function () {
      var email = el("tm-cloud-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Escribe primero el correo registrado.");
      var response = await client.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
      if (response.error) throw response.error;
      announce("Si existe una cuenta con ese correo, llegará un enlace para cambiar la contraseña. Ábrelo en este dispositivo y vuelve a la beta.");
    });
  }
  async function updatePassword() {
    await withBusy(async function () {
      var newPassword = el("tm-cloud-new-password").value;
      if (newPassword.length < 8) throw new Error("La contraseña nueva necesita al menos 8 caracteres.");
      var res = await client.auth.updateUser({password: newPassword});
      if (res.error) throw res.error;
      passwordRecoveryMode = false;
      el("tm-cloud-reset-panel").hidden = true;
      el("tm-cloud-new-password").value = "";
      announce("Contraseña actualizada. Ya puedes entrar con esa cuenta desde otro móvil.");
      await refreshAuth();
    });
  }

  el("tm-cloud-list").addEventListener("change", updateSelection);
  el("tm-cloud-forgot").addEventListener("click", requestPasswordRecovery);
  el("tm-cloud-update-password").addEventListener("click", updatePassword);
  el("tm-cloud-login").addEventListener("click", function () { signIn("login"); });
  el("tm-cloud-register").addEventListener("click", function () { signIn("register"); });
  el("tm-cloud-backup").addEventListener("click", backup);
  el("tm-cloud-refresh").addEventListener("click", function () {
    withBusy(async function () { await loadBackups(); announce("Lista actualizada."); });
  });
  el("tm-cloud-restore").addEventListener("click", restore);
  el("tm-cloud-delete").addEventListener("click", deleteBackup);
  el("tm-cloud-signout").addEventListener("click", function () {
    withBusy(async function () {
      var result = await client.auth.signOut();
      if (result.error) throw result.error;
      activeUser = null;
      await refreshAuth();
      announce("Sesión cerrada. Tu guardado local no se ha modificado.");
    });
  });
  client.auth.onAuthStateChange(function (event) {
    if (event === "PASSWORD_RECOVERY") {
      passwordRecoveryMode = true;
      el("tm-cloud-reset-panel").hidden = false;
      announce("Enlace de recuperación recibido. Escribe una nueva contraseña y pulsa Guardar contraseña.");
    }
    // Llamar a getUser dentro del callback puede bloquear el lock de Auth.
    setTimeout(function () {
      refreshAuth().then(function () {
        if (passwordRecoveryMode) {
          el("tm-cloud-reset-panel").hidden = false;
          announce("Enlace de recuperación recibido. Escribe y guarda tu nueva contraseña.");
        }
      }).catch(function (e) { announce(errorMessage(e), true); });
    }, 0);
  });
  refreshAuth().catch(function (e) { announce(errorMessage(e), true); });
})();
