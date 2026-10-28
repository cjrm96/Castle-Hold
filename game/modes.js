'use strict';
/* Castle Siege: level setup, game modes, waves, events, estates, carts, court, goals */

const DIRNAME={e:'the east',w:'the west',ne:'the northeast',se:'the southeast',n:'the north',s:'the south',camp:'the enemy camp'};
const SIEGE_SETUP={
  thornwall:{lord:2, garrison:{easy:{earcher:6,exbow:1,eswords:3,raider:5},normal:{earcher:12,exbow:3,eswords:6,raider:7},hard:{earcher:10,exbow:3,eswords:6,raider:7,eknight:1}}, waves:[{raider:10,earcher:4,dirs:['e']},{raider:12,earcher:6,ladder:4,dirs:['e','ne']},{raider:14,earcher:8,eswords:3,ram:1,stower:1,dirs:['e']},{raider:16,earcher:8,eswords:4,ecat:1,ladder:4,dirs:['e','se']},{raider:20,earcher:10,eswords:6,ram:2,stower:1,ecat:2,warlord:1,dirs:['e','ne','se']}],
    defend:{archer:6,xbow:2,spearman:4,pikeman:2}},
  ravenscar:{lord:1, garrison:{easy:{earcher:10,exbow:3,eswords:6,raider:6,eknight:1},normal:{earcher:14,exbow:5,eswords:8,raider:8,eknight:2},hard:{earcher:18,exbow:8,eswords:10,raider:10,eknight:3}}, waves:[{raider:12,earcher:6,ladder:3,dirs:['e']},{raider:14,earcher:8,ladder:4,stower:1,dirs:['e','ne']},{raider:16,earcher:8,eswords:4,ram:2,stower:1,ecat:1,dirs:['e','se']},{raider:18,earcher:10,eswords:6,ecat:2,etreb:1,ladder:6,dirs:['e']},{raider:22,earcher:12,eswords:8,eknight:4,ram:2,stower:2,ecat:2,dirs:['e','ne','se']},{raider:26,earcher:14,eswords:10,eknight:6,ram:2,stower:2,etreb:2,warlord:1,dirs:['e','ne','se']}],
    defend:{archer:12,xbow:6,spearman:6,pikeman:4,swordsman:2,engineer:2}},
};
const FREE_MAPS=[
  {map:'hollow',name:'Elmstead'},{map:'vale',name:'Wolfden Vale'},{map:'river',name:'Ashford Crossing'},{map:'moor',name:'Blackmoor'},
  {map:'brightwater',name:'Brightwater'},{map:'goldmere',name:'Goldmere'},{map:'winter',name:'The White Vale'},
];

