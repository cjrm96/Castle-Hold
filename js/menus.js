'use strict';
/* Hollowmere Keep: title, campaigns, skirmish setup, story scrolls, saves, editor panel, end screen, main loop */
let current=null; // {L, camp, idx}
function overlays(){ return ['ovTitle','ovCamp','ovSetup','ovStory','ovPause','ovEnd','ovHelp','ovLoad','ovCustom']; }
function hideAll(){ overlays().forEach(id=>$(id).hidden=true); }
function show(id){ hideAll(); $(id).hidden=false; if(id!=='ovPause'&&id!=='ovEnd'&&id!=='ovStory') $('toasts').innerHTML=''; }
function setGameUI(on,editor){
  document.body.classList.toggle('ingame',on&&!editor); document.body.classList.toggle('editing',!!editor);
}

/* ---------- attract scene behind the menus ---------- */
function attract(){
  if(V3&&V3.on) toggle3D();
  const L=siegeLevel(1,'defend'); L.firstWave=150; startLevel(L); G.attract=true;
  running=true; setSpeed(1); cam.z=Math.min(1.05,Math.max(.62,VW/1600)); centerOn(G.keep.x+5-(VW>900?VW*.17/(T*cam.z):0),G.keep.y+2);
  G.drift={a:0};
  setGameUI(false); renderTabs(); renderItems();
}
function attractTick(dt){
  if(!G||!G.attract) return;
  G.drift.a+=dt*.05;
  const k=G.keep, off=VW>900?VW*.17/(T*cam.z):0, cx=k.x+5-off+Math.sin(G.drift.a)*6, cy=k.y+2+Math.cos(G.drift.a*.7)*4;
  const c=viewCenter(); centerOn(c.x+(cx-c.x)*dt*.4, c.y+(cy-c.y)*dt*.4);
  if(G.over||G.time>600) attract();
}

/* ---------- title ---------- */
const MODES=[
  {id:'war',name:'The Ember Crown',sub:'War campaign · 8 missions',icon:'army'},
  {id:'peace',name:'The Quiet Years',sub:'Peace campaign · 4 missions',icon:'town'},
  {id:'kingmaker',name:'Kingmaker',sub:'Build and conquer against rival lords',icon:'keep'},
  {id:'siege',name:'Siege',sub:'Storm a great castle, or hold one',icon:'castle'},
  {id:'free',name:'Free build',sub:'No goals and no hurry',icon:'farm'},
  {id:'editor',name:'Scenario editor',sub:'Paint a land and place the lords',icon:'ind'},
];
function showTitle(){
  running=true; if(!G||!G.attract) attract();
  show('ovTitle');
  $('modeGrid').innerHTML=MODES.map(m=>`<button class="mode" data-mode="${m.id}"><span class="mi">${TAB_ICON[m.icon]}</span><span class="mt"><b>${m.name}</b><small>${m.sub}</small></span></button>`).join('');
  listSaves().then(s=>{ const any=Object.values(s).sort((a,b)=>b.when-a.when)[0]; $('continueBtn').hidden=!any; if(any) $('continueBtn').querySelector('small').textContent=`${any.name} · ${any.date||''}`; $('continueBtn').dataset.slot=any?any.slot:''; });
}
$('modeGrid').addEventListener('click',e=>{ const b=e.target.closest('[data-mode]'); if(!b) return; audioInit(); const m=b.dataset.mode;
  if(m==='war'||m==='peace') showCampaign(m); else if(m==='editor') showCustom(); else showSetup(m); });
$('continueBtn').addEventListener('click',()=>{ const s=$('continueBtn').dataset.slot; if(s) doLoad(s); });
$('loadBtn').addEventListener('click',()=>showLoad('title'));

