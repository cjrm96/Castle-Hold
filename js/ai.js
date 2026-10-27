'use strict';
/* Hollowmere Keep: castle templates and AI lords */

/* A castle plan in local coordinates, facing west. Mirrored for east. */
function castlePlan(kind, ox, oy, face, team){
  const P={walls:[],towers:[],great:[],gate:null,keep:null,inner:[],moat:[],oil:[],mangonel:[],ballista:[],camp:null,w:0,h:0};
  let w,h;
  if(kind==='large'){
    w=21; h=17;
    P.great=[[0,0],[0,14]];
    P.towers=[[19,0],[19,15],[9,0],[9,15]];
    P.gate={x:0,y:7};
    P.keep={x:13,y:6};
    P.inner = team===0 ? [['stockpile',5,3],['granary',5,11],['armory',9,12],['barracks',9,3]] : [['barracks',5,3],['chapel',5,11],['hovel',9,12]];
    for(let y=-1;y<=h;y++){ P.moat.push([-1,y]); P.moat.push([w,y]); } for(let x=0;x<w;x++){ P.moat.push([x,-1]); P.moat.push([x,h]); }
    P.oil=[[0,4],[0,6],[0,10],[0,12]];
    P.mangonel=['g0','g1']; P.ballista=['t2','t3'];
    P.camp={x:9.5,y:8.5};
  } else {
    w=15; h=13;
    P.towers=[[0,0],[13,0],[0,11],[13,11]];
    P.gate={x:0,y:5};
    P.keep={x:8,y:4};
    P.inner = team===0 ? [['stockpile',3,1],['granary',3,9],['armory',6,9],['barracks',3,5]] : [['barracks',3,8],['hovel',3,2]];
    P.camp={x:6.5,y:6.5};
  }
  P.w=w; P.h=h;
  for(let x=0;x<w;x++){ P.walls.push([x,0]); P.walls.push([x,h-1]); } for(let y=1;y<h-1;y++){ P.walls.push([0,y]); P.walls.push([w-1,y]); }
  // map local to world, mirroring for an east-facing castle
  const mx=(x,bw)=> face==='E' ? ox+(w-1)-x-(bw-1) : ox+x;
  const T_=([x,y],bw=1)=>[mx(x,bw),oy+y];
  return {
    kind, face, w, h, ox, oy,
    walls:P.walls.map(p=>T_(p)), towers:P.towers.map(p=>T_(p,2)), great:P.great.map(p=>T_(p,3)),
    gate:{x:mx(P.gate.x,2),y:oy+P.gate.y,dir:face}, keep:{x:mx(P.keep.x,4),y:oy+P.keep.y},
    inner:P.inner.map(([t,x,y])=>[t,mx(x,DEF[t].w),oy+y]), moat:P.moat.map(p=>T_(p)), oil:P.oil.map(p=>T_(p)),
    mangonel:P.mangonel, ballista:P.ballista, camp:{x:face==='E'?ox+(w-1)-P.camp.x+1:ox+P.camp.x, y:oy+P.camp.y},
  };
}
function clearTiles(x,y,w,h,v){ for(let j=0;j<h;j++)for(let i=0;i<w;i++){ if(!inb(x+i,y+j)) continue; const q=idx(x+i,y+j); if(ter[q]!==5||v===7){ ter[q]=v||0; treeW[q]=0; } } }
/* builds the whole plan at once (fixed castles); AI lords build it piece by piece instead */
function buildCastle(plan, team, owner){
  const out={towers:[],keep:null,gate:null,walls:[]};
  for(const [x,y] of plan.moat) if(inb(x,y)&&!occB[idx(x,y)]){ ter[idx(x,y)]=7; treeW[idx(x,y)]=0; }
  for(const [x,y] of plan.walls){ if(!inb(x,y)) continue; clearTiles(x,y,1,1); if(!occB[idx(x,y)]) out.walls.push(placeBld('wall',x,y,'E',team,owner)); }
  const replace=(type,x,y,dir)=>{ const dm=dims(type,dir); clearTiles(x,y,dm.w,dm.h); for(let j=0;j<dm.h;j++)for(let i=0;i<dm.w;i++){ const o=occB[idx(x+i,y+j)]; if(o) removeBld(o,false); } return placeBld(type,x,y,dir,team,owner); };
  plan.great.forEach(([x,y],i)=>{ const b=replace('greattower',x,y,'E'); b.tag='g'+i; out.towers.push(b); });
  plan.towers.forEach(([x,y],i)=>{ const b=replace('tower',x,y,'E'); b.tag='t'+i; out.towers.push(b); });
  out.gate=replace('gatehouse',plan.gate.x,plan.gate.y,plan.gate.dir); if(team===1) out.gate.raised=true;
  out.keep=replace('keep',plan.keep.x,plan.keep.y,'E');
  for(const [t,x,y] of plan.inner){ const b=replace(t,x,y,'E'); out[t]=b; }
  for(const b of out.towers){ if(plan.mangonel.includes(b.tag)) b.mangonel={cd:2}; if(plan.ballista.includes(b.tag)) b.ballista={cd:2}; }
  for(const [x,y] of plan.oil){ const b=bAt(x,y); if(b&&b.def.wallish) b.oil={cd:2}; }
  out.walls=out.walls.filter(b=>!b.dead);
  return out;
}
/* defenders for a fixed castle */
function garrisonCastle(built, team, owner, comp, ai){
  const slots=[];
  for(const t of built.towers) for(let k=0;k<t.def.cap;k++) slots.push({b:t,k});
  const walls=built.walls.filter(b=>!b.dead);
  const keepC={x:built.keep.x+2,y:built.keep.y+2};
  const gateC=built.gate?{x:built.gate.x+built.gate.w/2,y:built.gate.y+built.gate.h/2}:keepC;
  const units=[];
  for(const [kind,n] of Object.entries(comp)) for(let i=0;i<n;i++){
    const d=UD[kind]; let u;
    if(d.ranged && slots.length){ const s=slots.shift(); const p=slotPos(s.b,s.k); u=spawnUnit(kind,p.x,p.y,owner); if(team===0){ u.post=s.b; u.slot=s.k; } }
    else if(d.ranged && walls.length){ const w=walls.splice((rand()*walls.length)|0,1)[0]; u=spawnUnit(kind,w.x+.5,w.y+.5,owner); }
    else { const a=rand()*Math.PI*2, r=1+rand()*2.5; const c=rand()<.5?gateC:keepC; u=spawnUnit(kind,c.x+Math.cos(a)*r+(c===gateC?(built.gate.dir==='W'?2.5:-2.5):0),c.y+Math.sin(a)*r,owner); }
    if(team===1){ u.guard={x:u.x,y:u.y}; u.guardR=d.ranged?0:8; u.ai=ai; u.role=d.ranged?'garrison':'guard'; }
    else { u.hold={x:u.x,y:u.y}; }
    units.push(u);
  }
  return units;
}

