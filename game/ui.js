'use strict';
/* Castle Siege: settings, sound, music, input, panels */
const $=id=>document.getElementById(id);
let mode=null, speed=1, running=false, prevSpeed=1;

/* ---------- settings (kept in this browser) ---------- */
/* computers start in 3D; phones start in the lighter 2D map */
const SETTINGS_DEF={master:.8,music:.55,sfx:.8,amb:.5,scroll:1,edge:false,autosave:3,bars:'hurt',fps:false,view:matchMedia('(pointer: coarse)').matches?'2d':'3d'};
const SETTINGS={...SETTINGS_DEF};
try{ Object.assign(SETTINGS,JSON.parse(localStorage.getItem('cs-settings')||'{}')); }catch(e){}
function saveSettings(){ try{ localStorage.setItem('cs-settings',JSON.stringify(SETTINGS)); }catch(e){} applyVolumes(); }

/* ---------- sound: recorded effects with a synthesized fallback ---------- */
const AU={c:null,out:null,m:null,mus:null,amb:null,nb:null,on:true,music:true,last:{},next:0,step:0,buf:{},loading:false};
function audioInit(){
  if(AU.c){ if(AU.c.state==='suspended') AU.c.resume().catch(()=>{}); return; }
  try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    AU.c=new AC(); AU.out=AU.c.createGain(); AU.out.connect(AU.c.destination);
    AU.m=AU.c.createGain(); AU.m.connect(AU.out); AU.mus=AU.c.createGain(); AU.mus.connect(AU.out); AU.amb=AU.c.createGain(); AU.amb.connect(AU.out);
    applyVolumes();
    const len=AU.c.sampleRate; AU.nb=AU.c.createBuffer(1,len,AU.c.sampleRate); const d=AU.nb.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
    loadSfx();
  }catch(e){ AU.c=null; }
}
function applyVolumes(){ if(!AU.c) return; const t=AU.c.currentTime, k=SETTINGS.master;
  AU.out.gain.setTargetAtTime(Math.pow(k,1.5),t,.05); AU.m.gain.setTargetAtTime(Math.pow(SETTINGS.sfx,1.5)*.9,t,.05);
  AU.mus.gain.setTargetAtTime(Math.pow(SETTINGS.music,1.5)*.8,t,.2); AU.amb.gain.setTargetAtTime(Math.pow(SETTINGS.amb,1.5)*.5,t,.2); if(typeof Music!=='undefined') Music.relevel(); }
const SFX_FILES={arrow:3,hit:3,thunk:2,smash:2,thump:2,coin:2,build:3,collapse:1,chain:1,trap:1,oil:1,horn:1,recruit:1,deny:1,cheer:1,launch:1,ambient:1};
/* the single-file build carries its sounds inside the page */
function asset(p){ return (window.ASSETS&&window.ASSETS[p])||p; }
async function fetchBuf(path){ const r=await fetch(asset(path)); if(!r.ok) throw new Error(path); const a=await r.arrayBuffer(); return await new Promise((ok,no)=>AU.c.decodeAudioData(a,ok,no)); }
function loadSfx(){
  if(AU.loading||!AU.c) return; AU.loading=true;
  if(location.protocol==='file:'&&!window.ASSETS){ AU.fileMode=true; return; }   // pages opened from disk cannot fetch, so effects play as plain audio
  for(const [k,n] of Object.entries(SFX_FILES)) for(let i=0;i<n;i++){ const f=n>1?`${k}${i}`:k;
    fetchBuf(`sfx/${f}.mp3`).then(b=>{ (AU.buf[k]=AU.buf[k]||[]).push(b); if(k==='ambient') Ambience.ready(); }).catch(()=>{}); }
  for(const k of ['victory','defeat']) fetchBuf(`music/${k}.mp3`).then(b=>{ AU.buf[k]=[b]; }).catch(()=>{});
}
function playFile(path,vol){ try{ const a=new Audio(asset(path)); a.volume=Math.max(0,Math.min(1,vol)); a.play().catch(()=>{}); return a; }catch(e){ return null; } }
function sfxVol(){ return Math.pow(SETTINGS.master,1.5)*Math.pow(SETTINGS.sfx,1.5)*.9; }
function playBuf(list,gain,pan,rate,dest){
  const b=list[(Math.random()*list.length)|0], s=AU.c.createBufferSource(); s.buffer=b; s.playbackRate.value=rate||1;
  const g=AU.c.createGain(); g.gain.value=gain; let n=s; n.connect(g); n=g;
  if(pan&&AU.c.createStereoPanner){ const p=AU.c.createStereoPanner(); p.pan.value=Math.max(-1,Math.min(1,pan)); n.connect(p); n=p; }
  n.connect(dest||AU.m); s.start(); return s;
}
function noise(t0,dur,type,freq,q,gain){const s=AU.c.createBufferSource(); s.buffer=AU.nb; const f=AU.c.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q; const g=AU.c.createGain(); g.gain.setValueAtTime(gain,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur); s.connect(f); f.connect(g); g.connect(AU.m); s.start(t0,Math.random()*.5); s.stop(t0+dur+.03);}
function tone(t0,dur,type,f0,f1,gain,dest){const o=AU.c.createOscillator(); o.type=type; o.frequency.setValueAtTime(f0,t0); if(f1) o.frequency.exponentialRampToValueAtTime(f1,t0+dur); const g=AU.c.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(gain,t0+Math.min(.02,dur/4)); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur); o.connect(g); g.connect(dest||AU.m); o.start(t0); o.stop(t0+dur+.05);}
const GAP={arrow:.06,hit:.06,thunk:.05,smash:.1,collapse:.25,build:.07,horn:2,chain:.4,recruit:.1,deny:.2,win:1,lose:1,trap:.1,thump:.15,oil:.3,coin:.08,cheer:2,launch:.15};
const SFX_GAIN={arrow:.35,hit:.42,thunk:.3,smash:.7,collapse:.85,build:.45,horn:.75,chain:.6,recruit:.6,deny:.55,trap:.6,thump:.75,oil:.6,coin:.5,cheer:.55,launch:.55};
const SFX_ALIAS={win:'cheer'};
function sfx(name,x,y){
  if(!AU.on||!AU.c||AU.c.state!=='running'||(G&&G.attract)) return;
  const now=AU.c.currentTime;
  if(AU.last[name]!==undefined && now-AU.last[name]<(GAP[name]||.05)) return; AU.last[name]=now;
  let v=1, pan=0; if(x!==undefined&&G&&!G.editor){const s=w2s(x,y); if(s.x<-60||s.y<-60||s.x>VW+60||s.y>VH+60) v=.2; else { pan=(s.x/VW-.5)*1.2; v=.55+.45*Math.min(1,cam.z); } }
  const key=SFX_ALIAS[name]||name, list=AU.buf[key];
  if(AU.fileMode&&SFX_FILES[key]&&key!=='ambient'){ const n=SFX_FILES[key]; playFile(`sfx/${n>1?key+((Math.random()*n)|0):key}.mp3`,(SFX_GAIN[key]||.5)*v*sfxVol()); return; }
  if(list&&list.length){ try{ playBuf(list,(SFX_GAIN[key]||.5)*v,pan,.93+Math.random()*.14); }catch(e){} return; }
  sfxSynth(name,v);
}
function sfxSynth(name,v){
  const t=AU.c.currentTime+.005;
  try{ switch(name){
    case 'arrow': noise(t,.07,'bandpass',2600+Math.random()*800,1.5,.1*v); break;
    case 'hit': noise(t,.09,'lowpass',900,1,.25*v); tone(t,.08,'sine',140,70,.15*v); break;
    case 'thunk': noise(t,.05,'lowpass',700,1,.2*v); break;
    case 'smash': noise(t,.16,'lowpass',520,1,.3*v); tone(t,.12,'triangle',90,50,.18*v); break;
    case 'collapse': noise(t,.7,'lowpass',380,.7,.5*v); tone(t,.5,'sine',70,35,.28*v); break;
    case 'trap': noise(t,.12,'bandpass',1200,2,.3*v); tone(t,.1,'square',200,80,.08*v); break;
    case 'thump': tone(t,.18,'sine',90,40,.3*v); noise(t,.12,'lowpass',300,1,.2*v); break;
    case 'oil': noise(t,.5,'bandpass',600,1,.25*v); break;
    case 'launch': noise(t,.3,'bandpass',500,1,.2*v); break;
    case 'coin': tone(t,.06,'triangle',1200,null,.08); tone(t+.05,.08,'triangle',1600,null,.08); break;
    case 'build': tone(t,.12,'sine',220,110,.28*v); noise(t,.05,'highpass',3000,1,.07*v); break;
    case 'horn': for(const f of [110,165,111.3]){ const o=AU.c.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(f*.94,t); o.frequency.linearRampToValueAtTime(f,t+.25); const lp=AU.c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=700; const g=AU.c.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.1,t+.2); g.gain.setValueAtTime(.1,t+1.1); g.gain.exponentialRampToValueAtTime(.0001,t+1.6); o.connect(lp); lp.connect(g); g.connect(AU.m); o.start(t); o.stop(t+1.7);} break;
    case 'chain': for(let k=0;k<9;k++) noise(t+k*.09,.05,'bandpass',1800+Math.random()*900,4,.1); tone(t,.9,'triangle',60,45,.14); break;
    case 'recruit': tone(t,.09,'triangle',440,null,.13); tone(t+.09,.14,'triangle',660,null,.13); break;
    case 'deny': tone(t,.12,'square',150,120,.05); break;
    case 'win': case 'cheer': [262,330,392,523].forEach((f,i)=>tone(t+i*.15,.9,'triangle',f,null,.14)); break;
    case 'lose': [220,207,196,147].forEach((f,i)=>tone(t+i*.25,1,'sawtooth',f,null,.04)); break;
  } }catch(e){}
}

