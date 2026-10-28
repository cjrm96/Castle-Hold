'use strict';
/* Castle Siege: core simulation (buildings, units, combat, economy, update) */
let G=null;

/* ---------- buildings ---------- */
function dims(type,dir){const d=DEF[type]; if(d.gate&&(dir==='N'||dir==='S')) return {w:d.h,h:d.w}; return {w:d.w,h:d.h};}
function placeBld(type,x,y,dir,team,owner){
  const d=DEF[type], dm=dims(type,dir);
  const b={type,def:d,x,y,w:dm.w,h:dm.h,dir:dir||'E',hp:d.hp,maxHp:d.hp,worker:null,id:G.uid++,raised:false,anim:0,team:team||0,owner:owner||0,mode:0,fire:0,ladders:0,dock:0,pladders:0,pdock:0,store:0};
  for(let j=0;j<b.h;j++)for(let i=0;i<b.w;i++) occB[idx(x+i,y+j)]=b;
  G.blds.push(b); G.flowDirty=true; if(d.castle) G.pathVer++; G.bldVer++;
  return b;
}
function removeBld(b,destroyed){
  if(b.dead) return; b.dead=true;
  if(b.type==='powcamp'&&G&&G.prisoners>0){ toast(`The prison camp is gone. ${G.prisoners} prisoners escape.`,'warn'); G.prisoners=0; }
  if(destroyed&&b.team===1&&G&&!G.attract){ if(b.type==='gatehouse'&&b.ramT&&G.time-b.ramT<4) unlock('RAM_GATE'); if(b.def.towerish&&b.stoneT&&G.time-b.stoneT<4) unlock('TOWER_TOPPLER'); }
  for(let j=0;j<b.h;j++)for(let i=0;i<b.w;i++){const k=idx(b.x+i,b.y+j); if(occB[k]===b) occB[k]=null;}
  G.blds.splice(G.blds.indexOf(b),1); G.flowDirty=true; G.pathVer++; G.bldVer++;
  if(b.worker) dropJob(b.worker);
  for(const u of G.units){ if(u.post===b){u.post=null; if(destroyed) hurt(u,8,'fall');} if(u.docked===b) u.docked=null;
    if(u.forceB===b||u.autoB===b||u.breach===b||u.tgt===b){ if(u.team===0&&!u.storming) u.hold={x:u.x,y:u.y}; u.think=0; }
    if(u.forceB===b) u.forceB=null; if(u.autoB===b) u.autoB=null; if(u.breach===b) u.breach=null; if(u.storm===b) u.storm=null; if(u.tgt===b) u.tgt=null; }
  G.ladders=G.ladders.filter(l=>l.b!==b);
  if(b.team===1) computePWalk();
  if(G.selB===b) G.selB=null;
  if(destroyed && !b.def.trap){
    if(b.team===0) G.lostB++;
    G.decals.push({x:b.x,y:b.y,w:b.w,h:b.h,t:40,kind:'rubble'});
    for(let k=0;k<18;k++) G.parts.push({x:b.x+rand()*b.w,y:b.y+rand()*b.h,vx:(rand()-.5)*2,vy:(rand()-.5)*2,life:1+rand(),max:2,c:rand()<.5?'#8b857a':'#5a4a3a',s:3+rand()*3});
    sfx('collapse',b.x+b.w/2,b.y+b.h/2);
    if(b===G.keep) endGame(false,G.keep.type==='warcamp'?'Your war camp has been overrun':'Your keep has fallen');
    else if(b.team===1){ if(b.def.isKeep) aiKeepFell(b); else if(b.def.enemy) toast(`${b.def.name} destroyed`,'big'); }
    else if(!b.def.castle) say('lost'+b.type,`Your ${b.def.name.toLowerCase()} was destroyed`,'warn',8);
    else if(b.def.cap) say('lost'+b.type,`A ${b.def.name.toLowerCase()} has fallen`,'warn',6);
  }
}
function canPlace(type,x,y,dir){
  const d=DEF[type], dm=dims(type,dir);
  for(let j=0;j<dm.h;j++)for(let i=0;i<dm.w;i++){
    const tx_=x+i, ty_=y+j;
    if(!inb(tx_,ty_)) return 'Off the map';
    const k=idx(tx_,ty_), t=ter[k];
    if(t===1) return 'Clear of trees only';
    if(t===2||t===4) return 'Cannot build on rock';
    if(t===5||t===6) return 'Cannot build on water';
    if(t===7) return 'That is moat';
    const o=occB[k];
    if(o && !(d.gate && o.def.wallish && o.team===0)) return 'Something is already here';
    const cp=G.home.camp; if(Math.hypot(tx_+.5-cp.x,ty_+.5-cp.y)<1.3) return 'That is the campfire';
  }
  for(const u of G.units) if(u.team===1&&!u.def.beast){const ux=u.x|0,uy=u.y|0; if(ux>=x&&ux<x+dm.w&&uy>=y&&uy<y+dm.h) return 'Enemies are in the way';}
  if(d.needsTer){
    let n=0;
    for(let j=-1;j<=dm.h;j++)for(let i=-1;i<=dm.w;i++){if(i>=0&&j>=0&&i<dm.w&&j<dm.h)continue; const xx=x+i,yy=y+j; if(inb(xx,yy)&&ter[idx(xx,yy)]===d.needsTer)n++;}
    if(n<2) return d.needsTer===2?'Must touch a rock outcrop':'Must touch an iron deposit';
  }
  if(type==='barracks' && G.blds.some(b=>b.type==='barracks'&&b.team===0)) return 'You already have barracks';
  if(type==='cathedral' && G.blds.some(b=>b.type==='cathedral'&&b.team===0)) return 'You already have a cathedral';
  return null;
}
function afford(c){for(const k in c){ if(k==='food'){ if(foodTotal()<c[k]) return false; } else if((G.R[k]||0)<c[k]) return false; } return true;}
function pay(c){for(const k in c){ if(k==='food') consumeFood(c[k]); else G.R[k]-=c[k]; }}
function costStr(c){return Object.entries(c).map(([k,v])=>`${v} ${RES_NAME[k]||k}`).join(' · ');}
function lackStr(c){for(const k in c){ const have=k==='food'?foodTotal():(G.R[k]||0); if(have<c[k]) return `Not enough ${RES_NAME[k]||k}`; } return '';}
function tryBuild(type,x,y,quiet,dir){
  const d=DEF[type], dm=dims(type,dir);
  const why=canPlace(type,x,y,dir);
  if(why){ if(!quiet){toast(why,'warn');sfx('deny');} return false; }
  if(!afford(d.cost)){ if(!quiet){toast(lackStr(d.cost),'warn');sfx('deny');} return 'cost'; }
  pay(d.cost);
  if(d.terrain){ const i=idx(x,y); ter[i]=7; treeW[i]=0; redrawAround(i); G.flowDirty=true; G.pathVer++; for(let k=0;k<3;k++) G.parts.push({x:x+rand(),y:y+rand(),vx:(rand()-.5),vy:-rand(),life:.5,max:.5,c:'#6b5a40',s:3}); sfx('build',x,y); return {type}; }
  if(d.gate){ for(let j=0;j<dm.h;j++)for(let i=0;i<dm.w;i++){const o=occB[idx(x+i,y+j)]; if(o) removeBld(o,false);} }
  const b=placeBld(type,x,y,dir);
  if(d.castle) evictFromCastle(x,y,dm.w,dm.h,0);
  for(let k=0;k<6;k++) G.parts.push({x:x+rand()*dm.w,y:y+rand()*dm.h,vx:(rand()-.5),vy:-rand(),life:.6,max:.6,c:'#c9b48a',s:3});
  sfx('build',x,y);
  if(type==='woodcutter' && findTreeFrom(x+1,y+1,16)<0) toast('No trees within reach of this hut','warn');
  if(type==='hunter' && !nearestAnimal(x+1,y+1,20,'deer')) toast('No deer nearby right now. The hunter will wait.','warn');
  return b;
}
/* soldiers standing where a new wall goes up step down to the ground beside it */
function evictFromCastle(x,y,w,h,team){
  for(const u of G.units){ if(u.team!==team||u.dead||u.postB||u.post) continue; const ux=u.x|0, uy=u.y|0;
    if(ux<x||ux>=x+w||uy<y||uy>=y+h) continue; const q=idx(ux,uy); if(castleLevel(q)!==1||isStair(q)) continue;
    let best=null,bd=1e9; for(let j=-3;j<=3;j++)for(let i=-3;i<=3;i++){ const xx=ux+i,yy=uy+j; if(!inb(xx,yy)) continue; const t=ter[idx(xx,yy)]; if(t===2||t===5||t===4||occB[idx(xx,yy)]) continue; const dd=i*i+j*j+(insideMask()[idx(xx,yy)]?0:.5); if(dd<bd){bd=dd;best={x:xx,y:yy};} }
    if(best){ u.x=best.x+.5; u.y=best.y+.5; u.goal=null; u.path=null; u.pdest=null; if(u.hold) u.hold={x:u.x,y:u.y}; }
  }
}
function lineTiles(a,b){
  const out=[]; let x0=a.x,y0=a.y; const x1=b.x,y1=b.y;
  const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1; let err=dx+dy;
  for(let guard=0;guard<220;guard++){ out.push({x:x0,y:y0}); if(x0===x1&&y0===y1)break; const e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;} }
  return out;
}
function buildLine(type,tiles){
  let built=0, broke=false;
  for(const t of tiles){ const r=tryBuild(type,t.x,t.y,true); if(r==='cost'){broke=true;break;} if(r) built++; }
  if(broke){toast(lackStr(DEF[type].cost),'warn');sfx('deny');}
  else if(!built){toast('Cannot build there','warn');sfx('deny');}
}
function demolishAt(x,y){
  const i=tileOf(x,y), b=occB[i];
  if(b){ demolish(b); return; }
  if(ter[i]===7){ ter[i]=0; redrawAround(i); G.flowDirty=true; G.pathVer++; sfx('build',x,y); return; }
}
function demolish(b){
  if(!b) return;
  if(b.def.fixed||b.team===1){toast('That cannot be demolished','warn');sfx('deny');return;}
  for(const k in b.def.cost) G.R[k]+=Math.floor(b.def.cost[k]/2*(b.hp/b.maxHp));
  removeBld(b,false);
}
function housing(){let h=12; for(const b of G.blds) if(b.def.housing&&b.team===0) h+=b.def.housing; return h;}
function door(b){return {x:b.x+b.w/2, y:b.y+b.h+0.2};}
function storeB(k){return G[storeOf(k)];}
function rectDist(px,py,b){const dx=Math.max(b.x-px,0,px-(b.x+b.w)),dy=Math.max(b.y-py,0,py-(b.y+b.h));return Math.hypot(dx,dy);}
function canBurn(b){return b && !b.dead && b.team===0 && !b.def.castle && !b.def.fixed && !b.def.trap;}
function ignite(b){ if(!canBurn(b)||b.fire>0) return; b.fire=0.01; say('fire'+b.id,`Fire at the ${b.def.name.toLowerCase()}!`,'warn',20); }
function damageBld(b,d,fire,by){
  if(b.dead) return;
  if(by!==undefined){ b.lastBy=by; if(G.ffa&&b.def.isKeep&&b.team===1&&by!==b.owner){ const a=aiById(b.owner); if(a) a.grudge=by; } }
  if(b.type==='gatehouse'&&b.raised) d*=0.4;
  b.hp-=d; b.hitT=0.15;
  for(let k=0;k<3;k++) G.parts.push({x:b.x+rand()*b.w,y:b.y+rand()*b.h,vx:(rand()-.5)*1.5,vy:-rand()*1.5,life:.5,max:.5,c:'#b9b1a0',s:2});
  if(d>=5) sfx('smash',b.x+b.w/2,b.y+b.h/2);
  if(fire && b.def.wooden && rand()<fire) ignite(b);
  if(b===G.keep) say('keephit',G.keep.type==='warcamp'?'Your war camp is under attack!':'The keep is under attack!','warn',10);
  if(b.hp<=0) removeBld(b,true);
}
function repairCost(b){
  if(!b||b.dead||b.team===1||b.hp>=b.maxHp||b.def.trap||b.maxHp>1e8) return null;
  if(b.def.isKeep) return {stone:Math.ceil((b.maxHp-b.hp)/30)};
  const c=b.def.cost; if(!c) return null;
  const f=1-b.hp/b.maxHp, out={}; for(const k in c) out[k]=Math.max(1,Math.ceil(c[k]*f)); return out;
}
function underAttack(b){return G.units.some(u=>u.team===1&&!u.def.beast&&rectDist(u.x,u.y,b)<5);}
function repair(b,quiet){
  const c=repairCost(b); if(!c) return false;
  if(underAttack(b)){ if(!quiet){toast('Cannot repair while enemies are close','warn');sfx('deny');} return false; }
  if(!afford(c)){ if(!quiet){toast(lackStr(c),'warn');sfx('deny');} return false; }
  pay(c); b.hp=b.maxHp; b.fire=0; G.flowDirty=true;
  if(!quiet) sfx('build',b.x,b.y);
  return true;
}
function damagedCastle(){return G.blds.filter(b=>b.team===0&&b.def.castle&&b.hp<b.maxHp);}
function repairAll(){
  const list=damagedCastle(); if(!list.length){toast('Nothing needs repair');return;}
  let n=0; for(const b of list) if(repair(b,true)) n++;
  if(n){sfx('build');toast(`Repaired ${n} section${n>1?'s':''}`);} else {toast('Cannot repair now. Too little stone or enemies too close.','warn');sfx('deny');}
}
function setGate(b,raised){
  if(!b||b.type!=='gatehouse'||b.raised===raised) return;
  b.raised=raised; G.pathVer++; G.flowDirty=true; sfx('chain',b.x,b.y);
}
function toggleAllGates(){
  const gs=G.blds.filter(b=>b.type==='gatehouse'&&b.team===0);
  if(!gs.length){toast('You have no gatehouse yet','warn');return;}
  const raise=gs.some(b=>!b.raised);
  gs.forEach(b=>setGate(b,raise));
  toast(raise?'Drawbridges raised. Peasants cannot pass.':'Drawbridges lowered');
}
function freeEngineer(){ return G.units.find(u=>u.kind==='engineer'&&!u.dead&&!u.post&&u.fill===undefined); }
function crewWith(b,kind){
  const cost=kind==='mangonel'?{gold:80}:kind==='ballista'?{gold:60}:{gold:30};
  if((kind==='mangonel'||kind==='ballista')&&(b.mangonel||b.ballista)) return; if(kind==='oil'&&b.oil) return;
  const e=freeEngineer();
  if(!e){toast('You need an idle engineer. Recruit one in the Army tab.','warn');sfx('deny');return;}
  if(!afford(cost)){toast(lackStr(cost),'warn');sfx('deny');return;}
  pay(cost); e.dead=true; e.gone=true;
  if(kind==='mangonel') b.mangonel={cd:1}; else if(kind==='ballista') b.ballista={cd:1}; else b.oil={cd:1};
  toast(kind==='mangonel'?'Mangonel mounted. An engineer crews it.':kind==='ballista'?'Ballista mounted. It picks off siege engines and knights.':'Oil cauldron set. An engineer tends it.');
  sfx('build',b.x,b.y);
}