/* ---------- level builders for the skirmish modes ---------- */
function kingmakerLevel(mi,picks,diff,rich){
  const M=KM_MAPS[mi];
  return {id:'km_'+M.id, mode:'kingmaker', name:M.name, sub:'Skirmish', tag:'Skirmish', diffSel:diff, map:M.id, W:M.W, H:M.H, seed:M.seed+picks.length*7, keep:{...M.player},
    ais:M.slots.slice(0,picks.length).map((s,i)=>({x:s.x,y:s.y,lord:picks[i],diff})), estates:M.estates,
    start:rich?{wood:450,stone:260,iron:40,apples:200,bread:60,gold:1600,bows:10,spears:8,maces:4}:{wood:220,stone:80,apples:120,gold:600,bows:4,spears:4},
    peasants:rich?18:12, troops:rich?{archer:8,spearman:6,maceman:4}:{archer:4,spearman:4}, prebuilt:['barracks'], honorTotal:rich?60:20, honor:rich?30:10,
    goal:{type:'conquer'}, goals:['Defeat every rival lord: break his keep or slay him','Keep your lord and your keep alive'],
    firstWave:1e9, gap:1e9, waves:[], crime:.8, dirt:.8, events:['harvest','merchant','wolves','gift','rats'], evGap:[110,170], date:{y:1090,m:3}};
}
/* free for all: up to nine computer lords, and every lord fights every other lord */
function ffaLevel(n,picks,diff,rich){
  const M=FFA_MAP; n=Math.max(1,Math.min(9,n|0));
  return {id:'ffa', mode:'kingmaker', ffa:true, name:M.name, sub:'Free for all', tag:'Free for all', diffSel:diff, map:M.id, W:M.W, H:M.H, seed:M.seed+n*7, keep:{...M.player},
    ais:M.slots.slice(0,n).map((s,i)=>({x:s.x,y:s.y,lord:picks[i],diff})), estates:M.estates,
    start:rich?{wood:500,stone:300,iron:40,apples:220,bread:60,gold:1800,bows:10,spears:8,maces:4}:{wood:240,stone:90,apples:140,gold:700,bows:4,spears:4},
    peasants:rich?18:12, troops:rich?{archer:8,spearman:6,maceman:4}:{archer:4,spearman:4}, prebuilt:['barracks'], honorTotal:rich?60:20, honor:rich?30:10,
    goal:{type:'conquer'}, goals:['Be the last lord standing. Every lord fights every other lord','Keep your lord and your keep alive'],
    firstWave:1e9, gap:1e9, waves:[], crime:.8, dirt:.8, events:['harvest','merchant','wolves','gift','rats'], evGap:[110,170], date:{y:1090,m:3}};
}
function siegeLevel(ci,side,diff){
  diff=diff||'normal';
  const S=SIEGE[ci], X=SIEGE_SETUP[S.id], WW=100, HH=60;
  const sz=S.kind==='large'?{w:21,h:17}:{w:15,h:13};
  const base={mode:'siege', map:'siege_field', W:WW, H:HH, seed:7300+ci*11, crime:.6, dirt:.6, events:['merchant','harvest'], evGap:[140,200], date:{y:1091,m:4}, honorTotal:130, honor:40};
  if(side==='attack'){
    const cx=WW-sz.w-5, cy=Math.round(HH/2-sz.h/2);
    return {...base, diffSel:diff, id:'siege_'+S.id+'_a', name:`The siege of ${S.name}`, sub:'Siege · you attack', tag:'Assault', keep:{x:6,y:Math.round(HH/2)-2}, keepType:'warcamp',
      enemyCastle:{kind:S.kind,x:cx,y:cy,face:'W',lord:X.lord,garrison:X.garrison[diff],diff,might:30,sortieScale:1.4,engines:diff==='hard'?'all':diff==='normal'&&S.kind==='large'?'mangonel':'none'},
      start:{wood:300,stone:60,iron:30,apples:160,bread:60,gold:1500,bows:8,spears:6,maces:6,swords:4,armor:4}, peasants:16,
      troops:S.kind==='large'?{archer:14,xbow:6,spearman:8,maceman:8,swordsman:6,knight:2,pladder:8,engineer:8,pram:1,ptower:1,pcatapult:3,ptreb:2}:{archer:10,xbow:4,spearman:6,maceman:6,swordsman:2,pladder:6,engineer:4,pram:1,pcatapult:2,ptreb:1},
      prebuilt:['barracks'], firstWave:1e9, gap:1e9, waves:[],
      goal:{type:'conquer'}, goals:[`Break the keep of ${S.name} or slay its lord`,'Keep your lord and your war camp alive']};
  }
  const px=6, py=Math.round(HH/2-sz.h/2), plan=castlePlan(S.kind,px,py,'E',0);
  return {...base, diffSel:diff, id:'siege_'+S.id+'_d', name:`The defense of ${S.name}`, sub:'Siege · you defend', tag:'Defend', keep:{x:plan.keep.x,y:plan.keep.y},
    playerCastle:{kind:S.kind,x:px,y:py,face:'E',garrison:X.defend},
    start:{wood:260,stone:200,iron:20,apples:200,cheese:60,bread:60,gold:900,bows:6,spears:4,pikes:2,armor:2}, peasants:14, troops:{},
    firstWave:240, gap:150, waves:scaleWaves(X.waves,diff==='easy'?.75:diff==='hard'?1.35:1), goal:{type:'survive'}, goals:[`Survive ${X.waves.length} waves`,'Keep your lord and your keep alive']};
}
function scaleWaves(ws,m){ return ws.map(w=>{ const o={...w}; for(const k in o) if(typeof o[k]==='number'&&k!=='warlord') o[k]=Math.max(1,Math.round(o[k]*m)); return o; }); }
function freeLevel(fi,raids,rich){
  const F=FREE_MAPS[fi], base=LEVELS.find(l=>l.map===F.map)||LEVELS[0];
  return {id:'free_'+F.map, mode:'free', name:F.name, sub:'Free build', tag:'Free build', map:F.map, W:base.W, H:base.H, seed:base.seed, keep:{...base.keep},
    start:rich?{wood:600,stone:400,iron:80,apples:240,cheese:60,gold:3000,bows:8,spears:8}:{wood:250,stone:80,apples:140,gold:800},
    peasants:rich?20:12, troops:{archer:2}, prebuilt:['barracks'], estates:base.estates, honorTotal:rich?130:0,
    goal:{type:'free'}, goals:['Build as you please',raids?'Raiders come every few minutes':'No army will come for you'],
    firstWave:raids?420:1e9, gap:230, waves:[], raids:!!raids, crime:.8, dirt:.8,
    events:raids?['harvest','gift','merchant','wolves','bandits','rats','fire']:['harvest','gift','merchant','rats','fire'], evGap:[120,200], date:{y:1092,m:3}};
}