/* ---------- music: a written score that turns to war when the fighting starts ---------- */
const Music={
  el:[null,null], g:[null,null], lvl:[0,0], cur:-1, mood:null, list:[], idx:0, failed:false, calm:0, heat:0, wa:location.protocol!=='file:',
  LISTS:{menu:['title'],peace:['market','dusk'],battle:['battle1','battle2']},
  init(){
    if(this.el[0]||!AU.c) return;
    for(let i=0;i<2;i++){ const a=new Audio(); a.preload='auto';
      a.addEventListener('ended',()=>{ if(i===this.cur) this.next(); });
      a.addEventListener('error',()=>{ if(i===this.cur&&a.getAttribute('src')){ this.failed=true; } });
      this.el[i]=a;
      if(this.wa){ try{ const src=AU.c.createMediaElementSource(a), g=AU.c.createGain(); g.gain.value=0; src.connect(g); g.connect(AU.mus); this.g[i]=g; }catch(e){ this.wa=false; } }
      if(!this.wa) a.volume=0; }
  },
  /* fade one player to a level, through the mixer when we can, by hand when we cannot */
  fade(i,to,sec){
    this.lvl[i]=to;
    if(this.wa){ const g=this.g[i].gain, t=AU.c.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(to,t+sec); return; }
    const a=this.el[i], from=a.volume, t0=performance.now(), tgt=to*this.elemLevel();
    clearInterval(a._f); a._f=setInterval(()=>{ const k=Math.min(1,(performance.now()-t0)/(sec*1000)); a.volume=Math.max(0,Math.min(1,from+(tgt-from)*k)); if(k>=1) clearInterval(a._f); },50);
  },
  elemLevel(){ return Math.pow(SETTINGS.master,1.5)*Math.pow(SETTINGS.music,1.5)*.8; },
  relevel(){ if(this.wa) return; for(let i=0;i<2;i++) if(this.el[i]){ clearInterval(this.el[i]._f); this.el[i].volume=Math.min(1,this.lvl[i]*this.elemLevel()); } },
  set(mood){
    if(!AU.c||mood===this.mood) return; this.init(); this.mood=mood; this.list=this.LISTS[mood]; this.idx=(Math.random()*this.list.length)|0; this.play(this.list[this.idx],mood==='battle'?1.2:2.5);
  },
  next(){ if(!this.list.length) return; this.idx=(this.idx+1)%this.list.length; const m=this.mood; setTimeout(()=>{ if(this.mood===m) this.play(this.list[this.idx],1.5); }, m==='battle'?200:2500); },
  play(name,fade){
    if(!AU.music) return;
    const nxt=this.cur===0?1:0, old=this.cur;
    if(old>=0){ this.fade(old,0,fade); const e=this.el[old]; setTimeout(()=>{ if(this.cur!==old) e.pause(); },fade*1000+120); }
    const a=this.el[nxt]; a.src=asset(`music/${name}.mp3`); try{ a.currentTime=0; }catch(e){} a.play().catch(()=>{});
    this.fade(nxt,1,fade); this.cur=nxt;
  },
  stop(fade){ if(!AU.c) return; for(let i=0;i<2;i++){ if(!this.el[i]) continue; this.fade(i,0,fade||1); const e=this.el[i]; setTimeout(()=>e.pause(),(fade||1)*1000+120); } this.mood=null; this.cur=-1; },
  sting(name){ this.stop(.6); if(!AU.music) return; const b=AU.buf[name];
    if(b) setTimeout(()=>playBuf(b,.9,0,1,AU.mus),350); else if(AU.fileMode) setTimeout(()=>playFile(`music/${name}.mp3`,this.elemLevel()),350); else sfxSynth(name==='victory'?'win':'lose',1); },
  /* how hard is the fighting right now? */
  tick(dt){
    if(!AU.c||!AU.music||!G||G.editor) return;
    if(G.attract){ this.set('menu'); return; }
    if(G.over) return;
    let heat=0; const mine=G.units.filter(u=>u.team===0&&u.def.mil&&!u.dead);
    for(const e of G.units){ if(e.team!==1||e.dead||e.def.beast) continue; for(const m of mine){ if(Math.abs(m.x-e.x)<9&&Math.abs(m.y-e.y)<9){ heat++; break; } } if(heat>=6) break; }
    if(mine.some(u=>u.storming||u.stormAfter)) heat+=4;
    this.heat=heat;
    if(heat>=4){ this.calm=0; if(this.mood!=='battle') this.set('battle'); }
    else { this.calm+=dt; if(this.mood!=='peace'&&(this.mood!=='battle'||this.calm>14)) this.set('peace'); }
  }
};
function musicTick(dt){
  if(!AU.c||AU.c.state!=='running') return;
  if(!Music.failed){ Music.tick(dt||0); Ambience.tick(); return; }
  if(!AU.music) return;
  const now=AU.c.currentTime; if(AU.next<now) AU.next=now+.1;
  while(AU.next<now+.6){
    const s=AU.step++, ph=PHR[Math.floor(s/8)%PHR.length], n=ph[s%8], t=AU.next, beat=.62;
    if(n>=0) pluck(t,ROOT*Math.pow(2,MEL[n]/12),.5);
    if(s%8===0){ tone(t,beat*7.5,'sine',ROOT/2,null,.22,AU.mus); tone(t,beat*7.5,'sine',ROOT*.75,null,.1,AU.mus); }
    AU.next+=beat;
  }
}
/* fallback tune if the score cannot be loaded */
const MEL=[0,2,3,5,7,9,10,12,14,15], ROOT=146.83;
const PHR=[[7,5,3,2,0,-1,2,3],[4,3,2,0,2,-1,0,-1],[0,2,4,5,4,2,3,-1],[5,4,3,2,1,2,0,-1]];
function pluck(t,f,g){ const o=AU.c.createOscillator(), o2=AU.c.createOscillator(), gn=AU.c.createGain(), lp=AU.c.createBiquadFilter(); o.type='triangle'; o2.type='sine'; o.frequency.value=f; o2.frequency.value=f*2.003; lp.type='lowpass'; lp.frequency.setValueAtTime(2400,t); lp.frequency.exponentialRampToValueAtTime(500,t+1.2);
  gn.gain.setValueAtTime(.0001,t); gn.gain.exponentialRampToValueAtTime(g,t+.01); gn.gain.exponentialRampToValueAtTime(.0001,t+1.8); o.connect(lp); o2.connect(lp); lp.connect(gn); gn.connect(AU.mus); o.start(t); o2.start(t); o.stop(t+1.9); o2.stop(t+1.9); }
/* birdsong and wind under the game, never in the menus */
const Ambience={src:null,g:null,on:false,
  ready(){},
  tick(){ const want=!!(G&&!G.attract&&!G.editor&&!G.over&&running); if(want===this.on) return; this.on=want;
    if(AU.fileMode){ if(want){ if(!this.el){ this.el=new Audio(asset('sfx/ambient.mp3')); this.el.loop=true; } this.el.volume=Math.min(1,Math.pow(SETTINGS.master,1.5)*Math.pow(SETTINGS.amb,1.5)*.5); this.el.play().catch(()=>{}); } else if(this.el) this.el.pause(); return; }
    const b=AU.buf.ambient; if(!b) { this.on=false; return; }
    const t=AU.c.currentTime;
    if(want){ const s=AU.c.createBufferSource(); s.buffer=b[0]; s.loop=true; const g=AU.c.createGain(); g.gain.value=0; s.connect(g); g.connect(AU.amb); s.start(); g.gain.linearRampToValueAtTime(1,t+3); this.src=s; this.g=g; }
    else if(this.src){ const s=this.src, g=this.g; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value,t); g.gain.linearRampToValueAtTime(0,t+1.5); setTimeout(()=>{ try{s.stop();}catch(e){} },1700); this.src=null; }
  }};
function setMusic(on){ AU.music=on; audioInit(); if(!on) Music.stop(.8); else { Music.mood=null; } try{localStorage.setItem('hm-music',on?'on':'off');}catch(e){} syncSound(); }
function syncSound(){ document.querySelectorAll('.soundBtn').forEach(b=>b.textContent=AU.on?'Sound on':'Sound off'); document.querySelectorAll('.musicBtn').forEach(b=>b.textContent=AU.music?'Music on':'Music off'); }
try{ if(localStorage.getItem('hm-sound')==='off') AU.on=false; if(localStorage.getItem('hm-music')==='off') AU.music=false; }catch(e){}

/* ---------- messages ---------- */
function toast(msg,kind){
  if(G&&G.attract) return;
  const box=$('toasts');
  if(box.lastChild && box.lastChild.textContent===msg && box.lastChild.style.opacity!=='0') return;
  const el=document.createElement('div'); el.className='toast'+(kind?' '+kind:''); el.textContent=msg;
  box.appendChild(el); while(box.children.length>3) box.firstChild.remove();
  setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),450);},kind==='big'?4200:3000);
}
function say(key,msg,kind,cool){ if(!G) return; const t=G.lastSay[key]; if(t!==undefined && G.time-t<cool) return; G.lastSay[key]=G.time; toast(msg,kind); }

