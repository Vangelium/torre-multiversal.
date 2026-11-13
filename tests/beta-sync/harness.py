import json, time
from playwright.sync_api import sync_playwright
from fakesupa import FakeSupabase, URL
import srv
BASE="http://localhost:8765/beta/"
ARGS=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
UID="11111111-1111-4111-8111-111111111111"

class Phone:
    def __init__(self, browser, sb, name, session):
        self.name=name; self.sb=sb; self.errs=[]
        self.ctx=browser.new_context(viewport={"width":412,"height":860},is_mobile=True,has_touch=True,bypass_csp=True)
        self.ctx.route(URL+"/**",lambda r: sb.handle(r,name))
        self.ctx.route("https://fonts.**",lambda r: r.abort())
        self.ctx.add_init_script("""(()=>{try{if(!localStorage.getItem('tm.beta.cloud.auth.v1'))
          localStorage.setItem('tm.beta.cloud.auth.v1',%s);localStorage.setItem('tm.beta.v1.initialized','1')}catch(e){}})()"""%json.dumps(json.dumps(session)))
        self.pg=self.ctx.new_page()
        self.pg.on("pageerror",lambda e: self.errs.append("pageerror: "+str(e)))
        self.pg.on("console",lambda m: self.errs.append("console: "+m.text) if m.type=="error" else None)
        self.pg.on("dialog",lambda d: d.accept())
    def open(self):
        self.pg.goto(BASE)
        self.pg.wait_for_function("document.getElementById('boot').hidden",timeout=90000)
        self.pg.wait_for_function("document.querySelectorAll('#tm-entry-list .tm-entry-mainbtn').length>0",timeout=30000)
    def play_first(self):
        self.pg.click("#tm-entry-list .tm-entry-mainbtn")
        self.pg.wait_for_function("!document.getElementById('hud').hidden",timeout=30000)
        self.wait_state(lambda s: s["state"] in ("saved","saving","newer","conflict","error"),20)
    def state(self):
        return self.pg.evaluate("window.__TM_SYNC_STATE__&&window.__TM_SYNC_STATE__()")
    def wait_state(self, cond, sec=15):
        t=time.time()
        while time.time()-t<sec:
            s=self.state()
            if s and cond(s): return s
            self.pg.wait_for_timeout(300)
        return self.state()
    def export(self):
        raw=self.pg.evaluate("""()=>{document.getElementById('btn-export').click();const c=document.getElementById('export-out').value;
          document.getElementById('export-out').value='';const bin=atob(c.slice(4));return new TextDecoder().decode(Uint8Array.from(bin,x=>x.charCodeAt(0)))}""")
        return json.loads(raw)
    def walk(self, key="ArrowRight", ms=1400):
        self.pg.keyboard.down(key); self.pg.wait_for_timeout(ms); self.pg.keyboard.up(key); self.pg.wait_for_timeout(300)
    def chip(self):
        return self.pg.evaluate("""()=>{const c=document.getElementById('tm-save-chip');return c?{hidden:c.hidden,kind:c.dataset.kind,label:c.querySelector('.tm-save-label').textContent,aria:c.getAttribute('aria-label')}:null}""")
    def official_untouched(self):
        return self.pg.evaluate("localStorage.getItem('tm.save')===null&&localStorage.getItem('tm.save.bak')===null")
    def hide(self):
        self.pg.evaluate("""()=>{Object.defineProperty(document,'visibilityState',{get:()=> 'hidden',configurable:true});
           document.dispatchEvent(new Event('visibilitychange'))}""")
    def show(self):
        self.pg.evaluate("""()=>{Object.defineProperty(document,'visibilityState',{get:()=> 'visible',configurable:true});
           document.dispatchEvent(new Event('visibilitychange'))}""")

def fingerprint_in(page, raw):
    return page.evaluate("""async raw=>{const d=JSON.parse(raw).data;const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(d)));
       return 'sha256:'+[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}""", raw)