/* ---------- campaigns ---------- */
let campKind='war', menuPick=0;
const SITES={war:[{x:.12,y:.62},{x:.24,y:.3},{x:.38,y:.55},{x:.47,y:.2},{x:.58,y:.72},{x:.7,y:.4},{x:.8,y:.18},{x:.9,y:.6}],peace:[{x:.18,y:.6},{x:.38,y:.28},{x:.62,y:.64},{x:.84,y:.32}]};
function campLevels(){ return LEVELS.filter(l=>l.camp===campKind); }
function showCampaign(kind){ campKind=kind; menuPick=Math.min(menuPick,campLevels().length-1); show('ovCamp'); renderCampaign(); }
function stars(n){ return n?'★'.repeat(n)+'☆'.repeat(3-n):''; }
function drawCampaign(){
  const c=$('campMap'); if(c.offsetParent===null) return; const r=c.getBoundingClientRect(), d=Math.min(2,devicePixelRatio||1);
  c.width=Math.round(r.width*d); c.height=Math.round(r.height*d);
  const x=c.getContext('2d'); x.setTransform(d,0,0,d,0,0); const w=r.width, h=r.height;
  const rr=mulberry(campKind==='war'?31:57);
  const g=x.createRadialGradient(w/2,h/2,40,w/2,h/2,w*.7); g.addColorStop(0,'#efe0b8'); g.addColorStop(1,'#c9a970'); x.fillStyle=g; x.fillRect(0,0,w,h);
  for(let i=0;i<600;i++){x.fillStyle=`rgba(120,80,30,${rr()*.06})`;x.fillRect(rr()*w,rr()*h,2+rr()*6,1+rr()*3);}
  x.strokeStyle='rgba(60,90,120,.55)'; x.lineWidth=3; x.beginPath(); for(let i=0;i<=40;i++){const t=i/40; const px=w*(.44+.05*Math.sin(t*7)), py=t*h; i?x.lineTo(px,py):x.moveTo(px,py);} x.stroke();
  x.fillStyle='rgba(60,90,120,.35)'; x.beginPath(); x.ellipse(w*.9,h*.85,w*.08,h*.06,0,0,7); x.fill();
  const tree=(px,py)=>{x.fillStyle='#5a7a3a';x.beginPath();x.arc(px,py,4,0,7);x.fill();x.fillStyle='#3e5a2a';x.beginPath();x.arc(px+1,py+1,2.4,0,7);x.fill();};
  for(const [cx,cy,n] of [[.1,.2,14],[.3,.1,12],[.25,.88,10],[.62,.45,9],[.95,.4,10],[.75,.9,8]]) for(let i=0;i<n;i++) tree(cx*w+(rr()-.5)*70,cy*h+(rr()-.5)*40);
  const hill=(px,py)=>{x.strokeStyle='#7a5a34';x.lineWidth=1.5;x.beginPath();x.moveTo(px-9,py+5);x.lineTo(px,py-6);x.lineTo(px+9,py+5);x.stroke();};
  for(const [cx,cy,n] of [[.55,.1,6],[.78,.08,5],[.62,.85,5],[.97,.15,3]]) for(let i=0;i<n;i++) hill(cx*w+(rr()-.5)*80,cy*h+(rr()-.5)*30);
  const S=SITES[campKind], Ls=campLevels();
  x.setLineDash([5,5]); x.strokeStyle='rgba(90,50,20,.6)'; x.lineWidth=1.6; x.beginPath(); S.forEach((s,i)=>i?x.lineTo(s.x*w,s.y*h):x.moveTo(s.x*w,s.y*h)); x.stroke(); x.setLineDash([]);
  x.font='italic 16px "IM Fell English", Georgia, serif'; x.fillStyle='rgba(60,35,15,.75)'; x.textAlign='left'; x.fillText(campKind==='war'?'The March of Varn, 1083 to 1088':'The March of Varn, after the war',14,24);
  S.forEach((s,i)=>{ const px=s.x*w, py=s.y*h, L=Ls[i]; if(!L) return;
    if(i===menuPick){x.strokeStyle='#d6a03c';x.lineWidth=3;x.beginPath();x.arc(px,py,20,0,7);x.stroke();}
    x.fillStyle=progress[L.id]?'#4a6a2a':'#7e1a14';x.beginPath();x.arc(px,py,14,0,7);x.fill(); x.strokeStyle='#3a0b08';x.lineWidth=2;x.stroke();
    x.fillStyle='#f2d48a';x.font='bold 15px "IM Fell English SC", Georgia, serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String(i+1),px,py+1);
    x.fillStyle='#3a220f';x.font='14px "IM Fell English", Georgia, serif';x.fillText(L.name.replace("The Warlord's ","Warlord's ").replace('The Royal ','Royal '),px,py+28);
    const st=progress[L.id]||0; if(st){x.fillStyle='#9a6d1c';x.font='12px sans-serif';x.fillText(stars(st),px,py+43);} });
}
function renderCampaign(){
  const C=CAMPAIGNS[campKind], Ls=campLevels();
  $('campTitle').textContent=C.name; $('campSub').textContent=C.sub;
  const list=$('lvlList'); list.innerHTML='';
  Ls.forEach((L,i)=>{ const b=document.createElement('button'); b.className='lvl'+(i===menuPick?' on':''); const st=progress[L.id]||0;
    b.innerHTML=`<span class="num">${i+1}</span><span class="nm"><b>${L.name}</b><small>${L.sub} · ${L.tag}</small></span><span class="st">${stars(st)}</span>`;
    b.onclick=()=>{menuPick=i;renderCampaign();}; list.appendChild(b); });
  const L=Ls[menuPick], S=STORY[L.id];
  $('lvlBrief').innerHTML=`<h2>${L.name}</h2><div class="sub">${L.sub}</div><p class="intro">${S?S.intro:''}</p><ul>${L.goals.map(g=>`<li>${g}</li>`).join('')}</ul>`;
  drawCampaign();
}
$('campMap').addEventListener('click',e=>{ const r=e.currentTarget.getBoundingClientRect(); const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height; SITES[campKind].forEach((s,i)=>{ if(i<campLevels().length&&Math.hypot((s.x-px)*r.width,(s.y-py)*r.height)<24){menuPick=i;renderCampaign();} }); });
$('playBtn').addEventListener('click',()=>{ const L=campLevels()[menuPick]; beginLevel(L,{camp:campKind,idx:menuPick,story:true}); });
document.querySelectorAll('.backBtn').forEach(b=>b.addEventListener('click',showTitle));