/* ---------- garrisons ---------- */
function slotPos(b,k){
  let s;
  if(b.type==='greattower') s=[[.5,.5],[1.5,.5],[2.5,.5],[.5,1.5],[2.5,1.5],[.5,2.5],[1.5,2.5],[2.5,2.5]][k];
  else if(b.type==='tower') s=[[.5,.5],[1.5,.5],[.5,1.5],[1.5,1.5]][k];
  else if(b.dir==='E'||b.dir==='W') s=[[.5,.5],[1.5,.5],[.5,2.5],[1.5,2.5]][k];
  else s=[[.5,.5],[.5,1.5],[2.5,.5],[2.5,1.5]][k];
  return {x:b.x+s[0],y:b.y+s[1]};
}
function garrison(b){return G.units.filter(u=>u.post===b&&!u.dead);}
function freeSlots(b){const used=new Set(garrison(b).map(u=>u.slot)); const out=[]; for(let k=0;k<b.def.cap;k++) if(!used.has(k)) out.push(k); return out;}
function postTo(u,b,k){u.post=b; u.slot=k; const s=slotPos(b,k); orderMove(u,s.x,s.y); u.hold=null; u.tgt=null;}
function addArchers(b){
  if(!b||!b.def.cap) return;
  const free=freeSlots(b);
  if(!free.length){toast(`This ${b.def.name.toLowerCase()} is full`);return;}
  const c={x:b.x+b.w/2,y:b.y+b.h/2};
  const pool=G.units.filter(u=>(u.kind==='archer'||u.kind==='xbow')&&!u.dead&&!(u.post&&!u.post.dead)).sort((a,z)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(z.x-c.x,z.y-c.y));
  if(!pool.length){toast('Every bowman is already posted. Recruit more in the Army tab.','warn');sfx('deny');return;}
  let n=0; while(free.length&&pool.length){postTo(pool.shift(),b,free.shift());n++;}
  toast(`${n} bowm${n>1?'en':'an'} heading up`); sfx('recruit');
}
function sendDown(b){
  const g=garrison(b); if(!g.length) return;
  const c={x:b.x+b.w/2,y:b.y+b.h/2};
  const cand=groundSpots(Math.floor(c.x),Math.floor(c.y),g.length,false);
  g.forEach((u,k)=>{u.post=null; const s=cand[k]||cand[cand.length-1]; orderMove(u,s.x+.5,s.y+.5);});
}
function groundSpots(tx_,ty_,n,up){
  const cand=[];
  for(let j=-8;j<=8;j++)for(let i=-8;i<=8;i++){
    const x=tx_+i,y=ty_+j; if(!inb(x,y)) continue; const b=bAt(x,y), t=ter[idx(x,y)];
    const isWall=b&&b.def.wallish&&(b.team===0||pWalk[idx(x,y)]);
    if(up ? !isWall : ((b&&!b.def.trap) || t===2||t===5||t===4)) continue;
    cand.push({x,y,d:i*i+j*j});
  }
  cand.sort((a,b)=>a.d-b.d);
  return cand.length?cand.slice(0,Math.max(n,1)):[{x:tx_,y:ty_}];
}

/* ---------- units ---------- */
function spawnUnit(kind,x,y,owner){
  const d=UD[kind];
  const u={id:G.uid++,kind,def:d,team:d.team,owner:owner||0,x,y,hp:d.hp,maxHp:d.hp,speed:d.speed*(0.92+rand()*.16),cd:rand(),face:d.team===1?Math.PI:0,walk:0,moving:false,
    job:null,st:null,t:0,carry:null,tree:-1,goal:null,path:null,hold:null,tgt:null,think:rand()*.4,sel:false,wp:null,wait:0,el:0,post:null,slot:-1,squad:0,fade:0,
    stance:'defend',climb:false,forceT:null,forceB:null,calm:0};
  G.units.push(u); return u;
}
function blockedMove(u,i){
  const t=ter[i];
  if(t===2||t===5) return true;
  if(u.team===0){ const b=occB[i]; if(b&&b.team===1) return !(pWalk[i]&&!u.def.big); if(b&&b.def.isKeep&&!b.def.trap) return true; if(u.def.big&&(t===7||castleLevel(i)===1)) return true; return false; }
  if(u.team===2) return t===7||!!occB[i];
  return false;
}
function moveToward(u,tx_,ty_,dt){
  const dx=tx_-u.x, dy=ty_-u.y, d=Math.hypot(dx,dy);
  let sp=u.speed;
  const t=ter[tileOf(u.x,u.y)];
  if(t===7) sp*=0.4; else if(t===6) sp*=0.6; else if(t===1&&u.team===1) sp*=0.75;
  if(G.snow>.5 && !u.def.big) sp*=1-(G.snow-.5)*.3;
  if(u.pace && u.goal) sp=Math.min(sp,u.pace);
  const step=sp*dt;
  u.moving=true; u.walk+=dt;
  if(d<1e-6) return true;
  const cur=tileOf(u.x,u.y), curB=blockedMove(u,cur);
  const bad=q=>blockedMove(u,q) || (u.team===0 && q!==cur && !stepOK(cur,q));
  if(d<=step){ if(curB||!bad(tileOf(tx_,ty_))){u.x=tx_;u.y=ty_;} return true; }
  let nx=u.x+dx/d*step, ny=u.y+dy/d*step;
  if(!curB && bad(tileOf(nx,ny))){
    if(!bad(tileOf(nx,u.y))) ny=u.y; else if(!bad(tileOf(u.x,ny))) nx=u.x; else { u.moving=false; return false; }
  }
  u.x=nx; u.y=ny; u.face=Math.atan2(dy,dx);
  return false;
}
function pathKind(u){ return u.def.cart||u.kind==='peasant'||u.kind==='thief' ? 'P' : (u.def.big ? 'TS' : 'T'); }
function moveP(u,tx_,ty_,dt,kind){
  kind=kind||pathKind(u);
  if(!u.pdest || u.pdest.x!==tx_ || u.pdest.y!==ty_ || u.pver!==G.pathVer){
    u.pdest={x:tx_,y:ty_}; u.pver=G.pathVer; u.path=findPath(kind,u.x,u.y,tx_,ty_); u.pwait=2;
  }
  if(!u.path){
    u.pwait-=dt; u.moving=false;
    if(u.pwait<=0) u.pdest=null;
    if(kind==='P'&&u.kind==='peasant') say('nopath', G.blds.some(b=>b.type==='gatehouse'&&b.team===0&&b.raised) ? 'Peasants are stuck behind a raised drawbridge. Press G to lower it.' : 'Peasants cannot get through your walls or moat. Build a gatehouse.','warn',25);
    return false;
  }
  const wp=u.path[0];
  if(moveToward(u,wp.x,wp.y,dt)){ u.path.shift(); if(!u.path.length){ u.pdest=null; return true; } }
  return false;
}
function orderMove(u,x,y){ u.goal={x,y}; u.pdest=null; u.forceT=null; u.forceB=null; u.autoB=null; u.chase=null; u.tgt=null; u.fill=undefined; u.storming=false; u.storm=null; u.breach=null; u.pace=0; u.stormAfter=null; u.assaultId=0; }
function stepGoal(u,dt){
  if(!u.goal) return true;
  if(moveP(u,u.goal.x,u.goal.y,dt)){ u.hold={x:u.goal.x,y:u.goal.y}; u.goal=null; arrived(u); return true; }
  if(!u.path && !u.pdest){ u.hold={x:u.x,y:u.y}; u.goal=null; arrived(u); return true; }
  return false;
}
/* formation marches end here; assault columns wait on the line for the order to storm */
function arrived(u){ u.pace=0; if(u.stormAfter) u.waitT=G.time; if(u.faceTo!==undefined){ u.face=u.faceTo; } }
function startAssault(u){ const S=u.stormAfter; u.stormAfter=null; u.assaultId=0; u.stance='attack'; if(S&&!S.dead){ u.storming=true; u.storm=S; } else { u.storming=true; u.storm=null; } u.hold={x:u.x,y:u.y}; }
function elevOf(u){
  const b=bAt(u.x|0,u.y|0);
  if(!b||!b.def.castle||b.def.isKeep) return 0;
  if(b.team===u.team){
    if(b.def.towerish) return b.def.great?3:2;
    if(b.type==='gatehouse') return isPassage(b,u.x|0,u.y|0)?0:2;
    if(b.def.wallish) return 1;
    return 0;
  }
  if(u.team===1) return u.climb?1:0;
  if(u.team===0) return pWalk[tileOf(u.x,u.y)]?1:0;
  return 0;
}
function hurt(u,dmg,kind,src,by){
  if(u.dead||!(dmg>0)) return;
  if(src) by=lordOf(src); if(by!==undefined) u.lastBy=by;
  const d=u.def; let m=1;
  if(kind==='ballista'&&d.armor) m*=1-(1-d.armor)*.2;
  if(kind==='arrow'||kind==='melee'||kind==='bolt'){const e=u.el; m*= e>=2?(e===3?.4:.45) : e===1?0.7 : 1;}
  if(kind==='arrow'||kind==='bolt'){ if(d.arrowRes) m*=d.arrowRes; if(d.armor) m*= kind==='bolt'?(1-(1-d.armor)*.3):d.armor; }
  if(kind==='melee'&&d.armor) m*=0.4+0.6*d.armor;
  u.hp-=dmg*m; u.hitT=0.15; u.calm=0; if(src) u.lastHit=src;
  if(src && foe(u,src) && !u.tgt && d.dmg && !d.siege) u.tgt=src;
  for(let k=0;k<3;k++) G.parts.push({x:u.x,y:u.y,vx:(rand()-.5)*2,vy:(rand()-.5)*2,life:.35,max:.35,c:d.big?'#c9b48a':'#8e1b12',s:2});
  if(u.hp<=0) kill(u);
}
function kill(u){
  if(u.dead) return; u.dead=true; u.sel=false;
  const mine=!G.ffa||u.lastBy===0;   // in a free for all, only the men you bring down count as yours
  if(u.team===1&&!u.def.beast&&mine){ achCount('kills',1); if((u.aiLord||u.def.boss)&&G.lord&&u.lastHit===G.lord) unlock('LORD_DUEL'); }
  if(u.team===1&&!u.def.beast){ if(mine) G.kills++; } else if(u.team===0&&u.kind!=='thief') G.lostU++;
  if(u.job) dropJob(u);
  if(u.docked){ if(u.team===1) u.docked.dock=Math.max(0,u.docked.dock-1); else { u.docked.pdock=Math.max(0,u.docked.pdock-1); computePWalk(); G.pathVer++; } }
  if(u.def.caravan && G.caravans){ G.caravans.lost++; toast('A refugee caravan has been lost','warn'); }
  else if(u.kind==='cart' && u.estate) toast(`A supply cart from ${u.estate} was ambushed`,'warn');
  G.decals.push({x:u.x,y:u.y,t:20,kind:u.def.big?'wreck':'body',team:u.team});
  if(u===G.lord) endGame(false,'Your lord has fallen');
  if(u.kind==='warlord'){ toast('The warlord is slain!','big'); if(G.L.boss==='warlord') G.bossDead=true; }
  if(u.kind==='rothgar'){ toast(G.L.mode==='kingmaker'?'Rothgar the Grey is slain!':'The warlord is slain!','big'); G.bossDead=true; }
  if(u.aiLord) aiLordFell(u);
}
function hostile(a,b){ return (a===0&&b===1)||(a===1&&b===0); }
/* whose side something is on: 0 is you, a computer lord's id, 99 for raiders and wolves with no lord */
function lordOf(u){ return u.team===0?0:u.team===1?(u.ai||u.owner||99):-1; }
function bLord(b){ return b.team===0?0:(b.owner||99); }
/* in a free for all every lord fights every other lord; otherwise it is you against them */
function foe(a,o){ if(!G.ffa) return hostile(a.team,o.team); if(a.team===2||o.team===2) return false; return lordOf(a)!==lordOf(o); }
function nearestFoe(u,x,y,r,filter){
  let best=null,bd=r*r;
  for(const o of G.units){ if(o.dead||o.leaving||o.kind==='thief') continue;
    const dx=o.x-x,dy=o.y-y,d=dx*dx+dy*dy; if(d>=bd||!foe(u,o)) continue;   // distance first: the filter can be costly
    if(filter&&!filter(o)) continue; bd=d; best=o; }
  return best;
}
function nearestAnimal(x,y,r,kind){
  let best=null,bd=r*r;
  for(const o of G.units){ if(o.dead||o.kind!==kind) continue; const dx=o.x-x,dy=o.y-y,d=dx*dx+dy*dy; if(d<bd){bd=d;best=o;} }
  return best;
}
function shoot(src,tgt,dmg,h0,kind,fire){
  const d=Math.hypot(tgt.x-src.x,tgt.y-src.y);
  if(src.el) dmg*=src.el>=2?1.25:1.1; /* arrows from a height strike harder */
  G.proj.push({type:kind||'arrow',x0:src.x,y0:src.y,h0:h0||0,tgt,fx:tgt.x,fy:tgt.y,t:0,dur:Math.max(.2,d/(kind==='bolt'||kind==='ballista'?13:10)),dmg,team:src.team,lord:lordOf(src),miss:rand()<.12,fire:fire||0});
  src.face=Math.atan2(tgt.y-src.y,tgt.x-src.x);
  sfx('arrow',src.x,src.y);
}
function shootB(src,b,dmg,fire){
  G.proj.push({type:'arrow',x0:src.x,y0:src.y,h0:0,tgt:null,bld:b,fx:b.x+b.w/2+(rand()-.5)*b.w*.6,fy:b.y+b.h/2+(rand()-.5)*b.h*.6,t:0,dur:.5,dmg,team:src.team,lord:lordOf(src),miss:false,fire:fire||0});
}
function lob(src,x,y,bdmg,splash,team){
  const d=Math.hypot(x-src.x,y-src.y);
  G.proj.push({type:'stone',x0:src.x,y0:src.y,h0:.3,tgt:null,fx:x+(rand()-.5)*.8,fy:y+(rand()-.5)*.8,t:0,dur:Math.max(.6,d/8),bdmg,splash,team,lord:src.team===undefined?(team===0?0:99):lordOf(src),miss:false});
  src.face=Math.atan2(y-src.y,x-src.x); src.fireT=.4; sfx('launch',src.x,src.y);
  sfx('thump',src.x,src.y);
}
function stoneLands(p){
  const x=p.fx, y=p.fy;
  for(let k=0;k<12;k++) G.parts.push({x,y,vx:(rand()-.5)*3,vy:(rand()-.5)*3,life:.6,max:.6,c:rand()<.5?'#9a9282':'#6b5a40',s:3});
  sfx('smash',x,y);
  const b=occB[tileOf(x,y)];
  if(b && (G.ffa?bLord(b)!==p.lord:b.team!==p.team) && !b.def.trap){ if(p.team===0) b.stoneT=G.time; damageBld(b,p.bdmg,0,p.lord); }
  for(const u of G.units){ if(u.dead||!(G.ffa?(u.team!==2&&lordOf(u)!==p.lord):hostile(p.team,u.team))) continue; const d=Math.hypot(u.x-x,u.y-y); if(d<1.4){ hurt(u, (u.def.big?p.bdmg*.5:p.splash*(1-d/2))*COMBAT_HP, 'stone', null, p.lord); } }
}
function floatText(x,y,s,c){G.texts.push({x,y,s,c,t:1.4});}