/* ---------- start a level ---------- */
function startLevel(L){
  LV=L; genMap(L);
  let home=homeLayout(L.keep);
  const R={gold:0}; for(const k of ALL_RES) R[k]=0; Object.assign(R,L.start||{});
  const eg=L.evGap||[120,180];
  G={L, home, time:0, R, honor:L.honor||0, honorTotal:L.honorTotal||0, pop:70, tax:1, ration:2, banquet:0,
    crime:L.startCrime||0, dirt:L.startDirt||0, blds:[], units:[], proj:[], parts:[], decals:[], texts:[],
    nextWave:L.firstWave===undefined?1e9:L.firstWave, wave:0, spawnQ:[], kills:0, lostB:0, lostU:0, over:false, cyc:0, week:0,
    flowT:0, flowDirty:true, peasT:0, assignT:0, pathVer:1, bldVer:1, selB:null, selE:null, tab:'ind', uid:1, lastSay:{}, warned:-1,
    rally:{...home.rally}, boxMode:false, formation:'box', stance:'defend', evT:eg[0]+rand()*(eg[1]-eg[0]),
    merchantUntil:-1, ladders:[], deerT:20, factors:null, lastDir:'E', aleServed:0, banquetOK:true,
    mods:[], workMul:1, snow:0, monthLen:L.monthLen||70, ais:[], jousts:0, maxKnights:0, courtCd:{}, bossDead:false, show:null,
    mode:L.mode||'campaign', ffa:!!L.ffa, festUntil:-1, cartsSent:0,
    estates:(L.estates||[]).map(e=>({...e,owner:0,claim:0,claimBy:0,ai:0,store:{},weeks:0,cart:null})),
    caravans:L.caravans?{arrived:0,lost:0,spawned:0,total:L.caravans.times.length}:null};
  G.snow=snowTarget();
  if(L.playerCastle){
    const c=L.playerCastle, plan=castlePlan(c.kind,c.x,c.y,c.face||'E',0), built=buildCastle(plan,0,0);
    G.keep=built.keep; G.stock=built.stockpile; G.gran=built.granary; G.armory=built.armory;
    home={...home, camp:{...plan.camp}, rally:{x:plan.camp.x+1.5,y:plan.camp.y+1.5}}; G.home=home; G.rally={...home.rally};
    for(const u of garrisonCastle(built,0,0,c.garrison||{},0)) u.stance='defend';
  } else {
    G.keep=placeBld(L.keepType||'keep',L.keep.x,L.keep.y);
    G.stock=placeBld('stockpile',home.stock.x,home.stock.y);
    G.gran=placeBld('granary',home.gran.x,home.gran.y);
    G.armory=placeBld('armory',home.armory.x,home.armory.y);
    if((L.prebuilt||[]).includes('barracks')) placeBld('barracks',home.barracks.x,home.barracks.y);
  }
  if(L.enemyCastle){
    const c=L.enemyCastle, id=G.ais.length+1, plan=castlePlan(c.kind,c.x,c.y,c.face||'W',1), built=buildCastle(plan,1,id,c.engines||'none');
    const ai=createAI({lord:c.lord===undefined?1:c.lord, built, plan, fixed:true, diff:c.diff||'easy', guards:c.guards, might:c.might||40, sortieScale:c.sortieScale||1});
    garrisonCastle(built,1,id,c.garrison||{},id);
    ai.plan=plan; ai.capFixed=Object.values(c.garrison||{}).reduce((a,b)=>a+b,0)+(ai.diff.fixedExtra||1);
  }
  for(const a of L.ais||[]) createAI({lord:a.lord, x:a.x, y:a.y, diff:a.diff, face:a.face||(a.x+2<W/2?'E':'W')});
  if(L.ecamp){
    const c=L.ecamp;
    const camp=[['epavilion',c.x,c.y-1],['eworkshop',c.x-4,c.y-8],['eworkshop',c.x-4,c.y+7],['etent',c.x+4,c.y-6],['etent',c.x+5,c.y+5],['etent',c.x-6,c.y-1],['etent',c.x+5,c.y-1]];
    for(const [t,x,y] of camp){ clearTiles(x,y,DEF[t].w,DEF[t].h); placeBld(t,x,y,'E',1); }
    const g=(k,n,cx,cy)=>{for(let i=0;i<n;i++){const u=spawnUnit(k,cx+(rand()-.5)*5,cy+(rand()-.5)*6); u.guard={x:u.x,y:u.y}; u.guardR=7;}};
    g('raider',10,c.x-6,c.y); g('earcher',6,c.x-3,c.y); g('eswords',5,c.x-7,c.y);
    const w=spawnUnit(L.boss||'warlord',c.x+1.5,c.y+3); w.guard={x:w.x,y:w.y}; w.guardR=8;
  }
  const cp=G.home.camp;
  autoHovels(L.peasants);
  for(let k=0;k<L.peasants;k++) spawnUnit('peasant',cp.x+(rand()-.5)*3,cp.y+(rand()-.5)*2);
  G.lord=spawnUnit('lord',G.keep.x+2,G.keep.y+4.6); G.lord.hold={x:G.lord.x,y:G.lord.y};
  let n=0;
  const total=Object.values(L.troops||{}).reduce((a,b)=>a+b,0), spots=openSpots(G.rally.x,G.rally.y,Math.ceil(total/2)+2);
  for(const [k,c] of Object.entries(L.troops||{})) for(let i=0;i<c;i++){ const sp=spots[(n>>1)%spots.length]; const u=spawnUnit(k,sp.x+.28+(n%2)*.44,sp.y+.5); u.hold={x:u.x,y:u.y}; n++; }
  for(let i=0;i<9;i++) spawnDeer();
  buildTerrain(); computeFlow();
  G.started=true;
}

