'use strict';
/* Castle Siege: optional 3D view. three.js r128 loads only when the player turns it on. */
const R3={on:false,ready:false,loading:false,tx:32,ty:22,dist:30,yaw:0,pitch:.92,G:null,terrV:-1,treeV:-1,bldV:-1,meshes:new Map(),mats:{},lastTex:0};
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=()=>res(); s.onerror=()=>{ s.remove(); rej(new Error('failed '+src)); }; document.head.appendChild(s); }); }
async function load3D(){
  if(window.THREE) return;
  try{ await loadScript('three.min.js'); }catch(e){ await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'); }
  if(!window.THREE) throw new Error('three.js did not load');
}
async function toggle3D(){
  if(R3.loading) return;
  if(R3.on){ R3.on=false; R3.cv.hidden=true; cv.classList.remove('over3d'); const c={x:R3.tx,y:R3.ty}; cam.z=1; centerOn(c.x,c.y); syncViewBtn(); return; }
  R3.loading=true; syncViewBtn();
  try{ await load3D(); init3D(); const c=viewCenter(); R3.tx=c.x; R3.ty=c.y; R3.on=true; V3=R3; R3.cv.hidden=false; cv.classList.add('over3d'); R3.resize(); }
  catch(e){ toast('The 3D view could not load here. The map stays in 2D.','warn'); }
  R3.loading=false; syncViewBtn();
}
function syncViewBtn(){ document.body.classList.toggle('three',R3.on); const b=document.getElementById('viewBtn'); if(b){ b.textContent=R3.loading?'Loading':R3.on?'2D':'3D'; b.classList.toggle('on',R3.on); } }
function mat(col,opts){ const k=col+(opts?JSON.stringify(opts):''); if(!R3.mats[k]) R3.mats[k]=new THREE.MeshLambertMaterial({color:col,...(opts||{})}); return R3.mats[k]; }
function init3D(){
  if(R3.ready) return;
  const c=document.createElement('canvas'); c.id='cv3'; c.hidden=true; stage.insertBefore(c,cv); R3.cv=c;
  const r=new THREE.WebGLRenderer({canvas:c,antialias:true}); r.setPixelRatio(Math.min(2,devicePixelRatio||1)); r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap; R3.r=r;
  const sc=new THREE.Scene(); sc.background=new THREE.Color('#a9bccb'); sc.fog=new THREE.Fog('#a9bccb',60,150); R3.scene=sc;
  R3.cam=new THREE.PerspectiveCamera(42,1,.3,400);
  sc.add(new THREE.HemisphereLight(0xe6eeff,0x3a4a22,.72));
  const sun=new THREE.DirectionalLight(0xfff0d0,.85); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
  const sh=sun.shadow.camera; sh.left=-34; sh.right=34; sh.top=34; sh.bottom=-34; sh.near=1; sh.far=120; sun.shadow.bias=-.0008; sc.add(sun); sc.add(sun.target); R3.sun=sun;
  R3.ray=new THREE.Raycaster(); R3.groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  R3.dummy=new THREE.Object3D(); R3.col=new THREE.Color();
  const inst=(geo,m,n,colored)=>{ const im=new THREE.InstancedMesh(geo,m,n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if(colored){ const w=new THREE.Color(1,1,1); for(let i=0;i<n;i++) im.setColorAt(i,w); im.instanceColor.setUsage(THREE.DynamicDrawUsage); } im.count=0; im.castShadow=true; im.frustumCulled=false; sc.add(im); return im; };
  R3.body=inst(new THREE.CylinderGeometry(.17,.22,.5,8),new THREE.MeshLambertMaterial({color:0xffffff}),1200,true);
  R3.head=inst(new THREE.SphereGeometry(.12,8,6),new THREE.MeshLambertMaterial({color:0xffffff}),1200,true);
  R3.horse=inst(new THREE.BoxGeometry(.75,.36,.26),mat('#6a4a2a'),200);
  R3.big=inst(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),120,true);
  R3.beast=inst(new THREE.BoxGeometry(.5,.22,.18),new THREE.MeshLambertMaterial({color:0xffffff}),120,true);
  R3.part=inst(new THREE.BoxGeometry(.09,.09,.09),new THREE.MeshBasicMaterial({color:0xffffff}),1000,true); R3.part.castShadow=false;
  R3.proj=inst(new THREE.SphereGeometry(.07,6,4),new THREE.MeshBasicMaterial({color:0x2b1a12}),400); R3.proj.castShadow=false;
  R3.rock=inst(new THREE.SphereGeometry(.18,6,5),mat('#6e675c'),80);
  const ringG=new THREE.RingGeometry(.3,.38,20); ringG.rotateX(-Math.PI/2);
  R3.ring=inst(ringG,new THREE.MeshBasicMaterial({color:0xf2d36b,side:THREE.DoubleSide}),300); R3.ring.castShadow=false;
  const ghost=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x78dc5a,transparent:true,opacity:.35,depthWrite:false})); ghost.visible=false; sc.add(ghost); R3.ghost=ghost;
  const selBox=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xf2d36b,wireframe:true})); selBox.visible=false; sc.add(selBox); R3.selBox=selBox;
  R3.ready=true;
}
function resetWorld3D(){
  const sc=R3.scene;
  for(const m of R3.meshes.values()) sc.remove(m); R3.meshes.clear();
  for(const k of ['ground','snowP','trees','trees2','trunks','walls','pals','estG']) if(R3[k]){ sc.remove(R3[k]); R3[k]=null; }
  const tex=new THREE.CanvasTexture(tc); tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false; tex.anisotropy=4; R3.tex=tex;
  const g=new THREE.PlaneGeometry(W,H); g.rotateX(-Math.PI/2); g.translate(W/2,0,H/2);
  R3.ground=new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:tex})); R3.ground.receiveShadow=true; sc.add(R3.ground);
  const stex=new THREE.CanvasTexture(sc_canvas()); stex.minFilter=THREE.LinearFilter; stex.generateMipmaps=false; R3.stex=stex;
  R3.snowP=new THREE.Mesh(g.clone().translate(0,.01,0),new THREE.MeshLambertMaterial({map:stex,transparent:true,opacity:0,depthWrite:false})); R3.snowP.receiveShadow=true; sc.add(R3.snowP);
  const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1.15,1).translate(0,.575,0),mat('#9a9486'),2500); walls.count=0; walls.castShadow=walls.receiveShadow=true; sc.add(walls); R3.walls=walls;
  const pals=new THREE.InstancedMesh(new THREE.BoxGeometry(.9,.95,.9).translate(0,.475,0),mat('#7a5230'),1500); pals.count=0; pals.castShadow=pals.receiveShadow=true; sc.add(pals); R3.pals=pals;
  R3.estG=new THREE.Group(); sc.add(R3.estG);
  R3.G=G; R3.terrV=-1; R3.treeV=-1; R3.bldV=-1; R3.estSig='';
}
function sc_canvas(){ return sc; }
/* ---------- static scenery ---------- */
function rebuildTrees(){
  for(const k of ['trees','trees2','trunks']) if(R3[k]){ R3.scene.remove(R3[k]); R3[k]=null; }
  const con=[], broad=[]; for(let i=0;i<N;i++) if(ter[i]===1) (shade[i]<.4||G.L.map==='winter'?con:broad).push(i);
  const d=R3.dummy, col=R3.col, snowy=G.snow>.6, white=new THREE.Color('#e4eaee');
  const mk=(geo,list,hue,sat,lit)=>{ const im=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:0xffffff}),Math.max(1,list.length)); im.castShadow=true; im.receiveShadow=true;
    list.forEach((i,k)=>{ const x=i%W, y=(i/W)|0, s=.8+shade[i]*.5; d.position.set(x+.5+(shade[i]-.5)*.3,0,y+.5+(shade[(i+7)%N]-.5)*.3); d.rotation.set(0,shade[i]*6,0); d.scale.set(s,s*(.9+shade[(i+3)%N]*.4),s); d.updateMatrix(); im.setMatrixAt(k,d.matrix);
      col.setHSL(hue+shade[i]*.05,sat,lit+shade[(i+11)%N]*.08); if(snowy) col.lerp(white,.4); im.setColorAt(k,col); });
    im.count=list.length; if(im.instanceColor) im.instanceColor.needsUpdate=true; R3.scene.add(im); return im; };
  R3.trees=mk(new THREE.ConeGeometry(.42,1.25,7).translate(0,.85,0),con,.36,.34,.17);
  R3.trees2=mk(new THREE.IcosahedronGeometry(.5,1).translate(0,1.0,0),broad,.27,.42,.2);
  const tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.06,.08,.6,5).translate(0,.3,0),mat('#4b3220'),Math.max(1,broad.length));
  broad.forEach((i,k)=>{ const x=i%W, y=(i/W)|0; d.position.set(x+.5+(shade[i]-.5)*.3,0,y+.5+(shade[(i+7)%N]-.5)*.3); d.rotation.set(0,0,0); d.scale.set(1,1,1); d.updateMatrix(); tr.setMatrixAt(k,d.matrix); });
  tr.count=broad.length; tr.castShadow=true; R3.scene.add(tr); R3.trunks=tr;
}
function box(w,h,d,col,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(col)); m.position.set(x,y+h/2,z); m.castShadow=true; m.receiveShadow=true; return m; }
function roof(w,d,h,col,x,y,z){ const g=new THREE.ConeGeometry(Math.SQRT1_2,1,4); g.rotateY(Math.PI/4); const m=new THREE.Mesh(g,mat(col)); m.scale.set(w,h,d); m.position.set(x,y+h/2,z); m.castShadow=true; return m; }
function cyl(r,h,col,x,y,z,seg){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||10),mat(col)); m.position.set(x,y+h/2,z); m.castShadow=true; m.receiveShadow=true; return m; }
function flag3(col,x,y,z,h){ const g=new THREE.Group(); g.add(cyl(.03,h,'#3a2a1a',x,y,z,5)); const f=new THREE.Mesh(new THREE.PlaneGeometry(.6,.36),new THREE.MeshLambertMaterial({color:col,side:THREE.DoubleSide})); f.position.set(x+.31,y+h-.2,z); g.add(f); return g; }
const HOUSE_COL={woodcutter:['#6b4a2b','#8f5a33'],hunter:['#5e4a2a','#6b5a2a'],mill:['#c8b89a','#8f5a33'],bakery:['#a87a4a','#7d3b2a'],brewery:['#7a5a3a','#5c4a2a'],inn:['#8a6a42','#7d3b2a'],hovel:['#7c5a3a','#b8914f'],chapel:['#a39d8f','#55606b'],latrine:['#6b4a2b','#5e3e22'],ratcatcher:['#6b5a3a','#6b5a2a'],guardpost:['#6b4a2b','#86603a'],fletcher:['#6b4a2b','#7d3b2a'],poleturner:['#6b4a2b','#5c4a2a'],blacksmith:['#5a544b','#3d3a36'],armourer:['#5a544b','#55606b'],barracks:['#958f82','#5f3a2a'],armory:['#958f82','#5a544b'],market:['#8a7353','#b23c2c'],gaol:['#958f82','#6f6a60']};
function bldMesh(b){
  const g=new THREE.Group(), w=b.w, h=b.h, cx=b.x+w/2, cz=b.y+h/2, own=bannerCol(b);
  const d=b.def;
  switch(b.type){
    case 'keep': case 'warcamp':
      if(b.type==='warcamp'){ g.add(box(w-.2,.05,h-.2,'#7a6a48',cx,0,cz)); const t=new THREE.Mesh(new THREE.ConeGeometry(1.3,1.8,6),mat('#3f74c2')); t.position.set(cx,.9,cz); t.castShadow=true; g.add(t); g.add(flag3(own,cx,1.6,cz,1.4)); break; }
      g.add(box(w-.4,2.4,h-.4,'#8f897c',cx,0,cz)); g.add(box(w-1.4,2.9,h-1.4,'#7a746a',cx,0,cz));
      for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) g.add(cyl(.55,3.1,'#9c9689',cx+dx*(w/2-.5),0,cz+dz*(h/2-.5)));
      g.add(flag3(own,cx,2.9,cz,1.5)); break;
    case 'tower': case 'greattower': {
      const ht=b.def.great?2.8:2.0; g.add(box(w-.1,ht,h-.1,'#958f82',cx,0,cz));
      for(let i=0;i<4;i++) for(const s of [-1,1]){ const along=-w/2+.35+i*(w-.7)/3; g.add(box(.25,.3,.25,'#c4bdac',cx+along,ht,cz+s*(h/2-.2))); g.add(box(.25,.3,.25,'#c4bdac',cx+s*(w/2-.2),ht,cz+along)); }
      if(b.def.great) for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) g.add(cyl(.45,ht+.4,'#a39d90',cx+dx*(w/2-.4),0,cz+dz*(h/2-.4)));
      if(b.mangonel||b.ballista) g.add(box(.6,.3,.4,'#6b4a2b',cx,ht,cz));
      if(b.team===1||b.def.great) g.add(flag3(own,cx+w/2-.3,ht,cz-h/2+.3,1));
      break; }
    case 'gatehouse': {
      const ew=b.dir==='E'||b.dir==='W';
      const side=(o)=> ew? box(w,2.1,1,'#958f82',cx,0,b.y+o+.5) : box(1,2.1,h,'#958f82',b.x+o+.5,0,cz);
      g.add(side(0)); g.add(side(ew?h-1:w-1));
      g.add(ew?box(w,.6,1,'#8a847a',cx,1.5,cz):box(1,.6,h,'#8a847a',cx,1.5,cz));
      if(!b.raised){ const dir={E:[1,0],W:[-1,0],S:[0,1],N:[0,-1]}[b.dir]; const px=cx+dir[0]*(w/2+.5), pz=cz+dir[1]*(h/2+.5); g.add(box(ew?1:.9,.08,ew?.9:1,'#86603a',px,0,pz)); }
      if(b.team===1) g.add(flag3(own,cx,2.1,cz,1));
      break; }
    case 'stockpile': g.add(box(w-.2,.08,h-.2,'#7d6648',cx,0,cz)); for(let i=0;i<5;i++) g.add(box(.5,.25+(i%3)*.12,.4,i%2?'#8a5a32':'#aaa496',b.x+.6+(i%3)*.8,0,b.y+.7+((i/3)|0)*1.2)); break;
    case 'granary': g.add(cyl(.9,1.1,'#7a5a3a',cx,0,cz,12)); { const m=new THREE.Mesh(new THREE.ConeGeometry(1.05,.8,12),mat('#c9a35a')); m.position.set(cx,1.5,cz); m.castShadow=true; g.add(m); } break;
    case 'orchard': case 'wheatfarm': case 'hopsfarm': case 'dairy': {
      const bare=G.snow>.5, colr={orchard:'#4f6a2a',wheatfarm:bare?'#6a5a3a':'#c8a84a',hopsfarm:'#5a7a2a',dairy:'#5f7a34'}[b.type];
      g.add(box(w-.15,.04,h-.15,colr,cx,0,cz));
      if(b.type==='orchard') for(let i=0;i<3;i++)for(let j=0;j<3;j++){ g.add(cyl(.06,.4,'#4a3420',b.x+.7+i*1.3,0,b.y+.7+j*1.3,5)); if(!bare){ const m=new THREE.Mesh(new THREE.SphereGeometry(.38,8,6),mat('#2f5a22')); m.position.set(b.x+.7+i*1.3,.65,b.y+.7+j*1.3); m.castShadow=true; g.add(m);} }
      else if(b.type==='hopsfarm') for(let i=0;i<4;i++) g.add(box(.08,.9,h-.6,'#5a3a20',b.x+.5+i*.8,0,cz));
      else if(b.type==='dairy') for(let i=0;i<3;i++) g.add(box(.45,.3,.22,'#f2efe6',b.x+.8+i*.7,0,b.y+1+(i%2)*.8));
      g.add(box(.9,.6,.8,'#7c5a3a',b.x+w-.6,0,b.y+h-.6)); g.add(roof(1,.9,.5,'#b8914f',b.x+w-.6,.6,b.y+h-.6));
      break; }
    case 'cathedral': g.add(box(w-.6,2.2,h-1.4,'#b3ab98',cx,0,cz+.4)); g.add(roof(w-.4,h-1.2,1.2,'#4e5864',cx,2.2,cz+.4)); g.add(box(1.4,3.6,1.4,'#b3ab98',cx,0,b.y+.8)); { const m=new THREE.Mesh(new THREE.ConeGeometry(.9,2,4),mat('#4e5864')); m.rotation.y=Math.PI/4; m.position.set(cx,4.6,b.y+.8); m.castShadow=true; g.add(m); } break;
    case 'joustfield': g.add(box(w-.1,.03,h-.6,'#c8b080',cx,0,cz)); g.add(box(w-1,.5,.08,'#e6d6b0',cx,0,cz)); g.add(box(w-1.2,.6,.5,'#3f74c2',cx,0,b.y+.25)); g.add(box(w-1.2,.6,.5,'#b23c2c',cx,0,b.y+h-.25)); break;
    case 'well': g.add(cyl(.38,.45,'#958f82',cx,0,cz,10)); g.add(box(.9,.06,.06,'#5a3a20',cx,.9,cz)); break;
    case 'pit': break;
    case 'quarry': case 'ironmine': g.add(box(w-.2,.12,h-.2,b.type==='ironmine'?'#5e4a40':'#6d6960',cx,0,cz)); g.add(box(.12,1.6,.12,'#6b4a2b',b.x+w-.5,0,b.y+h-.4)); for(let i=0;i<4;i++) g.add(box(.4,.3,.35,b.type==='ironmine'?'#9a5a40':'#b3ad9f',b.x+.6+i*.5,0,b.y+h-.7)); break;
    case 'stocks': g.add(box(.8,.5,.2,'#7a5230',cx,0,cz)); break;
    case 'gallows': g.add(box(1.6,.5,1.6,'#6b4a2b',cx,0,cz)); g.add(box(.12,1.6,.12,'#4a3420',cx-.5,.5,cz)); g.add(box(1,.1,.1,'#4a3420',cx,2,cz)); break;
    case 'rack': g.add(box(1.5,.6,.9,'#5e3e22',cx,0,cz)); g.add(cyl(.32,.1,'#3a2a1a',cx-.6,.6,cz)); break;
    case 'etent': case 'eworkshop': case 'epavilion': { const col=b.type==='epavilion'?'#7a1a14':b.type==='eworkshop'?'#5a4a3a':'#8a2a20'; const m=new THREE.Mesh(new THREE.ConeGeometry(Math.min(w,h)*.55,b.type==='epavilion'?2:1.4,6),mat(col)); m.position.set(cx,b.type==='epavilion'?1:.7,cz); m.castShadow=true; g.add(m); if(b.type==='epavilion') g.add(flag3('#8a8a8a',cx,1.8,cz,1)); break; }
    default: {
      const [wc,rc]=HOUSE_COL[b.type]||['#7c5a3a','#8f5a33'];
      const hh=d.castle?1.2:.75; g.add(box(w-.35,hh,h-.35,wc,cx,0,cz)); g.add(roof(w-.15,h-.15,Math.min(w,h)*.42,rc,cx,hh,cz));
      if(b.type==='barracks'||b.type==='guardpost'||(b.team===1&&w>1)) g.add(flag3(own,b.x+w-.4,hh,b.y+.4,1));
    }
  }
  return g;
}
function syncBuildings(){
  const sc=R3.scene, seen=new Set();
  let wi=0, pi=0; const d=R3.dummy;
  for(const b of G.blds){
    if(b.type==='wall'||b.type==='palisade'){ d.position.set(b.x+.5,0,b.y+.5); d.rotation.set(0,0,0); d.scale.set(1,1,1); d.updateMatrix(); if(b.type==='wall') R3.walls.setMatrixAt(wi++,d.matrix); else R3.pals.setMatrixAt(pi++,d.matrix); continue; }
    const key=b.id+':'+(b.raised?1:0)+(b.mangonel?1:0)+(b.ballista?1:0)+(G.snow>.5&&b.def.farm?1:0);
    seen.add(key);
    if(!R3.meshes.has(key)){ const m=bldMesh(b); m.userData.b=b; R3.meshes.set(key,m); sc.add(m); }
  }
  for(const [k,m] of R3.meshes) if(!seen.has(k)){ sc.remove(m); R3.meshes.delete(k); }
  R3.walls.count=wi; R3.walls.instanceMatrix.needsUpdate=true; R3.pals.count=pi; R3.pals.instanceMatrix.needsUpdate=true;
}
function syncEstates(){
  const sig=G.estates.map(e=>e.owner+':'+e.ai).join(','); if(sig===R3.estSig) return; R3.estSig=sig;
  const g=R3.estG; while(g.children.length) g.remove(g.children[0]);
  for(const e of G.estates){ for(const [dx,dz,c] of [[-1,-.2,'#b8914f'],[.6,-.7,'#8f5a33'],[0,.7,'#55606b']]){ g.add(box(.9,.6,.8,'#7c5a3a',e.x+dx,0,e.y+dz)); g.add(roof(1,.9,.5,c,e.x+dx,.6,e.y+dz)); } g.add(flag3(estateCol(e),e.x,0,e.y-1.3,1.6)); }
}
/* ---------- per frame ---------- */
const ELEV=[0,1.15,2.0,2.8];
function unitColor(u){
  if(u.kind==='peasant') return '#a88a5c'; if(u.kind==='thief') return '#3e3a36'; if(u.kind==='lord') return '#6a3a8a'; if(u.kind==='monk') return '#6b4a2b'; if(u.kind==='engineer') return '#c47a2a';
  if(u.kind==='deer') return '#9a6a3a'; if(u.kind==='wolf') return '#6e6a64'; if(u.kind==='rat') return '#2e2a26'; if(u.kind==='rothgar') return '#8a8a86';
  return teamCols(u)[0];
}
function drawDynamic(){
  const d=R3.dummy, col=R3.col;
  let nb=0,nh=0,nH=0,nB=0,nA=0,nR=0;
  for(const u of G.units){
    const el=ELEV[u.el||0]||0, x=u.x, z=u.y;
    if(u.def.big){ const s=u.def.cart?[1.3,.7,.8]:u.def.stower?[1.4,2.4,1.4]:u.def.ram||u.kind==='ram'?[1.4,.8,.8]:[1.2,.7,.9];
      d.position.set(x,s[1]/2,z); d.rotation.set(0,-u.face,0); d.scale.set(s[0],s[1],s[2]); d.updateMatrix(); R3.big.setMatrixAt(nB,d.matrix);
      col.set(u.def.cart?(u.def.caravan?'#e8dcc4':'#7a5230'):u.team===0?'#6b5030':'#5a3a28'); if(u.hitT>0) col.set('#ffffff'); R3.big.setColorAt(nB,col); nB++;
      if(u.sel&&nR<300){ d.position.set(x,.03,z); d.rotation.set(0,0,0); d.scale.set(2.2,1,2.2); d.updateMatrix(); R3.ring.setMatrixAt(nR++,d.matrix); }
      continue; }
    if(u.team===2||u.def.beast){ d.position.set(x,u.kind==='rat'?.06:.3,z); d.rotation.set(0,-u.face,0); const s=u.kind==='rat'?.35:1; d.scale.set(s,s,s); d.updateMatrix(); R3.beast.setMatrixAt(nA,d.matrix); col.set(unitColor(u)); R3.beast.setColorAt(nA,col); nA++; continue; }
    const boss=u.kind==='lord'||u.kind==='warlord'||u.kind==='rothgar'||u.kind==='elord', sc_=boss?1.35:1, y0=el+(u.def.cav?.38:0)+(u.moving?Math.abs(Math.sin(u.walk*14))*.05:0);
    d.rotation.set(0,0,0); d.scale.set(sc_,sc_,sc_); d.position.set(x,y0+.25*sc_,z); d.updateMatrix(); R3.body.setMatrixAt(nb,d.matrix);
    col.set(unitColor(u)); if(u.hitT>0) col.set('#ffffff'); else if(u.sel) col.lerp(new THREE.Color('#fff2b0'),.25); R3.body.setColorAt(nb,col); nb++;
    d.position.set(x,y0+.62*sc_,z); d.updateMatrix(); R3.head.setMatrixAt(nh,d.matrix); col.set(boss?'#d6a03c':(u.def.mil&&u.kind!=='monk'?'#8c939a':'#e2bd8f')); R3.head.setColorAt(nh,col); nh++;
    if(u.def.cav){ d.position.set(x,el+.3,z); d.rotation.set(0,-u.face,0); d.scale.set(1,1,1); d.updateMatrix(); R3.horse.setMatrixAt(nH++,d.matrix); }
    if(u.sel&&nR<300){ d.position.set(x,el+.03,z); d.rotation.set(0,0,0); d.scale.set(1,1,1); d.updateMatrix(); R3.ring.setMatrixAt(nR++,d.matrix); }
  }
  const fin=(im,n)=>{ im.count=n; im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; };
  fin(R3.body,nb); fin(R3.head,nh); fin(R3.horse,nH); fin(R3.big,nB); fin(R3.beast,nA); fin(R3.ring,nR);
  let np=0, nr=0;
  for(const p of G.proj){ const t=p.t/p.dur, x=p.x0+(p.fx-p.x0)*t, y=p.y0+(p.fy-p.y0)*t, L=Math.hypot(p.fx-p.x0,p.fy-p.y0), h=Math.sin(Math.PI*t)*Math.max(1,L*(p.type==='stone'?.3:.14))+(p.h0||0)*(1-t)+.6;
    d.position.set(x,h,y); d.rotation.set(0,0,0); d.scale.set(1,1,1); d.updateMatrix();
    if(p.type==='stone'){ if(nr<80) R3.rock.setMatrixAt(nr++,d.matrix); } else if(np<400) R3.proj.setMatrixAt(np++,d.matrix); }
  R3.proj.count=np; R3.proj.instanceMatrix.needsUpdate=true; R3.rock.count=nr; R3.rock.instanceMatrix.needsUpdate=true;
  let nq=0;
  for(const q of G.parts){ if(nq>=1000) break; const f=Math.max(0,q.life/q.max); d.position.set(q.x,(q.smoke?1.2+(1-f)*1.5:.4+(1-f)*.3),q.y); const s=q.smoke?2.5+(1-f)*3:q.s/3; d.scale.set(s,s,s); d.updateMatrix(); R3.part.setMatrixAt(nq,d.matrix); col.set(q.c.startsWith('rgba')?'#55504a':q.c); R3.part.setColorAt(nq,col); nq++; }
  fin(R3.part,nq);
}
function placeCamera(){
  const hz=Math.cos(R3.pitch)*R3.dist, c=R3.cam;
  c.position.set(R3.tx-Math.sin(R3.yaw)*hz, Math.sin(R3.pitch)*R3.dist, R3.ty+Math.cos(R3.yaw)*hz);
  c.lookAt(R3.tx,0,R3.ty);
  R3.sun.position.set(R3.tx-18,40,R3.ty+12); R3.sun.target.position.set(R3.tx,0,R3.ty); R3.sun.target.updateMatrixWorld();
}
R3.draw=function(){
  if(!R3.ready||!G) return;
  if(R3.G!==G) resetWorld3D();
  const now=performance.now();
  if(R3.terrV!==terrVer && now-R3.lastTex>800){ R3.terrV=terrVer; R3.lastTex=now; R3.tex.needsUpdate=true; R3.stex.needsUpdate=true; }
  const treeSig=terrVer+':'+(G.snow>.6?1:0); if(R3.treeV!==treeSig && (R3.treeV===-1||now-(R3.lastTree||0)>2500)){ R3.treeV=treeSig; R3.lastTree=now; rebuildTrees(); }
  if(R3.bldV!==G.bldVer+':'+G.blds.filter(b=>b.type==='gatehouse'&&b.raised).length){ R3.bldV=G.bldVer+':'+G.blds.filter(b=>b.type==='gatehouse'&&b.raised).length; syncBuildings(); }
  syncEstates();
  R3.snowP.material.opacity=Math.min(1,G.snow);
  drawDynamic();
  const gh=R3.ghost; gh.visible=false;
  if(mode&&mode.type==='build'&&hover){ const dd=DEF[mode.key]; if(!dd.line||!lineStart){ const dm=dims(mode.key,mode.dir), f=footprint(mode.key,hover,mode.dir), ok=!canPlace(mode.key,f.x,f.y,mode.dir)&&afford(dd.cost); const hh=dd.castle?1.6:.8; gh.scale.set(dm.w,hh,dm.h); gh.position.set(f.x+dm.w/2,hh/2,f.y+dm.h/2); gh.material.color.set(ok?'#78dc5a':'#e64632'); gh.visible=true; } }
  const sb=R3.selBox, b=G.selB; sb.visible=!!(b&&!b.dead); if(sb.visible){ sb.scale.set(b.w+.1,b.def.castle?2.2:1.2,b.h+.1); sb.position.set(b.x+b.w/2,sb.scale.y/2,b.y+b.h/2); sb.material.color.set(b.team===1?'#ff7a5a':'#f2d36b'); }
  placeCamera();
  R3.r.render(R3.scene,R3.cam);
};
R3.resize=function(){ if(!R3.ready) return; R3.r.setSize(VW,VH,false); R3.cv.style.width=VW+'px'; R3.cv.style.height=VH+'px'; R3.cam.aspect=VW/Math.max(1,VH); R3.cam.updateProjectionMatrix(); };
R3.pick=function(sx,sy){
  placeCamera();
  const v=new THREE.Vector2(sx/VW*2-1,-(sy/VH)*2+1); R3.ray.setFromCamera(v,R3.cam);
  const p=new THREE.Vector3(); if(!R3.ray.ray.intersectPlane(R3.groundPlane,p)) return {x:R3.tx,y:R3.ty};
  return {x:p.x,y:p.z};
};
R3.project=function(x,y,h){ const v=new THREE.Vector3(x,h||0,y).project(R3.cam); return {x:(v.x+1)/2*VW,y:(1-v.y)/2*VH}; };
R3.zoom=function(f){ R3.dist=cl(R3.dist/f,9,70); };
R3.pan=function(dx,dy){ const k=R3.dist/VH*1.15, fx=Math.sin(R3.yaw), fz=-Math.cos(R3.yaw), rx=Math.cos(R3.yaw), rz=Math.sin(R3.yaw);
  R3.tx=cl(R3.tx-rx*dx*k+fx*dy*k*1.3,0,W); R3.ty=cl(R3.ty-rz*dx*k+fz*dy*k*1.3,0,H); };
R3.rotate=function(a){ R3.yaw+=a; };
R3.tilt=function(a){ R3.pitch=cl(R3.pitch+a,.45,1.4); };
R3.centerOn=function(x,y){ R3.tx=x; R3.ty=y; };