/* ---------- seasons ---------- */
function monthAbs(){ return G.L.date.y*12+G.L.date.m + G.time/G.monthLen; }
function monthOf(){ return Math.floor(monthAbs())%12; }
function isWinter(){ const m=monthOf(); return m===11||m===0||m===1||(G.L.longWinter&&m===2); }
function seasonName(){ const m=monthOf(); if(isWinter()) return 'Winter'; return m<=4?'Spring':m<=7?'Summer':'Autumn'; }
function snowTarget(){
  const SN=G.L.longWinter?[1,1,.95,.3,0,0,0,0,0,0,.2,.8]:[1,.9,.3,0,0,0,0,0,0,0,.15,.7];
  const ma=monthAbs(), m=Math.floor(ma)%12, f=ma-Math.floor(ma);
  return SN[m]*(1-f)+SN[(m+1)%12]*f;
}

/* ---------- peasants ---------- */
function setJob(u,b){u.job=b;b.worker=u;u.st='go';u.t=0;u.carry=null;u.wp=null;u.pdest=null;}
function dropJob(u){
  if(u.tree>=0){reserved[u.tree]=0;u.tree=-1;}
  if(u.job&&u.job.worker===u) u.job.worker=null;
  u.job=null;u.st=null;u.carry=null;u.wp=null;u.pdest=null;u.prey=null;
}
function findTreeFrom(cx,cy,R){
  let best=-1,bd=1e9;
  for(let y=Math.max(0,cy-R);y<=Math.min(H-1,cy+R);y++)for(let x=Math.max(0,cx-R);x<=Math.min(W-1,cx+R);x++){
    const i=idx(x,y); if(ter[i]!==1||treeW[i]===0||reserved[i]) continue;
    const d=(x-cx)*(x-cx)+(y-cy)*(y-cy); if(d<bd&&d<=R*R){bd=d;best=i;}
  }
  return best;
}
function deposit(u,at){
  if(!u.carry) return;
  G.R[u.carry.k]+=u.carry.n;
  floatText(at.x,at.y-1.4,`+${u.carry.n} ${u.carry.n===1&&RES_ONE[u.carry.k]?RES_ONE[u.carry.k]:RES_NAME[u.carry.k]}`,RES_COL[u.carry.k]);
  u.carry=null;
}
function clearSpot(cx,cy,r){ for(let k=0;k<8;k++){const p={x:cx+(rand()-.5)*2*r,y:cy+(rand()-.5)*2*r}; if(inb(p.x|0,p.y|0)&&clearAtK('P',p.x,p.y)) return p;} return null; }
function work(u,dt){ u.work=true; u.t-=dt*G.workMul; }
function updatePeasant(u,dt){
  if(u.leaving){ if(moveP(u,0.3,cl(u.y,1,H-1),dt,'P') || (!u.path && u.pdest)) u.gone=true; return; }
  const b=u.job;
  if(!b){
    if(!u.wp){ u.wait-=dt; if(u.wait<=0){ u.wp=clearSpot(G.home.camp.x,G.home.camp.y,1.6); if(!u.wp) u.wait=2; } return; }
    if(moveP(u,u.wp.x,u.wp.y,dt,'P')){u.wp=null;u.wait=1.5+rand()*4;}
    else if(!u.path){u.wp=null;u.wait=3;}
    return;
  }
  const J=b.def.job, go=p=>moveP(u,p.x,p.y,dt,'P');
  switch(J.type){
    case 'tree':
      switch(u.st){
        case 'go': if(go(door(b))) u.st='find'; break;
        case 'find': { const t=findTreeFrom(b.x+1,b.y+1,16); if(t<0){u.st='wait';u.t=3;} else {u.tree=t;reserved[t]=1;u.st='toTree';u.tp={x:t%W+.5,y:((t/W)|0)+.9};} break; }
        case 'wait': u.t-=dt; if(u.t<=0) u.st='find'; break;
        case 'toTree': if(go(u.tp)){u.st='chop';u.t=J.t;} break;
        case 'chop': work(u,dt); if(u.t<=0){const t=u.tree; if(ter[t]===1&&treeW[t]>0){treeW[t]--; if(!treeW[t]){ter[t]=3;drawTile(t);G.flowDirty=true;}} reserved[t]=0;u.tree=-1;u.carry={k:'wood',n:J.n};u.st='toHut';} break;
        case 'toHut': if(go(door(b))){u.st='saw';u.t=1.2;} break;
        case 'saw': work(u,dt); if(u.t<=0) u.st='deliver'; break;
        case 'deliver': if(go(door(G.stock))){deposit(u,door(G.stock));u.st='find';} break;
      } break;
    case 'gather':
      switch(u.st){
        case 'go': u.spot=J.inside?{x:b.x+.7+rand()*(b.w-1.4),y:b.y+.7+rand()*(b.h-1.4)}:{x:b.x+b.w/2,y:b.y+b.h/2-.3}; u.st='toSpot'; break;
        case 'toSpot': if(go(u.spot)){u.st='work';u.t=J.t;} break;
        case 'work':
          if(b.def.farm && isWinter()){ u.wintering=true; break; }
          u.wintering=false; work(u,dt*(b.type==='dairy'&&isWinter()?.5:1)); if(u.t<=0){u.carry={k:J.out,n:J.n};u.st='deliver';} break;
        case 'deliver': { const s=storeB(J.out); if(go(door(s))){deposit(u,door(s));u.st='go';} break; }
      } break;
    case 'craft': {
      const M=J.modes[b.mode||0], inK=Object.keys(M.in)[0];
      switch(u.st){
        case 'go': u.st='getIn'; break;
        case 'getIn': { const s=storeB(inK); if(go(door(s))){ if(afford(M.in)){ pay(M.in); u.carry={k:inK,n:M.in[inK]}; u.st='toShop'; } else { u.st='waitIn'; u.t=2; say('need'+inK,`Workshops are waiting for ${RES_NAME[inK]}`,'',40); } } break; }
        case 'waitIn': u.t-=dt; if(u.t<=0) u.st='getIn'; break;
        case 'toShop': if(go(door(b))){u.carry=null;u.st='craft';u.t=M.t;} break;
        case 'craft': work(u,dt); if(u.t<=0){u.carry={k:M.out,n:M.n};u.st='deliver';} break;
        case 'deliver': { const s=storeB(M.out); if(go(door(s))){deposit(u,door(s));u.st='getIn';} break; }
      } break; }
    case 'hunt':
      switch(u.st){
        case 'go': if(go(door(b))) u.st='find'; break;
        case 'find': { const p=nearestAnimal(b.x+1,b.y+1,22,'deer'); if(p){u.prey=p;u.st='stalk';} else {u.st='wait';u.t=4;} break; }
        case 'wait': u.t-=dt; if(u.t<=0) u.st='find'; break;
        case 'stalk': { const p=u.prey; if(!p||p.dead){u.st='find';break;} if(Math.hypot(p.x-u.x,p.y-u.y)<5){u.st='aim';u.t=.8;} else moveToward(u,p.x,p.y,dt); break; }
        case 'aim': { const p=u.prey; u.t-=dt; if(!p||p.dead){u.st='find';break;} if(u.t<=0){ shoot(u,p,30,0,'arrow'); u.spot={x:p.x,y:p.y}; u.st='toCarcass'; } break; }
        case 'toCarcass': { if(u.prey&&!u.prey.dead) u.spot={x:u.prey.x,y:u.prey.y}; if(moveToward(u,u.spot.x,u.spot.y,dt)){ if(u.prey&&!u.prey.dead){u.st='stalk';break;} u.st='butcher';u.t=2;} break; }
        case 'butcher': work(u,dt); if(u.t<=0){u.carry={k:'meat',n:J.n};u.st='deliver';} break;
        case 'deliver': if(go(door(G.gran))){deposit(u,door(G.gran));u.st='find';} break;
      } break;
    case 'inn':
      switch(u.st){
        case 'go': u.st='getAle'; break;
        case 'getAle': if(go(door(G.stock))){ if(b.store>=8){u.st='rest';u.t=3;} else if(G.R.ale>=1){const n=Math.min(2,Math.floor(G.R.ale)); G.R.ale-=n; u.carry={k:'ale',n}; u.st='toInn';} else {u.st='rest';u.t=3;} } break;
        case 'rest': u.t-=dt; if(u.t<=0) u.st='getAle'; break;
        case 'toInn': if(go(door(b))){ b.store+=u.carry.n; u.carry=null; u.st='getAle'; } break;
      } break;
    case 'well':
      switch(u.st){
        case 'go': if(go(door(b))) {u.st='watch';u.t=0;} break;
        case 'watch': { u.t-=dt; if(u.t>0) break; u.t=.7; let best=null,bd=14; for(const o of G.blds) if(o.fire>0){const d=rectDist(b.x,b.y,o); if(d<bd){bd=d;best=o;}} if(best){u.fireB=best;u.st='toFire';} break; }
        case 'toFire': { const f=u.fireB; if(!f||f.dead||!f.fire){u.st='go';break;} if(go(door(f))){u.st='douse';u.t=1.5;} break; }
        case 'douse': work(u,dt); if(u.t<=0){ if(u.fireB&&!u.fireB.dead){u.fireB.fire=0; floatText(u.x,u.y-1,'Fire out','#9fd0ff');} u.st='go'; } break;
      } break;
    case 'rats':
      switch(u.st){
        case 'go': if(go(door(b))) {u.st='watch';u.t=0;} break;
        case 'watch': { u.t-=dt; if(u.t>0) break; u.t=.8; const r=nearestAnimal(b.x+1,b.y+1,18,'rat'); if(r){u.prey=r;u.st='chase';} break; }
        case 'chase': { const r=u.prey; if(!r||r.dead){u.st='go';break;} if(Math.hypot(r.x-u.x,r.y-u.y)<.5){ kill(r); G.dirt=Math.max(0,G.dirt-1.5); u.st='watch'; } else moveToward(u,r.x,r.y,dt); break; }
      } break;
    case 'guard': {
      const th=nearestAnimal(u.x,u.y,7,'thief');
      if(th && !th.caught){ if(Math.hypot(th.x-u.x,th.y-u.y)<.6) catchThief(th); else moveToward(u,th.x,th.y,dt*1.15); break; }
      switch(u.st){
        case 'go': u.wp=clearSpot(b.x+1,b.y+1,6)||door(b); u.st='walk'; break;
        case 'walk': if(go(u.wp)){u.st='pause';u.t=1.5+rand()*2;} else if(!u.path) u.st='go'; break;
        case 'pause': u.t-=dt; if(u.t<=0) u.st='go'; break;
      } break; }
  }
}
/* thieves: peasants turned to crime walk to a store, steal, and run for the map edge */
function makeThief(){
  const ps=peasants().filter(u=>!u.job); if(!ps.length) return;
  const u=ps[0]; Object.assign(u,{kind:'thief',def:UD.thief,st:'toStore',wp:null,pdest:null,store:rand()<.5?G.stock:G.gran});
  say('thief','A thief is loose in the town!','warn',30);
}
function catchThief(u){ if(u.dead) return; u.caught=true; u.dead=true; G.crime=Math.max(0,G.crime-3); floatText(u.x,u.y-1,'Caught!','#9fd0ff'); toast('A thief was caught'); }
function updateThief(u,dt){
  for(const o of G.units){ if(o.team===0&&o.def.mil&&o.def.melee&&!o.dead&&Math.abs(o.x-u.x)<1&&Math.abs(o.y-u.y)<1){ catchThief(u); return; } }
  if(u.st==='toStore'){ const s=u.store; if(!s||s.dead){u.st='flee';return;} if(moveP(u,door(s).x,door(s).y,dt,'P')){
      const keys=(s===G.gran?RES_KEYS.food:RES_KEYS.stock).filter(k=>G.R[k]>=1); if(keys.length){ const k=keys[(rand()*keys.length)|0]; const n=Math.min(10,Math.floor(G.R[k])); G.R[k]-=n; u.carry={k,n}; }
      u.st='flee'; } }
  else { u.speed=UD.thief.speed; const ex=u.x<W/2?0.3:W-0.7; if(moveP(u,ex,cl(u.y,1,H-2),dt,'T')||(!u.path&&u.pdest)){ u.gone=true; if(u.carry) toast(`A thief escaped with ${u.carry.n} ${RES_NAME[u.carry.k]}`,'warn'); } }
}