/* ---------- skirmish setup ---------- */
const SET={kingmaker:{map:0,rivals:1,picks:[0,1,2],diff:'normal',rich:false},siege:{castle:1,side:'attack'},free:{map:0,raids:false,rich:false}};
function mapPreview(spec,W_,H_,marks){
  const c=document.createElement('canvas'), s=2; c.width=W_*s; c.height=H_*s; const x=c.getContext('2d');
  x.fillStyle=spec&&spec.ground==='snow'?'#dfe6ea':spec&&spec.ground==='moor'?'#7a7a4a':'#6f8a44'; x.fillRect(0,0,c.width,c.height);
  const blob=(a,col)=>{ x.fillStyle=col; for(const [bx,by,br] of a||[]){ x.beginPath(); x.ellipse(bx*s,by*s,br*s*1.1,br*s,0,0,7); x.fill(); } };
  blob(spec&&spec.forest,'#2f5a22'); blob(spec&&spec.rock,'#77736a'); blob(spec&&spec.iron,'#8a4f3c');
  x.fillStyle='#2f5a78'; for(const [bx,by,br] of (spec&&spec.lake)||[]){ x.beginPath(); x.ellipse(bx*s,by*s,br*s*1.4,br*s,0,0,7); x.fill(); }
  if(spec&&spec.river){ const R=spec.river; x.strokeStyle='#2f5a78'; x.lineWidth=3.5*s; x.beginPath(); for(let y=0;y<=H_;y++){ const px=(R.cx+R.amp*Math.sin(y/R.per))*s; y?x.lineTo(px,y*s):x.moveTo(px,0);} x.stroke(); x.strokeStyle='#8fa89a'; x.lineWidth=3.5*s; for(const [a,b] of R.fords||[]){ x.beginPath(); for(let y=a;y<=b;y++){ const px=(R.cx+R.amp*Math.sin(y/R.per))*s; y===a?x.moveTo(px,y*s):x.lineTo(px,y*s);} x.stroke(); } }
  for(const m of marks||[]){ x.fillStyle=m.c; x.strokeStyle='#1a0d08'; x.lineWidth=2; x.beginPath(); x.rect((m.x)*s,(m.y)*s,(m.w||4)*s,(m.h||4)*s); x.fill(); x.stroke(); }
  return c.toDataURL();
}
function seg(name,opts,cur,cb){ return `<div class="opt"><h4>${name}</h4><div class="segs">${opts.map(o=>`<button data-set="${cb}" data-v="${o.v}" class="${String(cur)===String(o.v)?'on':''}" ${o.dis?'disabled':''}>${o.n}${o.s?`<small>${o.s}</small>`:''}</button>`).join('')}</div></div>`; }
function showSetup(kind){ SET.kind=kind; show('ovSetup'); renderSetup(); }
function renderSetup(){
  const k=SET.kind, S=SET[k]; let h='';
  if(k==='kingmaker'){
    $('setTitle').textContent='Kingmaker'; $('setSub').textContent='The rival lords of Varn have sworn a pact against you. Break them one by one.';
    h+=`<div class="opt"><h4>Land</h4><div class="maps">${KM_MAPS.map((M,i)=>`<button data-set="map" data-v="${i}" class="map${S.map===i?' on':''}"><img alt="" src="${mapPreview(MAPS[M.id],M.W,M.H,[{x:M.player.x,y:M.player.y,c:'#3f74c2'},...M.slots.map((s,j)=>({x:s.x,y:s.y,c:AI_LORDS[S.picks[j]%3].color}))])}"><b>${M.name}</b><small>${M.desc}</small></button>`).join('')}</div></div>`;
    const max=KM_MAPS[S.map].slots.length; S.rivals=Math.min(S.rivals,max);
    h+=seg('Rivals',[1,2,3].map(n=>({n:String(n),v:n,dis:n>max})),S.rivals,'rivals');
    h+=`<div class="opt"><h4>Who opposes you</h4><div class="lords">${Array.from({length:S.rivals},(_,j)=>{ const L=AI_LORDS[S.picks[j]]; return `<button data-set="pick" data-v="${j}" style="--c:${L.color}"><b>${L.name}</b><small>${{aggressive:'Attacks early and often',builder:'Builds a great castle, slow to march',balanced:'Builds and raids in turn'}[L.style]}</small></button>`; }).join('')}</div><div class="note">Click a lord to swap him for another.</div></div>`;
    h+=seg('Difficulty',[{n:'Easy',v:'easy'},{n:'Normal',v:'normal'},{n:'Hard',v:'hard'}],S.diff,'diff');
    h+=seg('Your start',[{n:'Modest',v:'false'},{n:'Rich',v:'true'}],String(S.rich),'rich');
  } else if(k==='siege'){
    $('setTitle').textContent='Siege'; $('setSub').textContent='One castle, one army at the gates. Pick a side.';
    h+=`<div class="opt"><h4>Castle</h4><div class="maps">${SIEGE.map((C,i)=>`<button data-set="castle" data-v="${i}" class="map${S.castle===i?' on':''}"><img alt="" src="${castleIcon(C.kind)}"><b>${C.name}</b><small>${C.desc}</small></button>`).join('')}</div></div>`;
    h+=seg('Your side',[{n:'Attack',v:'attack',s:'Ladders, rams, siege towers'},{n:'Defend',v:'defend',s:'Hold the walls through every wave'}],S.side,'side');
  } else {
    $('setTitle').textContent='Free build'; $('setSub').textContent='Build the castle you always wanted.';
    h+=`<div class="opt"><h4>Land</h4><div class="maps small">${FREE_MAPS.map((F,i)=>{ const L=LEVELS.find(l=>l.map===F.map)||LEVELS[0]; return `<button data-set="map" data-v="${i}" class="map${S.map===i?' on':''}"><img alt="" src="${mapPreview(MAPS[F.map],L.W,L.H,[{x:L.keep.x,y:L.keep.y,c:'#3f74c2'}])}"><b>${F.name}</b></button>`; }).join('')}</div></div>`;
    h+=seg('Raiders',[{n:'Peaceful',v:'false'},{n:'Raids',v:'true',s:'They grow every time'}],String(S.raids),'raids');
    h+=seg('Your start',[{n:'Modest',v:'false'},{n:'Rich',v:'true'}],String(S.rich),'rich');
  }
  $('setBody').innerHTML=h;
}
const castleIconCache={};
function castleIcon(kind){
  if(castleIconCache[kind]) return castleIconCache[kind];
  const c=document.createElement('canvas'); c.width=240; c.height=170; const x=c.getContext('2d');
  x.fillStyle='#6f8a44'; x.fillRect(0,0,240,170);
  const P=castlePlan(kind,0,0,'W',1), s=Math.min(220/(P.w+2),150/(P.h+2)), ox=(240-(P.w+2)*s)/2+s, oy=(170-(P.h+2)*s)/2+s;
  x.fillStyle='#2f5a78'; for(const [mx,my] of P.moat) x.fillRect(ox+mx*s,oy+my*s,s,s);
  x.fillStyle='#9a9486'; for(const [mx,my] of P.walls) x.fillRect(ox+mx*s,oy+my*s,s,s);
  x.fillStyle='#b5ae9e'; for(const [mx,my] of P.towers) x.fillRect(ox+mx*s,oy+my*s,2*s,2*s); for(const [mx,my] of P.great) x.fillRect(ox+mx*s,oy+my*s,3*s,3*s);
  x.fillStyle='#7a746a'; x.fillRect(ox+P.keep.x*s,oy+P.keep.y*s,4*s,4*s);
  x.fillStyle='#86603a'; x.fillRect(ox+P.gate.x*s,oy+P.gate.y*s,2*s,3*s);
  return castleIconCache[kind]=c.toDataURL();
}
$('setBody').addEventListener('click',e=>{
  const b=e.target.closest('[data-set]'); if(!b||b.disabled) return; const k=SET.kind, S=SET[k], v=b.dataset.v, f=b.dataset.set;
  if(f==='pick'){ const j=+v; let n=(S.picks[j]+1)%AI_LORDS.length; S.picks[j]=n; }
  else if(f==='rich'||f==='raids') S[f]=v==='true';
  else if(f==='diff'||f==='side') S[f]=v;
  else S[f]=+v;
  renderSetup();
});
$('setGo').addEventListener('click',()=>{
  const k=SET.kind, S=SET[k];
  if(k==='kingmaker') beginLevel(kingmakerLevel(S.map,S.picks.slice(0,S.rivals),S.diff,S.rich),{});
  else if(k==='siege') beginLevel(siegeLevel(S.castle,S.side),{});
  else beginLevel(freeLevel(S.map,S.raids,S.rich),{});
});

