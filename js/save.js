'use strict';
/* Hollowmere Keep: save games, progress and custom scenarios.
   Stored per player in the artifact's private store when available, otherwise in this browser. */
const Store={db:null,uid:null,busy:{},ok:false};
Store.ready=(async()=>{
  try{
    if(!window.claude||typeof window.claude.use!=='function') return false;
    const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
    if(!db||!user) return false;
    const id=await user.id(); if(!id) return false;
    Store.db=db; Store.uid=id; Store.ok=true; return true;
  }catch(e){ return false; }
})();
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
function docRef(id){ return Store.db.collection('data/users/'+Store.uid).doc(id); }
async function storePut(id,body){
  await Store.ready;
  let cloud=false;
  if(Store.ok){
    while(Store.busy[id]) await Store.busy[id].catch(()=>{});
    const p=docRef(id).set(body); Store.busy[id]=p;
    try{ await p; cloud=true; }catch(e){ console.warn('save to store failed',e&&e.code); }
    finally{ if(Store.busy[id]===p) delete Store.busy[id]; }
  }
  const local=lsSet('hm-doc-'+id,JSON.stringify(body));
  if(!cloud&&!local) throw new Error('nowhere to save');
  return cloud?'cloud':'local';
}
async function storeGet(id){
  await Store.ready;
  if(Store.ok){ try{ const s=await docRef(id).get(); if(s.exists) return s.data(); }catch(e){} }
  const raw=lsGet('hm-doc-'+id); if(raw){ try{ return JSON.parse(raw); }catch(e){} }
  return null;
}
async function storeDel(id){
  await Store.ready; lsDel('hm-doc-'+id);
  if(Store.ok){ try{ await docRef(id).delete(); }catch(e){} }
}
async function storeList(prefix){
  await Store.ready;
  const out=new Map();
  try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('hm-doc-'+prefix)){ try{ out.set(k.slice(7),JSON.parse(localStorage.getItem(k))); }catch(e){} } } }catch(e){}
  if(Store.ok){ try{ const q=await Store.db.collection('data/users/'+Store.uid).get(); for(const d of q.docs) if(d.id.startsWith(prefix)) out.set(d.id,d.data()); }catch(e){} }
  return [...out.entries()].map(([id,b])=>({id,...b}));
}

/* compact text: gzip then base64 when the browser can, plain JSON otherwise */
async function pack(obj){
  const json=JSON.stringify(obj);
  if(typeof CompressionStream!=='undefined'){
    try{ const s=new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')); const buf=new Uint8Array(await new Response(s).arrayBuffer()); return {z:1,data:bytesToB64(buf)}; }catch(e){}
  }
  return {z:0,data:json};
}
async function unpack(b){
  if(!b.z) return JSON.parse(b.data);
  const bytes=b64ToBytes(b.data);
  const s=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(s).text());
}