/* ---------- selection and commands ---------- */
let drag=null, pinch=null, lastUnitClick={k:null,t:0}, lastSquad={n:0,t:0};
const pointers=new Map();
function unitAt(w,team){
  let best=null,bd=.6*.6;
  for(const u of G.units){ if(u.team!==team) continue; if(team===0&&!u.def.mil) continue; const e=(V3&&V3.on)?0:(u.el?.19:0); const dx=u.x-w.x,dy=u.y-e-w.y,d=dx*dx+dy*dy; const r=u.def.big?.9:.6; if(d<r*r&&d<bd+.3){bd=d;best=u;} }
  return best;
}
function selected(){return G.units.filter(u=>u.sel&&!u.dead);}
function clearSel(){for(const u of G.units)u.sel=false;}
const PLURAL={lord:'your lord',archer:'archers',xbow:'crossbowmen',spearman:'spearmen',pikeman:'pikemen',maceman:'macemen',swordsman:'swordsmen',knight:'knights',monk:'monks',engineer:'engineers',pladder:'laddermen',pram:'rams',ptower:'siege towers',pcatapult:'catapults',ptreb:'trebuchets'};
function describe(list){
  const c={}; for(const u of list) c[u.kind]=(c[u.kind]||0)+1;
  return Object.entries(c).map(([k,n])=>k==='lord'?'your lord':n===1?`1 ${UD[k].name.toLowerCase()}`:`${n} ${PLURAL[k]||k}`).join(', ');
}
function onScreen(u){ const s=w2s(u.x,u.y); return s.x>=0&&s.y>=0&&s.x<=VW&&s.y<=VH; }
function selectVisible(kind){ clearSel(); for(const u of G.units) if(u.kind===kind&&u.team===0&&onScreen(u)) u.sel=true; G.selB=null; G.selE=null; updateInfo(); }
function assignSquad(n){
  const sel=selected(); if(!sel.length){toast('Select troops first, then save them as a squad');return;}
  for(const u of G.units) if(u.squad===n && !u.sel) u.squad=0;
  for(const u of sel) u.squad=n;
  toast(`Squad ${n}: ${describe(sel)}`); updateInfo();
}
function selectSquad(n){
  const us=G.units.filter(u=>u.squad===n&&!u.dead);
  if(!us.length){toast(`Squad ${n} is empty. Select troops and press Shift+${n} to fill it.`);return;}
  clearSel(); us.forEach(u=>u.sel=true); G.selB=null; G.selE=null;
  const now=performance.now();
  if(lastSquad.n===n && now-lastSquad.t<450) centerOn(us.reduce((s,u)=>s+u.x,0)/us.length, us.reduce((s,u)=>s+u.y,0)/us.length);
  lastSquad={n,t:now}; updateInfo();
}
function freeTileNear(x,y){
  const ok=(tx_,ty_)=>{ if(!inb(tx_,ty_)) return false; const i=idx(tx_,ty_), t=ter[i], b=occB[i]; return !(t===2||t===5||t===4) && !(b&&!b.def.trap&&!(b.team===1&&pWalk[i])); };
  if(ok(x|0,y|0)) return {x,y};
  for(let r=1;r<5;r++) for(let j=-r;j<=r;j++) for(let i=-r;i<=r;i++){ if(Math.max(Math.abs(i),Math.abs(j))!==r) continue; if(ok((x|0)+i,(y|0)+j)) return {x:(x|0)+i+.5,y:(y|0)+j+.5}; }
  return {x,y};
}
function moatNear(tx_,ty_,n){
  const out=[]; for(let r=0;r<5&&out.length<n;r++) for(let j=-r;j<=r;j++) for(let i=-r;i<=r;i++){ if(Math.max(Math.abs(i),Math.abs(j))!==r) continue; const x=tx_+i,y=ty_+j; if(inb(x,y)&&ter[idx(x,y)]===7&&!G.units.some(u=>u.fill===idx(x,y))) out.push(idx(x,y)); }
  return out.slice(0,n);
}
/* is this click aimed at an enemy castle? Its walls, its keep, its yard, a defender on its walls, or the ground right at its foot */
function seatFor(b){ if(!b) return null; if(b.def.isKeep||b.type==='epavilion') return b; const ai=aiByOwner(b.owner); if(ai&&ai.alive&&ai.keep&&!ai.keep.dead) return ai.keep; return nearestSeat(b.x+b.w/2,b.y+b.h/2); }
function castleTargetAt(w,eu,eb){
  const castleB=b=>b&&b.team===1&&!b.dead&&!b.def.trap&&(b.def.castle||b.def.isKeep||b.def.enemy);
  if(castleB(eb)) return {seat:seatFor(eb)||eb, bld:eb};
  let near=null,nd=1e9; for(const b of G.blds){ if(!castleB(b)) continue; const d=rectDist(w.x,w.y,b); if(d<nd){nd=d;near=b;} }
  if(!near) return null;
  if(eu && (eu.el>0 || nd<4)) return {seat:seatFor(near), bld:null};
  if(nd<=2.5) return {seat:seatFor(near), bld:null};
  if(nd<14 && insideMask()[tileOf(w.x,w.y)]) return {seat:seatFor(near), bld:null};
  return null;
}
function resetOrders(u){ u.goal=null; u.pdest=null; u.path=null; u.post=null; u.forceT=null; u.forceB=null; u.autoB=null; u.chase=null; u.breach=null; u.tgt=null; u.storming=false; u.storm=null; u.pace=0; u.stormAfter=null; u.assaultId=0; if(!u.def.eng) u.fill=undefined; }
/* every unit takes the job it is built for */
function orderAssault(sel,T,w){
  sel=sel.filter(u=>!u.def.cart); if(!sel.length) return false;
  const seat=T.seat, focus=T.bld;
  if(G.formation==='siege' && seat){ formedAssault(sel,seat); return true; }
  for(const u of sel){ resetOrders(u); u.stance='attack'; u.storming=true; u.hold={x:u.x,y:u.y};
    const d=u.def;
    if(focus){
      if(d.pladder&&(focus.def.wallish||focus.def.towerish)) u.forceB=focus;
      else if((d.ram||u.kind==='pram')&&focus.def.castle) u.forceB=focus;
      else if(d.stower&&focus.def.wallish) u.forceB=focus;
      else if(d.artillery) u.forceB=focus;
    }
    u.storm=(focus&&d.melee&&u.kind!=='lord')?focus:seat; }
  const ai=seat?aiByOwner(seat.owner):null;
  toast(ai?`Attack ${ai.name}'s castle!`:'Attack!','big'); sfx('horn');
  G.moveMark={x:w.x,y:w.y,t:1,atk:true}; updateInfo(); return true;
}
function commandMove(w){
  let sel=selected(); if(!sel.length) return false;
  const eu=unitAt(w,1), eb=bAt(w.x|0,w.y|0);
  const CT=castleTargetAt(w,eu,eb);
  if(CT) return orderAssault(sel,CT,w);
  if(eu || (eb&&eb.team===1&&!pWalk[tileOf(w.x,w.y)])){
    let note='';
    for(const u of sel){ u.goal=null; u.pdest=null; u.post=null; u.fill=undefined; u.autoB=null; u.chase=null; u.breach=null; u.storming=false; u.storm=null;
      const stormer=!eu && u.stance==='attack' && (u.def.melee||u.def.ranged);
      if(stormer){ u.storming=true; u.storm=eb; u.forceB=null; u.forceT=null; }
      else if(eu){u.forceT=eu;u.forceB=null;} else {u.forceB=eb;u.forceT=null;} u.hold={x:u.x,y:u.y};
      if(eb&&u.def.pladder&&!eb.def.wallish&&!eb.def.towerish) note='Ladders go against walls and towers.';
      if(eb&&u.def.stower&&(eb.def.isKeep||!eb.def.castle)) note='Siege towers dock against walls and towers.'; }
    if(note) toast(note,'warn');
    G.moveMark={x:w.x,y:w.y,t:1,atk:true}; updateInfo(); return true;
  }
  const tx_=Math.floor(w.x), ty_=Math.floor(w.y), tb=eb;
  if(inb(tx_,ty_)&&ter[idx(tx_,ty_)]===7){
    const engs=sel.filter(u=>u.kind==='engineer'); if(engs.length){ const tiles=moatNear(tx_,ty_,engs.length); engs.forEach((u,k)=>{ if(tiles[k]!==undefined){ u.goal=null; u.post=null; u.fill=tiles[k]; u.t=0; } }); sel=sel.filter(u=>u.fill===undefined||u.kind!=='engineer'); toast(`${engs.length>1?'Engineers are':'An engineer is'} filling the moat`); if(!sel.length){ G.moveMark={x:w.x,y:w.y,t:1}; return true; } }
  }
  sel.forEach(u=>{u.post=null;});
  const rank=u=>u.def.melee?0:u.def.ranged?1:2;
  let rest=sel.slice().sort((a,b)=>rank(a)-rank(b) || Math.hypot(a.x-w.x,a.y-w.y)-Math.hypot(b.x-w.x,b.y-w.y));
  if(tb && tb.def.cap && tb.team===0){
    const archersFirst=rest.slice().sort((a,b)=>(b.def.ranged?1:0)-(a.def.ranged?1:0));
    const free=freeSlots(tb); rest=[];
    for(const u of archersFirst){ if(free.length&&!u.def.big) postTo(u,tb,free.shift()); else rest.push(u); }
    if(rest.length) toast(`The ${tb.def.name.toLowerCase()} holds ${tb.def.cap}. The rest wait nearby.`);
  }
  if(rest.length){
    const up = tb && tb.def.castle && !tb.def.isKeep && (tb.team===0 || pWalk[tileOf(w.x,w.y)]);
    let pts=null;
    if(!up && G.formation==='siege'){
      const c=groupCenter(rest); let dir={x:w.x-c.x,y:w.y-c.y}; const L=Math.hypot(dir.x,dir.y); if(L<.5){ const S=nearestSeat(c.x,c.y); dir=S?{x:S.x-c.x,y:S.y-c.y}:{x:1,y:0}; }
      const L2=Math.hypot(dir.x,dir.y)||1; dir={x:dir.x/L2,y:dir.y/L2};
      marchInFormation(rest,{x:w.x,y:w.y},dir,null); rest=[];
    } else if(up || G.formation==='box'){
      let cand=groundSpots(tx_,ty_,rest.length,up);
      if(up && cand.length<rest.length) cand=cand.concat(groundSpots(tx_,ty_,rest.length-cand.length,false));
      pts=rest.map((u,k)=>{const c=cand[k]||cand[cand.length-1]; return {x:c.x+.5,y:c.y+.5};});
    } else {
      const cx=rest.reduce((s,u)=>s+u.x,0)/rest.length, cy=rest.reduce((s,u)=>s+u.y,0)/rest.length;
      let dx=w.x-cx, dy=w.y-cy; const L=Math.hypot(dx,dy)||1; dx/=L; dy/=L; if(L<.5){dx=1;dy=0;}
      const px=-dy, py=dx, per=G.formation==='line'?12:3, n=rest.length;
      pts=rest.map((u,i)=>{ const row=Math.floor(i/per), inRow=Math.min(per,n-row*per), col=(i%per)-(inRow-1)/2; return freeTileNear(w.x+px*col*.8-dx*row*.9, w.y+py*col*.8-dy*row*.9); });
    }
    if(pts) rest.forEach((u,k)=>{ orderMove(u,pts[k].x,pts[k].y); u.hold=null; u.tgt=null; });
  }
  G.moveMark={x:w.x,y:w.y,t:1};
  updateInfo();
  return true;
}
function setStance(s){ G.stance=s; for(const u of selected()){ u.stance=s; if(s!=='attack'&&u.storming){ u.storming=false; u.storm=null; u.breach=null; u.hold={x:u.x,y:u.y}; } } toast(s==='attack'?'Aggressive: they attack anything nearby':'Guarding: they hold where you put them'); }
function enemySeats(){ return G.blds.filter(b=>b.team===1&&!b.dead&&(b.def.isKeep||b.type==='epavilion')); }
/* attack formation: shields and heavy foot in front to soak arrows, ladders and rams with them,
   bowmen behind, the lord and monks next, engineers and siege engines at the rear */