/* ---------- story scroll ---------- */
function showStory(L,outro){
  const S=STORY[L.id]; if(!S) return false;
  $('storyTitle').textContent=L.name; $('storySub').textContent=outro?'Afterward':L.sub;
  $('storyText').textContent=outro?S.outro:S.intro;
  $('storyGoals').innerHTML=outro?'':`<ul>${L.goals.map(g=>`<li>${g}</li>`).join('')}</ul>`;
  $('storyGo').textContent=outro?'Continue':'Begin';
  $('storyGo').onclick=()=>{ $('ovStory').hidden=true; if(outro) showEnd(); else { running=true; setSpeed(1); } };
  show('ovStory'); return true;
}

/* ---------- start a level ---------- */
function beginLevel(L,opts){
  audioInit(); if(V3&&V3.on){ V3.on=false; V3.cv.hidden=true; cv.classList.remove('over3d'); syncViewBtn(); }
  current={L,...(opts||{})};
  startLevel(L); afterStart(opts&&opts.story);
}
function afterStart(story){
  mode=null; G.tab=G.tab||'ind'; setGameUI(true); renderTabs(); renderItems(); autoT=0;
  cam.z=VW<700?0.72:1; centerOn(G.keep.x+2,G.keep.y+3);
  hideAll();
  updateTop(); updateInfo(); syncDock();
  if(story && showStory(G.L,false)){ running=false; setSpeed(0); return; }
  running=true; setSpeed(1);
  toast(G.L.name,'big');
}

