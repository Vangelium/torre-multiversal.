import json, sys
import harness
from harness import *
results=[]
def check(name, ok, info=""):
    results.append((name,bool(ok),info)); print(("PASA " if ok else "FALLA")+" | "+name+(" | "+str(info)[:220] if info else ""),flush=True)
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 8770
srv.start(PORT); harness.BASE="http://localhost:%d/beta/"%PORT
sb=FakeSupabase(); session=sb.add_user(UID,"yonnah@prueba.cl")
raw=open("seed_raw.json").read(); pid=json.loads(raw)["data"]["profile"]["id"]
row=lambda: sb.row(UID,pid)
cloudpos=lambda: json.loads(row()["payload"]["raw"])["data"]["progress"]["solo"]
def resume(ph):
    if not ph.pg.evaluate("document.getElementById('pause').hidden"):
        ph.pg.click("#tabbtn-game"); ph.pg.click("#btn-resume"); ph.pg.wait_for_timeout(300)
def wait_cloud(cond,sec=12,ph=None):
    t=time.time()
    while time.time()-t<sec:
        if cond(): return True
        (ph.pg.wait_for_timeout(300) if ph else time.sleep(.3))
    return cond()
with sync_playwright() as p:
    b=p.chromium.launch(args=ARGS)
    A=Phone(b,sb,"A",session)
    A.pg.goto("http://localhost:%d/beta/README.md"%PORT); fp=fingerprint_in(A.pg,raw)
    sb.tables["tm_character_saves"].append({"user_id":UID,"profile_id":pid,"revision":1,"payload":{"raw":raw},"fingerprint":fp,"save_version":19,"verified":False,"updated_at":"2026-11-12T10:00:00.000Z"})
    # 1
    A.open(); A.play_first()
    s=A.wait_state(lambda s:s["state"]=="saved")
    check("1. A entra y el guardado automático ya está activo", s["state"]=="saved", s)
    c=A.chip(); check("1. Indicador visible «Guardado»", c and not c["hidden"] and c["kind"]=="saved", c)
    A.pg.screenshot(path="t_A1.png")
    # 2
    r0=row()["revision"]; A.walk("ArrowRight",1600); A.walk("ArrowDown",800); posA=A.export()["data"]["progress"]["solo"]
    A.pg.click("#btn-pause")
    ok=wait_cloud(lambda: row()["revision"]>r0 and cloudpos()==posA, ph=A)
    check("2. A camina y al pausar la nube recibe su posición", ok, (r0,row()["revision"]))
    A.pg.click("#tabbtn-save"); A.pg.wait_for_timeout(400); A.pg.screenshot(path="t_A2_cuenta.png"); resume(A)
    # 3
    B=Phone(b,sb,"B",session); B.open(); B.play_first()
    check("3. B abre el personaje justo donde lo dejó A", B.export()["data"]["progress"]["solo"]==posA)
    s=B.wait_state(lambda s:s["state"]=="saved"); check("3. B queda al día sin conflicto", s["state"]=="saved", s)
    # 4
    r1=row()["revision"]; B.walk("ArrowLeft",1500); posB=B.export()["data"]["progress"]["solo"]
    B.hide(); ok=wait_cloud(lambda: row()["revision"]>r1 and cloudpos()==posB, ph=B)
    check("4. B minimiza el navegador y se guarda solo", ok, (r1,row()["revision"])); B.show()
    # 5
    r2=row()["revision"]
    A.hide(); A.pg.wait_for_timeout(300); A.show()
    s=A.wait_state(lambda s:s["state"]=="newer",12)
    check("5. A (quieto) detecta progreso más nuevo de otro celular", s["state"]=="newer", s)
    c=A.chip(); check("5. Indicador corto «Revisar» que explica el motivo al tocarlo", c["label"]=="Revisar" and "más nuevo" in c["aria"], c)
    A.pg.screenshot(path="t_A5_nueva.png")
    A.pg.evaluate("window.__TM_SYNC_NOW__('manual')"); A.pg.wait_for_timeout(1500)
    check("5. A no sobrescribe la nube", row()["revision"]==r2 and cloudpos()==posB)
    # 6
    A.pg.click("#tm-save-chip"); A.pg.wait_for_timeout(2500)
    shown=A.pg.evaluate("!document.getElementById('tm-char-conflict-results').hidden")
    check("6. Tocar el aviso abre Cuenta y compara las versiones", shown)
    A.pg.screenshot(path="t_A6_comparar.png")
    A.pg.click("#tm-char-conflict-use-cloud"); A.pg.wait_for_timeout(3500)
    hud=A.pg.evaluate("!document.getElementById('hud').hidden && document.getElementById('pause').hidden")
    check("6. Tras «Recuperar nube» A vuelve a jugar solo", hud)
    check("6. A queda exactamente con el progreso de B", A.export()["data"]["progress"]["solo"]==posB, A.export()["data"]["progress"]["solo"])
    s=A.wait_state(lambda s:s["state"]=="saved",12)
    check("6. Guardado automático sigue activo, sin reactivar nada", s["state"]=="saved", s)
    check("6. La nube conserva la posición de B", cloudpos()==posB)
    check("6. Se respaldaron ambas versiones en el historial", len(sb.tables["tm_legacy_backups"])==2, len(sb.tables["tm_legacy_backups"]))
    # 7
    r3=row()["revision"]; A.pg.wait_for_timeout(5000); A.pg.click("#btn-pause"); A.pg.wait_for_timeout(2000); A.hide(); A.pg.wait_for_timeout(1500); A.show()
    check("7. Un celular encendido pero sin jugar NO sube versiones", row()["revision"]==r3, (r3,row()["revision"]))
    resume(A); A.wait_state(lambda s:s["state"]=="saved",8)
    # 8
    A.walk("ArrowUp",1200)
    r4=row()["revision"]; B.walk("ArrowRight",1200); B.pg.click("#btn-pause")
    wait_cloud(lambda: row()["revision"]>r4, ph=B); fpB=row()["fingerprint"]; rB=row()["revision"]
    resume(B)
    A.pg.click("#btn-pause"); s=A.wait_state(lambda s:s["state"]=="conflict",10)
    check("8. Ambos juegan: A detecta conflicto y NO pisa a B", s["state"]=="conflict" and row()["fingerprint"]==fpB and row()["revision"]==rB, s)
    check("8. Indicador «Revisar»", A.chip()["label"]=="Revisar", A.chip())
    resume(A)
    # 9
    B.ctx.set_offline(True); sb.offline.add("B")
    r5=row()["revision"]; B.walk("ArrowDown",1200); posB9=B.export()["data"]["progress"]["solo"]; B.pg.click("#btn-pause")
    s=B.wait_state(lambda s:s["state"]=="offline",10)
    check("9. Sin internet: avisa «Sin conexión» y no rompe nada", s["state"]=="offline" and row()["revision"]==r5, s)
    B.pg.screenshot(path="t_B9_offline.png")
    sb.offline.discard("B"); B.ctx.set_offline(False)
    ok=wait_cloud(lambda: row()["revision"]>r5 and cloudpos()==posB9, ph=B)
    check("9. Vuelve internet: sube solo lo pendiente", ok, B.state())
    # 10
    B.pg.click("#tabbtn-save"); B.pg.wait_for_timeout(300); B.pg.click("#tm-char-sync-off"); B.pg.wait_for_timeout(500)
    r6=row()["revision"]; resume(B); B.walk("ArrowLeft",900); posB10=B.export()["data"]["progress"]["solo"]
    B.pg.click("#btn-pause"); B.pg.wait_for_timeout(1800)
    check("10. Si el jugador lo pausa, no se sube nada", row()["revision"]==r6, B.state())
    check("10. Indicador «Pausado»", B.chip()["kind"]=="paused", B.chip())
    B.pg.click("#tabbtn-save"); B.pg.wait_for_timeout(200); B.pg.click("#tm-char-sync-on")
    ok=wait_cloud(lambda: row()["revision"]>r6 and cloudpos()==posB10, ph=B)
    check("10. Al reanudarlo sube lo pendiente", ok, B.state())
    # 11
    check("11. Juego oficial intacto en A", A.official_untouched())
    check("11. Juego oficial intacto en B", B.official_untouched())
    check("11. Nube: siempre verified=false", all(r["verified"] is False for r in sb.tables["tm_character_saves"]))
    check("11. Nube: un solo registro del personaje", len(sb.tables["tm_character_saves"])==1)
    errs=[e for e in A.errs+B.errs if not any(k in e for k in ("fonts","ERR_INTERNET_DISCONNECTED","Failed to load resource","WebSocket","ERR_NAME_NOT_RESOLVED"))]
    check("11. Sin errores de JavaScript", not errs, errs[:5])
    b.close()
f=[r for r in results if not r[1]]
print("\nRESUMEN: %d pruebas · %d pasan · %d fallan"%(len(results),len(results)-len(f),len(f)))
