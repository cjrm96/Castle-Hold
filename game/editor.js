'use strict';
/* Castle Siege: scenario editor */
const ED={on:false,tool:'tree',brush:2,name:'My scenario',sid:'',seed:1,keep:null,ais:[],estates:[],goal:'conquer',diff:'normal',rich:false,lord:0,painting:false};
const ED_TOOLS=[
  {id:'grass',name:'Grass',ter:0,col:'#5c7a34'},{id:'tree',name:'Forest',ter:1,col:'#2f5a22'},{id:'rock',name:'Rock',ter:2,col:'#77736a'},
  {id:'iron',name:'Iron',ter:4,col:'#7d4f3c'},{id:'water',name:'Water',ter:5,col:'#2f5a78'},{id:'ford',name:'Ford',ter:6,col:'#557a7c'},
  {id:'keep',name:'Your keep',col:'#3f74c2'},{id:'ai',name:'Rival lord',col:'#b23c2c'},{id:'estate',name:'Estate',col:'#d6a03c'},{id:'erase',name:'Remove marker',col:'#6b5a40'},{id:'pan',name:'Pan',col:'#8a7a5a'},
];
const ESTATE_KINDS=[{yield:{wheat:10},desc:'wheat',cost:40},{yield:{gold:20},desc:'gold',cost:50},{yield:{stone:8},desc:'stone',cost:40},{yield:{iron:6},desc:'iron',cost:50},{yield:{apples:12},desc:'apples',cost:40}];
const ESTATE_NAMES=['Ashby','Fenwick','Harrowgate','Coldbrook','Lakeholm','Thornfield','Mossgate','Redwater','Elmstead','Greyford','Oakhurst','Wyndham'];
const ED_SIZES=[{W:64,H:44,n:'Small'},{W:72,H:48,n:'Medium'},{W:84,H:58,n:'Large'}];