/* ---------- pause, save and load ---------- */
$('menuBtn').addEventListener('click',()=>{ if(!G||G.attract) return; setSpeed(0); show('ovPause'); });
$('resumeBtn').addEventListener('click',()=>{ $('ovPause').hidden=true; setSpeed(prevSpeed||1); });
$('restartBtn').addEventListener('click',()=>{ if(current&&current.L) beginLevel(current.L,{...current,story:false}); });
$('quitBtn').addEventListener('click',()=>{ setGameUI(false); showTitle(); });
$('saveBtn').addEventListener('click',()=>showLoad('save'));
$('pLoadBtn').addEventListener('click',()=>showLoad('pause'));
$('view3dBtn').addEventListener('click',()=>{ $('ovPause').hidden=true; setSpeed(prevSpeed||1); toggle3D(); });
let loadFrom='title';
async function showLoad(from){
  loadFrom=from; show('ovLoad');
  $('loadTitle').textContent=from==='save'?'Save game':'Load game';
  $('loadNote').textContent=Store.ok?'Saves are kept with your account, so they follow you to any device.':'Saves are kept in this browser.';
  $('slotList').innerHTML='<div class="note">Reading saves…</div>';
  const S=await listSaves();
  const slots=from==='save'?['s1','s2','s3']:['auto','s1','s2','s3'];
  $('slotList').innerHTML=slots.map(k=>{ const s=S[k]; const meta=s?`<b>${s.name}</b><small>${s.sub?s.sub+' · ':''}${s.date||''} · played ${clock(s.time||0)} · ${new Date(s.when).toLocaleString()}</small>`:'<b>Empty</b><small>Nothing saved here yet</small>';
    const btn=from==='save'?`<button class="go" data-save="${k}">Save here</button>`:(s?`<button class="go" data-load="${k}">Load</button>`:'');
    return `<div class="slot"><span class="sn">${slotName(k)}</span><span class="sm">${meta}</span>${btn}</div>`; }).join('');
}
$('slotList').addEventListener('click',async e=>{
  const sv=e.target.closest('[data-save]'), ld=e.target.closest('[data-load]');
  if(sv){ sv.disabled=true; sv.textContent='Saving'; await saveGame(sv.dataset.save); showLoad('save'); }
  if(ld) doLoad(ld.dataset.load);
});
$('loadBack').addEventListener('click',()=>{ if(loadFrom==='title') showTitle(); else show('ovPause'); });
async function doLoad(slot){
  if(V3&&V3.on){ V3.on=false; V3.cv.hidden=true; cv.classList.remove('over3d'); syncViewBtn(); }
  const S=await loadGame(slot); if(!S) return;
  current={L:G.L, camp:G.L.camp, idx:G.L.camp?LEVELS.filter(l=>l.camp===G.L.camp).indexOf(LEVELS.find(l=>l.id===G.L.id)):undefined};
  mode=null; setGameUI(true); renderTabs(); renderItems(); autoT=0;
  hideAll(); cam.z=S.zoom||1; centerOn(S.view.x,S.view.y);
  running=true; setSpeed(1); updateTop(); updateInfo(); syncDock();
  toast(`Loaded: ${G.L.name}`,'big');
}