/* ---------- serialize the running game ---------- */
function enc(v,sets){
  if(typeof v==='number') return isFinite(v)?Math.round(v*1000)/1000:{$n:String(v)};
  if(v===null||typeof v!=='object') return v===undefined?null:v;
  if(v.def) return sets.has(v)?{$r:v.id}:null;
  if(Array.isArray(v)) return v.map(x=>enc(x,sets));
  const o={}; for(const k in v){ const x=v[k]; if(x===undefined||typeof x==='function') continue; o[k]=enc(x,sets); } return o;
}
function encEntity(e,sets){ const o={}; for(const k in e){ if(k==='def') continue; const x=e[k]; if(x===undefined||typeof x==='function') continue; o[k]=enc(x,sets); } return o; }
function dec(v,map){
  if(v===null||typeof v!=='object') return v;
  if(Array.isArray(v)) return v.map(x=>dec(x,map));
  if(v.$n!==undefined) return Number(v.$n);
  if(v.$r!==undefined) return map.get(v.$r)||null;
  const o={}; for(const k in v) o[k]=dec(v[k],map); return o;
}
const SKIP_G=new Set(['parts','texts','blds','units','L','factors','selE','moveMark']);
function snapshot(){
  const sets=new Set([...G.blds,...G.units]);
  const g={}; for(const k in G){ if(SKIP_G.has(k)) continue; const x=G[k]; if(x===undefined||typeof x==='function') continue; g[k]=enc(x,sets); }
  return {v:4, W, H, L:G.L, ter:bytesToB64(ter), treeW:bytesToB64(treeW), view:viewCenter(), zoom:cam.z,
    blds:G.blds.map(b=>encEntity(b,sets)), units:G.units.map(u=>encEntity(u,sets)), G:g};
}
function restore(S){
  const L=S.L; LV=L; W=S.W; H=S.H; allocMap();
  ter.set(b64ToBytes(S.ter).subarray(0,N)); treeW.set(b64ToBytes(S.treeW).subarray(0,N));
  const r=mulberry(L.seed||1); for(let i=0;i<N;i++) shade[i]=r();
  const map=new Map(), blds=[], units=[];
  for(const o of S.blds){ const b={def:DEF[o.type]}; map.set(o.id,b); blds.push([b,o]); }
  for(const o of S.units){ const u={def:UD[o.kind]}; map.set(o.id,u); units.push([u,o]); }
  for(const [b,o] of blds) for(const k in o) b[k]=dec(o[k],map);
  for(const [u,o] of units) for(const k in o) u[k]=dec(o[k],map);
  const g=dec(S.G,map);
  G={...g, L, blds:blds.map(p=>p[0]).filter(b=>b.def), units:units.map(p=>p[0]).filter(u=>u.def), parts:[], texts:[], selE:null, factors:null};
  for(const b of G.blds) for(let j=0;j<b.h;j++)for(let i=0;i<b.w;i++) if(inb(b.x+i,b.y+j)) occB[idx(b.x+i,b.y+j)]=b;
  for(const u of G.units) if(u.tree>=0) reserved[u.tree]=1;
  G.flowDirty=true; G.started=true; G.over=false; G.lastSay={};
  buildTerrain(); computeFlow();
  return S;
}
async function saveGame(slot,quiet){
  if(!G||G.over||G.editor) return false;
  try{
    const S=snapshot(), p=await pack(S);
    if(p.data.length>250000){ if(!quiet) toast('This game is too large to save','warn'); return false; }
    const body={kind:'save', slot, name:G.L.name, sub:G.L.sub||'', mode:G.mode, time:Math.floor(G.time), date:dateStr(), when:Date.now(), ...p};
    const where=await storePut('save-'+slot,body);
    if(!quiet) toast(slot==='auto'?'Autosaved':`Saved to ${slotName(slot)}${where==='local'?' in this browser':''}`);
    return true;
  }catch(e){ if(!quiet) toast('Could not save the game','warn'); return false; }
}
async function loadGame(slot){
  const b=await storeGet('save-'+slot); if(!b){ toast('That slot is empty','warn'); return false; }
  try{ const S=await unpack(b); restore(S); return S; }catch(e){ console.error(e); toast('That save could not be read','warn'); return false; }
}
async function listSaves(){ const all=await storeList('save-'); const by={}; for(const s of all) by[s.slot]=s; return by; }
function slotName(s){ return s==='auto'?'Autosave':`Slot ${s.slice(1)}`; }

/* ---------- campaign progress ---------- */
let progress={}; try{ progress=JSON.parse(lsGet('hm-progress')||'{}')||{}; }catch(e){ progress={}; }
(async()=>{ const b=await storeGet('progress'); if(b&&b.stars){ for(const [k,v] of Object.entries(b.stars)) progress[k]=Math.max(progress[k]||0,v||0); if(typeof onProgressLoaded==='function') onProgressLoaded(); } })();
function saveProgress(){ lsSet('hm-progress',JSON.stringify(progress)); storePut('progress',{kind:'progress',stars:progress}).catch(()=>{}); }

/* ---------- custom scenarios ---------- */
async function saveScenario(L){ const id='scen-'+L.sid; const p=await pack(L); return storePut(id,{kind:'scenario',name:L.name,W:L.W,H:L.H,ais:(L.ais||[]).length,goal:L.goal.type,when:Date.now(),...p}); }
async function listScenarios(){ return (await storeList('scen-')).sort((a,b)=>(b.when||0)-(a.when||0)); }
async function loadScenario(id){ const b=await storeGet(id); if(!b) return null; try{ return await unpack(b); }catch(e){ return null; } }
async function deleteScenario(id){ await storeDel(id); }