function editorG(){
  G={L:LV, editor:true, time:0, R:{gold:0}, blds:[], units:[], proj:[], parts:[], decals:[], texts:[], estates:ED.estates, ladders:[], ais:edAis(),
    home:{camp:{x:-99,y:-99}}, rally:{x:-99,y:-99}, snow:0, monthLen:70, mods:[], spawnQ:[], wave:0, nextWave:1e9, over:false, selB:null, selE:null, lastSay:{}, honor:0, honorTotal:0, pop:70};
}
function edAis(){ return ED.ais.map((a,i)=>{ const L=AI_LORDS[a.lord]; return {id:i+1,name:L.name,color:L.color,dark:L.dark,alive:true}; }); }
function startEditor(size,fromL){
  const S=fromL?{W:fromL.W,H:fromL.H}:ED_SIZES[size||0];
  Object.assign(ED,{on:true,tool:'tree',keep:null,ais:[],estates:[],seed:(Math.random()*1e6)|0,sid:'',name:'My scenario',goal:'conquer',diff:'normal',rich:false,lord:0});
  W=S.W; H=S.H; LV={id:'editor',map:'custom',W,H,seed:ED.seed,keep:{x:-50,y:-50}}; allocMap();
  const r=mulberry(ED.seed); for(let i=0;i<N;i++) shade[i]=r();
  if(fromL){
    ter.set(b64ToBytes(fromL.terrain).subarray(0,N)); for(let i=0;i<N;i++) treeW[i]=ter[i]===1?3:0;
    Object.assign(ED,{sid:fromL.sid,name:fromL.name,keep:{...fromL.keep},ais:(fromL.ais||[]).map(a=>({x:a.x,y:a.y,lord:a.lord})),estates:(fromL.estates||[]).map(e=>({...e,owner:0,claim:0,store:{}})),goal:fromL.goal.type,diff:(fromL.ais&&fromL.ais[0]&&fromL.ais[0].diff)||'normal',rich:!!fromL.rich});
  } else edGenerate(false);
  editorG(); buildTerrain();
}
function edGenerate(redraw){
  const r=mulberry(ED.seed=(Math.random()*1e6)|0);
  ter.fill(0); treeW.fill(0);
  const blob=(bx,by,br,val,prob)=>{ for(let y=Math.floor(by-br-1);y<=by+br+1;y++)for(let x=Math.floor(bx-br-1);x<=bx+br+1;x++){ if(!inb(x,y))continue; if(Math.hypot(x-bx,y-by)<br*(0.75+0.45*r())&&r()<prob) ter[idx(x,y)]=val; } };
  const nF=6+((W*H)/700|0); for(let k=0;k<nF;k++) blob(r()*W,r()*H,3+r()*4,1,.86);
  for(let k=0;k<(W*H)/40;k++){ const x=(r()*W)|0,y=(r()*H)|0; if(!ter[idx(x,y)]) ter[idx(x,y)]=1; }
  for(let k=0;k<4;k++) blob(r()*W,r()*H,1.5+r()*1.4,2,1);
  for(let k=0;k<3;k++) blob(r()*W,r()*H,1.2+r(),4,1);
  if(r()<.6){ const cx=W*(.3+r()*.4), amp=2+r()*2, per=5+r()*3, f1=(r()*H*.4)|0, f2=(H*.55+r()*H*.3)|0;
    for(let y=0;y<H;y++){ const c=cx+amp*Math.sin(y/per); for(let x=Math.floor(c-2);x<=Math.ceil(c+2);x++){ if(inb(x,y)&&Math.abs(x+.5-c)<1.8) ter[idx(x,y)]=(Math.abs(y-f1)<=1||Math.abs(y-f2)<=1)?6:5; } } }
  else for(let k=0;k<2;k++){ const bx=r()*W,by=r()*H,br=2+r()*2; for(let y=Math.floor(by-br-1);y<=by+br+1;y++)for(let x=Math.floor(bx-br*1.4-1);x<=bx+br*1.4+1;x++){ if(inb(x,y)&&Math.hypot((x-bx)/1.4,y-by)<br) ter[idx(x,y)]=5; } }
  for(let i=0;i<N;i++) if(ter[i]===1) treeW[i]=3;
  if(redraw) buildTerrain();
}
function edPaint(w){
  const t=ED_TOOLS.find(t=>t.id===ED.tool); if(t.ter===undefined) return;
  const R=ED.brush-1, cx=Math.floor(w.x), cy=Math.floor(w.y);
  for(let j=-R;j<=R;j++)for(let i=-R;i<=R;i++){ if(i*i+j*j>R*R+R) continue; const x=cx+i,y=cy+j; if(!inb(x,y)) continue; const q=idx(x,y); if(ter[q]===t.ter) continue; ter[q]=t.ter; treeW[q]=t.ter===1?3:0; redrawAround(q); }
}
function edNear(w,r){
  let best=null,bd=r;
  const test=(o,kind,i,cx,cy)=>{ const d=Math.hypot(w.x-cx,w.y-cy); if(d<bd){bd=d;best={kind,i};} };
  if(ED.keep) test(ED.keep,'keep',0,ED.keep.x+2,ED.keep.y+2);
  ED.ais.forEach((a,i)=>test(a,'ai',i,a.x+2,a.y+2));
  ED.estates.forEach((e,i)=>test(e,'estate',i,e.x,e.y));
  return best;
}
function edClick(w){
  const x=Math.floor(w.x), y=Math.floor(w.y);
  if(ED.tool==='keep'){ ED.keep={x:cl(x-2,3,W-7),y:cl(y-2,3,H-12)}; sfx('build'); }
  else if(ED.tool==='ai'){ if(ED.ais.length>=3){ toast('Three rival lords at most','warn'); return; } ED.ais.push({x:cl(x-2,3,W-7),y:cl(y-2,3,H-12),lord:ED.lord}); ED.lord=(ED.lord+1)%AI_LORDS.length; G.ais=edAis(); sfx('build'); }
  else if(ED.tool==='estate'){ if(ED.estates.length>=8){ toast('Eight estates at most','warn'); return; } const k=ESTATE_KINDS[ED.estates.length%ESTATE_KINDS.length]; const used=new Set(ED.estates.map(e=>e.name)); const nm=ESTATE_NAMES.find(n=>!used.has(n))||('Estate '+(ED.estates.length+1));
    ED.estates.push({x:cl(x,3,W-4),y:cl(y,3,H-4),name:nm,...JSON.parse(JSON.stringify(k)),owner:0,claim:0,store:{}}); sfx('build'); }
  else if(ED.tool==='erase'){ const n=edNear(w,4); if(!n) return; if(n.kind==='keep') ED.keep=null; else if(n.kind==='ai'){ ED.ais.splice(n.i,1); G.ais=edAis(); } else ED.estates.splice(n.i,1); sfx('build'); }
  else edPaint(w);
  if(typeof renderEditorPanel==='function') renderEditorPanel();
}
function aiFootprint(a){
  const style=AI_LORDS[a.lord].style, kind=style==='builder'?'large':'small', face=a.x+2<W/2?'E':'W';
  const base=castlePlan(kind,0,0,face,1), ox=a.x-base.keep.x, oy=a.y-base.keep.y;
  const pad=kind==='large'?1:0; return {x:ox-pad,y:oy-pad,w:base.w+pad*2,h:base.h+pad*2,kind};
}
function drawEditor(c){
  const dash=(x,y,w,h,col)=>{ c.save(); c.strokeStyle=col; c.lineWidth=2; c.setLineDash([8,6]); c.strokeRect(x*T,y*T,w*T,h*T); c.restore(); };
  for(const e of ED.estates) drawEstate(c,e);
  if(ED.keep){ const k=ED.keep; dash(k.x-3,k.y-3,15,15,'rgba(120,170,255,.7)'); drawKeep(c,{team:0,type:'keep'},k.x*T,k.y*T,4*T,4*T);
    c.fillStyle='rgba(20,12,8,.78)'; c.font='bold 13px "Alegreya Sans",sans-serif'; c.textAlign='center'; c.fillRect(k.x*T+64-40,k.y*T-30,80,18); c.fillStyle='#bcd6ff'; c.fillText('Your keep',k.x*T+64,k.y*T-21); }
  ED.ais.forEach((a,i)=>{ const f=aiFootprint(a), L=AI_LORDS[a.lord]; const bad=f.x<0||f.y<0||f.x+f.w>W||f.y+f.h>H; dash(f.x,f.y,f.w,f.h,bad?'rgba(255,80,60,.9)':L.color);
    drawKeep(c,{team:1,type:'keep',owner:i+1},a.x*T,a.y*T,4*T,4*T);
    c.fillStyle='rgba(20,12,8,.78)'; c.font='bold 13px "Alegreya Sans",sans-serif'; c.textAlign='center'; const tw=c.measureText(L.name).width+12; c.fillRect(a.x*T+64-tw/2,a.y*T-30,tw,18); c.fillStyle=bad?'#ff9a8a':'#ffd9c8'; c.fillText(L.name+(bad?' (too close to the edge)':''),a.x*T+64,a.y*T-21); });
  if(hover&&!drag){ const t=ED_TOOLS.find(t=>t.id===ED.tool); if(t.ter!==undefined){ c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=1.5; c.beginPath(); c.arc((Math.floor(hover.x)+.5)*T,(Math.floor(hover.y)+.5)*T,(ED.brush-.5)*T,0,7); c.stroke(); } }
}
function edWaves(dirs){
  const out=[]; for(let n=0;n<6;n++){ const w={raider:6+3*n,earcher:3+2*n,dirs:n<2?[dirs[0]]:dirs}; if(n>=1) w.ladder=2+n; if(n>=2) w.ram=1; if(n>=3){ w.eswords=2*n-4; w.stower=1; } if(n>=4) w.ecat=1; if(n===5){ w.warlord=1; w.eknight=3; } out.push(w); } return out;
}
function edValidate(){
  if(!ED.keep) return 'Place your keep first';
  if(ED.goal==='conquer'&&!ED.ais.length) return 'Add at least one rival lord, or pick another goal';
  for(const a of ED.ais){ const f=aiFootprint(a); if(f.x<0||f.y<0||f.x+f.w>W||f.y+f.h>H) return `${AI_LORDS[a.lord].name}'s castle runs off the map. Move it in.`; if(Math.hypot(a.x-ED.keep.x,a.y-ED.keep.y)<22) return `${AI_LORDS[a.lord].name} is too close to your keep`; }
  return '';
}
function edLevel(){
  if(!ED.sid) ED.sid=Date.now().toString(36);
  return customLevel({sid:ED.sid, name:ED.name, W, H, seed:ED.seed, terrain:bytesToB64(ter), keep:ED.keep, ais:ED.ais, estates:ED.estates, rich:ED.rich, goal:ED.goal, diff:ED.diff});
}
/* every custom map, made here or shared by a friend, is built from the same few fields */
function customLevel(f){
  const k=f.keep, west=k.x<f.W/2, dirs=west?['e','ne','se']:['w','n','s'], g=f.goal;
  const goal=g==='conquer'?{type:'conquer'}:g==='survive'?{type:'survive'}:{type:'free'};
  return {id:'custom-'+f.sid, sid:f.sid, mode:'custom', name:f.name||'My map', sub:'Custom map', tag:'Custom', W:f.W, H:f.H, seed:f.seed, map:'custom', terrain:f.terrain,
    keep:{x:k.x,y:k.y}, ais:f.ais.map(a=>({x:a.x,y:a.y,lord:a.lord,diff:f.diff})), estates:f.estates.map(e=>({x:e.x,y:e.y,name:e.name,yield:e.yield,desc:e.desc,cost:e.cost})), rich:f.rich, edDiff:f.diff, edGoal:g,
    start:f.rich?{wood:500,stone:300,iron:60,apples:200,bread:60,gold:2000,bows:10,spears:8,maces:4}:{wood:220,stone:80,apples:120,gold:600,bows:4,spears:4},
    peasants:f.rich?18:12, troops:f.rich?{archer:8,spearman:6,maceman:4}:{archer:4,spearman:4}, prebuilt:['barracks'], honorTotal:f.rich?60:20, honor:f.rich?30:10,
    goal, goals:g==='conquer'?['Defeat every rival lord','Keep your lord and your keep alive']:g==='survive'?['Survive 6 waves','Keep your lord and your keep alive']:['Build as you please','Keep your lord and your keep alive'],
    firstWave:g==='survive'?300:1e9, gap:160, waves:g==='survive'?edWaves(dirs):[], crime:.8, dirt:.8, events:['harvest','merchant','gift','wolves','rats'], evGap:[110,170], date:{y:1093,m:3}};
}
/* ---------- sharing: a map travels as a short code or a small file ---------- */
const SHARE_TAG='CASTLEMAP1:';
async function mapCode(L){
  const f={n:L.name,W:L.W,H:L.H,s:L.seed,t:L.terrain,k:L.keep,a:(L.ais||[]).map(a=>[a.x,a.y,a.lord]),e:(L.estates||[]).map(e=>[e.x,e.y,e.name,e.yield,e.desc,e.cost]),r:L.rich?1:0,g:L.edGoal||(L.goal&&L.goal.type)||'free',d:L.edDiff||((L.ais||[])[0]||{}).diff||'normal'};
  const p=await pack(f); return SHARE_TAG+(p.z?'z'+p.data.replace(/\s/g,''):'j'+p.data);
}
const cleanText=(v,n)=>String(v==null?'':v).replace(/[<>&"'`\u0000-\u001f]/g,'').slice(0,n).trim();
const cleanInt=(v,a,b)=>{ v=Math.round(+v); if(!isFinite(v)) throw new Error('bad number'); return Math.max(a,Math.min(b,v)); };
async function mapFromCode(code){
  code=String(code||'').trim(); if(!code.startsWith(SHARE_TAG)) throw new Error('That is not a Castle Siege map code');
  const kind=code[SHARE_TAG.length], data=code.slice(SHARE_TAG.length+1);
  let f; try{ f=await unpack({z:kind==='z'?1:0,data}); }catch(e){ throw new Error('That map code is damaged or cut short'); }
  if(!f||typeof f!=='object') throw new Error('That map code is damaged or cut short');
  const Wm=cleanInt(f.W,40,128), Hm=cleanInt(f.H,30,80); if(Wm*Hm>128*80) throw new Error('That map is too large');
  const tb=b64ToBytes(String(f.t||'')); if(tb.length<Wm*Hm) throw new Error('The map code is incomplete');
  for(let i=0;i<tb.length;i++) if(tb[i]>7) tb[i]=0;
  const inX=x=>cleanInt(x,1,Wm-6), inY=y=>cleanInt(y,1,Hm-6);
  const ais=(Array.isArray(f.a)?f.a:[]).slice(0,3).map(a=>({x:inX(a[0]),y:inY(a[1]),lord:cleanInt(a[2],0,AI_LORDS.length-1)}));
  const estates=(Array.isArray(f.e)?f.e:[]).slice(0,8).map(e=>{ const y={}; for(const [k,v] of Object.entries(e[3]||{})) if(ALL_RES.includes(k)||k==='gold') y[k]=cleanInt(v,0,50);
    return {x:inX(e[0]),y:inY(e[1]),name:cleanText(e[2],24)||'Estate',yield:y,desc:cleanText(e[4],24),cost:cleanInt(e[5],0,200)}; });
  const goal=['conquer','survive','free'].includes(f.g)?f.g:'free', diff=['easy','normal','hard'].includes(f.d)?f.d:'normal';
  if(goal==='conquer'&&!ais.length) throw new Error('That map has no rivals to conquer');
  return customLevel({sid:Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36), name:cleanText(f.n,40)||'Shared map', W:Wm, H:Hm, seed:cleanInt(f.s,1,1e9),
    terrain:bytesToB64(tb.subarray(0,Wm*Hm)), keep:{x:inX(f.k&&f.k.x),y:inY(f.k&&f.k.y)}, ais, estates, rich:!!f.r, goal, diff});
}