/* open ground near a point, nearest first */
function openSpots(cx,cy,n){
  const out=[]; const x0=Math.floor(cx), y0=Math.floor(cy);
  for(let r=0;r<14&&out.length<n;r++) for(let j=-r;j<=r;j++) for(let i=-r;i<=r;i++){ if(Math.max(Math.abs(i),Math.abs(j))!==r) continue; const x=x0+i,y=y0+j; if(!inb(x,y)) continue; const t=ter[idx(x,y)]; if(t===2||t===4||t===5||t===7||occB[idx(x,y)]) continue; out.push({x,y}); }
  out.sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy));
  return out.length?out:[{x:x0,y:y0}];
}
/* levels that start with a crowd get the hovels to house it */
function autoHovels(n){
  let need=Math.ceil((n-housing())/8); if(need<=0) return;
  const c=G.home.camp, d=DEF.hovel;
  for(let r=2;r<12&&need>0;r++) for(let k=0;k<24&&need>0;k++){
    const a=k/24*Math.PI*2, x=Math.round(c.x+Math.cos(a)*r-1), y=Math.round(c.y+Math.sin(a)*r-1);
    let ok=true; for(let j=-1;j<=d.h&&ok;j++)for(let i=-1;i<=d.w;i++){ const xx=x+i,yy=y+j; if(!inb(xx,yy)||occB[idx(xx,yy)]){ok=false;break;} const t=ter[idx(xx,yy)]; if(i>=0&&j>=0&&i<d.w&&j<d.h&&t!==0&&t!==3){ok=false;break;} }
    if(ok && Math.hypot(x+1-c.x,y+1-c.y)>1.8){ placeBld('hovel',x,y); need--; }
  }
}