/* ---------- your troops ---------- */
function postValid(u){return u.post && !u.post.dead;}
function lordBonus(u){ const l=G.lord; return (l&&!l.dead&&u!==l&&Math.hypot(u.x-l.x,u.y-l.y)<4)?1.2:1; }
function troopRanges(u){ return u.stance==='stand'?{aggro:0,leash:0}:u.stance==='attack'?{aggro:10,leash:16}:{aggro:5.5,leash:9}; }
function updateTroop(u,dt){
  const d=u.def; u.cd-=dt;
  if(d.lord){ u.calm+=dt; if(u.calm>4&&u.hp<u.maxHp) u.hp=Math.min(u.maxHp,u.hp+4*COMBAT_HP*dt); }
  if(d.cart) return updateCart(u,dt);
  if(u.goal){ stepGoal(u,dt); if(u.goal) return; }
  if(postValid(u)){const s=slotPos(u.post,u.slot); if(Math.hypot(u.x-s.x,u.y-s.y)>.05) moveToward(u,s.x,s.y,dt);}
  if(!u.hold) u.hold={x:u.x,y:u.y};
  if(u.stormAfter && G.assaultGo && G.assaultGo[u.assaultId]) startAssault(u);
  if(u.storming) stormPrep(u);
  if(d.healer) return healer(u,dt);
  if(u.storming && ((d.eng&&u.fill===undefined) || (d.pladder&&(u.placed||!u.forceB)))) return followArmy(u,dt,4);
  if(d.eng) return engineer(u,dt);
  if(u.fill!==undefined){ if(ter[u.fill]===7) return engineer(u,dt); u.fill=undefined; }
  if(d.pladder) return ladderman(u,dt);
  if(d.siege) return playerSiege(u,dt);
  if(d.artillery) return artillery(u,dt);
  if(d.ranged) return ranged(u,dt);
  return melee(u,dt);
}
function healer(u,dt){
  if(u.storming){ let best=null,bd=1e9; for(const o of G.units){ if(o.team!==0||o.dead||!o.storming||o===u||!o.def.melee) continue; const dd=Math.hypot(o.x-u.x,o.y-u.y); if(dd<bd){bd=dd;best=o;} } if(best&&bd>2.2) chaseTo(u,best.x,best.y,dt); }
  u.t-=dt; if(u.t>0) return; u.t=.5;
  let best=null,bh=1;
  for(const o of G.units){ if(o.team!==0||o.dead||o===u||o.def.big||o.kind==='peasant'||o.kind==='thief') continue; const f=o.hp/o.maxHp; if(f<bh&&Math.hypot(o.x-u.x,o.y-u.y)<3.5){bh=f;best=o;} }
  if(best){ best.hp=Math.min(best.maxHp,best.hp+u.def.heal*.5); u.work=true; if(rand()<.3) G.parts.push({x:best.x,y:best.y-.3,vx:0,vy:-.8,life:.6,max:.6,c:'#f2e6a0',s:2}); }
}
function engineer(u,dt){
  if(u.fill===undefined) return;
  const i=u.fill, tx_=i%W+.5, ty_=((i/W)|0)+.5;
  if(ter[i]!==7){ u.fill=undefined; return; }
  if(Math.hypot(u.x-tx_,u.y-ty_)>.7){ moveP(u,tx_,ty_,dt,'T'); return; }
  u.work=true; u.t=(u.t>0?u.t:(u.def.eng?3:5))-dt;
  if(u.t<=0.01){ ter[i]=0; redrawAround(i); G.flowDirty=true; G.pathVer++; floatText(tx_,ty_-1,'Moat filled','#e2c08f'); G.moatN=(G.moatN||0)+1; if(G.moatN>=10) unlock('MOAT_FILL'); u.fill=undefined; u.t=0; sfx('build',tx_,ty_); }
}
function ladderman(u,dt){
  const b=u.forceB; if(!b||b.dead||u.placed) return;
  const dd=rectDist(u.x,u.y,b);
  if(dd>.75){ const p=adjacentSpot(u,b); moveP(u,p.x,p.y,dt,'T'); return; }
  b.pladders++; u.placed=true; G.ladders.push({b,x:u.x,y:u.y,team:0}); computePWalk(); G.pathVer++;
  toast('Ladder raised against their wall. Send troops up it.'); sfx('build',u.x,u.y);
}
function adjacentSpot(u,b){ return {x:cl(u.x,b.x-.4,b.x+b.w+.4), y:cl(u.y,b.y-.4,b.y+b.h+.4)}; }
function playerSiege(u,dt){
  const d=u.def, b=u.forceB;
  if(!b||b.dead||u.docked){ u.moat=null; return; }
  const dd=rectDist(u.x,u.y,b);
  if(dd>.85){
    if(!u.spot||u.spot.ver!==G.pathVer||u.spot.b!==b){ u.spot={ver:G.pathVer,b,p:siegeSpot(u,b)}; }
    const p=u.spot.p;
    if(p){ u.moat=null; moveP(u,p.x,p.y,dt,'TS'); }
    else crossMoat(u,b,dt);
    return; }
  u.moat=null;
  if(d.stower){ if(b.def.castle&&!b.def.isKeep){ u.docked=b; b.pdock++; computePWalk(); G.pathVer++; toast('Siege tower docked. Your troops can storm the wall.'); unlock('TOWER_DOCK'); } else u.forceB=null; return; }
  if(u.cd<=0){ b.ramT=G.time; damageBld(b,d.bdmg,0,0); u.cd=d.rate; u.strike=.25; sfx('thump',u.x,u.y); }
}
/* ground a ram or siege tower can roll over: no moat, no walls, no enemy buildings */
let compS=null, compSVer=-1, compSG=null;
function compsTS(){
  if(compS&&compSVer===G.pathVer&&compSG===G&&compS.length===N) return compS;
  compS=new Int32Array(N).fill(-1); let c=0;
  for(let s0=0;s0<N;s0++){
    if(compS[s0]!==-1||blockedK('TS',s0)) continue;
    let h=0,tl=0; qComp[tl++]=s0; compS[s0]=c;
    while(h<tl){ const i=qComp[h++], x=i%W, y=(i/W)|0;
      for(const [dx,dy] of NB){ const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; const n=idx(nx,ny); if(compS[n]!==-1||blockedK('TS',n)) continue;
        if(dx&&dy&&(blockedK('TS',idx(nx,y))||blockedK('TS',idx(x,ny)))) continue; compS[n]=c; qComp[tl++]=n; } }
    c++; }
  compSVer=G.pathVer; compSG=G; return compS;
}
/* the tile beside building b that this engine can roll up to, nearest first; null if a moat or wall cuts it off */
function siegeSpot(u,b){
  const C=compsTS(), my=C[tileOf(u.x,u.y)]; let best=null,bd=1e9;
  const tryT=(x,y)=>{ if(!inb(x,y)) return; const q=idx(x,y); if(ter[q]===7||blockedK('TS',q)) return; if(my>=0&&C[q]!==my) return; const dd=Math.hypot(x+.5-u.x,y+.5-u.y); if(dd<bd){bd=dd;best={x:x+.5,y:y+.5};} };
  for(let i=0;i<b.w;i++){ tryT(b.x+i,b.y-1); tryT(b.x+i,b.y+b.h); }
  for(let j=0;j<b.h;j++){ tryT(b.x-1,b.y+j); tryT(b.x+b.w,b.y+j); }
  return best;
}
/* the fewest moat tiles to fill so an engine can roll up to building b, and where to wait meanwhile */
const moatD=new Int32Array(MAXN), moatPrev=new Int32Array(MAXN);
function moatPlan(u,b){
  const s0=tileOf(u.x,u.y); if(s0<0||s0>=N) return null;
  const goal=new Set(), add=(x,y)=>{ if(inb(x,y)) goal.add(idx(x,y)); };
  for(let i=0;i<b.w;i++){ add(b.x+i,b.y-1); add(b.x+i,b.y+b.h); } for(let j=0;j<b.h;j++){ add(b.x-1,b.y+j); add(b.x+b.w,b.y+j); }
  const pass=q=>ter[q]===7?!occB[q]:!blockedK('TS',q);
  moatD.fill(1e9,0,N); moatD[s0]=0; moatPrev[s0]=-1;
  let cur=[s0], found=-1;
  for(let lvl=0;lvl<=6&&cur.length&&found<0;lvl++){ const next=[];
    for(let k=0;k<cur.length;k++){ const i=cur[k]; if(moatD[i]!==lvl) continue; if(goal.has(i)&&pass(i)){ found=i; break; }
      const x=i%W, y=(i/W)|0;
      for(let n4=0;n4<4;n4++){ const nx=x+NB[n4][0], ny=y+NB[n4][1]; if(!inb(nx,ny)) continue; const n=idx(nx,ny); if(!pass(n)) continue;
        const w=ter[n]===7?1:0, nd=lvl+w; if(nd<moatD[n]){ moatD[n]=nd; moatPrev[n]=i; (w?next:cur).push(n); } } }
    cur=next; }
  if(found<0) return null;
  const path=[]; for(let i=found;i!==-1;i=moatPrev[i]) path.push(i); path.reverse();
  const tiles=path.filter(q=>ter[q]===7); if(!tiles.length) return null;
  const k=path.indexOf(tiles[0]), st=path[Math.max(0,k-1)];
  return {tiles, stand:{x:st%W+.5,y:((st/W)|0)+.5}};
}
/* cut off by the moat: wait at its edge and call the engineers to fill a crossing */
function crossMoat(u,b,dt){
  if(!u.moat||u.moat.ver!==G.pathVer||u.moat.b!==b) u.moat={ver:G.pathVer,b,plan:moatPlan(u,b),t:0};
  const P=u.moat.plan; if(!P) return;
  if(Math.hypot(u.x-P.stand.x,u.y-P.stand.y)>.6) moveP(u,P.stand.x,P.stand.y,dt,'TS');
  u.moat.t-=dt; if(u.moat.t>0) return; u.moat.t=1;
  callEngineers(P.tiles);
}
const DIGGERS=['spearman','maceman','pikeman','swordsman'];
function callEngineers(tiles){
  let free=G.units.filter(o=>o.team===0&&!o.dead&&o.def.eng&&o.fill===undefined&&!o.goal&&!postValid(o)), soldiers=false;
  /* no engineers to spare: the nearest foot soldiers fill it, more slowly */
  if(!free.length&&!G.units.some(o=>o.team===0&&!o.dead&&o.def.eng&&o.fill!==undefined&&tiles.includes(o.fill))){
    const q0=tiles[0], qx=q0%W+.5, qy=((q0/W)|0)+.5;
    free=G.units.filter(o=>o.team===0&&!o.dead&&DIGGERS.includes(o.kind)&&o.fill===undefined&&!o.goal&&!postValid(o)&&o.el===0&&Math.hypot(o.x-qx,o.y-qy)<30)
      .sort((a,b)=>Math.hypot(a.x-qx,a.y-qy)-Math.hypot(b.x-qx,b.y-qy)).slice(0,Math.max(2,tiles.length));
    soldiers=free.length>0; }
  let busy=false;
  for(const q of tiles){ if(ter[q]!==7) continue;
    if(G.units.some(o=>!o.dead&&o.fill===q)){ busy=true; continue; }
    const qx=q%W+.5, qy=((q/W)|0)+.5; let best=null,bd=1e9;
    for(const e of free){ if(e.fill!==undefined) continue; const dd=Math.hypot(e.x-qx,e.y-qy); if(dd<bd){bd=dd;best=e;} }
    if(best){ best.fill=q; best.t=0; best.pdest=null; busy=true; } }
  if(busy) say('moatfill',soldiers?'No engineers free, so foot soldiers are filling the moat for your siege engines':'Engineers are filling the moat so your siege engines can cross',undefined,45);
  else say('moatnone','Rams and siege towers cannot cross a moat. Bring engineers or foot soldiers to fill it.','warn',45);
}
function updateCart(u,dt){
  const s=G.stock, dest=u.dest||door(s);
  if(moveP(u,dest.x,dest.y,dt,'P')){
    if(u.def.caravan){ G.caravans.arrived++; const cp=G.home.camp; for(let i=0;i<4;i++){ const p=spawnUnit('peasant',u.x+(rand()-.5),u.y+(rand()-.5)); p.fade=1; } toast(`A caravan is safe! ${G.caravans.arrived} of ${G.L.goal.need} needed.`,'big'); sfx('win'); }
    for(const [k,v] of Object.entries(u.cargo||{})){ G.R[k]=(G.R[k]||0)+v; }
    if(u.cargo) floatText(u.x,u.y-1.2,Object.entries(u.cargo).map(([k,v])=>`+${v} ${RES_NAME[k]}`).join(' '),'#f2e6a0');
    u.gone=true;
  }
}
/* when a forced target falls, troops hold where the fight was instead of marching back */
function targetDone(u){
  if(u.forceT&&(u.forceT.dead||u.forceT.gone)){ u.forceT=null; u.tgt=null; u.hold={x:u.x,y:u.y}; u.think=0; }
  if(u.forceB&&u.forceB.dead){ u.forceB=null; u.hold={x:u.x,y:u.y}; u.think=0; }
  if(u.autoB&&u.autoB.dead){ u.autoB=null; u.hold={x:u.x,y:u.y}; u.think=0; }
  if(u.tgt&&(u.tgt.dead||u.tgt.gone)) u.tgt=null;
}
function chaseTo(u,x,y,dt){
  const d=Math.hypot(x-u.x,y-u.y);
  if(d<=3 && lineClear('T',u.x,u.y,x,y)){ moveToward(u,x,y,dt); return; }
  if(u.path && u.pdest && u.pver===G.pathVer && Math.hypot(u.pdest.x-x,u.pdest.y-y)<1.5){
    const wp=u.path[0]; if(moveToward(u,wp.x,wp.y,dt)){ u.path.shift(); if(!u.path.length){ u.pdest=null; u.path=null; } } return; }
  moveP(u,x,y,dt,'T');
}
/* attack stance: the nearest enemy building worth hitting that this unit can actually reach */
function autoBuilding(u,r,ranged){
  let best=null,bd=1e9; const my=compOf(u.x,u.y);
  for(const b of G.blds){ if(b.team!==1||b.dead||b.def.trap) continue;
    if(ranged && (b.def.castle||b.def.isKeep)) continue;
    const dd=rectDist(u.x,u.y,b); if(dd>r) continue;
    if(!ranged && my>=0 && dd>.8 && !touchesComp(b,my)) continue;
    const score=dd+(b.def.wallish?2.5:0)+(b.def.isKeep?1:0); if(score<bd){bd=score;best=b;} }
  return best;
}
/* the wall, gate or tower to break when the way to a target is shut */
function breachTarget(u,S){
  const my=compOf(u.x,u.y); let best=null,bs=1e9;
  const sx=S.x+S.w/2, sy=S.y+S.h/2;
  for(const b of G.blds){ if(b.team!==1||b.dead||!b.def.castle||b.def.isKeep) continue;
    if(my>=0 && !touchesComp(b,my)) continue;
    const cx=b.x+b.w/2, cy=b.y+b.h/2;
    const sc=Math.hypot(cx-u.x,cy-u.y)+.7*Math.hypot(cx-sx,cy-sy)+(b.type==='gatehouse'?-6:0)+(b.def.towerish?5:0);
    if(sc<bs){bs=sc;best=b;} }
  return best;
}
/* walk up to a building and hit it; if walls are in the way, break through the nearest weak point first */
function assaultBuilding(u,B,dt){
  let tgt=B;
  if(!canReachB(u,B)){ if(!u.breach||u.breach.dead||!canReachB(u,u.breach)) u.breach=breachTarget(u,B); if(!u.breach) return false; tgt=u.breach; }
  else u.breach=null;
  const dd=rectDist(u.x,u.y,tgt);
  if(dd>0.7){ const p=adjacentSpot(u,tgt); chaseTo(u,p.x,p.y,dt); return true; }
  if(u.cd<=0){ damageBld(tgt,u.def.dmg*1.2*lordBonus(u),0,0); u.cd=u.def.rate; u.strike=.15; u.face=Math.atan2(tgt.y+tgt.h/2-u.y,tgt.x+tgt.w/2-u.x); }
  return true;
}
function fightUnit(u,t,dt){
  const d=u.def, dd=Math.hypot(t.x-u.x,t.y-u.y), reach=t.def.big?0.95:0.75;
  if(dd>reach){ chaseTo(u,t.x,t.y,dt); return; }
  if(u.cd<=0){
    let dmg=d.dmg*lordBonus(u); if(t.def.big&&d.antiSiege) dmg*=d.antiSiege; if(d.cav&&!t.def.big) dmg*=1.1;
    hurt(t,dmg,'melee',u); u.cd=d.rate; u.face=Math.atan2(t.y-u.y,t.x-u.x); u.strike=.15; sfx('hit',u.x,u.y);
  }
}
/* ---------- storming a castle ---------- */
function stormTargetOf(u){
  if(u.storm&&!u.storm.dead) return u.storm;
  let best=null,bd=1e9;
  for(const b of G.blds){ if(b.team!==1||b.dead||b.def.trap) continue;
    const pr=(b.def.isKeep||b.type==='epavilion')?0:b.def.enemy?6:40;
    const d=Math.hypot(b.x+b.w/2-u.x,b.y+b.h/2-u.y)+pr; if(d<bd){bd=d;best=b;} }
  u.storm=best; if(!best){ u.storming=false; u.hold={x:u.x,y:u.y}; }
  return best;
}
/* a siege tower can only dock where solid ground it can reach touches the wall */
function dockable(u,b){ return !!(b&&!b.dead&&siegeSpot(u,b)); }
/* a ram goes for a gate it can reach, then the keep through a breach, then any gate (calling engineers to fill the moat) */
function ramTarget(u,S){
  const gates=G.blds.filter(b=>b.team===1&&!b.dead&&b.type==='gatehouse').sort((a,b)=>rectDist(u.x,u.y,a)-rectDist(u.x,u.y,b));
  for(const g of gates) if(siegeSpot(u,g)) return g;
  if(S&&siegeSpot(u,S)) return S;
  return gates[0]||S;
}
function nearestEnemyB(u,f){ let best=null,bd=1e9; for(const b of G.blds){ if(b.team!==1||b.dead||!f(b)) continue; const d=rectDist(u.x,u.y,b); if(d<bd){bd=d;best=b;} } return best; }
function stormPrep(u){
  const S=stormTargetOf(u); if(!S) return;
  const d=u.def;
  if(d.pladder){ if(!u.placed&&(!u.forceB||u.forceB.dead)) u.forceB=nearestEnemyB(u,b=>b.def.wallish||b.def.towerish); }
  else if(d.ram||u.kind==='pram'){ if(!u.forceB||u.forceB.dead||(u.forceB===u.autoPick&&u.soVer!==G.pathVer&&!siegeSpot(u,u.forceB))){ u.soVer=G.pathVer; u.forceB=u.autoPick=ramTarget(u,S); } }
  else if(d.stower){ if(!u.docked&&(!u.forceB||u.forceB.dead||(u.soVer!==G.pathVer&&!dockable(u,u.forceB)))){ u.soVer=G.pathVer; u.forceB=nearestEnemyB(u,b=>b.def.wallish&&dockable(u,b))||u.forceB&&!u.forceB.dead&&u.forceB||nearestEnemyB(u,b=>b.def.wallish); } }
  else if(d.artillery){ if(!u.forceB||u.forceB.dead){ const sx=S.x+S.w/2, sy=S.y+S.h/2; let best=null,bd=1e9; for(const b of G.blds){ if(b.team!==1||b.dead||!(b.def.towerish||b.type==='gatehouse')) continue; if(Math.hypot(b.x+b.w/2-sx,b.y+b.h/2-sy)>28) continue; const dd=rectDist(u.x,u.y,b)+(b.type==='gatehouse'?4:0)+(u.skip&&u.skip.includes(b.id)?99:0); if(dd<bd){bd=dd;best=b;} } u.forceB=best||S; } }
  else if(d.eng){ if(u.fill===undefined){ const gt=nearestEnemyB(u,b=>b.type==='gatehouse'); if(gt){ let bi=-1,bd=1e9; for(let j=-3;j<gt.h+3;j++)for(let i=-3;i<gt.w+3;i++){ const x=gt.x+i,y=gt.y+j; if(!inb(x,y)) continue; const q=idx(x,y); if(ter[q]!==7||G.units.some(o=>o.fill===q)) continue; const dd=Math.hypot(x+.5-u.x,y+.5-u.y); if(dd<bd){bd=dd;bi=q;} } if(bi>=0){ u.fill=bi; u.t=0; } } } }
}
/* support troops in an assault stay with the fighting men instead of standing where they were */
function followArmy(u,dt,dist){
  let best=null,bd=1e9; for(const o of G.units){ if(o.team!==0||o.dead||o===u||!o.storming||!(o.def.melee||o.def.ranged)||o.kind==='lord') continue; const dd=Math.hypot(o.x-u.x,o.y-u.y); if(dd<bd){bd=dd;best=o;} }
  if(!best){ u.storming=false; u.hold={x:u.x,y:u.y}; return; }
  if(bd>dist) chaseTo(u,best.x,best.y,dt);
}
/* your lord marches with the bowmen to inspire them, and only fights what reaches him */
function lordStorm(u,dt,reachable){
  const f=nearestFoe(u,u.x,u.y,3,reachable); if(f){ fightUnit(u,f,dt); return true; }
  let best=null,bd=1e9; for(const o of G.units){ if(o.team!==0||o.dead||o===u||!o.storming) continue; const w=o.def.ranged?0:6, dd=Math.hypot(o.x-u.x,o.y-u.y)+w; if(dd<bd){bd=dd;best=o;} }
  if(!best){ u.storming=false; u.hold={x:u.x,y:u.y}; return true; }
  if(Math.hypot(best.x-u.x,best.y-u.y)>2.5) chaseTo(u,best.x,best.y,dt);
  return true;
}
function stormMelee(u,dt,reachable){
  if(u.kind==='lord') return lordStorm(u,dt,reachable);
  const S=stormTargetOf(u); if(!S) return false;
  let t=u.tgt&&u.tgt.def&&u.tgt.def.w===undefined&&!u.tgt.dead&&Math.hypot(u.tgt.x-u.x,u.tgt.y-u.y)<8?u.tgt:null;
  u.think-=dt;
  if(u.think<=0){ u.think=.3; const f=nearestFoe(u,u.x,u.y,6,reachable); if(f&&(!t||Math.hypot(f.x-u.x,f.y-u.y)<Math.hypot(t.x-u.x,t.y-u.y)-1)) t=f; u.tgt=t; }
  if(t){ fightUnit(u,t,dt); return true; }
  if(!assaultBuilding(u,S,dt)) moveToward(u,S.x+S.w/2,S.y+S.h/2,dt);
  return true;
}
/* a reachable place within r of a point, cached so paths are not rebuilt every frame */
function standPoint(u,cx,cy,r){
  const key=Math.round(cx)+','+Math.round(cy);
  if(u.sp&&u.sp.key===key&&G.time-u.sp.t<1.5) return u.sp;
  const C=compsT(), my=C[tileOf(u.x,u.y)], a0=Math.atan2(u.y-cy,u.x-cx);
  let p={x:u.x+(cx-u.x)*.3,y:u.y+(cy-u.y)*.3};
  for(let k=0;k<11;k++){ const a=a0+(k%2?1:-1)*Math.ceil(k/2)*.22; const x=cl(cx+Math.cos(a)*r,.5,W-.5), y=cl(cy+Math.sin(a)*r,.5,H-.5); const c=C[tileOf(x,y)]; if(c>=0&&(my<0||c===my)){ p={x,y}; break; } }
  u.sp={x:p.x,y:p.y,key,t:G.time}; return u.sp;
}
function stormRanged(u,dt,range){
  const S=stormTargetOf(u); if(!S) return false;
  if(u.cd<=0){ const t=nearestFoe(u,u.x,u.y,range); if(t){ shoot(u,t,u.def.dmg*lordBonus(u),u.el*.25,u.def.ap?'bolt':'arrow'); u.cd=u.def.rate+rand()*.3; return true; } }
  if(nearestFoe(u,u.x,u.y,range)) return true;
  const f=nearestFoe(u,u.x,u.y,range+8);
  if(f){ const p=standPoint(u,f.x,f.y,range-1); chaseTo(u,p.x,p.y,dt); return true; }
  const cx=S.x+S.w/2, cy=S.y+S.h/2;
  if(rectDist(u.x,u.y,S)>range-.5){ const p=standPoint(u,cx,cy,range-1+Math.min(S.w,S.h)/2); chaseTo(u,p.x,p.y,dt); }
  else if(u.cd<=0&&!S.def.castle&&!S.def.isKeep){ shootB(u,S,u.def.dmg*.5); u.cd=u.def.rate; }
  return true;
}
function ranged(u,dt){
  const d=u.def, e=u.el, range=d.range+elevRange(e), atk=u.stance==='attack'&&!postValid(u);
  targetDone(u);
  if(u.storming&&!postValid(u)&&!u.forceT&&!u.forceB&&stormRanged(u,dt,range)) return;
  let t=u.forceT && !u.forceT.dead ? u.forceT : null;
  const B=u.forceB&&!u.forceB.dead?u.forceB:(atk&&u.autoB&&!u.autoB.dead?u.autoB:null);
  if(B && (B===u.forceB || !nearestFoe(u,u.x,u.y,range))){
    const dd=rectDist(u.x,u.y,B);
    if(dd>range-.3){ const p=standPoint(u,B.x+B.w/2,B.y+B.h/2,range-1+Math.min(B.w,B.h)/2); chaseTo(u,p.x,p.y,dt); return; }
    if(u.cd<=0){ const f=nearestFoe(u,u.x,u.y,range); if(f&&atk) shoot(u,f,d.dmg*lordBonus(u),e*.25,d.ap?'bolt':'arrow'); else shootB(u,B,d.dmg*.5); u.cd=d.rate; } return;
  }
  if(t){ const dd=Math.hypot(t.x-u.x,t.y-u.y); if(dd>range){ const p=standPoint(u,t.x,t.y,range-1); chaseTo(u,p.x,p.y,dt); return; } }
  if(u.cd>0){ if(u.chase&&!u.chase.dead&&Math.hypot(u.chase.x-u.x,u.chase.y-u.y)>range){ const p=standPoint(u,u.chase.x,u.chase.y,range-1); chaseTo(u,p.x,p.y,dt); } return; }
  if(!t) t=nearestFoe(u,u.x,u.y,range);
  if(t){ u.chase=null; shoot(u,t,d.dmg*lordBonus(u),e*0.25,d.ap?'bolt':'arrow'); u.cd=d.rate+rand()*.3; return; }
  u.cd=0.2;
  if(atk){
    const R=troopRanges(u);
    const f=nearestFoe(u,u.x,u.y,range+R.aggro);
    if(f){ u.chase=f; u.autoB=null; u.goal=null; const p=standPoint(u,f.x,f.y,range-1); chaseTo(u,p.x,p.y,dt); return; }
    u.chase=null;
    const b=autoBuilding(u,range+R.aggro,true); if(b){ u.autoB=b; return; }
    u.hold={x:u.x,y:u.y};
  }
}
function melee(u,dt){
  const d=u.def, R=troopRanges(u), atk=u.stance==='attack';
  targetDone(u);
  const reachable=o=>(u.el>0 ? (o.el>0||Math.hypot(o.x-u.x,o.y-u.y)<1.3) : o.el===0) && sameComp(u,o);
  if(u.storming&&!u.forceT&&!u.forceB&&stormMelee(u,dt,reachable)) return;
  let B=u.forceB&&!u.forceB.dead?u.forceB:(atk&&u.autoB&&!u.autoB.dead?u.autoB:null);
  if(B){ const f=nearestFoe(u,u.x,u.y,B===u.autoB?Math.max(3,R.aggro*.6):(atk?2.5:0),reachable); if(f){ if(B===u.autoB) u.autoB=null; u.tgt=f; B=null; } }
  if(B){ if(!assaultBuilding(u,B,dt)){ if(B===u.autoB) u.autoB=null; else { u.forceB=null; u.hold={x:u.x,y:u.y}; } } return; }
  let t=u.forceT&&!u.forceT.dead?u.forceT:u.tgt;
  if(t&&(t.dead||!t.def||t.def.w!==undefined)) t=u.tgt=null;
  if(t&&!u.forceT){
    if(atk){ if(Math.hypot(t.x-u.x,t.y-u.y)>R.aggro+6) t=u.tgt=null; }
    else if(Math.hypot(t.x-u.hold.x,t.y-u.hold.y)>R.leash+.5) t=u.tgt=null;
  }
  if(!t){
    u.think-=dt;
    if(u.think<=0){ u.think=.3;
      const reach=Math.max(1.2,R.aggro), ax=atk?u.x:u.hold.x, ay=atk?u.y:u.hold.y;
      t=(d.antiSiege&&nearestFoe(u,ax,ay,reach,o=>(o.kind==='ram'||o.kind==='stower')&&sameComp(u,o)))||nearestFoe(u,ax,ay,reach,reachable);
      u.tgt=t;
      if(!t&&atk&&u.el===0){ const b=autoBuilding(u,reach+4,false); if(b){ u.autoB=b; return; } }
    }
  }
  if(t){
    if(u.stance==='stand'&&!u.forceT&&Math.hypot(t.x-u.x,t.y-u.y)>(t.def.big?.95:.75)){ u.tgt=null; return; }
    fightUnit(u,t,dt);
    if(t.dead&&atk){ u.hold={x:u.x,y:u.y}; u.think=0; }
    return;
  }
  if(atk){ u.hold={x:u.x,y:u.y}; return; }
  if(Math.hypot(u.x-u.hold.x,u.y-u.hold.y)>.12) moveToward(u,u.hold.x,u.hold.y,dt);
}
function clusterTarget(u,range,minR,team){
  let best=null,bs=0;
  for(const o of G.units){ if(o.dead||!foe(u,o)||o.kind==='thief') continue; const d=Math.hypot(o.x-u.x,o.y-u.y); if(d>range||d<minR) continue;
    let s=o.def.big?4:1; for(const p of G.units){ if(p!==o&&!p.dead&&p.team===o.team&&Math.abs(p.x-o.x)<1.3&&Math.abs(p.y-o.y)<1.3) s++; }
    if(s>bs){bs=s;best=o;} }
  return best;
}
function artillery(u,dt){
  const d=u.def;
  if(u.fireT>0) u.fireT-=dt;
  if(u.cd>0) return;
  let tx_=null, ty_=null;
  const inR=(x,y)=>{const dd=Math.hypot(x-u.x,y-u.y); return dd<=d.range&&dd>=d.minRange;};
  const standoff=(cx,cy)=>{
    const key=Math.round(cx)+','+Math.round(cy);
    if(!u.so||u.so.key!==key||u.so.ver!==G.pathVer){
      const my=compOf(u.x,u.y), a0=Math.atan2(u.y-cy,u.x-cx); let p=null;
      for(const r of [d.range-.4,d.range-1.5,d.range-3]) { if(r<d.minRange+1) continue; for(let k=0;k<17&&!p;k++){ const a=a0+(k%2?1:-1)*Math.ceil(k/2)*.16, x=cl(cx+Math.cos(a)*r,.5,W-.5), y=cl(cy+Math.sin(a)*r,.5,H-.5); if(clearAtK('TS',x,y)&&(my<0||compOf(x,y)===my)) p={x,y}; } if(p) break; }
      u.so={key,ver:G.pathVer,p};
    }
    if(!u.so.p){ if(u.forceB&&u.storming) u.forceB=null; else if(u.forceB) { u.forceB=null; toast('A siege engine cannot get in range of that target','warn'); } return; }
    moveP(u,u.so.p.x,u.so.p.y,dt,'TS'); };
  if(u.forceB&&!u.forceB.dead){ const b=u.forceB; const cx=b.x+b.w/2, cy=b.y+b.h/2; if(inR(cx,cy)){tx_=cx;ty_=cy;} else { standoff(cx,cy); return; } }
  else if(u.forceT&&!u.forceT.dead){ const t=u.forceT; if(inR(t.x,t.y)){tx_=t.x;ty_=t.y;} else { standoff(t.x,t.y); return; } }
  if(tx_===null){
    const nearestB=()=>{ let best=null,bd=1e9; for(const b of G.blds){ if(b.team!==1) continue; const cx=b.x+b.w/2, cy=b.y+b.h/2; const dd=Math.hypot(cx-u.x,cy-u.y); if(inR(cx,cy)&&dd<bd){bd=dd;best=b;} } return best; };
    if(d.bldFirst){ const b=nearestB(); if(b){tx_=b.x+b.w/2;ty_=b.y+b.h/2;} }
    if(tx_===null){ const t=clusterTarget(u,d.range,d.minRange,0); if(t){tx_=t.x;ty_=t.y;} }
    if(tx_===null){ const b=nearestB(); if(b){tx_=b.x+b.w/2;ty_=b.y+b.h/2;} }
  }
  if(tx_===null){ u.cd=.4; return; }
  lob(u,tx_,ty_,d.bdmg,d.splash,0); u.cd=d.rate;
}