/* ---------- AI lords ---------- */
const AI_COST={raider:8,earcher:10,exbow:16,eswords:22,eknight:30,ladder:6,ram:40,ecat:60,etreb:90,stower:70,wall:2,tower:25,greattower:45,gatehouse:30,econ:15,barracks:30,chapel:30,hovel:10,moat:1};
const AI_DIFF={easy:{rate:.9,first:480,gap:300,cap:40,size:5},normal:{rate:1.3,first:360,gap:240,cap:60,size:7},hard:{rate:1.8,first:270,gap:180,cap:80,size:9}};
function createAI(spec){
  const lordDef=AI_LORDS[spec.lord];
  const ai={id:G.ais.length+1, name:spec.name||lordDef.name, color:lordDef.color, dark:lordDef.dark, style:spec.style||lordDef.style, diff:AI_DIFF[spec.diff||'normal'],
    alive:true, might:spec.might||80, queue:[], attackN:0, attackT:0, estT:60, garrisonSlots:[], plan:null, keep:null, lord:null, kills:0, fixed:!!spec.fixed};
  G.ais.push(ai);
  ai.attackT=G.time+ai.diff.first*(ai.style==='aggressive'?.85:ai.style==='builder'?1.25:1)*(spec.sortieScale||1);
  ai.sortieScale=spec.sortieScale||1;
  if(spec.built){ // a finished castle (Greywater, Siege mode)
    ai.built=spec.built; ai.keep=spec.built.keep; ai.barracks=spec.built.barracks||null; ai.plan=spec.plan||null;
  } else {
    const face=spec.face||'W', kind=ai.style==='builder'?'large':'small';
    const base=castlePlan(kind,0,0,face,1);
    const ox=spec.x-base.keep.x, oy=spec.y-base.keep.y;
    const plan=castlePlan(kind,ox,oy,face,1); ai.plan=plan;
    clearTiles(plan.keep.x,plan.keep.y,4,4);
    ai.keep=placeBld('keep',plan.keep.x,plan.keep.y,'E',1,ai.id);
    const bar=plan.inner.find(i=>i[0]==='barracks'); if(bar){ clearTiles(bar[1],bar[2],3,3); ai.barracks=placeBld('barracks',bar[1],bar[2],'E',1,ai.id); }
    // build queue: farms first, then the face toward the enemy, then the rest
    const q=[];
    for(let i=0;i<3;i++) q.push({econ:true});
    const faceX=face==='W'?plan.ox:plan.ox+plan.w-1;
    const faceWalls=plan.walls.filter(([x])=>Math.abs(x-faceX)<=0), rest=plan.walls.filter(([x])=>Math.abs(x-faceX)>0);
    plan.towers.forEach(([x,y],i)=>q.push({type:'tower',x,y,tag:'t'+i}));
    plan.great.forEach(([x,y],i)=>q.push({type:'greattower',x,y,tag:'g'+i}));
    for(const [x,y] of faceWalls) q.push({type:'wall',x,y});
    q.push({type:'gatehouse',x:plan.gate.x,y:plan.gate.y,dir:plan.gate.dir});
    for(const [x,y] of rest) q.push({type:'wall',x,y});
    for(const [t,x,y] of plan.inner) if(t!=='barracks') q.push({type:t,x,y});
    for(let i=0;i<3;i++) q.push({econ:true});
    if(kind==='large'){ for(const [x,y] of plan.moat) q.push({type:'moat',x,y}); q.push({upgrade:true}); }
    ai.queue=q;
    // starting economy and guard
    for(let i=0;i<2;i++) aiBuildEcon(ai);
  }
  const L=AI_LORDS[spec.lord];
  const k=ai.keep, lu=spawnUnit(L.unit,k.x+2,k.y+4.6,ai.id); lu.guard={x:lu.x,y:lu.y}; lu.guardR=7; lu.aiLord=true; lu.ai=ai.id; lu.lordName=ai.name;
  if(L.unit==='elord'){ lu.maxHp=lu.hp=UD.elord.hp; }
  ai.lord=lu;
  if(!spec.built) for(let i=0;i<4;i++) aiSpawn(ai,i<2?'earcher':'raider','guard');
  return ai;
}
function aiCenter(ai){ return {x:ai.keep.x+2,y:ai.keep.y+2}; }
function aiBuildEcon(ai){
  const types=['orchard','woodcutter','hovel','wheatfarm','dairy','hovel'];
  const t=types[(ai.econN=(ai.econN||0)+1)%types.length];
  const c=aiCenter(ai), d=DEF[t];
  for(let r=10;r<20;r++) for(let k=0;k<24;k++){
    const a=k/24*Math.PI*2+r; const x=Math.round(c.x+Math.cos(a)*r-d.w/2), y=Math.round(c.y+Math.sin(a)*r-d.h/2);
    let ok=true; for(let j=-1;j<=d.h&&ok;j++)for(let i=-1;i<=d.w;i++){ const xx=x+i,yy=y+j; if(!inb(xx,yy)){ok=false;break;} const q=idx(xx,yy); if(occB[q]||ter[q]===2||ter[q]===4||ter[q]===5||ter[q]===6||ter[q]===7){ok=false;break;} }
    if(ok && Math.hypot(x-G.keep.x,y-G.keep.y)>16){ clearTiles(x,y,d.w,d.h); if(G.started) for(let j=0;j<d.h;j++)for(let i=0;i<d.w;i++) drawTile(idx(x+i,y+j)); const b=placeBld(t,x,y,'E',1,ai.id); ai.econ=(ai.econ||0)+1; return b; }
  }
  return null;
}
function aiPlace(ai,it){
  const d=DEF[it.type]; if(!d) return true;
  if(it.type==='moat'){ if(inb(it.x,it.y)&&!occB[idx(it.x,it.y)]&&ter[idx(it.x,it.y)]!==5){ ter[idx(it.x,it.y)]=7; treeW[idx(it.x,it.y)]=0; redrawAround(idx(it.x,it.y)); G.flowDirty=true; } return true; }
  const dm=dims(it.type,it.dir);
  for(let j=0;j<dm.h;j++)for(let i=0;i<dm.w;i++){ if(!inb(it.x+i,it.y+j)) return true; const o=occB[idx(it.x+i,it.y+j)]; if(o&&!(o.team===1&&o.def.wallish&&it.type!=='wall')) return it.type==='wall'; }
  if(G.units.some(u=>u.team===0&&!u.dead&&u.x>=it.x-.5&&u.x<it.x+dm.w+.5&&u.y>=it.y-.5&&u.y<it.y+dm.h+.5)) return false;
  for(let j=0;j<dm.h;j++)for(let i=0;i<dm.w;i++){ const o=occB[idx(it.x+i,it.y+j)]; if(o) removeBld(o,false); }
  clearTiles(it.x,it.y,dm.w,dm.h);
  for(let j=0;j<dm.h;j++)for(let i=0;i<dm.w;i++) drawTile(idx(it.x+i,it.y+j));
  const b=placeBld(it.type,it.x,it.y,it.dir||'E',1,ai.id); b.tag=it.tag;
  if(it.type==='gatehouse') b.raised=true;
  return true;
}
function aiSpawn(ai,kind,role){
  const src=ai.barracks&&!ai.barracks.dead?ai.barracks:ai.keep;
  const u=spawnUnit(kind,src.x+src.w/2+(rand()-.5),src.y+src.h+.6,ai.id);
  u.ai=ai.id; u.role=role; u.fade=1;
  if(role==='guard'){ const c=aiCenter(ai); const a=rand()*Math.PI*2; u.guard={x:c.x+Math.cos(a)*(3+rand()*2),y:c.y+3+Math.sin(a)*2}; u.guardR=8; }
  else if(role==='pool'){ const c=aiCenter(ai); u.guard={x:c.x+(rand()-.5)*6,y:c.y+5+rand()*3}; u.guardR=7; }
  return u;
}
function aiUnits(ai){ return G.units.filter(u=>u.ai===ai.id&&!u.dead&&!u.aiLord); }
function aiTowers(ai){ return G.blds.filter(b=>b.owner===ai.id&&b.def.towerish&&!b.dead); }
function aiTick(dt){
  if(!G.ais) return;
  for(const ai of G.ais){
    if(!ai.alive) continue;
    const econ=G.blds.filter(b=>b.owner===ai.id&&!b.def.castle&&!b.def.isKeep).length;
    const est=G.estates.filter(e=>e.owner===2&&e.ai===ai.id).length;
    ai.might+=dt*(ai.fixed?ai.diff.rate*.45:ai.diff.rate+econ*.12+est);
    const cap=ai.fixed?(ai.capFixed||30):ai.diff.cap;
    // build
    if(!ai.fixed && ai.queue.length){
      const it=ai.queue[0];
      const cost=it.econ?AI_COST.econ:it.upgrade?60:(AI_COST[it.type]||20);
      if(ai.might>=cost){
        if(it.econ){ aiBuildEcon(ai); ai.queue.shift(); ai.might-=cost; }
        else if(it.upgrade){ for(const t of aiTowers(ai)){ if(t.def.great) t.mangonel={cd:2}; else if(!t.ballista&&rand()<.5) t.ballista={cd:2}; } ai.queue.shift(); ai.might-=cost; }
        else { const ok=aiPlace(ai,it); if(ok){ ai.queue.shift(); ai.might-=cost; } else { ai.queue.push(ai.queue.shift()); } }
      }
    }
    // rebuild what you broke, when you are far away
    if(!ai.fixed && ai.plan && !ai.queue.length && rand()<dt/25){
      const near=G.units.some(u=>u.team===0&&u.def.mil&&!u.dead&&Math.hypot(u.x-ai.keep.x,u.y-ai.keep.y)<16);
      if(!near) for(const [x,y] of ai.plan.walls){ if(inb(x,y)&&!occB[idx(x,y)]&&ter[idx(x,y)]!==7){ ai.queue.push({type:'wall',x,y}); } }
    }
    const units=aiUnits(ai);
    // garrison the towers
    const towers=aiTowers(ai);
    for(const t of towers){
      const have=units.filter(u=>u.postB===t).length;
      if(have<Math.min(t.def.cap,ai.style==='builder'?t.def.cap:3) && ai.might>=AI_COST.earcher && units.length<cap){
        const kind=rand()<.3&&G.time>300?'exbow':'earcher'; const u=aiSpawn(ai,kind,'garrison'); ai.might-=AI_COST[kind];
        const k=have; const p=slotPos(t,k); u.postB=t; u.guard={x:p.x,y:p.y}; u.guardR=0; break;
      }
    }
    // guards and the strike force
    const guards=units.filter(u=>u.role==='guard').length, pool=units.filter(u=>u.role==='pool');
    if(units.length<cap){
      if(guards<4 && ai.might>=AI_COST.eswords){ aiSpawn(ai,G.time>360?'eswords':'raider','guard'); ai.might-=G.time>360?AI_COST.eswords:AI_COST.raider; }
      else if(ai.might>=40){
        const opts=ai.style==='aggressive'?['raider','raider','eknight','earcher','eswords']:ai.style==='builder'?['earcher','exbow','eswords','raider']:['raider','earcher','eswords','eknight','exbow'];
        let kind=opts[(rand()*opts.length)|0]; if(G.time<240&&(kind==='eknight'||kind==='eswords')) kind='raider';
        aiSpawn(ai,kind,'pool'); ai.might-=AI_COST[kind];
      }
    }
    // attack
    if(G.time>=ai.attackT && G.keep && !G.keep.dead){
      const need=4+2*ai.attackN;
      if(pool.length>=Math.min(need,24) || pool.length>=12){
        const k=ai.attackN; const extra=[];
        if(k>=1&&ai.might>=18) extra.push('ladder','ladder','ladder');
        if(k>=2&&ai.might>=60) extra.push('ram');
        if(k>=3&&ai.might>=130) extra.push('ecat','stower');
        if(k>=4&&ai.might>=230) extra.push('etreb');
        for(const kind of extra){ if(ai.might>=AI_COST[kind]){ const u=aiSpawn(ai,kind,'pool'); ai.might-=AI_COST[kind]; pool.push(u); } }
        const size=Math.min(30,(ai.diff.size||7)+4*ai.attackN), go=pool.slice(0,size).concat(pool.filter(u=>u.def.siege||u.def.ladder||u.kind==='ladder'));
        for(const u of new Set(go)){ u.guard=null; u.wave=true; u.role='attack'; }
        ai.attackN++;
        toast(`${ai.name} is marching on you!`,'big'); sfx('horn');
        ai.attackT=G.time+ai.diff.gap*(ai.style==='aggressive'?.85:ai.style==='builder'?1.2:1)*(ai.sortieScale||1);
      } else ai.attackT=G.time+20;
    }
    // claim estates
    ai.estT-=dt;
    if(ai.estT<=0){ ai.estT=70;
      const c=aiCenter(ai);
      const e=G.estates.filter(e=>e.owner!==2&&Math.hypot(e.x-c.x,e.y-c.y)<40).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];
      if(e){ const free=units.filter(u=>u.role==='pool'&&!u.def.ranged).slice(0,3); for(const u of free){ u.role='estate'; u.guard={x:e.x+(rand()-.5)*2,y:e.y+(rand()-.5)*2}; u.guardR=6; } }
    }
  }
}
function aiByOwner(o){ return G.ais&&G.ais.find(a=>a.id===o); }
function aiKeepFell(b){ const ai=aiByOwner(b.owner); if(ai) defeatAI(ai,'keep'); }
function aiLordFell(u){ const ai=aiByOwner(u.ai); if(ai) defeatAI(ai,'lord'); }
function defeatAI(ai,why){
  if(!ai.alive) return; ai.alive=false;
  toast(`${ai.name} is defeated!`,'big'); sfx('win');
  for(const u of G.units) if(u.ai===ai.id&&!u.dead){ const ex=u.x<W/2?-1:W+1; u.flee={x:ex,y:u.y}; u.guard=null; u.role='flee'; }
  if(ai.lord&&!ai.lord.dead) ai.lord.dead=true;
  for(const e of G.estates) if(e.owner===2&&e.ai===ai.id){ e.owner=0; e.claim=0; }
  const blds=G.blds.filter(b=>b.owner===ai.id);
  blds.forEach((b,i)=>setTimeout(()=>{ if(!b.dead&&G&&G.blds.includes(b)) removeBld(b,true); },200+i*40));
}
