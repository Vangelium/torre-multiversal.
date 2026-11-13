/* Torre Multiversal · Rey Slime, primera integración jugable (beta / solo)
 * Un ritual consume diez limos DOMADOS mediante diez ranuras reversibles.
 * Un jefe real participa en combate, perdón crea aliado, derrota otorga arma.
 * No agrega recursos económicos validados, no se activa en cooperativo.
 */
(function (root) {
  'use strict';
  const HUES = Object.freeze(['verde', 'azul', 'rosa']);
  const WEAPONS = Object.freeze([
    'hoja-rey-slime', 'cetro-rey-slime', 'dagas-rey-slime'
  ]);
  const LIMIT = 10;
  const BOSS_ID_MIN = 57000;
  const BOSS_ID_MAX = 57999;
  const $ = id => root.document && root.document.getElementById(id);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+x) ? +x : lo));
  function validPiece(p) {
    if (!p || typeof p !== 'object' || !/^[a-z0-9]{4,16}$/.test(p.uid || '') || !HUES.includes(p.hue)) return null;
    return {uid:p.uid, hue:p.hue, bond:Math.floor(clamp(p.bond,0,50)),
      lv:Math.floor(clamp(p.lv,1,20)), el:Math.floor(clamp(p.el,0,511))};
  }
  function normalize(raw) {
    const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const seen = new Set(), pieces=[];
    for (const p of Array.isArray(o.pieces) ? o.pieces.slice(0,LIMIT) : []) {
      const q=validPiece(p);
      if(q && !seen.has(q.uid)){pieces.push(q);seen.add(q.uid);}
    }
    const r={v:1, pieces, cycle:Math.floor(clamp(o.cycle,0,100000)), stage:'collect', king:null, ally:null, history:[]};
    const rawKing = o.king;
    if (rawKing && typeof rawKing==='object' && HUES.includes(rawKing.hue) && Array.isArray(rawKing.mix) && rawKing.mix.length===3) {
      const mix=rawKing.mix.map(x=>Math.floor(clamp(x,0,LIMIT)));
      if(mix.reduce((a,b)=>a+b,0)===LIMIT){r.king={hue:rawKing.hue, mix,
        level:Math.floor(clamp(rawKing.level,1,20)), seed:Math.floor(clamp(rawKing.seed,1,2147483647)),
        x:clamp(rawKing.x,0,4096), y:clamp(rawKing.y,0,4096),
        world:typeof rawKing.world==='string' && /^(?:valle-alba|sala-pruebas|torre-[1-9][0-9]{0,2})$/.test(rawKing.world) ? rawKing.world : 'valle-alba',
        hp:Math.floor(clamp(rawKing.hp,0,2000)), maxHp:Math.floor(clamp(rawKing.maxHp,1,2000)),
        atk:Math.floor(clamp(rawKing.atk,1,120)), speed:clamp(rawKing.speed,.5,4),
        prism:rawKing.prism===true};
        if(['battle','decision'].includes(o.stage))r.stage=o.stage;
      }
    }
    const ally=o.ally;
    if(ally && typeof ally==='object' && HUES.includes(ally.hue))r.ally={hue:ally.hue,
      mix:Array.isArray(ally.mix) && ally.mix.length===3 ? ally.mix.map(v=>Math.floor(clamp(v,0,10))) : [10,0,0],
      level:Math.floor(clamp(ally.level,1,20)),seed:Math.floor(clamp(ally.seed,1,2147483647)),
      prism:ally.prism===true};
    for(const a of Array.isArray(o.history)?o.history.slice(-12):[]){
      if(a && ['aliado',...WEAPONS].includes(a.reward) && Number.isInteger(a.seed))r.history.push({seed:Math.floor(clamp(a.seed,1,2147483647)),reward:a.reward});
    }
    return r;
  }
  function levelOf(p) {return Math.max(1,Math.min(20,(p.lv||1) + Math.floor((p.bond||0)/12) + (p.el?2:0)));}
  function compose(pieces,seed=1){
    if(!Array.isArray(pieces)||pieces.length!==LIMIT)throw Error('El ritual necesita exactamente diez fragmentos.');
    const ps=pieces.map(validPiece);
    if(ps.some(p=>!p)||new Set(ps.map(p=>p.uid)).size!==LIMIT)throw Error('Los fragmentos deben ser diez slimes distintos.');
    const mix=HUES.map(h=>ps.filter(p=>p.hue===h).length);
    const primary=mix.indexOf(Math.max(...mix));
    const level=Math.min(20,Math.max(1,Math.round(ps.reduce((sum,p)=>sum+levelOf(p),0)/10)));
    const maxHp=Math.min(2000,360+level*28+mix[1]*19);
    const atk=Math.min(120,13+level*3+mix[2]*2);
    const speed=clamp(1.15+mix[2]*.10,1,2.4);
    return {hue:HUES[primary], mix, level, seed:Math.max(1,seed|0), maxHp,hp:maxHp, atk,speed,
      prism:mix.every(n=>n>0)};
  }
  function chooseWeapon(seed){return WEAPONS[Math.abs(seed|0)%WEAPONS.length];}
  function takePiece(state,pets,uid){
    if(state.stage!=='collect')throw Error('El ritual actual ya está en curso.');
    if(state.pieces.length===LIMIT)throw Error('Las diez posiciones están ocupadas.');
    const i=pets.findIndex(p=>p.uid===uid && p.species==='limo' && HUES.includes(p.hue));
    if(i<0)throw Error('Solo puedes colocar slimes que has domesticado.');
    const pet=pets[i];if(state.pieces.some(p=>p.uid===uid))throw Error('Ese slime ya forma parte del ritual.');
    const piece=validPiece({uid:pet.uid,hue:pet.hue,bond:pet.bond||0,lv:pet.lv||1,el:pet.el||0});
    if(!piece)throw Error('Los datos de esta mascota no son válidos.');
    state.pieces.push(piece);pets.splice(i,1);return piece;
  }
  function giveBack(state,pets,index){
    if(state.stage!=='collect')throw Error('No se puede retirar un fragmento después de invocar.');
    if(!Number.isInteger(index)||index<0||index>=state.pieces.length)throw Error('Posición vacía.');
    if(pets.length>=12)throw Error('No hay espacio para devolverlo al inventario de mascotas.');
    const [piece]=state.pieces.splice(index,1);
    pets.push({uid:piece.uid,species:'limo',hue:piece.hue,bond:piece.bond,
      at:Date.now(),hp:100,...piece.el?{el:piece.el}:{}});
    return piece;
  }
  function labels(mix){return HUES.map((h,i)=>`${h}: ${mix[i]}`).join(' · ');}
  function color(h){return h==='azul'?'#57b5f4':h==='rosa'?'#f38cbc':'#83dd67';}
  function renderTex(spec) {
    const c=root.document.createElement('canvas');c.width=c.height=64;
    const g=c.getContext('2d');g.imageSmoothingEnabled=false;
    const raw=spec.hue==='azul'?['#1e3764','#367fc0','#86d7ff']:spec.hue==='rosa'?['#612a58','#bc4e97','#ffd0ed']:['#22462d','#50a354','#ccf79a'];
    // Cuerpo gelatinoso: silueta pixelada, ojos, reflejo, corazón y corona.
    g.fillStyle='#1a1b2e';g.fillRect(6,24,52,26);g.fillRect(10,17,44,35);
    g.fillStyle=raw[0];g.fillRect(8,22,48,29);g.fillRect(12,15,40,36);
    g.fillStyle=raw[1];g.fillRect(11,22,42,25);g.fillRect(14,18,36,30);
    g.fillStyle=raw[2];g.fillRect(15,20,11,8);g.fillRect(15,31,5,5);
    if(spec.prism){g.fillStyle='#ff8cbe';g.fillRect(45,27,7,7);g.fillStyle='#69bdfc';g.fillRect(20,45,11,4);}
    g.fillStyle='#172333';g.fillRect(24,34,6,8);g.fillRect(40,34,6,8);
    g.fillStyle='#fff';g.fillRect(25,35,2,3);g.fillRect(41,35,2,3);
    g.fillStyle='#e9cb5a';g.fillRect(18,7,29,11);g.fillRect(18,4,6,9);g.fillRect(31,1,6,16);g.fillRect(41,4,6,9);
    g.fillStyle='#fff0b3';g.fillRect(20,8,25,2);
    g.fillStyle=spec.prism?'#dc9ffb':'#df515f';g.fillRect(31,11,7,6);
    const t=new root.THREE.CanvasTexture(c);t.magFilter=root.THREE.NearestFilter;t.minFilter=root.THREE.NearestFilter;t.needsUpdate=true;return t;
  }
  function mountUI(){
    const hud=$('hud'),app=$('app')||root.document.body,time=$('time-hud');if(!hud||!time||$('tm-rey-open'))return;
    const btn=root.document.createElement('button');btn.type='button';btn.id='tm-rey-open';btn.className='chip tm-rey-chip';btn.textContent='👑 0/10';btn.setAttribute('aria-label','Abrir ritual del Rey Slime');btn.hidden=true;time.append(btn);
    const panel=root.document.createElement('section');panel.id='tm-rey-panel';panel.className='tm-rey-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Ritual del Rey Slime');panel.hidden=true;
    panel.innerHTML='<div class="tm-rey-window"><header><strong>👑 EL REY SLIME</strong><button type="button" id="tm-rey-close" aria-label="Cerrar ritual">✕</button></header><p id="tm-rey-notice" class="tm-rey-muted">Reúne 10 slimes domesticados.</p><div class="tm-rey-ring" id="tm-rey-ring" role="group" aria-label="Diez posiciones del ritual"></div><p id="tm-rey-details" class="tm-rey-muted"></p><div class="tm-rey-list" id="tm-rey-list"></div><div class="tm-rey-actions"><button type="button" id="tm-rey-summon">Invocar al Rey</button><button type="button" id="tm-rey-pardon" hidden>Perdonar · aliado</button><button type="button" id="tm-rey-finish" hidden>Rematar · arma real</button></div><p class="tm-rey-muted tm-rey-foot">Beta: ritual individual. El multijugador y la economía verificada no intervienen.</p></div>';
    app.append(panel);
    return {btn,panel};
  }
  class KingSlime {
    constructor(app){this.app=app;this.ui=null;this.open=false;this.wasPaused=false;this.actor=null;this.actorWorld=null;this.mesh=null;this.ring=[];this.scene=null;this.texture=null;this.anim=null;this.elapsed=0;this.attackT=0;this.lastSave=0;this.lastUI=0;this.lastStateKey='';this.alive=true;
      this.initUI();this.hook();}
    state(){const p=this.app.saves&&this.app.data&&this.app.data.progress;
      if(!p)return null; if(!p.reySlime)p.reySlime=normalize(null);return p.reySlime;}
    solo(){const e=this.app,s=e.session;return!!(e.mode==='game'&&s&&!s.channel&&!e.trial&&s.state==='playing'&&s.isHost&&s.avatar&&s.world&&!s.isDown(s.self.pid));}
    notice(t,kind='gold'){if(this.app.ui&&this.app.ui.toast)this.app.ui.toast(t,kind,4200);}
    persist(){this.app.saves.markDirty();this.app._saveNow();if(typeof root.__TM_SYNC_NOW__==='function')root.__TM_SYNC_NOW__('king').catch(()=>{});}
    initUI(){if(!root.document)return;const start=()=>{this.ui=mountUI();if(!this.ui)return;this.ui.btn.addEventListener('click',()=>this.toggle(true));$('tm-rey-close').addEventListener('click',()=>this.toggle(false));$('tm-rey-summon').addEventListener('click',()=>this.summon());$('tm-rey-pardon').addEventListener('click',()=>this.resolve(true));$('tm-rey-finish').addEventListener('click',()=>this.resolve(false));$('tm-rey-ring').addEventListener('click',e=>{const b=e.target.closest('button[data-index]');if(b)this.remove(Number(b.dataset.index));});$('tm-rey-list').addEventListener('click',e=>{const b=e.target.closest('button[data-pet]');if(b)this.place(b.dataset.pet);});this.refresh(true);};
      if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
    hook(){const a=this.app,origStep=a._step;const self=this;
      a._step=function(dt){const r=origStep.call(a,dt);self.tick(dt);return r;};
      const origRender=a._render;a._render=function(alpha,ms){const r=origRender.call(a,alpha,ms);if(a.pr&&!a.pr.__tmKingPatched){const pr=a.pr,fn=pr.render;pr.render=function(){self.beforeDraw();return fn.apply(pr,arguments);};pr.__tmKingPatched=true;}return r;};
      const originalTargetFrame=a._targetFrame;a._targetFrame=function(frame){const out=originalTargetFrame.call(a,frame);if(self.actor&&a.session&&a.session.combat&&a.session.combat.targetId===self.actor.id&&a.ui&&!a.ui.isPauseOpen()){const k=self.state().king;a.ui.setTargetFrame({name:'👑 Rey Slime · Nv. '+k.level,hp:Math.max(0,Math.round(self.actor.hp)),maxHp:self.actor.maxHp,opening:self.actor.atk===3,elite:-1});}return out;};
      const origLeave=a.leaveGame;a.leaveGame=function(){self.saveHp();self.closeVisual();return origLeave.apply(a,arguments);};
      root.addEventListener('pagehide',()=>self.saveHp());}
    toggle(yes){if(!this.ui)return;if(yes&&(!this.solo()||$('pause')&&!$('pause').hidden)){this.notice('El ritual solo está disponible durante la partida individual.');return;}
      this.open=!!yes;this.ui.panel.hidden=!yes; if(yes){this.wasPaused=!!(this.app.loop&&this.app.loop.paused);if(this.app.loop)this.app.loop.paused=true;}else if(this.app.loop&&!this.wasPaused)this.app.loop.paused=false;
      this.refresh(true);}
    place(uid){if(!this.solo())return;const p=this.app.data.progress,s=this.state();try{takePiece(s,p.companions,uid);p.party=(p.party||[]).filter(x=>x!==uid);p.companion=p.party[0]||null;this.app._applyParty(true);this.app._renderCompanions();this.persist();this.refresh(true);}catch(e){this.notice(e.message,'bad');}}
    remove(index){const p=this.app.data.progress,s=this.state();if(!s)return;try{giveBack(s,p.companions,index);this.app._renderCompanions();this.persist();this.refresh(true);}catch(e){this.notice(e.message,'bad');}}
    spawnPoint(){const a=this.app,t=a.session.avatar,candidates=[[2.8,0],[2,2.2],[-2,2.2],[0,3.2],[-2.4,0],[0,-2.8]];
      for(const [dx,dy] of candidates){let x=t.x+dx,y=t.y+dy,z=a.terrain.surfaceAt(x,y);if(Number.isFinite(z)&&Math.abs(z-t.z)<.25)return {x,y};}return{x:t.x,y:t.y};}
    summon(){if(!this.solo())return;const s=this.state();if(!s||s.stage!=='collect'||s.pieces.length!==LIMIT){this.notice('Coloca 10 slimes diferentes antes de invocar.');return;}
      if(!root.confirm('Los diez slimes se fusionarán y NO podrán recuperarse por separado. ¿Iniciar el ritual?'))return;
      const seed=1+(Math.floor(Date.now()/1000)+s.cycle*8191)%2147483645;const boss=compose(s.pieces,seed),p=this.spawnPoint();
      Object.assign(boss,{x:p.x,y:p.y,world:this.app.terrain.id});const consumed=s.pieces.map(q=>({...q}));s.king=boss;s.stage='battle';s.pieces=[];s.cycle++;this.anim={t:0,x:p.x,y:p.y,boss,pieces:consumed};this.persist();this.toggle(false);this.notice('Los diez fragmentos se reúnen… La corona despierta.', 'gold');}
    saveHp(){const s=this.state();if(s&&s.stage==='battle'&&s.king&&this.actor&&!this.actor.dead){s.king.hp=Math.max(1,Math.round(this.actor.hp));this.app.saves.markDirty();}}
    tick(dt){this.elapsed+=dt;if(!this.app.data||!this.app.view||!this.app.pr)return;const s=this.state();if(!s)return;
      if(!this.solo()){if(this.actor){this.closeActor();}this.hideVisual();this.refresh();return;}
      if(s.stage==='battle'&&s.king&&s.king.world===this.app.terrain.id){
        if(this.anim){this.anim.t+=dt;if(this.anim.t>=4.2){this.anim=null;this.ensureActor();this.notice('¡EL REY SLIME HA DESPERTADO! Ataca y esquiva.','gold');}}
        else {this.ensureActor();const e=this.actor;if(e){if(e.dead||e.hp<=0){s.king.hp=0;s.stage='decision';this.closeActor();this.persist();this.notice('El Rey Slime cayó. Tú decides su destino.','good');this.toggle(true);}else if(this.elapsed-this.lastSave>3){this.lastSave=this.elapsed;this.saveHp();}}}
      }else this.closeActor();
      this.stepAlly(dt,s);
      this.refresh();}
    ensureActor(){const a=this.app,t=a.session,s=this.state();if(!s||!s.king||!t||!t.world)return;
      if(this.actor&&this.actorWorld===t.world&&t.world.entities.includes(this.actor))return;
      this.closeActor();const w=t.world,k=s.king,ids=new Set(w.entities.map(e=>e.id));let id=BOSS_ID_MIN;while(ids.has(id)&&id<=BOSS_ID_MAX)id++;if(id>BOSS_ID_MAX){this.notice('No hay un identificador libre para el Rey Slime.','bad');return;}
      const foe={name:'Rey Slime',hp:k.maxHp,chase:k.speed,attack:{kind:'embestida',range:1.9,windup:.9,lunge:2.5,lungeTime:.35,hitR:1.2,dmg:k.atk,cd:2.6}};
      const rand={range:(lo,hi)=>lo+(hi-lo)*Math.random(),fork:()=>rand};
      const x=k.x,y=k.y,z=a.terrain.surfaceAt(x,y),actor={id,kind:1,species:'limo',hue:k.hue,royal:true,foe,slot:false,r:.85,homeX:x,homeY:y,x,y,z:Number.isFinite(z)?z:t.avatar.z,
        px:x,py:y,pz:Number.isFinite(z)?z:t.avatar.z,facing:0,moving:false,animT:0,tp:0,state:0,timer:.5,tx:x,ty:y,rng:rand,
        maxHp:k.maxHp,hp:k.hp>0?k.hp:k.maxHp,mul:2+k.level*.28,gen:0,dead:false,deadT:0,ag:t.self.pid,agT:0,stagger:0,kbx:0,kby:0,kbT:0,poise:0,
        threat:new Map([[t.self.pid,10]]),atk:0,atkT:0,atkCd:1,aimX:0,aimY:0,lvx:0,lvy:0,hitSet:new Set()};
      // Los jefes no pueden domesticarse por el sistema normal; el perdón es una decisión posterior a la victoria.
      if(w.tame&&!w.tame.__tmKingGuard){const orig=w.tame.control;w.tame.control=function(e){if(e&&e.royal)return false;return orig.apply(this,arguments);};w.tame.__tmKingGuard=true;}
      w.entities.push(actor);this.actor=actor;this.actorWorld=w;
      if(t.combat)t.combat.targetId=id;
    }
    closeActor(){if(this.actorWorld&&this.actor){this.actorWorld.entities=this.actorWorld.entities.filter(e=>e!==this.actor);if(this.app.view&&this.app.view.entityVis){const vis=this.app.view.entityVis.get(this.actor.id);if(vis){vis.sprite.visible=false;if(vis.shadow)vis.shadow.visible=false;}}}
      this.actor=null;this.actorWorld=null;}
    resolve(pardon){if(!this.solo())return;const s=this.state();if(!s||s.stage!=='decision'||!s.king)return;const king=s.king;
      if(pardon){if(s.ally&&!root.confirm('Ya te acompaña un Rey Slime. ¿Permitir que el nuevo tome su lugar?'))return;
        s.ally={hue:king.hue,mix:king.mix.slice(),level:king.level,seed:king.seed,prism:king.prism};s.history.push({seed:king.seed,reward:'aliado'});this.notice('El Rey Slime reconoce tu misericordia. ¡Ahora te protege!','good');}
      else {const id=chooseWeapon(king.seed),gear=this.app.data.profile.gear;
        if(!gear||!Array.isArray(gear.items)||gear.items.length>=60){this.notice('Inventario lleno. Libera espacio para recibir el arma del Rey.','bad');return;}
        gear.items.push({u:gear.next++,i:id,d:0});s.history.push({seed:king.seed,reward:id});this.notice('¡Arma real conseguida! Revisa tu equipamiento.','good');
        if(this.app.gearScreen)this.app.gearScreen.refresh();}
      s.history=s.history.slice(-12);s.stage='collect';s.king=null;this.closeActor();this.persist();this.toggle(false);this.refresh(true);}
    stepAlly(dt,s){if(!s.ally)return;const t=this.app.session;
      if(!t||!t.avatar||!t.world)return;
      this.attackT-=dt;
      // El aliado es autónomo y usa la misma ruta de daño de compañeros que las mascotas normales.
      if(this.attackT>0)return;
      const p=t.avatar,enemies=t.world.entities.filter(e=>!e.ally&&!e.dead&&!e.royal&&e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<4);
      enemies.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
      if(enemies.length){const foe=enemies[0],dmg=8+s.ally.level*2;const hit=t.companionHit(foe,dmg,p.x,p.y,{element:s.ally.prism?'arcano':null});if(hit&&hit.ok){this.attackT=2.25;this.lastAllyAttack=this.elapsed;}}}
    closeVisual(){if(this.scene){if(this.mesh)this.scene.remove(this.mesh);for(const m of this.ring)this.scene.remove(m);}
      if(this.mesh){this.mesh.geometry.dispose();if(this.mesh.material.map)this.mesh.material.map.dispose();this.mesh.material.dispose();}this.mesh=null;for(const m of this.ring){m.geometry.dispose();if(m.material.map)m.material.map.dispose();m.material.dispose();}this.ring=[];if(this.texture)this.texture.dispose();this.texture=null;this.scene=null;}
    hideVisual(){if(this.mesh)this.mesh.visible=false;for(const m of this.ring)m.visible=false;}
    renderMesh(spec,size,alpha=1){const tex=renderTex(spec),mat=new root.THREE.MeshBasicMaterial({map:tex,alphaTest:.06,transparent:true,depthWrite:false,side:root.THREE.DoubleSide,opacity:alpha}),mesh=new root.THREE.Mesh(new root.THREE.PlaneGeometry(size,size),mat);mesh.renderOrder=4;mesh.userData.kingTex=tex;return mesh;}
    beforeDraw(){const a=this.app,s=this.state();if(!s||!a.view||!a.session||a.session.channel||a.mode!=='game')return this.hideVisual();
      if(this.scene!==a.view.scene){this.closeVisual();this.scene=a.view.scene;}
      let spec=null,pos=null,size=3.1;
      if(s.stage==='battle'&&s.king&&s.king.world===a.terrain.id){spec=s.king;pos=this.actor||s.king;size=3.3;
        if(this.actor){const v=a.view.entityVis.get(this.actor.id);if(v){v.sprite.visible=false;if(v.shadow)v.shadow.visible=false;}}}
      else if(s.ally&&a.session.avatar){spec=s.ally;const p=a.session.avatar;pos={x:p.x-1.4,y:p.y+1.3,z:p.z};size=1.8;}
      if(!spec||!pos){this.hideVisual();return;}
      const signature=[spec.hue,spec.prism,spec.seed,size].join('|');
      if(!this.mesh||this.mesh.userData.key!==signature){this.closeVisual();this.scene=a.view.scene;this.mesh=this.renderMesh(spec,size);this.mesh.userData.key=signature;this.scene.add(this.mesh);}
      const z=Number.isFinite(pos.z)?pos.z:a.terrain.surfaceAt(pos.x,pos.y);let x=pos.x,y=pos.y;
      const anim=this.anim&&s.stage==='battle'?this.anim:null;
      if(anim){const t=clamp(anim.t/4.2,0,1);const scale=.25+.75*t;this.mesh.scale.set(scale,scale,1);
        this.mesh.material.opacity=t<.45?.08:(t-.45)/.55;
        if(!this.ring.length){for(let i=0;i<LIMIT;i++){const m=this.renderMesh({hue:anim.pieces[i].hue,prism:false},.78);this.scene.add(m);this.ring.push(m);}}
        for(let i=0;i<this.ring.length;i++){const angle=i*Math.PI*2/LIMIT,rad=2.2*(1-t);const p=this.ring[i];p.visible=true;p.position.set(x+Math.cos(angle)*rad,(z||0)+.55+Math.sin(t*Math.PI)*.8,(z||0)-(y+Math.sin(angle)*rad)+.06);p.scale.setScalar(Math.max(.04,1-t));p.material.opacity=1-t;}
      } else {this.mesh.scale.set(1+Math.sin(this.elapsed*3)*.035,1+Math.cos(this.elapsed*4)*.035,1);this.mesh.material.opacity=1;for(const p of this.ring)p.visible=false;}
      this.mesh.visible=true;this.mesh.position.set(x,(z||0)+size*.46+Math.sin(this.elapsed*2)*.045,(z||0)-y+.09);}
    refresh(force=false){if(!this.ui||!this.app.saves||!this.app.saves.data)return;const s=this.state();if(!s)return;
      if(!force&&this.elapsed-this.lastUI<.3)return;this.lastUI=this.elapsed;
      const usable=this.solo(),btn=this.ui.btn;btn.hidden=!usable;btn.textContent=s.stage==='collect'?`👑 ${s.pieces.length}/10`:s.stage==='decision'?'👑 Elegir':'👑 ¡Rey!';
      if(!this.open&&!force){if(s.stage==='decision'&&usable)this.toggle(true);return;}
      $('tm-rey-notice').textContent=s.stage==='battle'?'¡El Rey Slime está en el mundo! Enfréntalo con tus ataques.':s.stage==='decision'?'Lo has derrotado. Decide si será aliado o dará un arma.':s.pieces.length===10?'Diez posiciones completas: el ritual está listo.':'Coloca diez slimes domesticados. Puedes retirarlos antes de invocar.';
      $('tm-rey-details').textContent=s.king?`Nivel ${s.king.level} · ${labels(s.king.mix)} · Vida ${this.actor?Math.ceil(this.actor.hp):s.king.hp}/${s.king.maxHp}`:`Fragmentos: ${s.pieces.length}/10 · ${s.ally?'Un Rey Slime ya te acompaña.':''}`;
      const ring=$('tm-rey-ring');ring.textContent='';for(let i=0;i<LIMIT;i++){
        const p=s.pieces[i],b=root.document.createElement('button');b.type='button';b.className='tm-rey-slot';b.dataset.index=i;b.disabled=!p||s.stage!=='collect';b.textContent=p?'●':String(i+1);b.style.setProperty('--slime-color',p?color(p.hue):'#556275');b.title=p?`${p.hue} · vínculo ${p.bond} · tocar para devolver`:`Posición ${i+1}`;b.setAttribute('aria-label',b.title);ring.append(b);}
      const list=$('tm-rey-list');list.textContent='';if(s.stage==='collect'){
        const pets=(this.app.data.progress.companions||[]).filter(p=>p.species==='limo'&&HUES.includes(p.hue));
        if(!pets.length){const t=root.document.createElement('p');t.className='tm-rey-muted';t.textContent='Domestica slimes verdes, azules o rosados para reunir los diez fragmentos.';list.append(t);}
        for(const p of pets){const b=root.document.createElement('button');b.type='button';b.className='tm-rey-pet';b.dataset.pet=p.uid;b.disabled=s.pieces.length>=LIMIT;b.textContent=`● ${p.name||'Limo '+p.hue} · Vínculo ${p.bond||0} · Colocar`;b.style.setProperty('--slime-color',color(p.hue));list.append(b);}
      }
      $('tm-rey-summon').hidden=s.stage!=='collect';$('tm-rey-summon').disabled=s.pieces.length!==LIMIT||!usable;
      $('tm-rey-pardon').hidden=s.stage!=='decision';$('tm-rey-finish').hidden=s.stage!=='decision';
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={LIMIT,HUES,WEAPONS,normalize,validPiece,compose,chooseWeapon,takePiece,giveBack};
  if(root.document)root.__TM_REY_INSTALL__=function(app){try{root.__TM_REY_CONTROLLER__=new KingSlime(app);}catch(e){console.error('Rey Slime beta:',e);}};
})(typeof window!=='undefined'?window:globalThis);