/* ---------- enemies ---------- */
function econBld(b){return b && b.team===0 && !b.def.castle && !b.def.trap && !b.def.fixed;}
/* a building this soldier may break: yours, or in a free for all the lord he marches on */
function breakable(u,b){ return b.team===0 || (G.ffa && u.march>0 && b.team===1 && b.owner===u.march); }
function econFoe(u,b){ return b && !b.def.castle && !b.def.trap && !b.def.fixed && (b.team===0 || (G.ffa && b.team===1 && b.owner && b.owner!==lordOf(u))); }
function foeBld(u,b){ return b.team===0 ? true : G.ffa && b.team===1 && b.owner && b.owner!==lordOf(u); }
/* where an army is headed: 0 is you, otherwise the rival lord it marches on */
function lordAlive(T){ if(!(T>0)) return !!(G.keep&&!G.keep.dead); const a=aiById(T); return !!(a&&a.alive&&a.keep&&!a.keep.dead); }
function fields(u){ if(!G.ffa||!(u.march>0)) return {G:distG,C:distC,S:distS,T:0}; return {G:ffaField(u.march,'G'),get C(){return ffaField(u.march,'C');},get S(){return ffaField(u.march,'S');},T:u.march}; }
function marchKeep(u){ return G.ffa&&u.march>0 ? (aiById(u.march)||{}).keep : G.keep; }
function retarget(u){
  const me=lordOf(u), ai=aiById(me);
  if(ai&&ai.target!==undefined&&ai.target!==me&&lordAlive(ai.target)){ u.march=ai.target; return; }
  let best=-1,bd=1e9; const cand=[0,...G.ais.filter(a=>a.alive).map(a=>a.id)];
  for(const T of cand){ if(T===me||!lordAlive(T)) continue; const k=T>0?aiById(T).keep:G.keep; const d=Math.hypot(k.x-u.x,k.y-u.y); if(d<bd){bd=d;best=T;} }
  if(best<0){ u.wave=false; u.march=undefined; if(ai){ u.role='pool'; const m=aiMuster(ai); u.guard=aiSpot(m.x,m.y,3,false); u.guardR=7; } return; }
  u.march=best;
}
function blockedFlow(u,i){ const t=ter[i]; if(t===2||t===5) return true; if(u.def.siege&&t===7) return true; const b=occB[i]; if(!b||b.def.trap) return false;
  if(b.team===1 && !(G.ffa&&u.march>0&&b.owner===u.march)) return ownCastleShut(b,i) && !(u.el>0||u.postB||castleLevel(tileOf(u.x,u.y))===1);
  if(u.climb&&b.def.castle&&!b.def.isKeep) return false; return true; }
