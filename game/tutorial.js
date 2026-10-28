'use strict';
/* Castle Siege: the tutorial. One step at a time, with the right button glowing. */
const Tutorial={
  i:0, t0:0, view:null, base:{}, done:false,
  steps:[
    {text:'Move the camera. Drag with the right mouse button or use W A S D. Scroll to zoom.', touch:'Move the camera. Drag the map with one finger. Pinch to zoom.',
     start(T){ T.view=viewCenter(); T.zoom=cam.z; T.dist=R3.dist; },
     check(T){ const v=viewCenter(); return Math.hypot(v.x-T.view.x,v.y-T.view.y)>4||Math.abs(cam.z-T.zoom)>.12||(R3.on&&Math.abs(R3.dist-T.dist)>3); }},
    {text:'Your people need wood. Open the Industry tab and build a Woodcutter\'s Hut near the trees.', hl:['#tabs [data-tab="ind"]','#items [data-k="woodcutter"]'],
     check(){ return countB('woodcutter')>=1; }},
    {text:'Food keeps them happy. Open the Farms tab and build an Apple Orchard on open grass.', hl:['#tabs [data-tab="farm"]','#items [data-k="orchard"]'],
     check(){ return countB('orchard')>=1; }},
    {text:'More homes bring more workers. Open the Town tab and build a Hovel.', hl:['#tabs [data-tab="town"]','#items [data-k="hovel"]'],
     start(T){ T.base.hovel=countB('hovel'); }, check(T){ return countB('hovel')>T.base.hovel; }},
    {text:'Raiders come from the east. Open the Castle tab, pick Stone Wall, and drag a line east of your keep.', hl:['#tabs [data-tab="castle"]','#items [data-k="wall"]'],
     start(T){ T.base.wall=walls(); }, check(T){ return walls()-T.base.wall>=6; }, prog(T){ return `Wall sections: ${Math.min(6,walls()-T.base.wall)} of 6`; }},
    {text:'Add a Bastion Tower touching your wall. Troops climb onto walls from towers.', hl:['#tabs [data-tab="castle"]','#items [data-k="tower"]'],
     check(){ return countB('tower')+countB('greattower')>=1; }},
    {text:'Recruit two archers. Open the Army tab and press Archer twice. Each one needs a bow and gold.', hl:['#tabs [data-tab="army"]','#rec-archer'],
     start(T){ T.base.arch=G.units.filter(u=>u.kind==='archer'&&!u.dead).length; }, check(T){ return G.units.filter(u=>u.kind==='archer'&&!u.dead).length-T.base.arch>=2; }},
    {text:'Put your archers on the tower. Drag a box around them, then right click the tower.', touch:'Put your archers on the tower. Tap Box select, drag around them, then tap the tower.',
     check(){ return G.units.some(u=>u.kind==='archer'&&!u.dead&&(u.el>0||(u.post&&!u.post.dead&&u.post.def.towerish))); }},
    {text:'Raiders are coming. Your archers shoot from the tower. Select your spearmen and right click a raider to attack.', touch:'Raiders are coming. Your archers shoot from the tower. Tap a spearman, then tap a raider to attack.',
     start(T){ G.nextWave=G.time+12; }, check(){ return G.wave>=1&&!hostilesLeft(); }},
    {text:'Now attack. A raider camp sits to the east. Select your soldiers and right click a tent.', touch:'Now attack. A raider camp sits to the east. Open the Army tab, tap Select all troops, then tap a tent.',
     start(T){ T.camp(); }, check(){ return !G.blds.some(b=>b.team===1&&!b.dead); }, prog(){ const n=G.blds.filter(b=>b.team===1&&!b.dead).length; return `Tents left: ${n}`; }},
  ],
  begin(){ this.i=-1; this.done=false; this.base={}; $('tut').hidden=false; this.next(); },
  next(){
    this.i++; document.querySelectorAll('.tut-hl').forEach(e=>e.classList.remove('tut-hl'));
    if(this.i>=this.steps.length){ this.finish(); return; }
    const S=this.steps[this.i]; this.t0=G.time; if(S.start) S.start(this);
    $('tutStep').textContent=`Step ${this.i+1} of ${this.steps.length}`; $('tutText').textContent=(touchy&&S.touch)||S.text; $('tutProg').textContent='';
    sfx('coin');
  },
  tick(){
    if(this.done||!G||G.L.mode!=='tutorial'||this.i<0) return;
    const S=this.steps[this.i]; if(!S) return;
    for(const sel of S.hl||[]) document.querySelectorAll(sel).forEach(e=>e.classList.add('tut-hl'));
    if(S.prog) $('tutProg').textContent=S.prog(this);
    if(S.check(this)) this.next();
  },
  skip(){ if(!this.done) this.next(); },
  finish(){ this.done=true; $('tut').hidden=true; unlock('TUTORIAL'); endGame(true); },
  hide(){ $('tut').hidden=true; document.querySelectorAll('.tut-hl').forEach(e=>e.classList.remove('tut-hl')); },
  /* a small raider camp for the last lesson */
  camp(){
    const cx=Math.min(W-8,G.keep.x+30), cy=G.keep.y+1;
    for(const [t,x,y] of [['etent',cx,cy-3],['etent',cx+3,cy+1],['etent',cx-1,cy+4]]){ clearTiles(x,y,DEF[t].w,DEF[t].h); placeBld(t,x,y,'E',1); }
    for(let i=0;i<4;i++){ const u=spawnUnit('raider',cx+(rand()-.5)*4,cy+(rand()-.5)*5); u.guard={x:u.x,y:u.y}; u.guardR=6; }
    G.flowDirty=true; G.pathVer++; buildTerrain();
    toast('A raider camp has been spotted to the east','big'); sfx('horn');
  },
};
function walls(){ return G.blds.filter(b=>b.team===0&&!b.dead&&(b.type==='wall'||b.type==='palisade')).length; }
$('tutSkip').addEventListener('click',()=>Tutorial.skip());