/* ---------- custom scenarios and the editor ---------- */
async function showCustom(){
  show('ovCustom');
  $('scenList').innerHTML='<div class="note">Reading your scenarios…</div>';
  const list=await listScenarios();
  $('scenList').innerHTML=list.length?list.map(s=>`<div class="slot"><span class="sm"><b>${s.name}</b><small>${s.W}×${s.H} · ${s.ais} rival${s.ais===1?'':'s'} · ${{conquer:'Conquer',survive:'Survive',free:'Free build'}[s.goal]||s.goal}</small></span><button class="go" data-play="${s.id}">Play</button><button class="go alt" data-edit="${s.id}">Edit</button><button class="go alt" data-del="${s.id}">Delete</button></div>`).join(''):'<div class="note">No scenarios yet. Start a new map above.</div>';
}
$('newMaps').addEventListener('click',e=>{ const b=e.target.closest('[data-size]'); if(!b) return; openEditor(+b.dataset.size,null); });
$('scenList').addEventListener('click',async e=>{
  const p=e.target.closest('[data-play]'), ed=e.target.closest('[data-edit]'), del=e.target.closest('[data-del]');
  if(p){ const L=await loadScenario(p.dataset.play); if(L) beginLevel(L,{}); else toast('That scenario could not be read','warn'); }
  if(ed){ const L=await loadScenario(ed.dataset.edit); if(L) openEditor(0,L); }
  if(del){ if(del.dataset.armed){ await deleteScenario(del.dataset.del); showCustom(); } else { del.dataset.armed='1'; del.textContent='Sure?'; } }
});
function openEditor(size,L){
  if(V3&&V3.on){ V3.on=false; V3.cv.hidden=true; cv.classList.remove('over3d'); syncViewBtn(); }
  running=false; setSpeed(0); startEditor(size,L); hideAll(); setGameUI(true,true);
  cam.z=VW<700?.5:.7; centerOn(W/2,H/2); renderEditorPanel(); syncDock();
  toast('Paint the land, then place your keep and your rivals','big');
}
function renderEditorPanel(){
  if(!G||!G.editor) return;
  $('edTools').innerHTML=ED_TOOLS.map(t=>`<button data-tool="${t.id}" class="${ED.tool===t.id?'on':''}" title="${t.name}"><i style="background:${t.col}"></i>${t.name}</button>`).join('')+
    `<span class="edsep"></span>${[1,2,3,4].map(n=>`<button data-brush="${n}" class="br${ED.brush===n?' on':''}" title="Brush size ${n}"><i style="width:${4+n*3}px;height:${4+n*3}px"></i></button>`).join('')}`;
  const why=edValidate();
  setHTML($('info'),`<h3>Scenario</h3>
    <label class="fld">Name <input id="edName" maxlength="40" value="${(ED.name||'').replace(/"/g,'&quot;')}"></label>
    <div class="acts">${['conquer','survive','free'].map(g=>`<button data-edgoal="${g}" class="${ED.goal===g?'hot':''}">${{conquer:'Conquer',survive:'Survive waves',free:'Free build'}[g]}</button>`).join('')}</div>
    <div class="acts">${['easy','normal','hard'].map(d=>`<button data-eddiff="${d}" class="${ED.diff===d?'hot':''}">${d[0].toUpperCase()+d.slice(1)}</button>`).join('')}<button data-edrich="1" class="${ED.rich?'hot':''}">Rich start</button></div>
    <div class="obj">${ED.keep?'Your keep is placed.':'<b>Place your keep.</b>'} ${ED.ais.length} rival${ED.ais.length===1?'':'s'} · ${ED.estates.length} estate${ED.estates.length===1?'':'s'}. Next rival: ${AI_LORDS[ED.lord].name}.</div>
    ${why?`<div class="obj warnline">${why}</div>`:''}
    <div class="acts"><button data-ed="play" class="hot">Save and play</button><button data-ed="save">Save</button><button data-ed="gen">New land</button><button data-ed="exit">Exit</button></div>`);
}
$('edTools').addEventListener('click',e=>{ const t=e.target.closest('[data-tool]'), b=e.target.closest('[data-brush]'); if(t) ED.tool=t.dataset.tool; if(b) ED.brush=+b.dataset.brush; renderEditorPanel(); });
$('info').addEventListener('input',e=>{ if(e.target.id==='edName') ED.name=e.target.value; });
$('info').addEventListener('click',async e=>{
  if(!G||!G.editor) return;
  const g=e.target.closest('[data-edgoal]'), d=e.target.closest('[data-eddiff]'), r=e.target.closest('[data-edrich]'), a=e.target.closest('[data-ed]');
  if(g) ED.goal=g.dataset.edgoal; if(d) ED.diff=d.dataset.eddiff; if(r) ED.rich=!ED.rich;
  if(a){ const k=a.dataset.ed;
    if(k==='gen'){ edGenerate(true); toast('A new land'); }
    if(k==='exit'){ G=null; showCustom(); setGameUI(false); attract(); show('ovCustom'); return; }
    if(k==='save'||k==='play'){ const why=edValidate(); if(why){ toast(why,'warn'); sfx('deny'); }
      else { const L=edLevel(); try{ await saveScenario(L); toast(`Saved “${L.name}”`); }catch(err){ toast('Could not save the scenario','warn'); } if(k==='play') beginLevel(L,{}); } }
  }
  uiHold=false; renderEditorPanel();
});