function blockedBetween(u,a,b){
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2);
  for(let s=1;s<steps;s++){const x=a.x+(b.x-a.x)*s/steps,y=a.y+(b.y-a.y)*s/steps; if(blockedFlow(u,tileOf(x,y))) return true;}
  return false;
}
function elevRange(e){ return e===3?5:e===2?4:e===1?2:0; }
const MANG_R=13, MANG_GREAT_R=15, BALL_R=15, KEEP_R=9;
function enemyRange(u){ return u.def.range+elevRange(u.el); }
function chooseTarget(u){
  const d=u.def;
  if(d.siege) return null;
  if(u.hunt && !u.hunt.dead) return u.hunt;
  if(u.guard){
    if(d.ranged) return nearestFoe(u,u.x,u.y,enemyRange(u));
    const t=nearestFoe(u,u.guard.x,u.guard.y,u.guardR||9);
    if(t) return t;
    if(u.ai) return null;
    let best=null,bd=6; for(const b of G.blds){ if(b.team!==0) continue; const dd=rectDist(u.x,u.y,b); if(dd<bd){bd=dd;best=b;} } return best;
  }
  if(d.ranged){
    const t=nearestFoe(u,u.x,u.y,enemyRange(u)); if(t) return t;
    let best=null,bd=d.range-1;
    for(const b of G.blds){ if(!econFoe(u,b)) continue; const dd=rectDist(u.x,u.y,b); if(dd<bd){bd=dd;best=b;} }
    return best;
  }
  if(d.beast){ let t=nearestFoe(u,u.x,u.y,7,o=>o.el===0&&!o.def.big); if(!t) t=nearestAnimal(u.x,u.y,6,'deer'); return t; }
  const t=nearestFoe(u,u.x,u.y,3.5,o=> (u.el>0 ? (o.el>0||Math.hypot(o.x-u.x,o.y-u.y)<1.3) : o.el===0) && !blockedBetween(u,u,o));
  if(t) return t;
  let best=null,bd=1.6;
  for(const b of G.blds){ if(!econFoe(u,b)) continue; const dd=rectDist(u.x,u.y,b); if(dd<bd){bd=dd;best=b;} }
  return best;
}
function updateEnemy(u,dt){
  const d=u.def;
  u.cd-=dt; u.think-=dt;
  if(u.fireT>0) u.fireT-=dt;
  if(d.regen){ u.calm+=dt; if(u.calm>4&&u.hp<u.maxHp) u.hp=Math.min(u.maxHp,u.hp+d.regen*dt); }
  if(u.flee){ if(moveToward(u,u.flee.x,u.flee.y,dt)) u.gone=true; u.fade=Math.max(u.fade,0); return; }
  const ti=tileOf(u.x,u.y), ob=occB[ti];
  if(ob && ob.def.trap && ob.team===0 && !d.beast){ hurt(u,70,'trap'); sfx('trap',u.x,u.y); removeBld(ob,true); for(let k=0;k<8;k++)G.parts.push({x:u.x,y:u.y,vx:(rand()-.5)*3,vy:(rand()-.5)*3,life:.5,max:.5,c:'#6b4a2b',s:3}); if(u.dead) return; }
  if(G.ffa&&u.wave&&u.march!==undefined&&!lordAlive(u.march)){ retarget(u); if(!u.wave) return; }
  if(d.artillery) return enemyArtillery(u,dt);
  if(d.stower){ if(u.docked) return; if(u.guard&&!u.wave) return; return siegeStep(u,dt); }
  if(d.beast) return beastStep(u,dt);
  if(d.siege){ if(u.guard&&!u.wave) return; return siegeStep(u,dt); }
  if(u.think<=0){u.think=.35+rand()*.2; u.tgt=chooseTarget(u);}
  const t=u.tgt;
  if(t && !t.dead){
    if(t.def && t.def.w===undefined){
      const dd=Math.hypot(t.x-u.x,t.y-u.y);
      if(d.ranged){ if(dd<=enemyRange(u)){ if(u.cd<=0){shoot(u,t,d.dmg*bossBonus(u),u.el*.25,d.ap?'bolt':'arrow',u.fire?.3:0);u.cd=d.rate;} return; } }
      else{
        if(dd<=0.75){ if(u.cd<=0){ if(t.team===2) kill(t); else hurt(t,d.dmg*bossBonus(u),'melee',u); u.cd=d.rate;u.face=Math.atan2(t.y-u.y,t.x-u.x);u.strike=.15;sfx('hit',u.x,u.y);} return; }
        const nx=u.x+(t.x-u.x)/dd*0.4, ny=u.y+(t.y-u.y)/dd*0.4;
        if(inb(nx|0,ny|0) && !blockedFlow(u,tileOf(nx,ny))){ moveToward(u,t.x,t.y,dt); return; }
        if(u.guard){ moveE(u,u.guard.x,u.guard.y,dt); return; }
      }
    } else {
      const dd=rectDist(u.x,u.y,t);
      const reach=d.ranged?d.range:0.75;
      if(dd<=reach){ if(u.cd<=0){ if(d.ranged) shootB(u,t,d.bdmg,u.fire?.35:0); else {damageBld(t,d.bdmg,0,lordOf(u));u.strike=.15;} u.cd=d.rate; u.face=Math.atan2(t.y+t.h/2-u.y,t.x+t.w/2-u.x);} return; }
      if(!d.ranged && dd<1.6){ moveToward(u,cl(u.x,t.x,t.x+t.w),cl(u.y,t.y,t.y+t.h),dt); return; }
    }
  }
  if(u.guard){ if(Math.hypot(u.x-u.guard.x,u.y-u.guard.y)>.3) moveE(u,u.guard.x,u.guard.y,dt); return; }
  const F=fields(u); flowStep(u,dt,u.climb?F.C:F.G);
}
/* enemy soldiers walk inside their own castle like anyone else: out through the gate, up at the towers */
function moveE(u,x,y,dt){ if(Math.hypot(x-u.x,y-u.y)<2.5||lineClear('E',u.x,u.y,x,y)) { moveToward(u,x,y,dt); return; } moveP(u,x,y,dt,'E'); }
function bossBonus(u){ for(const o of G.units){ if(o.kind==='rothgar'&&!o.dead&&o!==u&&Math.abs(o.x-u.x)<4&&Math.abs(o.y-u.y)<4) return 1.15; } return 1; }
function beastStep(u,dt){
  if(u.think<=0){u.think=.4; u.tgt=chooseTarget(u);}
  const t=u.tgt;
  if(t&&!t.dead){ const dd=Math.hypot(t.x-u.x,t.y-u.y); if(dd<=.7){ if(u.cd<=0){ if(t.team===2) kill(t); else hurt(t,u.def.dmg,'melee',u); u.cd=u.def.rate; sfx('hit',u.x,u.y);} } else moveToward(u,t.x,t.y,dt); return; }
  if(!u.wp||Math.hypot(u.wp.x-u.x,u.wp.y-u.y)<.4){ const k=G.keep; u.wp={x:cl(u.x+(rand()-.5)*8+(k.x-u.x)*.15,1,W-2),y:cl(u.y+(rand()-.5)*8+(k.y-u.y)*.15,1,H-2)}; }
  moveToward(u,u.wp.x,u.wp.y,dt*.6);
}
function nextFlowTile(u,dist){
  if(u.def.siege && dist[tileOf(u.x,u.y)]===Infinity){ const F=fields(u); if(dist===F.S) dist=F.G; }
  const cx=cl(u.x|0,0,W-1), cy=cl(u.y|0,0,H-1);
  const ci=idx(cx,cy);
  let best=-1, bd=dist[ci];
  for(const [dx,dy] of NB){
    const nx=cx+dx, ny=cy+dy; if(!inb(nx,ny)) continue;
    if(dx&&dy && (blockedFlow(u,idx(nx,cy))||blockedFlow(u,idx(cx,ny)))) continue;
    const n=idx(nx,ny); if(u.def.siege&&ter[n]===7) continue; if(dist[n]<bd){ const ob=occB[n]; if(ob&&G.ffa&&!ob.def.trap&&!breakable(u,ob)&&blockedFlow(u,n)) continue; bd=dist[n];best=n;}
  }
  return {ci,best};
}
function flowStep(u,dt,dist){
  const d=u.def;
  const {ci,best}=nextFlowTile(u,dist);
  if(best<0){ if(dist[ci]===Infinity){ const k=marchKeep(u); if(k) moveToward(u,k.x+k.w/2,k.y+k.h/2,dt); } return; }
  const sb=occB[best];
  if(sb && !sb.def.trap && breakable(u,sb)){
    const climbable = sb.def.castle && !sb.def.isKeep;
    if(u.climb && climbable){ moveToward(u,best%W+.5,((best/W)|0)+.5,dt); return; }
    if(!u.climb && !d.ranged && climbable && (sb.ladders>0||sb.dock>0)){
      if(moveToward(u,best%W+.5,((best/W)|0)+.5,dt)) u.climb=true;
      if(occB[tileOf(u.x,u.y)]===sb) u.climb=true;
      return;
    }
    if(rectDist(u.x,u.y,sb)<=0.75){
      if(d.ladder && sb.def.wallish && !u.placed){
        sb.ladders++; u.placed=true; u.climb=true; G.ladders.push({b:sb,x:u.x,y:u.y,team:1});
        if(sb.team===0) say('ladder','Ladders against the walls!','warn',15); sfx('build',u.x,u.y); return;
      }
      if(u.cd<=0){ damageBld(sb, d.bdmg*bossBonus(u),0,lordOf(u)); u.cd=d.rate; u.strike=.15; u.face=Math.atan2(((best/W)|0)+.5-u.y,best%W+.5-u.x); }
      return;
    }
  }
  moveToward(u,best%W+.5,((best/W)|0)+.5,dt);
}
function siegeStep(u,dt){
  const d=u.def, S=fields(u).S;
  const {ci,best}=nextFlowTile(u,S);
  if(best<0){ if(S[ci]===Infinity){ u.stuck=(u.stuck||0)+dt; if(u.stuck>2&&!(u.march>0)) say('siegestuck','Your moat has stopped their siege engines. Send troops out to finish them.','',45); } return; }
  const sb=occB[best];
  if(sb && !sb.def.trap && breakable(u,sb)){
    if(rectDist(u.x,u.y,sb)<=0.8){
      if(d.stower){ if(sb.def.castle && !sb.def.isKeep){ u.docked=sb; sb.dock++; if(sb.team===0) say('stower','A siege tower has reached the walls!','warn',15); } else if(u.cd<=0){ damageBld(sb,30,0,lordOf(u)); u.cd=2; } return; }
      if(u.cd<=0){ damageBld(sb, d.bdmg,0,lordOf(u)); u.cd=d.rate; u.strike=.25; }
      return;
    }
  }
  moveToward(u,best%W+.5,((best/W)|0)+.5,dt);
}
function enemyArtillery(u,dt){
  const d=u.def;
  if(u.cd>0 && u.inPos) return;
  const inR=(x,y)=>{const dd=Math.hypot(x-u.x,y-u.y); return dd<=d.range&&dd>=d.minRange;};
  let tgt=null;
  if(d.bldFirst){ let bd=1e9; for(const b of G.blds){ if(b.def.trap||!foeBld(u,b)) continue; const cx=b.x+b.w/2, cy=b.y+b.h/2; if(!inR(cx,cy)) continue; const pr=(b.def.isKeep?0:b.def.castle?5:9)+Math.hypot(cx-u.x,cy-u.y)*.1; if(pr<bd){bd=pr;tgt={x:cx,y:cy};} } }
  else { const t=clusterTarget(u,d.range,d.minRange,1); if(t) tgt={x:t.x,y:t.y}; else { let bd=1e9; for(const b of G.blds){ if(b.def.trap||!foeBld(u,b)) continue; const cx=b.x+b.w/2, cy=b.y+b.h/2; if(!inR(cx,cy)) continue; const dd=Math.hypot(cx-u.x,cy-u.y); if(dd<bd){bd=dd;tgt={x:cx,y:cy};} } } }
  if(tgt){ u.inPos=true; if(u.cd<=0){ lob(u,tgt.x,tgt.y,d.bdmg,d.splash,1); u.cd=d.rate; } return; }
  u.inPos=false;
  if(u.guard&&!u.wave) return;
  const {best}=nextFlowTile(u,fields(u).S);
  if(best>=0 && !(occB[best]&&breakable(u,occB[best]))) moveToward(u,best%W+.5,((best/W)|0)+.5,dt);
}