/* ---------- waves ---------- */
function raidWave(n){
  const w={raider:4+3*n, earcher:2+2*n, dirs:n<2?['e']:n<5?['e','ne','se']:['e','ne','se','n','s']};
  if(n>=2) w.ladder=2+n; if(n>=3){ w.ram=1; w.eswords=n-2; } if(n>=5){ w.ecat=1; w.stower=1; w.eknight=n-4; }
  return w;
}
function waveDef(n){
  if(G.L.endless) return campWave(n,G.blds.filter(b=>b.type==='eworkshop').length);
  if(G.L.raids) return raidWave(n);
  return G.L.waves[n];
}
function totalWaves(){ return (G.L.endless||G.L.raids) ? Infinity : (G.L.waves||[]).length; }
const WAVE_NAMES={raider:'raiders',earcher:'archers',exbow:'crossbowmen',eswords:'swordsmen',eknight:'knights',ladder:'laddermen',ram:'rams',stower:'siege towers',ecat:'catapults',etreb:'trebuchets',warlord:'the warlord',rothgar:'Rothgar himself'};
function waveDesc(n){
  const w=waveDef(n); if(!w) return '';
  const ONE={raiders:'raider',archers:'archer',crossbowmen:'crossbowman',swordsmen:'swordsman',knights:'knight',laddermen:'ladderman',rams:'ram','siege towers':'siege tower',catapults:'catapult',trebuchets:'trebuchet'};
  return Object.keys(WAVE_NAMES).filter(k=>w[k]).map(k=>k==='warlord'||k==='rothgar'?WAVE_NAMES[k]:`${w[k]} ${w[k]===1?ONE[WAVE_NAMES[k]]:WAVE_NAMES[k]}`).join(', ')+(w.fire?', with fire arrows':'');
}
function dirList(n){ const w=waveDef(n); if(!w) return ''; return w.dirs.map(d=>DIRNAME[d]||'the wilds').join(', ').replace(/, ([^,]*)$/,' and $1'); }
function waveLabel(){ return G.L.endless||G.L.raids?'Raid':'Wave'; }
function launchWave(n){
  const w=waveDef(n), list=[];
  for(const k of ['ram','stower','ecat','etreb','ladder','raider','earcher','exbow','eswords','eknight','warlord','rothgar']) for(let i=0;i<(w[k]||0);i++) list.push(k);
  for(let i=list.length-1;i>0;i--){const j=(rand()*(i+1))|0; if(!UD[list[i]].big&&!UD[list[j]].big)[list[i],list[j]]=[list[j],list[i]];}
  const t0=Math.max(G.time,G.spawnQ.length?G.spawnQ[G.spawnQ.length-1].at:0);
  list.forEach((k,i)=>G.spawnQ.push({kind:k,dir:w.dirs[i%w.dirs.length],at:t0+i*0.4,fire:!!w.fire}));
  toast(`${waveLabel()} ${n+1}: the enemy comes from ${dirList(n)}`,'big');
  if(w.ram && !G.ramSaid){G.ramSaid=true; setTimeout(()=>toast('Battering rams! Spearmen and pikemen break them.','warn'),1600);}
  if((w.ecat||w.etreb) && !G.catSaid){G.catSaid=true; setTimeout(()=>toast('Siege engines! Ride out with knights, or answer with mangonels and ballistae.','warn'),3200);}
  if(w.stower && !G.towerSaid){G.towerSaid=true; setTimeout(()=>toast('Siege towers! A moat stops them. So do spearmen.','warn'),4800);}
  sfx('horn');
}
function spawnEnemy(q){
  const p=spawnPoint(q.dir); const u=spawnUnit(q.kind,p.x,p.y); u.wave=true; u.fade=1;
  if(q.fire) u.fire=true;
  if(q.hunt && !q.hunt.dead) u.hunt=q.hunt;
}
function wavesTick(dt){
  const tw=totalWaves();
  if(G.wave<tw && G.warned<G.wave && G.nextWave-G.time<=25){ G.warned=G.wave; toast(`${waveLabel()} ${G.wave+1} approaches from ${dirList(G.wave)}`,'warn'); }
  if(G.wave<tw && G.time>=G.nextWave){ launchWave(G.wave); G.wave++; G.nextWave = G.wave<tw ? G.time+(G.L.raids?Math.max(150,G.L.gap-G.wave*6):G.L.gap) : Infinity; }
  while(G.spawnQ.length && G.spawnQ[0].at<=G.time) spawnEnemy(G.spawnQ.shift());
}