/* ---------- end of a level ---------- */
let endInfo=null;
function endGame(win,why){
  if(G.over) return; G.over=true; G.endWhy=win?'win':why;
  if(G.attract){ return; }
  running=false; sfx(win?'win':'lose');
  const kf=G.keep.dead?0:G.keep.hp/G.keep.maxHp;
  const st=win?((kf>.66&&G.lostB<=4)?3:kf>.33?2:1):0;
  if(win&&G.L.camp){ progress[G.L.id]=Math.max(progress[G.L.id]||0,st); saveProgress(); }
  endInfo={win,why,stars:st,kf};
  setTimeout(()=>{ if(win&&G.L.camp&&STORY[G.L.id]) showStory(G.L,true); else showEnd(); },win?900:1400);
}
function showEnd(){
  const {win,why,stars:st,kf}=endInfo;
  $('endTitle').textContent=win?`${G.L.name} is won`:'Defeat';
  $('endSub').textContent=win?(G.L.mode==='kingmaker'?'Every rival lord has fallen':GOAL_WIN[G.L.goal.type]||'Victory'):(why||'Your keep has fallen');
  $('endStars').textContent=win?stars(st):'';
  const t=Math.floor(G.time);
  $('endStats').innerHTML=`<span>Time</span><b>${clock(t)}</b><span>Keep standing</span><b>${Math.round(kf*100)}%</b><span>Rank reached</span><b>${RANKS[rankOf(G.honorTotal)].n}</b><span>Enemies slain</span><b>${G.kills}</b><span>Your people lost</span><b>${G.lostU}</b><span>Buildings lost</span><b>${G.lostB}</b>`;
  const camp=current&&current.camp, n=camp?LEVELS.filter(l=>l.camp===camp).length:0;
  $('nextBtn').hidden=!(win&&camp&&current.idx<n-1);
  show('ovEnd');
}
$('againBtn').addEventListener('click',()=>{ if(current) beginLevel(current.L,{...current,story:false}); });
$('nextBtn').addEventListener('click',()=>{ const Ls=LEVELS.filter(l=>l.camp===current.camp); const i=current.idx+1; menuPick=i; beginLevel(Ls[i],{camp:current.camp,idx:i,story:true}); });
$('endMenuBtn').addEventListener('click',()=>{ setGameUI(false); if(current&&current.camp) { attract(); showCampaign(current.camp); } else showTitle(); });
document.querySelectorAll('.helpBtn').forEach(b=>b.addEventListener('click',()=>{ $('ovHelp').hidden=false; }));
$('helpClose').addEventListener('click',()=>{ $('ovHelp').hidden=true; });
document.querySelectorAll('.soundBtn').forEach(b=>b.addEventListener('click',()=>{ AU.on=!AU.on; audioInit(); syncSound(); try{localStorage.setItem('hm-sound',AU.on?'on':'off');}catch(e){} }));
document.querySelectorAll('.musicBtn').forEach(b=>b.addEventListener('click',()=>setMusic(!AU.music)));
syncSound();
document.addEventListener('visibilitychange',()=>{ if(document.hidden && running && speed>0 && G && !G.attract) setSpeed(0); });
function onProgressLoaded(){ if(!$('ovCamp').hidden) renderCampaign(); }