/* ---------- animals ---------- */
function spawnDeer(){
  const k=G.keep;
  for(let t=0;t<40;t++){ const x=1+rand()*(W-2), y=1+rand()*(H-2); const i=tileOf(x,y);
    if(ter[i]!==0||occB[i]||Math.hypot(x-k.x,y-k.y)<14) continue;
    let near=false; for(let j=-2;j<=2&&!near;j++)for(let q=-2;q<=2;q++) if(inb((x|0)+q,(y|0)+j)&&ter[idx((x|0)+q,(y|0)+j)]===1){near=true;break;}
    if(!near) continue; const u=spawnUnit('deer',x,y); u.home={x,y}; return u; }
}
function updateAnimal(u,dt){
  if(u.kind==='deer'){
    const f=nearestFoe({team:1},u.x,u.y,3.5,o=>!o.job||o.job.type!=='hunter') || G.units.find(o=>o.def.beast&&!o.dead&&Math.hypot(o.x-u.x,o.y-u.y)<4);
    if(f){ moveToward(u,u.x+(u.x-f.x),u.y+(u.y-f.y),dt); return; }
    if(!u.wp||Math.hypot(u.wp.x-u.x,u.wp.y-u.y)<.3){ u.wait-=dt; if(u.wait>0) return; u.wp={x:cl(u.home.x+(rand()-.5)*8,1,W-2),y:cl(u.home.y+(rand()-.5)*8,1,H-2)}; u.wait=2+rand()*4; }
    moveToward(u,u.wp.x,u.wp.y,dt*.35);
  } else if(u.kind==='rat'){
    const g=G.gran;
    if(!u.wp||Math.hypot(u.wp.x-u.x,u.wp.y-u.y)<.3){ const near=rand()<.6?g:(G.blds.filter(b=>b.def.housing&&b.team===0)[0]||g); u.wp={x:near.x+rand()*near.w,y:near.y+near.h+rand()*1.5}; }
    moveToward(u,u.wp.x,u.wp.y,dt*.7);
    if(rectDist(u.x,u.y,g)<3){ u.eat=(u.eat||0)+dt*.05; if(u.eat>=1){ u.eat=0; for(const k of RES_KEYS.food) if(G.R[k]>=1){G.R[k]--;break;} } }
  }
}
function spawnRats(n){
  const g=G.gran; let c=0;
  for(let i=0;i<n;i++){ if(G.units.filter(u=>u.kind==='rat').length>=12) break; spawnUnit('rat',g.x+rand()*3-0.5,g.y+g.h+.5+rand()); c++; }
  return c;
}
function spawnWolves(n){
  for(let t=0;t<60;t++){ const x=1+rand()*(W-2), y=1+rand()*(H-2); const i=tileOf(x,y);
    if(ter[i]!==1||Math.hypot(x-G.keep.x,y-G.keep.y)<16) continue;
    for(let k=0;k<n;k++) spawnUnit('wolf',x+(rand()-.5)*2,y+(rand()-.5)*2);
    return true; }
  return false;
}

/* separation using a tile grid */
let gHead=null, gNext=new Int32Array(1);
function separate(dt){
  const us=G.units, n=us.length;
  if(!gHead||gHead.length!==N) gHead=new Int32Array(N);
  gHead.fill(-1); if(gNext.length<n) gNext=new Int32Array(n*2);
  for(let i=0;i<n;i++){ const c=tileOf(us[i].x,us[i].y); gNext[i]=gHead[c]; gHead[c]=i; }
  const k=Math.min(1,dt*10);
  for(let i=0;i<n;i++){
    const a=us[i]; if(a.dead||a.def.big||a.docked) continue;
    const ax0=a.x|0, ay0=a.y|0;
    const aFix=(a.post||(a.el>0&&!a.goal)||(a.guard&&a.def.ranged));
    for(let jy=ay0-1;jy<=ay0+1;jy++)for(let jx=ax0-1;jx<=ax0+1;jx++){
      if(!inb(jx,jy)) continue;
      for(let j=gHead[idx(jx,jy)];j!==-1;j=gNext[j]){
        if(j<=i) continue; const b=us[j]; if(b.dead||b.team!==a.team||b.def.big) continue;
        const dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy;
        if(d2<0.12 && d2>1e-6){
          const bFix=(b.post||(b.el>0&&!b.goal)||(b.guard&&b.def.ranged));
          const d=Math.sqrt(d2), push=(0.35-d)*0.5*k/d;
          const ax=a.x-dx*push, ay=a.y-dy*push, bx=b.x+dx*push, by=b.y+dy*push;
          if(!aFix && !blockedMove(a,tileOf(ax,ay)) && (a.kind!=='peasant'||clearAtK('P',ax,ay)) && (a.team!==1||!blockedFlow(a,tileOf(ax,ay))) && (a.team!==0||stepOK(tileOf(a.x,a.y),tileOf(ax,ay)))){a.x=ax;a.y=ay;}
          if(!bFix && !blockedMove(b,tileOf(bx,by)) && (b.kind!=='peasant'||clearAtK('P',bx,by)) && (b.team!==1||!blockedFlow(b,tileOf(bx,by))) && (b.team!==0||stepOK(tileOf(b.x,b.y),tileOf(bx,by)))){b.x=bx;b.y=by;}
        }
      }
    }
  }
}

/* ---------- economy ---------- */
function peasants(){return G.units.filter(u=>u.kind==='peasant'&&!u.leaving&&!u.dead);}
function countB(t){let n=0; for(const b of G.blds) if(b.type===t&&b.team===0) n++; return n;}
function staffed(t){let n=0; for(const b of G.blds) if(b.type===t&&b.team===0&&b.worker&&b.worker.st&&b.worker.st!=='go') n++; return n;}
function foodTotal(){let s=0; for(const k of RES_KEYS.food) s+=G.R[k]; return s;}
function rankOf(h){let r=0; for(let i=0;i<RANKS.length;i++) if(h>=RANKS[i].h) r=i; return r;}
function consumeFood(n){
  let need=n;
  for(let pass=0;pass<3&&need>0.01;pass++){
    const types=RES_KEYS.food.filter(k=>G.R[k]>=1); if(!types.length) break;
    const share=need/types.length;
    for(const k of types){ const take=Math.min(G.R[k],share); G.R[k]-=take; need-=take; }
  }
  return n-need;
}
function fearSum(){ return countB('stocks')+countB('gaol')+2*countB('gallows')+3*countB('rack'); }
function predictFactors(){
  const ps=peasants().length, rat=RATIONS[G.ration], tx_=TAXES[G.tax];
  const need=Math.ceil(ps*rat.m*0.3), ft=foodTotal();
  const food = (need>0 && ft<need) ? -8 : rat.p;
  const kinds=RES_KEYS.food.filter(k=>G.R[k]>=1).length;
  const variety = rat.m>0 && ft>=need ? Math.max(0,Math.min(3,kinds-1)) : 0;
  const gold = ps*tx_.g;
  const tax = (gold<0 && G.R.gold < -gold) ? 1 : tx_.p;
  const aleNeed=Math.ceil(ps/12); let inns=0; for(const b of G.blds) if(b.type==='inn'&&b.team===0) inns+=b.store;
  const ale = countB('inn') ? Math.round(4*Math.min(1,inns/Math.max(1,aleNeed))) : 0;
  const chap = Math.min(3,countB('chapel'))*2 + countB('cathedral')*4;
  const crime = -Math.min(5,Math.floor(G.crime/20));
  const justice = -Math.min(8,fearSum());
  const rats = -Math.min(4,Math.floor(G.units.filter(u=>u.kind==='rat').length/3));
  let court=0; for(const m of G.mods) if(m.until>G.time) court+=m.pop;
  const ev = G.time<(G.festUntil||-1) ? 3 : 0;
  const cold = isWinter() && foodTotal()<ps*2 ? -2 : 0;
  return {food,variety,tax,ale,chap,crime,justice,rats,court:court+ev,cold,trend:food+variety+tax+ale+chap+crime+justice+rats+court+ev+cold,need,gold,aleNeed,inns};
}
function econCycle(){
  const f=predictFactors(), L=G.L;
  if(f.need>0) consumeFood(f.need);
  if(f.gold<0){ if(G.R.gold>=-f.gold) G.R.gold+=f.gold; } else G.R.gold+=f.gold;
  if(f.gold>=1) floatText(G.keep.x+2,G.keep.y-.3,`+${Math.floor(f.gold)} gold`,RES_COL.gold);
  let served=0; for(const b of G.blds) if(b.type==='inn'&&b.team===0&&served<f.aleNeed){ const t=Math.min(b.store,f.aleNeed-served); b.store-=t; served+=t; }
  let h=0; const bq=BANQUETS[G.banquet];
  if(bq.h){ const ok=foodTotal()>=bq.food && G.R.ale>=bq.ale && G.R.gold>=bq.gold;
    if(ok){ consumeFood(bq.food); G.R.ale-=bq.ale; G.R.gold-=bq.gold; h+=bq.h; G.banquetOK=true; }
    else { G.banquetOK=false; say('banquet','Not enough food, ale or gold for the banquet','warn',30); } }
  h+=Math.min(3,countB('chapel'))*0.5 + countB('cathedral')*2;
  estatesWeek();
  for(const e of G.estates) if(e.owner===1) h+=1;
  if(h>0) gainHonor(h);
  const ps=peasants().length;
  G.crime=cl(G.crime + (ps*0.045 + (G.pop<50?1.5:0) - 0.5)*L.crime - staffed('guardpost')*3 - countB('stocks')*1 - countB('gaol')*2.5 - countB('gallows')*3 - countB('rack')*4, 0, 100);
  if(G.crime>25 && rand()<.5){ const s=Math.min(G.R.gold, Math.round(G.crime*0.3)); if(s>0){ G.R.gold-=s; say('theft',`Pickpockets took ${s} gold. Build guard posts or justice buildings.`,'warn',25); } }
  if(G.crime>35 && rand()<(G.crime-30)/90 && G.units.filter(u=>u.kind==='thief').length<3) makeThief();
  if(G.crime>55 && rand()<.25){ const c=G.blds.filter(canBurn); if(c.length){ ignite(c[(rand()*c.length)|0]); say('arson','Arsonists set a fire!','warn',20); } }
  G.dirt=cl(G.dirt + (ps*0.03 + (foodTotal()>260?.6:0) - 0.6)*L.dirt - countB('latrine')*1.2 - staffed('ratcatcher')*2.5, 0, 100);
  if(G.dirt>45){ const n=spawnRats(Math.floor(G.dirt/35)); if(n) say('rats','Rats in the granary! Build latrines and a rat catcher.','warn',40); }
  G.pop=Math.max(0,Math.min(100,G.pop+f.trend));
  G.factors=f; G.aleServed=served;
  G.week++;
  G.workMul=1+Math.min(.3,fearSum()*.03);
  if(f.food===-8 && RATIONS[G.ration].m>0) say('nofood','The granary is empty. Popularity is falling.','warn',20);
  if(isWinter()&&!G.saidWinter){ G.saidWinter=true; toast('Winter has come. Orchards and fields lie idle until spring.','big'); }
  if(!isWinter()) G.saidWinter=false;
}
function gainHonor(h){ G.honor+=h; const before=rankOf(G.honorTotal); G.honorTotal+=h; const after=rankOf(G.honorTotal); floatText(G.keep.x+2,G.keep.y-1,`+${h%1?h.toFixed(1):h} honor`,RES_COL.honor); if(after>before){ toast(`You are now a ${RANKS[after].n}`,'big'); sfx('win'); } }
function peasantFlow(){
  const ps=peasants(), cp=G.home.camp;
  if(G.pop>=50 && ps.length<housing()){
    const y=cl(cp.y-3+rand()*6,1,H-2);
    let u;
    if(findPath('P',0.5,y,cp.x,cp.y)) u=spawnUnit('peasant',0.3,y);
    else u=spawnUnit('peasant',cp.x+(rand()-.5)*2,cp.y+(rand()-.5)*1.5);
    u.wp=clearSpot(cp.x,cp.y,1.5); u.fade=1;
  } else if(G.pop<50 && ps.length){
    let u=ps.find(p=>!p.job) || ps[ps.length-1];
    dropJob(u); u.leaving=true; u.sel=false;
    say('leaving','Peasants are leaving. Raise popularity in the Keep tab.','warn',25);
  }
}
function assignWorkers(){
  const idle=peasants().filter(u=>!u.job);
  for(const b of G.blds){ if(!b.def.worker||b.worker||b.team!==0) continue; const u=idle.shift(); if(!u) break; setJob(u,b); }
}