/* ---------- once a second ---------- */
function modesTick(dt){
  G.mods=G.mods.filter(m=>m.until>G.time);
  assaultTick();
  ransomTick();
  const kn=G.units.filter(u=>u.kind==='knight'&&!u.dead).length; if(kn>G.maxKnights) G.maxKnights=kn;
  const c=G.caravans;
  if(c && c.spawned<c.total && G.time>=G.L.caravans.times[c.spawned]) spawnCaravan();
  if(G.show && G.time>G.show.t0+G.show.dur) G.show=null;
  for(const e of G.estates) if(e.cart && (e.cart.dead||e.cart.gone)) e.cart=null;
}
/* an assault goes in once most of the column is on its line, or after a short wait */
function assaultTick(){
  if(!G.assaultGo) G.assaultGo={};
  const groups={};
  for(const u of G.units){ if(u.team!==0||u.dead||!u.stormAfter||!u.assaultId) continue; const g=groups[u.assaultId]||(groups[u.assaultId]={n:0,ready:0,first:1e9,eng:0,engReady:0}); if(u.def.artillery||u.def.eng) continue;
    if(u.def.siege){ g.eng++; if(!u.goal) g.engReady++; continue; }
    g.n++; if(!u.goal){ g.ready++; g.first=Math.min(g.first,u.waitT||G.time); } }
  for(const [id,g] of Object.entries(groups)){
    if(G.assaultGo[id]) continue;
    /* the foot wait out of range for the rams and siege towers, but not forever */
    const foot=g.n===0 || g.ready/g.n>=.8 || (g.ready>0 && G.time-g.first>14), engines=g.engReady>=g.eng || (g.ready>0 && G.time-g.first>45);
    if((foot&&engines) || (g.n===0&&g.eng===0)){ G.assaultGo[id]=true; toast('The line is formed. Storm the walls!','big'); sfx('horn'); }
    else if(foot && !g.told){ g.told=true; G.assaultWait=G.assaultWait||{}; if(!G.assaultWait[id]){ G.assaultWait[id]=true; toast('The line waits for the rams and siege towers'); } }
  }
}
function spawnCaravan(){
  const c=G.caravans, k=c.spawned++;
  const p=spawnPoint('e'); const u=spawnUnit('caravan',p.x,p.y); u.fade=1;
  u.dest={x:G.home.camp.x+1.5,y:G.home.camp.y+.5}; u.cargo={wheat:15,apples:15};
  toast(`Caravan ${k+1} of ${c.total} is fleeing in from the east. Ride out and guard it!`,'big'); sfx('horn');
  const n=1+Math.min(3,Math.floor(k*0.7));
  for(let i=0;i<n;i++) G.spawnQ.push({kind:i===1?'eknight':'raider',dir:{x:p.x,y:p.y},at:G.time+6+i*1.5,hunt:u});
  G.spawnQ.sort((a,b)=>a.at-b.at);
}

/* ---------- events ---------- */
function runEvent(){
  const L=G.L, list=L.events; if(!list||!list.length) return;
  const k=list[(rand()*list.length)|0];
  switch(k){
    case 'harvest': { if(isWinter()){ G.R.meat+=20; toast('Hunters found a frozen herd: +20 meat'); break; } const f=RES_KEYS.food[(rand()*4)|0]; G.R[f]+=40; toast(`A good harvest: +40 ${RES_NAME[f]}`); break; }
    case 'gift': G.R.gold+=100; gainHonor(5); toast('A gift from the king: +100 gold, +5 honor'); break;
    case 'merchant': G.merchantUntil=G.time+90; toast('A traveling merchant is in town. Market prices are better for 90 seconds.'); break;
    case 'wolves': if(spawnWolves(2+((rand()*3)|0))) toast(isWinter()?'Starving wolves come out of the snow!':'Wolves have come out of the forest!','warn'); break;
    case 'fire': { if(G.snow>.6) break; const c=G.blds.filter(canBurn); if(c.length) ignite(c[(rand()*c.length)|0]); break; }
    case 'rats': if(spawnRats(6)) toast('A plague of rats!','warn'); break;
    case 'bandits': { const dirs=['e','ne','se','n','s'], dir=dirs[(rand()*dirs.length)|0]; for(let i=0;i<5;i++){ const p=spawnPoint(dir); spawnUnit(i<3?'raider':'earcher',p.x,p.y); } toast('Bandits are raiding from the wilds!','warn'); break; }
  }
}