const ASSAULT_ROWS=[
  ['pikeman','swordsman'],
  ['maceman','spearman','knight'],
  ['pladder','pram','ptower'],
  ['xbow','archer'],
  ['lord','monk'],
  ['engineer','pcatapult','ptreb'],
];
function assaultRank(k){ for(let g=0;g<ASSAULT_ROWS.length;g++){ const i=ASSAULT_ROWS[g].indexOf(k); if(i>=0) return [g,i]; } return [1,9]; }
function assaultSlots(units,front,dir){
  const px=-dir.y, py=dir.x, n=units.length, width=cl(Math.ceil(Math.sqrt(n)*1.6),4,14)*.8;
  const groups=ASSAULT_ROWS.map(()=>[]); for(const u of units){ const [g,i]=assaultRank(u.kind); groups[g].push({u,i}); }
  const out=new Map(); let depth=0;
  groups.forEach((grp,g)=>{
    if(!grp.length) return;
    const list=grp.sort((a,b)=>a.i-b.i).map(o=>o.u), rows=[]; let row=[], rw=0;
    for(const u of list){ const w=u.def.big?1.8:.8; if(row.length&&rw+w>width+.01){ rows.push(row); row=[]; rw=0; } row.push(u); rw+=w; }
    if(row.length) rows.push(row);
    for(const r of rows){
      const bigs=r.filter(u=>u.def.big), smalls=r.filter(u=>!u.def.big), h=Math.ceil(smalls.length/2), line=smalls.slice(0,h).concat(bigs,smalls.slice(h));
      const total=line.reduce((a,u)=>a+(u.def.big?1.8:.8),0); let off=-total/2;
      const back=depth+(bigs.length?.5:0);
      for(const u of line){ const w=u.def.big?1.8:.8, c=off+w/2; off+=w; out.set(u,freeTileNear(front.x+px*c-dir.x*back, front.y+py*c-dir.y*back)); }
      depth+=bigs.length?1.9:.85;
    }
    depth+=.4;
  });
  return out;
}
let assaultSeq=0;
function marchInFormation(units,front,dir,stormTarget){
  const slots=assaultSlots(units,front,dir);
  /* the foot keep step with the slowest soldier; rams and siege towers trundle along behind at their own speed */
  const pace=Math.min(...units.filter(u=>assaultRank(u.kind)[0]<5&&u.def.speed>=1).map(u=>u.def.speed).concat([9]))*.95;
  const id=stormTarget?++assaultSeq+Math.round(G.time):0;
  for(const u of units){ const p=slots.get(u); u.post=null; orderMove(u,p.x,p.y); u.hold=null; u.tgt=null; u.faceTo=Math.atan2(dir.y,dir.x);
    if(assaultRank(u.kind)[0]<5&&u.def.speed>=1) u.pace=pace;
    if(stormTarget){ u.stormAfter=stormTarget; u.assaultId=id; u.stance='defend'; } }
  return slots;
}
function groupCenter(us){ return {x:us.reduce((a,u)=>a+u.x,0)/us.length, y:us.reduce((a,u)=>a+u.y,0)/us.length}; }
function nearestSeat(x,y){ let S=null,bd=1e9; for(const b of enemySeats()){ const d=Math.hypot(b.x+b.w/2-x,b.y+b.h/2-y); if(d<bd){bd=d;S=b;} } return S; }
function formUpInPlace(){
  const sel=selected().filter(u=>!u.def.cart); if(!sel.length) return;
  const c=groupCenter(sel), S=nearestSeat(c.x,c.y);
  let dir=S?{x:S.x+S.w/2-c.x,y:S.y+S.h/2-c.y}:{x:1,y:0}; const L=Math.hypot(dir.x,dir.y)||1; dir={x:dir.x/L,y:dir.y/L};
  marchInFormation(sel,{x:c.x+dir.x*2,y:c.y+dir.y*2},dir,null);
  toast('Battle line: heavy foot in front, bowmen behind, siege at the back');
}
function stormSelected(){
  const sel=selected().filter(u=>!u.def.cart); if(!sel.length) return; const c=groupCenter(sel), S=nearestSeat(c.x,c.y);
  if(!S){ toast('No enemy castle to storm','warn'); sfx('deny'); return; }
  /* already at the walls: no time to form up, go now */
  if(nearCastleDist(c.x,c.y)<5){ const f=G.formation; G.formation='box'; orderAssault(sel,{seat:S,bld:null},{x:S.x+S.w/2,y:S.y+S.h/2}); G.formation=f; return; }
  formedAssault(sel,S);
}
function nearCastleDist(x,y){ let nd=1e9; for(const b of G.blds){ if(b.team!==1||b.dead||!(b.def.castle||b.def.isKeep||b.def.enemy)) continue; nd=Math.min(nd,rectDist(x,y,b)); } return nd; }
/* every bow, engine and keep that could hit a man standing near this castle */
function castleThreats(S){
  const out=[], cx=S.x+S.w/2, cy=S.y+S.h/2, near=(x,y)=>Math.hypot(x-cx,y-cy)<36;
  let bowR=0; for(const u of G.units) if(u.team===1&&!u.dead&&u.def.ranged&&near(u.x,u.y)){ bowR=Math.max(bowR,u.def.range); out.push({x:u.x,y:u.y,r:enemyRange(u)}); }
  for(const b of G.blds){ if(b.team!==1||b.dead) continue; const bx=b.x+b.w/2, by=b.y+b.h/2; if(!near(bx,by)) continue;
    if(b.def.isKeep) out.push({x:bx,y:by,r:KEEP_R});
    if(b.mangonel) out.push({x:b.x+1,y:b.y+1,r:b.def.great?MANG_GREAT_R:MANG_R});
    if(b.ballista) out.push({x:bx,y:by,r:BALL_R});
    /* bowmen can step onto any tower or wall, so the whole rampart counts */
    if(bowR&&b.def.castle&&!b.def.isKeep) out.push({x:bx,y:by,r:bowR+(b.def.towerish?(b.def.great?5:4):b.type==='gatehouse'?4:2)+Math.max(b.w,b.h)/2}); }
  return out;
}
/* the nearest line to the castle that no arrow, bolt or stone can reach */
function safeLine(c,S,width){
  const T={x:S.x+S.w/2,y:S.y+S.h/2}; let dir={x:T.x-c.x,y:T.y-c.y}; const L=Math.hypot(dir.x,dir.y)||1; dir={x:dir.x/L,y:dir.y/L};
  const px=-dir.y, py=dir.x, hw=Math.min(width/2,7), th=castleThreats(S), M=2.5;
  const safe=(x,y)=>inb(x|0,y|0)&&th.every(t=>Math.hypot(x-t.x,y-t.y)>=t.r+M);
  for(let s=4;s<90;s+=.5){ const x=T.x-dir.x*s, y=T.y-dir.y*s;
    if(!inb(x|0,y|0)) break;
    if(safe(x,y)&&safe(x+px*hw,y+py*hw)&&safe(x-px*hw,y-py*hw)) return {front:freeTileNear(x,y),dir,dist:s}; }
  return {front:{x:c.x+dir.x*1.5,y:c.y+dir.y*1.5},dir,dist:L};
}
function formedAssault(sel,S){
  sel.forEach(resetOrders);
  const c=groupCenter(sel), width=cl(Math.ceil(Math.sqrt(sel.length)*1.6),4,14)*.8;
  const {front,dir}=safeLine(c,S,width);
  marchInFormation(sel,front,dir,S);
  toast('Lining up out of range of their bows and engines. They charge when the line is ready.','big'); sfx('horn');
  G.moveMark={x:front.x,y:front.y,t:1,atk:true}; updateInfo();
}
function setMode(m){
  if(m&&(m.type==='build'||m.type==='demolish')&&G) clearSel();
  mode=m; lineStart=lineEnd=null;
  if(m&&m.type==='build'&&DEF[m.key].gate&&!m.dir) m.dir=G.lastDir||'E';
  document.querySelectorAll('.item[data-k]').forEach(el=>el.classList.toggle('on',!!(m&&m.type==='build'&&m.key===el.dataset.k)));
  const db=$('demoBtn'); if(db) db.classList.toggle('on',!!(m&&m.type==='demolish'));
  const rb=$('rallyBtn'); if(rb) rb.classList.toggle('on',!!(m&&m.type==='rally'));
  cv.style.cursor=m?(m.type==='demolish'?'not-allowed':'crosshair'):'default';
  updateInfo();
}
function rotateGate(){ if(mode&&mode.type==='build'&&DEF[mode.key].gate){ mode.dir=DIRS[(DIRS.indexOf(mode.dir)+1)%4]; G.lastDir=mode.dir; updateInfo(); } }
function estateAt(w){ return G.estates.find(e=>Math.hypot(e.x-w.x,e.y-w.y)<1.6); }
function clickAt(w,touch,shift){
  if(G.editor){ edClick(w); return; }
  if(mode&&mode.type==='build'){ const d=DEF[mode.key]; if(d.line){buildLine(mode.key,[{x:Math.floor(w.x),y:Math.floor(w.y)}]);} else {const f=footprint(mode.key,w,mode.dir);tryBuild(mode.key,f.x,f.y,false,mode.dir);} updateTop(); return; }
  if(mode&&mode.type==='demolish'){ demolishAt(w.x,w.y); updateTop(); return; }
  if(mode&&mode.type==='rally'){ G.rally={x:w.x,y:w.y}; toast('Rally point set. New recruits gather here.'); setMode(null); return; }
  const u=unitAt(w,0);
  if(u){
    const now=performance.now();
    if(lastUnitClick.k===u.kind && now-lastUnitClick.t<380){ selectVisible(u.kind); lastUnitClick={k:null,t:0}; return; }
    lastUnitClick={k:u.kind,t:now};
    if(shift) u.sel=!u.sel; else { clearSel(); u.sel=true; }
    G.selB=null; G.selE=null; updateInfo(); return;
  }
  if(touch && selected().length){ commandMove(w); return; }
  clearSel();
  G.selE=estateAt(w)||null;
  G.selB=G.selE?null:bAt(w.x|0,w.y|0); updateInfo();
}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  if(!G||G.attract||(!running&&!G.over&&!G.editor)) return;
  audioInit();
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};drag=null;boxSel=null;lineStart=null;return;}
  const touch=e.pointerType!=='mouse';
  const w=s2w(e.offsetX,e.offsetY);
  drag={sx:e.offsetX,sy:e.offsetY,lx:e.offsetX,ly:e.offsetY,moved:false,touch,button:e.button,shift:e.shiftKey,kind:null};
  if(G.editor){ if(e.button===0&&ED.tool!=='pan'){ drag.kind='paint'; const t=ED_TOOLS.find(t=>t.id===ED.tool); if(t.ter!==undefined) edPaint(w); else drag.kind='edclick'; } else drag.kind='pan'; return; }
  if(mode&&mode.type==='build'&&DEF[mode.key].line && e.button===0){drag.kind='line';lineStart=lineEnd={x:Math.floor(w.x),y:Math.floor(w.y)};}
  else if(touch) drag.kind=G.boxMode&&!mode?'box':'panTap';
  else if(e.button===0) drag.kind=mode?'click':'box';
  else drag.kind='pan';
});
cv.addEventListener('pointermove',e=>{
  if(!G||G.attract) return;
  const p=pointers.get(e.pointerId); if(p){p.x=e.offsetX;p.y=e.offsetY;}
  hover=s2w(e.offsetX,e.offsetY);
  if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y), cx=(a.x+b.x)/2, cy=(a.y+b.y)/2; zoomAt(cx,cy,d/pinch.d); panBy(cx-pinch.cx,cy-pinch.cy); pinch.d=d; pinch.cx=cx; pinch.cy=cy; return;}
  if(!drag) return;
  if(Math.hypot(e.offsetX-drag.sx,e.offsetY-drag.sy)>7) drag.moved=true;
  if(drag.kind==='paint'){ edPaint(hover); }
  if(drag.kind==='pan'||(drag.kind==='panTap'&&drag.moved)) panBy(e.offsetX-drag.lx,e.offsetY-drag.ly);
  if(drag.kind==='box'&&drag.moved) boxSel={x0:drag.sx,y0:drag.sy,x1:e.offsetX,y1:e.offsetY};
  if(drag.kind==='line') lineEnd={x:Math.floor(hover.x),y:Math.floor(hover.y)};
  drag.lx=e.offsetX;drag.ly=e.offsetY;
});
cv.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);
  if(pinch){ if(pointers.size<2) pinch=null; drag=null; return; }
  if(!drag||!G) return;
  const w=s2w(e.offsetX,e.offsetY);
  switch(drag.kind){
    case 'paint': if(typeof renderEditorPanel==='function') renderEditorPanel(); break;
    case 'edclick': edClick(w); break;
    case 'line': if(lineStart&&lineEnd) buildLine(mode.key,lineTiles(lineStart,lineEnd)); lineStart=lineEnd=null; updateTop(); break;
    case 'click': clickAt(w,false,drag.shift); break;
    case 'box':
      if(drag.moved&&boxSel){
        const x0=Math.min(boxSel.x0,boxSel.x1), x1=Math.max(boxSel.x0,boxSel.x1), y0=Math.min(boxSel.y0,boxSel.y1), y1=Math.max(boxSel.y0,boxSel.y1);
        if(!drag.shift) clearSel();
        for(const u of G.units) if(u.team===0&&u.def.mil){ const s=w2s(u.x,u.y,(u.el?1:0)); if(s.x>=x0-4&&s.x<=x1+4&&s.y>=y0-6&&s.y<=y1+6) u.sel=true; }
        G.selB=null; G.selE=null; if(drag.touch) G.boxMode=false; updateInfo();
      } else clickAt(w,drag.touch,drag.shift);
      boxSel=null; break;
    case 'pan': if(!drag.moved&&!G.editor){ if(mode) setMode(null); else if(!commandMove(w)){G.selB=null;G.selE=null;updateInfo();} } break;
    case 'panTap': if(!drag.moved) clickAt(w,true,false); break;
  }
  drag=null;
});
cv.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;pinch=null;boxSel=null;});
cv.addEventListener('pointerleave',()=>{if(!drag)hover=null;});
cv.addEventListener('wheel',e=>{e.preventDefault(); if(!G||G.attract) return; zoomAt(e.offsetX,e.offsetY,Math.exp(-e.deltaY*0.0015));},{passive:false});
const keys=new Set();
addEventListener('keydown',e=>{
  if(!G||G.attract) return;
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')) return;
  if(!running&&!G.editor) return;
  const k=e.key.toLowerCase();
  if(!G.editor&&e.code&&e.code.startsWith('Digit')){ const n=+e.code.slice(5); if(n>=1&&n<=5){ e.preventDefault(); if(e.shiftKey||e.ctrlKey||e.metaKey) assignSquad(n); else selectSquad(n); return; } }
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  keys.add(k);
  if(k==='v') toggle3D().then(rememberView);
  if(V3&&V3.on){ if(k==='q') V3.rotate(-.25); if(k==='e') V3.rotate(.25); if(e.key==='PageUp') V3.tilt(.08); if(e.key==='PageDown') V3.tilt(-.08); }
  if(G.editor) return;
  if(e.key==='Escape'){ if(mode) setMode(null); else {clearSel();G.selB=null;G.selE=null;updateInfo();} }
  if(e.key===' '){e.preventDefault(); setSpeed(speed?0:(prevSpeed||1));}
  if(e.key==='='||e.key==='+') setSpeed(Math.min(3,(speed||0)+1));
  if(e.key==='-') setSpeed(Math.max(0,speed-1));
  if(k==='r') rotateGate();
  if(k==='g') { toggleAllGates(); updateInfo(); }
  if(k==='l' && G.lord && !G.lord.dead){ clearSel(); G.lord.sel=true; G.selB=null; centerOn(G.lord.x,G.lord.y); updateInfo(); }
  if(e.key==='Delete'&&G.selB) demolish(G.selB);
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
function panKeys(dt){
  let dx=0,dy=0;
  if(keys.has('a')||keys.has('arrowleft'))dx--; if(keys.has('d')||keys.has('arrowright'))dx++;
  if(keys.has('w')||keys.has('arrowup'))dy--; if(keys.has('s')||keys.has('arrowdown'))dy++;
  if(SETTINGS.edge&&mouseIn&&!drag){ const m=14; if(mouseX<m) dx--; else if(mouseX>innerWidth-m) dx++; if(mouseY<m) dy--; else if(mouseY>innerHeight-m) dy++; }
  if(dx||dy) panBy(-dx*700*SETTINGS.scroll*dt,-dy*700*SETTINGS.scroll*dt);
}
let mouseX=0, mouseY=0, mouseIn=false;
addEventListener('mousemove',e=>{ mouseX=e.clientX; mouseY=e.clientY; mouseIn=true; });
document.addEventListener('mouseleave',()=>{ mouseIn=false; });

/* ---------- top bar ---------- */
function setSpeed(s){ if(s) prevSpeed=s; speed=s; document.querySelectorAll('#speed button').forEach(b=>b.classList.toggle('on',+b.dataset.s===s)); }
document.querySelectorAll('#speed button').forEach(b=>b.addEventListener('click',()=>{audioInit();setSpeed(+b.dataset.s);}));
$('sendNow').addEventListener('click',()=>{ if(G&&G.wave<totalWaves()){G.nextWave=G.time; G.warned=G.wave;} });
$('viewBtn').addEventListener('click',()=>{ audioInit(); toggle3D().then(rememberView); });
/* the view you last picked is the one the next game opens in */
function rememberView(){ if(!G||G.attract||G.editor) return; SETTINGS.view=R3.on?'3d':'2d'; saveSettings(); }
function wantView(){ if(SETTINGS.view==='3d'&&!R3.on&&!R3.loading) toggle3D(); }
$('rotL').addEventListener('click',()=>V3&&V3.rotate(-.35)); $('rotR').addEventListener('click',()=>V3&&V3.rotate(.35));
let uiHold=false;
['info','hud','items'].forEach(id=>$(id).addEventListener('pointerdown',()=>{uiHold=true;}));
addEventListener('pointerup',()=>setTimeout(()=>{uiHold=false;},0));
function setHTML(el,html){ if(!el||uiHold) return; if(el._h!==html){el.innerHTML=html; el._h=html;} }
function yearOf(){ return Math.floor(monthAbs()/12); }
function dateStr(){ return `${MONTHS[monthOf()]} ${yearOf()}`; }
function updateTop(){
  if(!G||G.editor) return;
  const ps=peasants(), idle=ps.filter(u=>!u.job).length;
  const r=G.R, tr=predictFactors().trend;
  $('rank').textContent=RANKS[rankOf(G.honorTotal)].n;
  $('date').innerHTML=`${dateStr()}<small>${seasonName()}</small>`;
  $('date').classList.toggle('winter',isWinter());
  setHTML($('res'),
    `<span class="cell" title="Gold">${RES_ICON.gold}${Math.floor(r.gold)}</span>`+
    `<span class="cell" title="Food: ${RES_KEYS.food.map(k=>`${Math.floor(r[k])} ${k}`).join(', ')}">${RES_ICON.food}${Math.floor(foodTotal())}</span>`+
    `<span class="cell" title="Wood">${RES_ICON.wood}${Math.floor(r.wood)}</span>`+
    `<span class="cell" title="Stone">${RES_ICON.stone}${Math.floor(r.stone)}</span>`+
    `<span class="cell wide" title="Iron">${RES_ICON.iron}${Math.floor(r.iron)}</span>`+
    `<span class="cell wide" title="Honor to spend (earned in total: ${Math.floor(G.honorTotal)})">${RES_ICON.honor}${Math.floor(G.honor)}</span>`+
    `<span class="cell" title="Peasants: idle, then total and housing">${RES_ICON.people}${idle}<small>idle</small> ${ps.length}/${housing()}</span>`+
    `<span class="cell" id="pop" title="Popularity. Below 50, peasants leave.">${RES_ICON.pop}${Math.round(G.pop)}<span class="bar"><i style="width:${G.pop}%;background:${G.pop<50?'var(--bad)':'var(--good)'}"></i></span><span class="trend ${tr>0?'up':tr<0?'down':''}">${tr>0?'+':''}${tr}</span></span>`);
  const wv=$('wave'), tw=totalWaves(), gp=goalProgress();
  if(G.L.mode==='tutorial'){ wv.hidden=true; $('sendNow').hidden=true; }
  else if(tw>0 && G.wave<tw){const s=Math.max(0,Math.ceil(G.nextWave-G.time)); const lbl=tw===Infinity?`${waveLabel()} ${G.wave+1}`:`Wave ${G.wave+1} of ${tw}`; wv.innerHTML=`${lbl}&nbsp;<b>${clock(s)}</b>`; wv.classList.toggle('soon',s<=25); wv.title=`Next: ${waveDesc(G.wave)} from ${dirList(G.wave)}`; $('sendNow').hidden=false; wv.hidden=false;}
  else if(tw>0){const left=G.units.filter(u=>u.team===1&&!u.def.beast&&!u.ai&&!u.guard).length+G.spawnQ.length; wv.innerHTML=`Final wave&nbsp;<b>${left}</b>&nbsp;left`; wv.classList.remove('soon'); $('sendNow').hidden=true; wv.hidden=false;}
  else { wv.hidden=true; $('sendNow').hidden=true; }
  $('goal').hidden=!gp; $('goal').textContent=gp;
  if(G.tab==='keep') refreshKeep();
  if(G.tab==='army') refreshArmy();
  if(G.tab==='castle') refreshCastle();
  if(G.tab==='trade') refreshTrade();
  refreshAfford();
}

/* ---------- dock ---------- */
function renderTabs(){
  const box=$('tabs'); box.innerHTML='';
  for(const t of TABS){const b=document.createElement('button');b.dataset.tab=t.id;b.innerHTML=TAB_ICON[t.id];b.title=t.name;b.setAttribute('aria-label',t.name);b.className=G.tab===t.id?'on':'';b.onclick=()=>{ if(mode&&mode.type==='build'&&!(t.items||[]).includes(mode.key)) setMode(null); G.tab=t.id;renderTabs();renderItems();};box.appendChild(b);}
  const d=document.createElement('button');d.id='demoBtn';d.className='demo'+(mode&&mode.type==='demolish'?' on':'');d.innerHTML=TAB_ICON.demo;d.title='Demolish';d.setAttribute('aria-label','Demolish');
  d.onclick=()=>setMode(mode&&mode.type==='demolish'?null:{type:'demolish'});box.appendChild(d);
}
const iconCache={};
function iconFor(key){
  if(iconCache[key]) return iconCache[key];
  const c=document.createElement('canvas'); c.width=88; c.height=88; const x=c.getContext('2d');
  const d=DEF[key], m=Math.max(d.w,d.h), s=80/(m*T+(key==='cathedral'?40:10)); x.translate(4,key==='cathedral'?14:4); x.scale(s,s);
  if(key==='moat'){ x.fillStyle='#28465a'; x.fillRect(0,0,T,T); x.fillStyle='#6e675c'; x.fillRect(0,0,T,3); x.fillRect(0,T-3,T,3); x.fillStyle='rgba(255,255,255,.12)'; x.fillRect(6,12,14,1.5); x.fillRect(12,20,12,1.5); }
  else drawBld(x,{type:key,def:d,x:-99,y:-99,w:d.w,h:d.h,dir:'E',anim:0,id:1,team:0},(m-d.w)*T/2,(m-d.h)*T/2);
  return iconCache[key]=c.toDataURL();
}
function bigAct(box,title,sub,fn,id){const b=document.createElement('button');b.className='big-act';if(id)b.id=id;b.innerHTML=`<b>${title}</b><span>${sub}</span>`;b.onclick=()=>{audioInit();fn();updateTop();};box.appendChild(b);return b;}
function group(box,title,inner,cls){const g=document.createElement('div');g.className='group'+(cls?' '+cls:'');g.innerHTML=`<h4>${title}</h4>${inner}`;box.appendChild(g);return g;}
function pickRow(id,list,cur,fn){ const el=$(id); list.forEach((r,i)=>{const b=document.createElement('button');b.textContent=r.n;b.className=cur===i?'on':'';b.onclick=()=>{fn(i);renderItems();};el.appendChild(b);}); }
function renderItems(){
  const box=$('items'); box.innerHTML=''; box._h=null;
  const tab=TABS.find(t=>t.id===G.tab);
  $('stripTitle').textContent=tab.name;
  box.classList.toggle('wrapped',tab.id==='keep'||tab.id==='trade');
  if(tab.items){
    for(const k of tab.items){
      const d=DEF[k], b=document.createElement('button'); b.className='item'; b.dataset.k=k;
      b.innerHTML=`<img src="${iconFor(k)}" width="46" height="46" alt=""><span class="n">${d.name}</span><span class="c">${Object.entries(d.cost).map(([k2,v])=>`${v} ${RES_NAME[k2]}`).join(', ')}</span>`; b.title=d.name; b.setAttribute('aria-label',d.name);
      b.onclick=()=>{audioInit();setMode(mode&&mode.key===k?null:{type:'build',key:k});};
      b.onmouseenter=()=>infoText(d.name,d.desc+(d.cost?`<div class="obj">Costs ${costStr(d.cost)}${d.line?' per tile':''}.</div>`:''));
      b.onmouseleave=()=>updateInfo();
      if(mode&&mode.key===k) b.classList.add('on');
      box.appendChild(b);
    }
    if(tab.id==='castle'){
      const s=document.createElement('div'); s.className='sep'; box.appendChild(s);
      bigAct(box,'Repair castle','',repairAll,'repAll');
      bigAct(box,'Drawbridges','',toggleAllGates,'gateAll');
      refreshCastle();
    }
  } else if(tab.id==='army'){
    for(const k of ARMY_ORDER){
      const R=RECRUIT[k], parts=[];
      if(R.w) for(const [w,n] of Object.entries(R.w)) parts.push(`${n} ${RES_ONE[w]||w}`);
      parts.push(`${R.gold} gold`); if(R.wood) parts.push(`${R.wood} wood`); if(R.honor) parts.push(`${R.honor} honor`); if(R.crew) parts.push(`${R.crew} engineer${R.crew>1?'s':''}`);
      const b=bigAct(box,UD[k].name,parts.join(' · '),()=>recruit(k),'rec-'+k); b.classList.add('rec');
      b.onmouseenter=()=>infoText(UD[k].name,troopBlurb(k)); b.onmouseleave=()=>updateInfo();
    }
    const s=document.createElement('div'); s.className='sep'; box.appendChild(s);
    bigAct(box,'Select your lord','Key L',()=>{ if(G.lord&&!G.lord.dead){clearSel();G.lord.sel=true;G.selB=null;centerOn(G.lord.x,G.lord.y);updateInfo();} },'selLord');
    bigAct(box,'Select all troops','',()=>{clearSel(); for(const u of G.units) if(u.team===0&&u.def.mil&&u.kind!=='lord') u.sel=true; G.selB=null; updateInfo();},'selAll');
    bigAct(box,'Set rally point','Where new recruits gather',()=>setMode(mode&&mode.type==='rally'?null:{type:'rally'}),'rallyBtn');
    refreshArmy();
  } else if(tab.id==='keep'){
    group(box,'Rations','<div class="pick" id="pR"></div>');
    group(box,'Taxes','<div class="pick" id="pT"></div>');
    group(box,'Weekly banquet','<div class="pick" id="pB"></div><div class="note" id="bqNote"></div>');
    group(box,'Court','<div class="court" id="courtBtns"></div>');
    group(box,'Popularity each week','<div class="facts" id="facts"></div>');
    group(box,'Town','<div class="facts" id="court"></div>');
    if(G.estates.length) group(box,'Estates','<div class="facts" id="estList"></div>');
    pickRow('pR',RATIONS,G.ration,i=>G.ration=i);
    pickRow('pT',TAXES,G.tax,i=>G.tax=i);
    pickRow('pB',BANQUETS,G.banquet,i=>G.banquet=i);
    refreshKeep();
  } else if(tab.id==='trade'){
    const g=document.createElement('div'); g.className='trade'; g.id='tradeBox'; box.appendChild(g);
    refreshTrade(true);
  }
  refreshAfford();
}
const BLURB={archer:'Cheap and quick. Best on walls and towers.',xbow:'Slow to reload but punches through armor.',spearman:'Fast and cheap. Good against rams and siege towers.',pikeman:'A heavily armored wall of pikes. Holds a gate and breaks rams.',maceman:'Fast, hard hitting infantry.',swordsman:'Slow, heavily armored, deadly up close.',knight:'Mounted and fast. Needs the rank of Knight. Rides down siege engines.',monk:'Heals wounded troops near him. Ordained at a chapel or cathedral.',engineer:'Crews mangonels, ballistae, oil and engines. Right click a moat tile with engineers selected to fill it.',pladder:'Carries a ladder. Right click an enemy wall to raise it, then send troops up.',pram:'Batters gates and walls. Needs 1 engineer as crew. Moats stop it.',ptower:'Docks against an enemy wall so troops can storm across. Needs 2 engineers.',pcatapult:'Hurls stones at crowds and buildings. Needs Baron rank.',ptreb:'Huge range against buildings. Needs Earl rank.'};
function troopBlurb(k){
  const d=UD[k];
  return `${BLURB[k]||''}<div class="obj">Health ${d.hp}${d.dmg?` · damage ${d.dmg}`:''}${d.range?` · range ${d.range}`:''}${d.bdmg?` · ${d.bdmg} against buildings`:''}</div>`;
}
function refreshAfford(){
  document.querySelectorAll('.item[data-k]').forEach(el=>el.classList.toggle('no',!afford(DEF[el.dataset.k].cost)));
  const rank=rankOf(G.honorTotal);
  document.querySelectorAll('.big-act.rec').forEach(el=>{ const k=el.id.slice(4), R=RECRUIT[k]; el.classList.toggle('no',!!(!afford(recruitCost(k))||(R.rank&&rank<R.rank)||(R.honor&&G.honor<R.honor))); });
}
function refreshCastle(){
  const r=$('repAll'), g=$('gateAll'); if(!r||!G) return;
  const dmg=damagedCastle(); let st=0; for(const b of dmg){const c=repairCost(b); if(c) st+=c.stone||0;}
  r.querySelector('span').textContent=dmg.length?`${dmg.length} damaged · ${st} stone`:'Nothing damaged';
  const gs=G.blds.filter(b=>b.type==='gatehouse'&&b.team===0);
  g.querySelector('b').textContent=gs.some(b=>!b.raised)?'Raise drawbridges':'Lower drawbridges';
  g.querySelector('span').textContent=gs.length?`${gs.filter(b=>b.raised).length} of ${gs.length} raised · key G`:'No gatehouse yet';
}
function refreshArmy(){
  for(const k of Object.keys(RECRUIT)){ const el=$('rec-'+k); if(!el) continue; const n=G.units.filter(u=>u.kind===k&&u.team===0).length, b=el.querySelector('b'), txt=`${UD[k].name}${n?` (${n})`:''}`; if(b.textContent!==txt) b.textContent=txt; }
}
function refreshKeep(){
  const el=$('facts'); if(!el) return; const f=predictFactors();
  const sg=v=>`<span class="${v>0?'p':v<0?'m':''}">${v>0?'+':''}${v}</span>`;
  const rows=[['Food',f.food],['Food variety',f.variety],['Taxes',f.tax],['Ale at the inn',f.ale],['Religion',f.chap],['Crime',f.crime],['Fear',f.justice],['Rats',f.rats]];
  if(f.court) rows.push(['Court and fairs',f.court]); if(f.cold) rows.push(['Winter cold',f.cold]);
  setHTML(el,rows.map(([n,v])=>`<span>${n}</span>${sg(v)}`).join('')+`<span><b>Change</b></span><b>${sg(f.trend)}</b>`);
  const bq=BANQUETS[G.banquet];
  setHTML($('bqNote'), bq.h?`${bq.food} food, ${bq.ale} ale, ${bq.gold} gold a week for +${bq.h} honor${G.banquetOK?'':'. <b>Short of supplies.</b>'}`:'Banquets earn honor for knights, ranks and siege engines.');
  setHTML($('courtBtns'),Object.entries(COURT).map(([k,c])=>{ const why=courtCheck(k); return `<button data-court="${k}" class="${why?'no':''}" title="${why||c.desc}"><b>${c.name}</b><span>${costStr(c.cost)}</span><span class="${why?'m':''}">${why||c.desc}</span></button>`; }).join(''));
  const r=rankOf(G.honorTotal), nx=RANKS[r+1];
  const ratN=G.units.filter(u=>u.kind==='rat').length;
  setHTML($('court'),`<span>Rank</span><b>${RANKS[r].n}${nx?` · ${nx.h-Math.floor(G.honorTotal)} to ${nx.n}`:''}</b><span>Honor</span><b>${Math.floor(G.honor)} to spend</b><span>Crime</span><b class="${G.crime>40?'m':''}">${Math.round(G.crime)}%</b><span>Filth</span><b class="${G.dirt>40?'m':''}">${Math.round(G.dirt)}%${ratN?` · ${ratN} rats`:''}</b><span>Fear</span><b>workers ${Math.round((G.workMul-1)*100)}% faster</b><span>Ale needed</span><b>${f.aleNeed} a week · ${Math.floor(f.inns)} at inns</b>`);
  const est=$('estList'); if(est) setHTML(est,G.estates.map(e=>`<span>${e.name}</span><b class="${e.owner===1?'p':e.owner===2?'m':''}">${e.owner===1?'yours':e.owner===2?(aiByOwner(e.ai)||{name:'enemy'}).name:`free · ${e.cost} honor`} · ${e.desc}</b>`).join(''));
}
function refreshTrade(){
  const el=$('tradeBox'); if(!el) return;
  if(!countB('market')){ setHTML(el,'<div class="note">Build a market in the Industry tab to buy and sell goods. A traveling merchant sometimes brings better prices.</div>'); return; }
  const deal=G.time<G.merchantUntil;
  setHTML(el,`<div class="note">${deal?'<b>A merchant is in town:</b> better prices for now.':'Goods trade in lots of 5.'}</div><div class="tgrid">`+ALL_RES.map(k=>`<span class="tn">${RES_NAME[k]}</span><span class="tq">${Math.floor(G.R[k])}</span><button data-buy="${k}">Buy ${price(k,false)*5}</button><button data-sell="${k}">Sell ${price(k,true)*5}</button>`).join('')+'</div>');
}
$('items').addEventListener('click',e=>{
  const c=e.target.closest('[data-court]'); if(c){ audioInit(); holdCourt(c.dataset.court); uiHold=false; updateTop(); return; }
  const b=e.target.closest('[data-buy],[data-sell]'); if(!b) return; audioInit(); if(b.dataset.buy) trade(b.dataset.buy,false); else trade(b.dataset.sell,true); uiHold=false; updateTop();
});

/* ---------- ledger and HUD ---------- */
let infoLock=false;
function infoText(title,body){infoLock=true;const el=$('info');el.innerHTML=`<h3>${title}</h3><div>${body}</div>`;el._h=null;}
const touchy=matchMedia('(pointer: coarse)').matches;
/* short head count: "12 foot · 14 bowmen · 9 siege" */
function summary(list){
  const c={foot:0,bow:0,siege:0,other:0}; let lord=false;
  for(const u of list){ if(u.kind==='lord'){ lord=true; continue; } const d=u.def; if(d.pladder||d.siege||d.artillery||d.eng) c.siege++; else if(d.ranged) c.bow++; else if(d.melee) c.foot++; else c.other++; }
  const parts=[]; if(c.foot) parts.push(`${c.foot} foot`); if(c.bow) parts.push(`${c.bow} bowmen`); if(c.siege) parts.push(`${c.siege} siege`); if(c.other) parts.push(`${c.other} monk${c.other>1?'s':''}`); if(lord) parts.push('your lord');
  return parts.join(' · ');
}
function updateHud(){
  const sel=selected();
  const sq=[1,2,3,4,5].map(n=>({n,us:G.units.filter(u=>u.squad===n&&!u.dead)})).filter(s=>s.us.length);
  let h=sq.map(s=>`<button class="chip${s.us.every(u=>u.sel)?' on':''}" data-act="pick-${s.n}" title="${describe(s.us)}. Press ${s.n} to select, twice to jump to them."><b>${s.n}</b>${s.us.length}</button>`).join('');
  h+=`<button class="chip" data-act="lord" title="Key L">Lord</button>`;
  if(touchy) h+=`<button class="chip${G.boxMode?' on':''}" data-act="box">Box select</button>`;
  for(const a of G.ais) if(a.alive) h+=`<button class="chip foe" data-act="ai-${a.id}" style="--c:${a.color}" title="Show ${a.name}'s keep">${G.ais.length>3?(a.short||a.name):a.name}<i style="width:${Math.round(a.keep&&!a.keep.dead?a.keep.hp/a.keep.maxHp*100:0)}%"></i></button>`;
  setHTML($('squads'),h);
  const sb=$('selbar'); sb.hidden=!sel.length;
  if(sel.length){
    const aggr=sel.every(u=>u.stance==='attack'), formed=G.formation==='siege', up=sel.some(u=>u.post);
    let x=`<span class="cnt" title="${describe(sel)}">${summary(sel)}</span>`;
    x+=`<button data-act="aggr" class="${aggr?'on':''}" title="On: they attack anything nearby and never walk back. Off: they guard where you put them.">Aggressive</button>`;
    x+=`<button data-act="formup" class="${formed?'on':''}" title="Heavy foot in front, bowmen behind, siege engines at the back. They march together.">Battle line</button>`;
    if(enemySeats().length) x+=`<button data-act="storm" class="storm" title="They line up just out of range of the enemy bows and engines, then charge together. Right click the castle instead to go in at once.">Storm castle</button>`;
    if(up) x+=`<button data-act="down">Come down</button>`;
    setHTML(sb,x);
  }
}
function selHint(sel){
  const k=new Set(sel.map(u=>u.kind));
  if(k.has('pladder')||k.has('ptower')) return 'Right click an enemy wall to put ladders or the siege tower on it.';
  if(k.has('pram')) return 'Right click an enemy gate to batter it.';
  if(k.has('engineer')) return 'Right click a moat to fill it.';
  return '';
}
function updateInfo(){
  infoLock=false; if(!G) return;
  if(G.editor){ if(typeof renderEditorPanel==='function') renderEditorPanel(); return; }
  if(mode&&(mode.type==='build'||mode.type==='demolish')&&G.units.some(u=>u.sel&&!u.dead)){ setMode(null); return; }
  updateHud();
  const el=$('info'); const sel=selected();
  const how=touchy?'Tap':'Right click';
  if(mode&&mode.type==='build'){const d=DEF[mode.key];
    let x=`<h3>${d.name}</h3><div>${d.desc}</div><div class="obj">Costs ${costStr(d.cost)}${d.line?' per tile':''}.</div>`;
    if(d.gate) x+=`<div class="acts"><button data-act="rotate">Rotate (R) · bridge faces ${{E:'east',S:'south',W:'west',N:'north'}[mode.dir]}</button></div>`;
    x+=`<div class="obj">${d.line?'Drag across the map to lay a line.':'Click the map to place. Right click or Esc to stop.'}</div>`;
    setHTML(el,x); return;}
  if(mode&&mode.type==='demolish'){setHTML(el,`<h3>Demolish</h3><div>Click a building to tear it down for half its cost, or a moat tile to fill it in.</div>`);return;}
  if(mode&&mode.type==='rally'){setHTML(el,`<h3>Rally point</h3><div>Click the map where new recruits should gather.</div>`);return;}
  if(sel.length){ const tip=selHint(sel); setHTML(el,`<h3>${sel.length} selected</h3><div>${summary(sel)}</div><div class="obj">${how} to move or attack.${enemySeats().length?` Storm castle lines them up out of range, then charges. ${how} the castle to send them in at once.`:(tip?' '+tip.replace('Right click',how):'')}</div>`);return;}
  const e=G.selE;
  if(e){
    const ai=e.owner===2?aiByOwner(e.ai):null, n=Object.entries(e.store||{}).map(([k,v])=>`${v} ${RES_NAME[k]}`).join(', ');
    let s=`<h3>${e.name}</h3><div>An estate that yields <b>${e.desc}</b> each week and 1 honor while it is yours.</div>`;
    if(e.owner===1) s+=`<div class="obj">Yours. ${e.cart&&!e.cart.dead?'A cart is on the road to your stockpile. Guard it.':n?`Waiting to ship: ${n}.`:'Supply carts leave every two weeks.'}</div><div class="acts">${n&&!(e.cart&&!e.cart.dead)?'<button data-act="cart" class="hot">Send cart now</button>':''}</div>`;
    else if(e.owner===2) s+=`<div class="obj">Held by <b>${ai?ai.name:'the enemy'}</b>. Drive his men off with your own troops to free it.</div>`;
    else s+=`<div class="obj">Claim it by standing troops on it with no enemies near (your lord claims twice as fast), or buy it outright.${e.claim>0?` Claim ${Math.round(e.claim/8*100)}%.`:''}</div><div class="acts"><button data-act="buy" class="hot">Buy for ${e.cost} honor</button></div>`;
    setHTML(el,s); return;
  }
  const b=G.selB;
  if(b){const d=b.def; let s=`<h3>${d.name}</h3>`;
    if(!(d.fixed&&!d.isKeep)) s+=`<div class="hp"><i style="width:${Math.max(0,b.hp/b.maxHp*100)}%"></i></div>`;
    if(b.team===1){ const ai=aiByOwner(b.owner); s+=`<div>${ai?`Held by <b>${ai.name}</b>. `:''}${d.enemy?d.desc:''}</div><div class="obj">Select troops and ${how.toLowerCase()} it to attack. ${d.wallish||d.towerish?'Laddermen and siege towers get your troops onto it.':''} Catapults and trebuchets wreck it fastest.</div>`; setHTML(el,s); return; }
    if(d.cap){
      const g=garrison(b);
      s+=`<div>Garrison <b>${g.length}/${d.cap}</b><span class="pips">${Array.from({length:d.cap},(_,k)=>`<i class="${k<g.length?'f':''}"></i>`).join('')}</span> · bowmen here get +${elevRange(d.great?3:2)} range</div>`;
      s+=`<div class="acts"><button data-act="garrison" class="hot">Add archers</button>${g.length?'<button data-act="selgarr">Select them</button><button data-act="ungarrison">Send down</button>':''}</div>`;
    } else if(d.isKeep){ s+=`<div>${d.desc}</div><div class="acts"><button data-act="lord" class="hot">Select your lord</button></div>`; }
    else s+=`<div>${d.desc}</div>`;
    if(d.towerish) s+=`<div class="acts">${b.mangonel?'<span class="obj">Mangonel mounted.</span>':b.ballista?'<span class="obj">Ballista mounted. It hunts siege engines and knights.</span>':'<button data-act="mangonel">Mangonel · 80 gold</button><button data-act="ballista">Ballista · 60 gold</button><span class="obj">needs 1 engineer</span>'}</div>`;
    if(d.wallish) s+=`<div class="acts">${b.oil?'<span class="obj">Oil cauldron ready. It pours on enemies at the wall\'s foot.</span>':'<button data-act="oil">Add oil cauldron · 30 gold, 1 engineer</button>'}${b.ladders?`<span class="obj">${b.ladders} ladder${b.ladders>1?'s':''} against it. Put troops on this wall to push them off.</span>`:''}</div>`;
    if(b.type==='gatehouse') s+=`<div class="acts"><button data-act="gate">${b.raised?'Lower drawbridge':'Raise drawbridge'}</button><span class="obj">${b.raised?'Sealed. Peasants cannot pass.':'Open to your peasants. Enemies still have to break it.'}</span></div>`;
    if(d.job&&d.job.modes&&d.job.modes.length>1) s+=`<div class="acts"><span class="obj">Make</span>${d.job.modes.map((m,i)=>`<button data-act="mode-${i}" class="${(b.mode||0)===i?'hot':''}">${m.label}</button>`).join('')}</div>`;
    if(b.type==='inn') s+=`<div class="obj">${Math.floor(b.store)} ale on tap.</div>`;
    if(b.type==='powcamp') s+=`<div class="obj">${G.prisoners>0?`<b>${G.prisoners}</b> prisoner${G.prisoners>1?'s':''} held. About ${RANSOM*G.prisoners} gold of ransom still to come.`:'Empty. Beaten lords\' soldiers can be sent here.'}</div>`;
    if(b.type==='joustfield') s+=`<div class="acts"><button data-act="joust" class="hot">Hold a joust</button><span class="obj">${courtCheck('joust')||'Ready'}</span></div>`;
    if(d.farm&&isWinter()) s+=`<div class="obj">Frozen until spring.</div>`;
    if(b.fire>0) s+=`<div class="obj"><b>On fire!</b> A well keeper puts fires out.</div>`;
    if(d.worker) s+=`<div class="obj">${b.worker?'Staffed.':'Waiting for an idle peasant.'}</div>`;
    const rc=repairCost(b), acts=[];
    if(rc) acts.push(`<button data-act="repair">Repair · ${costStr(rc)}</button>`);
    if(!d.fixed&&!d.isKeep) acts.push(`<button data-act="demolish">Demolish</button>`);
    if(acts.length) s+=`<div class="acts">${acts.join('')}</div>`;
    setHTML(el,s);return;}
  const tw=totalWaves();
  const wv=tw>0&&G.wave<tw?`<div class="obj">Next: <b>${waveDesc(G.wave)}</b> from ${dirList(G.wave)}.</div>`:'';
  const gp=goalProgress();
  const ais=G.ais.length?`<div class="obj">${G.ais.map(a=>`<span class="lord" style="--c:${a.color}">${a.name}${a.alive?'':' · defeated'}</span>`).join(' ')}</div>`:'';
  setHTML(el,`<h3>${G.L.name}</h3><div class="obj">${G.L.goals.join(' · ')}</div>${gp?`<div class="obj"><b>${gp}</b></div>`:''}${ais}${wv}<div class="obj">${seasonName()}${isWinter()?': farms lie idle, so stock the granary.':''}</div>`);
}
function act(a){
  audioInit();
  const b=G.selB;
  if(a==='garrison') addArchers(b);
  else if(a==='ungarrison') sendDown(b);
  else if(a==='selgarr'){ const g=garrison(b); if(g.length){clearSel(); g.forEach(u=>u.sel=true); G.selB=null;} }
  else if(a==='gate'){ setGate(b,!b.raised); refreshCastle(); }
  else if(a==='repair'){ repair(b); }
  else if(a==='demolish'){ demolish(b); }
  else if(a==='mangonel') crewWith(b,'mangonel');
  else if(a==='ballista') crewWith(b,'ballista');
  else if(a==='oil') crewWith(b,'oil');
  else if(a==='joust') holdCourt('joust');
  else if(a==='buy') buyEstate(G.selE);
  else if(a==='cart'){ sendCart(G.selE); toast('A cart sets out for your stockpile'); }
  else if(a.startsWith('mode-')){ b.mode=+a.slice(5); if(b.worker){b.worker.st='getIn';b.worker.carry=null;} }
  else if(a==='rotate') rotateGate();
  else if(a==='deselect') clearSel();
  else if(a==='lord'){ if(G.lord&&!G.lord.dead){clearSel();G.lord.sel=true;G.selB=null;centerOn(G.lord.x,G.lord.y);} }
  else if(a.startsWith('ai-')){ const ai=aiByOwner(+a.slice(3)); if(ai&&ai.keep) centerOn(ai.keep.x+2,ai.keep.y+2); }
  else if(a.startsWith('only-')){ const k=a.slice(5); for(const u of G.units) if(u.sel&&u.kind!==k) u.sel=false; }
  else if(a.startsWith('st-')) setStance(a.slice(3));
  else if(a.startsWith('fm-')){ G.formation=a.slice(3); if(G.formation==='siege') formUpInPlace(); else toast(`Formation: ${G.formation}`); }
  else if(a.startsWith('save-')) assignSquad(+a.slice(5));
  else if(a.startsWith('pick-')) selectSquad(+a.slice(5));
  else if(a==='storm') stormSelected();
  else if(a==='aggr'){ const sel=selected(); const on=!sel.every(u=>u.stance==='attack'); setStance(on?'attack':'defend'); }
  else if(a==='formup'){ if(G.formation==='siege'){ G.formation='box'; toast('Battle line off'); } else { G.formation='siege'; formUpInPlace(); } }
  else if(a==='box'){ if(mode) setMode(null); G.boxMode=!G.boxMode; if(G.boxMode) toast('Drag on the map to box-select troops'); }
  else if(a==='down'){ const sel=selected(); sel.forEach(u=>u.post=null); commandMove({x:sel.reduce((s,u)=>s+u.x,0)/sel.length,y:sel.reduce((s,u)=>s+u.y,0)/sel.length+1.5}); }
  uiHold=false; updateInfo(); updateTop();
}
$('info').addEventListener('click',e=>{const el=e.target.closest('[data-act]'); if(el&&!G.editor) act(el.dataset.act);});
$('hud').addEventListener('click',e=>{const el=e.target.closest('[data-act]'); if(el) act(el.dataset.act);});