/* ---------- main update ---------- */
const STEP=1/30;
function update(dt){
  G.time+=dt;
  /* big maps refresh the fields less often, and one field per step so no single frame stalls */
  if(G.flowStage){ const k=G.flowStage; flowFor(k,k==='C'?distC:distS); G.flowStage=k==='C'?'S':0; if(!G.flowStage) G.flowN=(G.flowN||0)+1; }
  else if(G.flowDirty){G.flowT-=dt; if(G.flowT<=0){ if(N>7000){ flowFor('G',distG); computePWalk(); G.flowDirty=false; G.flowStage='C'; } else computeFlow(); G.flowT=.4*Math.max(1,N/5000);}}
  G.cyc+=dt; if(G.cyc>=8){G.cyc=0; econCycle();}
  G.peasT+=dt; if(G.peasT>=(G.pop<25?2.5:4)){G.peasT=0; if(!G.L.noPeasants) peasantFlow();}
  G.assignT+=dt; if(G.assignT>=1){G.assignT=0; assignWorkers(); if(!G.flowDirty && (G.time%4)<1) G.flowDirty=true; modesTick(1); aiTick(1); achTick();}
  G.evT-=dt; if(G.evT<=0){ G.evT=G.L.evGap[0]+rand()*(G.L.evGap[1]-G.L.evGap[0]); runEvent(); }
  G.deerT-=dt; if(G.deerT<=0){ G.deerT=25; if(G.units.filter(u=>u.kind==='deer').length<7) spawnDeer(); }
  G.snow+= (snowTarget()-G.snow)*Math.min(1,dt*.5);
  wavesTick(dt);
  for(const b of G.blds){
    if(b.type==='gatehouse'){const tg=b.raised?1:0; b.anim+=cl(tg-b.anim,-dt*.9,dt*.9);}
    if(b.hitT>0) b.hitT-=dt;
    if(b.fire>0){ b.fire+=dt; b.hp-=7*dt; if(rand()<dt*.9) G.parts.push({x:b.x+rand()*b.w,y:b.y+rand()*b.h,vx:(rand()-.5)*.3,vy:-1.2,life:1.2,max:1.2,c:'rgba(60,55,50,.6)',s:5,smoke:true});
      if(rand()<dt*.07){ for(const o of G.blds) if(o!==b&&canBurn(o)&&o.def.wooden&&!o.fire&&Math.abs(o.x+o.w/2-b.x-b.w/2)<(o.w+b.w)/2+1.5&&Math.abs(o.y+o.h/2-b.y-b.h/2)<(o.h+b.h)/2+1.5){ ignite(o); break; } }
      if(b.fire>32||(G.snow>.6&&b.fire>12)) b.fire=0;
      if(b.hp<=0) removeBld(b,true); }
    if(b.mangonel){ b.mangonel.cd-=dt; if(b.mangonel.cd<=0){ const src={x:b.x+1,y:b.y+1,team:b.team,owner:b.owner}; const t=clusterTarget(src,b.def.great?MANG_GREAT_R:MANG_R,2.5,b.team); if(t){ lob(src,t.x,t.y,45,28,b.team); b.mangonel.cd=4.5*COMBAT_RATE; b.mangonel.fire=.4; b.mangonel.ang=Math.atan2(t.y-src.y,t.x-src.x); } else b.mangonel.cd=.5; } if(b.mangonel.fire>0) b.mangonel.fire-=dt; }
    if(b.ballista){ b.ballista.cd-=dt; if(b.ballista.cd<=0){ const src={x:b.x+b.w/2,y:b.y+b.h/2,team:b.team,owner:b.owner}; const t=nearestFoe(src,src.x,src.y,BALL_R,o=>o.def.big)||nearestFoe(src,src.x,src.y,BALL_R,o=>o.def.armor&&o.def.armor<.6)||nearestFoe(src,src.x,src.y,BALL_R); if(t){ shoot(src,t,45*COMBAT_HP,.9,'ballista'); b.ballista.cd=3*COMBAT_RATE; b.ballista.fire=.3; b.ballista.ang=Math.atan2(t.y-src.y,t.x-src.x); } else b.ballista.cd=.4; } if(b.ballista.fire>0) b.ballista.fire-=dt; }
    if(b.oil){ b.oil.cd-=dt; if(b.oil.cd<=0){ const cx=b.x+.5, cy=b.y+.5; const hit=G.units.filter(u=>foe(b,u)&&!u.dead&&u.el===0&&Math.hypot(u.x-cx,u.y-cy)<1.8);
      if(hit.length){ for(const u of hit) hurt(u,50*COMBAT_HP,'oil',null,bLord(b)); for(let k=0;k<14;k++) G.parts.push({x:hit[0].x+(rand()-.5),y:hit[0].y+(rand()-.5),vx:(rand()-.5)*1.5,vy:(rand()-.5)*1.5,life:.8,max:.8,c:'#1c1410',s:4}); sfx('oil',cx,cy); b.oil.cd=6*COMBAT_RATE; } else b.oil.cd=.3; } }
    if(b.ladders>0){ const on=G.units.some(u=>u.team===0&&u.def.mil&&!u.dead&&!u.def.big&&(u.x|0)>=b.x&&(u.x|0)<b.x+b.w&&(u.y|0)>=b.y&&(u.y|0)<b.y+b.h);
      const foe=G.units.some(u=>u.team===1&&u.climb&&!u.dead&&rectDist(u.x,u.y,b)<.4);
      if(on&&!foe){ b.push=(b.push||0)+dt; if(b.push>2.5){ b.ladders=0; b.push=0; G.ladders=G.ladders.filter(l=>!(l.b===b&&l.team===1)); toast('Ladder pushed off the wall'); G.flowDirty=true; } } else b.push=0; }
    if(b.pladders>0){ const on=G.units.some(u=>u.team===1&&!u.dead&&!u.def.big&&(u.x|0)>=b.x&&(u.x|0)<b.x+b.w&&(u.y|0)>=b.y&&(u.y|0)<b.y+b.h);
      const mine=G.units.some(u=>u.team===0&&u.def.mil&&!u.dead&&rectDist(u.x,u.y,b)<.4);
      if(on&&!mine){ b.ppush=(b.ppush||0)+dt; if(b.ppush>3){ b.pladders=0; b.ppush=0; G.ladders=G.ladders.filter(l=>!(l.b===b&&l.team===0)); computePWalk(); G.pathVer++; toast('They pushed your ladder off the wall','warn'); } } else b.ppush=0; }
  }
  for(const u of G.units){
    if(u.dead) continue;
    u.moving=false; u.work=false; if(u.strike>0)u.strike-=dt; if(u.hitT>0)u.hitT-=dt; if(u.fade>0)u.fade-=dt*2;
    u.el=elevOf(u);
    if(u.post && u.post.dead) u.post=null;
    if(u.team===0){ if(u.kind==='peasant') updatePeasant(u,dt); else if(u.kind==='thief') updateThief(u,dt); else updateTroop(u,dt); }
    else if(u.team===1) updateEnemy(u,dt);
    else updateAnimal(u,dt);
  }
  separate(dt);
  for(const kp of G.blds){
    if(!kp.def.isKeep) continue;
    kp.cd=(kp.cd||0)-dt; if(kp.cd>0) continue;
    const src={x:kp.x+kp.w/2,y:kp.y+kp.h/2,team:kp.team,owner:kp.owner};
    const t=nearestFoe(src,src.x,src.y,KEEP_R);
    if(t){ const ai=kp.team===1?aiByOwner(kp.owner):null; shoot(src,t,(kp.team===1?((ai&&ai.diff.keepDmg)||6):8)*COMBAT_HP,.6); kp.cd=1.1*COMBAT_RATE; } else kp.cd=.3;
  }
  for(const p of G.proj){
    p.t+=dt;
    if(p.tgt && !p.tgt.dead){p.fx=p.tgt.x;p.fy=p.tgt.y;}
    if(p.t>=p.dur){
      p.done=true;
      if(p.type==='stone') stoneLands(p);
      else if(p.bld){ if(!p.bld.dead) damageBld(p.bld,p.dmg,p.fire,p.lord); }
      else if(p.tgt && !p.tgt.dead && !p.miss){ if(p.tgt.team===2) kill(p.tgt); else { hurt(p.tgt,p.dmg,p.type,null,p.lord); sfx('thunk',p.fx,p.fy); } }
    }
  }
  G.proj=G.proj.filter(p=>!p.done);
  for(const q of G.parts){q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;}
  if(G.parts.length>900) G.parts.splice(0,G.parts.length-900);
  G.parts=G.parts.filter(q=>q.life>0);
  for(const dc of G.decals) dc.t-=dt;
  G.decals=G.decals.filter(dc=>dc.t>0);
  for(const t of G.texts) t.t-=dt;
  G.texts=G.texts.filter(t=>t.t>0);
  G.units=G.units.filter(u=>!u.dead && !u.gone);
  G.estT=(G.estT||0)+dt; if(G.estT>=.2){ updateEstates(G.estT); G.estT=0; }
  checkGoals();
}

/* ---------- recruiting and trade ---------- */
function recruitCost(kind){ const R=RECRUIT[kind]; const cost={...(R.w||{}),gold:R.gold}; if(R.wood) cost.wood=R.wood; return cost; }
function recruit(kind){
  const R=RECRUIT[kind], d=UD[kind];
  const cost=recruitCost(kind);
  const rank=rankOf(G.honorTotal);
  if(R.rank && rank<R.rank){toast(`${d.name}s need the rank of ${RANKS[R.rank].n}. Earn honor with banquets, chapels, court events and estates.`,'warn');sfx('deny');return false;}
  if(R.honor && G.honor<R.honor){toast(`A ${d.name.toLowerCase()} costs ${R.honor} honor`,'warn');sfx('deny');return false;}
  const bar=G.blds.find(b=>b.type==='barracks'&&b.team===0);
  const src = R.needs==='chapel' ? G.blds.find(b=>(b.type==='chapel'||b.type==='cathedral')&&b.team===0) : bar;
  if(!src){toast(R.needs==='chapel'?'Monks are ordained at a chapel. Build one first.':'You need barracks to train troops. Find them in the Industry tab.','warn');sfx('deny');return false;}
  if(R.crew){
    const engs=G.units.filter(u=>u.kind==='engineer'&&!u.dead&&!u.post&&u.fill===undefined);
    if(engs.length<R.crew){toast(`A ${d.name.toLowerCase()} needs ${R.crew} idle engineer${R.crew>1?'s':''} as crew`,'warn');sfx('deny');return false;}
    if(!afford(cost)){toast(lackStr(cost),'warn');sfx('deny');return false;}
    pay(cost); engs.slice(0,R.crew).forEach(e=>{e.dead=true;e.gone=true;});
    const u=spawnUnit(kind,src.x+src.w/2,src.y+src.h+.8); orderMove(u,G.rally.x,G.rally.y);
    sfx('build'); toast(`${d.name} built`); return true;
  }
  const idle=peasants().filter(u=>!u.job);
  if(!idle.length){toast('No idle peasants. Build hovels or raise popularity.','warn');sfx('deny');return false;}
  if(!afford(cost)){toast(lackStr(cost).replace(/Not enough (bows|crossbows)$/,'Not enough $1. Build a fletcher').replace(/Not enough (spears|pikes)$/,'Not enough $1. Build a poleturner').replace(/Not enough (maces|swords)$/,'Not enough $1. Build a blacksmith').replace(/Not enough armor$/,'Not enough armor. Build an armourer'),'warn');sfx('deny');return false;}
  pay(cost); if(R.honor) G.honor-=R.honor;
  const u=idle[0];
  Object.assign(u,{kind,def:d,hp:d.hp,maxHp:d.hp,speed:d.speed*(0.95+rand()*.1),wp:null,cd:0,hold:null,path:null,pdest:null,stance:G.stance||'defend'});
  u.x=src.x+src.w/2+(rand()-.5); u.y=src.y+src.h+.5; u.fade=1;
  const n=G.units.filter(o=>o.def.mil).length;
  orderMove(u,G.rally.x+(n%5)*.7-1.4,G.rally.y+((n/5|0)%4)*.7-1);
  sfx('recruit');
  return true;
}
function price(k,sell){ const p=PRICES[k][sell?1:0]; const m=G.time<G.merchantUntil?(sell?1.3:0.7):1; return Math.round(p*m); }
function trade(k,sell){
  if(!countB('market')){toast('Build a market first','warn');return;}
  const n=5, p=price(k,sell)*n;
  if(sell){ if(G.R[k]<n){toast(`You need ${n} ${RES_NAME[k]} to sell`,'warn');sfx('deny');return;} G.R[k]-=n; G.R.gold+=p; }
  else { if(G.R.gold<p){toast('Not enough gold','warn');sfx('deny');return;} G.R.gold-=p; G.R[k]+=n; }
  sfx('coin');
}