/* ---------- estates and supply carts ---------- */
function estateFoes(e){ return G.units.some(u=>u.team===1&&!u.def.beast&&!u.dead&&Math.hypot(u.x-e.x,u.y-e.y)<5); }
function ownEstate(e,by,aiId){
  e.owner=by; e.claim=8; e.claimBy=0; e.ai=by===2?aiId:0; e.store={}; e.weeks=0;
  if(by===1){ gainHonor(5); toast(`${e.name} is yours. Carts will bring its ${e.desc} to your stockpile.`,'big'); sfx('win'); }
  else { const ai=aiByOwner(aiId); if(!G.ffa||Math.hypot(e.x-G.keep.x,e.y-G.keep.y)<50) toast(`${ai?ai.name:'The enemy'} has taken ${e.name}`,'warn'); }   // far-off squabbles stay quiet
}
function updateEstates(dt){
  for(const e of G.estates){
    let mine=0, foes=0, lord=false, aiId=0, holders=0, others=0;
    for(const u of G.units){ if(u.dead) continue; const d=Math.hypot(u.x-e.x,u.y-e.y);
      if(u.team===0&&u.def.mil&&!u.def.cart&&d<3.2){ mine++; if(u===G.lord) lord=true; }
      else if(u.team===1&&!u.def.beast&&!u.flee&&d<3.5){ foes++; if(u.ai) aiId=u.ai; if(u.ai===e.ai) holders++; else if(u.ai) others++; } }
    if(e.owner===1){
      if(foes>0&&mine===0){ e.claim-=dt; if(e.claim<=0){ e.owner=0; e.claim=0; e.store={}; toast(`The estate of ${e.name} has been lost`,'warn'); } }
      else e.claim=Math.min(8,e.claim+dt);
    } else if(e.owner===2){
      if(G.ffa&&others>0&&mine===0&&holders===0){ e.claim-=dt*.8; if(e.claim<=0){ e.owner=0; e.ai=0; e.claim=0; } }   // another lord's men drive his out
      else if(mine>0&&(G.ffa?holders:foes)===0){ e.claim-=dt*(lord?2:1); if(e.claim<=0){ const ai=aiByOwner(e.ai); e.owner=0; e.ai=0; e.claim=0; toast(`You drove ${ai?ai.name+"'s":'their'} men out of ${e.name}`); } }
      else e.claim=Math.min(8,e.claim+dt*.5);
    } else {
      if(mine>0&&foes===0){ if(e.claimBy!==1){e.claimBy=1;e.claim=0;} e.claim+=dt*(lord?2:1); if(e.claim>=8) ownEstate(e,1); }
      else if(foes>0&&mine===0&&aiId){ if(e.claimBy!==2){e.claimBy=2;e.claim=0;} e.claim+=dt*.8; if(e.claim>=8) ownEstate(e,2,aiId); }
      else e.claim=Math.max(0,e.claim-dt*.5);
    }
  }
}
function buyEstate(e){
  if(!e||e.owner===1) return;
  if(e.owner===2){ toast('Another lord holds it. Drive his men off with your own troops.','warn'); sfx('deny'); return; }
  if(estateFoes(e)){ toast('Enemies are on the estate. Clear them out first.','warn'); sfx('deny'); return; }
  if(G.honor<e.cost){ toast(`You need ${e.cost} honor to buy ${e.name}`,'warn'); sfx('deny'); return; }
  G.honor-=e.cost; ownEstate(e,1);
}
function estatesWeek(){
  for(const e of G.estates){
    if(e.owner!==1) continue;
    for(const [k,v] of Object.entries(e.yield)) e.store[k]=(e.store[k]||0)+v;
    e.weeks++;
    if(e.weeks>=2 && !e.cart) sendCart(e);
  }
}
function sendCart(e){
  if(!e||e.owner!==1||e.cart||!Object.keys(e.store).length) return;
  const u=spawnUnit('cart',e.x,e.y+1.2); u.fade=1;
  u.cargo=e.store; u.estate=e.name; u.dest=door(G.stock);
  e.store={}; e.weeks=0; e.cart=u; G.cartsSent++;
}

/* ---------- court ---------- */
function courtCheck(kind){
  const c=COURT[kind];
  if(G.courtCd[kind]>G.time) return `Ready again in ${Math.ceil(G.courtCd[kind]-G.time)}s`;
  if(c.needs && !countB(c.needs)) return 'Build a jousting field first (Town tab)';
  if(c.knights && G.units.filter(u=>u.kind==='knight'&&!u.dead).length<c.knights) return `You need ${c.knights} knights`;
  if(!afford(c.cost)) return lackStr(c.cost);
  return '';
}
function holdCourt(kind){
  const why=courtCheck(kind); if(why){ toast(why,'warn'); sfx('deny'); return false; }
  const c=COURT[kind]; pay(c.cost); gainHonor(c.honor);
  G.mods.push({until:G.time+c.weeks*8,pop:c.pop,name:c.name.replace('Hold a ','')});
  G.courtCd[kind]=G.time+90;
  if(kind==='joust'){ G.jousts++; G.show={kind,b:G.blds.find(b=>b.type==='joustfield'&&b.team===0),t0:G.time,dur:12}; toast(`The joust begins! +${c.honor} honor`,'big'); }
  else { G.show={kind,b:G.keep,t0:G.time,dur:10}; toast(kind==='feast'?`A great feast in the hall! +${c.honor} honor`:`The town dances! +${c.honor} honor`,'big'); }
  sfx('win'); return true;
}