/* ---------- loop ---------- */
let last=performance.now(), acc=0, uiT=0, miniT=0, autoT=0;
function frame(now){
  const dt=Math.min(0.1,(now-last)/1000); last=now;
  if(G && !G.over && !G.editor && running && speed>0){
    acc+=dt*speed; let n=0;
    while(acc>=STEP && n<14){update(STEP);acc-=STEP;n++;}
    if(n>=14) acc=0;
    if(!G.attract){ autoT+=dt*speed; if(autoT>180){ autoT=0; saveGame('auto',true); } }
  } else if(G && G.over && G.parts){ for(const q of G.parts){q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;} G.parts=G.parts.filter(q=>q.life>0); }
  if(G&&G.attract) attractTick(dt);
  if(G&&G.moveMark) G.moveMark.t-=dt*1.5;
  if(G&&!G.attract) panKeys(dt);
  render();
  musicTick();
  uiT+=dt; if(uiT>.25&&G&&!G.attract){uiT=0; updateTop(); if(!infoLock&&!G.editor) updateInfo();}
  miniT+=dt; if(miniT>.3){miniT=0; if(G&&!G.attract) drawMini();}
  requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe(stage);
const rootS=document.documentElement.style;
function syncDock(){ const dk=document.body.classList.contains('editing')?$('edDock'):$('dock'); const dh=dk.offsetHeight, lh=$('ledger').offsetHeight, phone=innerWidth<=760; rootS.setProperty('--dockH',dh+'px'); rootS.setProperty('--ledH',(phone?lh+6:0)+'px'); INS.top=$('top').offsetHeight+4; INS.bot=(phone?dh+lh+6:Math.max(dh,lh))+14; clampCam(); }
new ResizeObserver(syncDock).observe($('dock'));
new ResizeObserver(syncDock).observe($('edDock'));
new ResizeObserver(syncDock).observe($('ledger'));
new ResizeObserver(syncDock).observe($('top'));
new ResizeObserver(()=>{ if(!$('ovCamp').hidden) drawCampaign(); }).observe($('campMap'));
addEventListener('pointerdown',()=>audioInit(),{capture:true});
resize();
showTitle();
window.__hm={get G(){return G;},update,setSpeed,tryBuild,recruit,commandMove,launchWave,clickAt,s2w,w2s,addArchers,sendDown,assignSquad,selectSquad,setGate,toggleAllGates,findPath,repairAll,act,setMode,beginLevel,crewWith,trade,startLevel,kingmakerLevel,siegeLevel,freeLevel,saveGame,loadGame,doLoad,snapshot,restore,toggle3D,openEditor,edLevel,ED,holdCourt,buyEstate,sendCart,showTitle,showSetup,showCampaign,get running(){return running;}};
requestAnimationFrame(frame);