/* ---------- goals ---------- */
const GOAL_WIN={survive:'Every wave was beaten',honor:'Honor and estates won',escort:'The caravans are safe',
  conquer:'Their keep has fallen',winter:'Your town lived through the winter',destroy:'The enemy camp is destroyed',
  pop:'Your town has grown',gold:'The treasury is full',cathedral:'The cathedral stands',tourney:'The tournament is won',tutorial:'Tutorial complete'};
function hostilesLeft(){ return G.spawnQ.length>0 || G.units.some(u=>u.team===1&&!u.def.beast&&!u.dead&&!u.ai&&!u.flee&&!u.guard); }
function checkGoals(){
  if(G.over||G.editor) return;
  const g=G.L.goal, c=G.caravans;
  switch(g.type){
    case 'survive': if(G.wave>=totalWaves() && !hostilesLeft()) endGame(true); break;
    case 'honor': { const own=G.estates.filter(e=>e.owner===1).length;
      if(G.honorTotal>=g.honor && own>=g.estates) endGame(true);
      else if(G.time>=g.by) endGame(false,'Time ran out'); break; }
    case 'escort': if(c.arrived>=g.need) endGame(true); else if(c.lost>c.total-g.need) endGame(false,'Too many caravans were lost to the riders'); break;
    case 'conquer': if(G.ais.length && G.ais.every(a=>!a.alive)) endGame(true); break;
    case 'winter': if(monthAbs()>=g.until.y*12+g.until.m){ const n=peasants().length; if(n>=g.peasants) endGame(true); else endGame(false,`Spring came, but only ${n} of your people lived to see it`); } break;
    case 'destroy': if(!G.blds.some(b=>b.team===1) && (!g.boss||G.bossDead)) endGame(true); break;
    case 'pop': if(peasants().length>=g.peasants && G.pop>=g.popularity) endGame(true); break;
    case 'gold': if(G.R.gold>=g.gold) endGame(true); else if(G.time>=g.by) endGame(false,'Time ran out before the coffers filled'); break;
    case 'cathedral': if(countB('cathedral') && G.honorTotal>=g.honor) endGame(true); break;
    case 'tourney': if(G.maxKnights>=g.knights && G.jousts>=g.jousts) endGame(true); break;
    case 'tutorial': Tutorial.tick(); break;
  }
}
function clock(s){ s=Math.max(0,Math.ceil(s)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function goalProgress(){
  const g=G.L.goal, c=G.caravans;
  switch(g.type){
    case 'honor': { const own=G.estates.filter(e=>e.owner===1).length; return `Honor ${Math.floor(G.honorTotal)}/${g.honor} · Estates ${own}/${g.estates} · ${clock(g.by-G.time)} left`; }
    case 'escort': return `Caravans home ${c.arrived}/${g.need} · lost ${c.lost}`;
    case 'conquer': { const left=G.ais.filter(a=>a.alive); return left.length?`${left.length} rival${left.length>1?'s':''} standing${left.length>3?'':': '+left.map(a=>a.name).join(', ')}`:''; }
    case 'winter': { const left=(g.until.y*12+g.until.m-monthAbs())*G.monthLen; return `${peasants().length}/${g.peasants} peasants · thaw in ${clock(left)}`; }
    case 'destroy': { const n=G.blds.filter(b=>b.team===1).length; return `${n} camp building${n===1?'':'s'} left${g.boss&&!G.bossDead?' · the warlord lives':''}`; }
    case 'pop': return `Peasants ${peasants().length}/${g.peasants} · popularity ${Math.round(G.pop)}/${g.popularity}`;
    case 'gold': return `Gold ${Math.floor(G.R.gold)}/${g.gold} · ${clock(g.by-G.time)} left`;
    case 'cathedral': return `Cathedral ${countB('cathedral')?'built':'not built'} · honor ${Math.floor(G.honorTotal)}/${g.honor}`;
    case 'tourney': return `Knights raised ${G.maxKnights}/${g.knights} · jousts ${G.jousts}/${g.jousts}`;
    case 'tutorial': return '';
    case 'free': return G.L.raids?`Raids survived ${Math.max(0,G.wave-(hostilesLeft()?1:0))}`:'';
  }
  return '';
}
