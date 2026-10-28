'use strict';
/* Castle Siege: camera and 2D drawing */
const stage=document.getElementById('stage'), cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const cam={x:0,y:0,z:1};
let dpr=1,VW=0,VH=0;
let V3=null; // set by render3d.js when the 3D view is on
function resize(){
  const r=stage.getBoundingClientRect(); dpr=Math.min(2,window.devicePixelRatio||1);
  VW=r.width; VH=r.height; cv.width=Math.max(1,Math.round(VW*dpr)); cv.height=Math.max(1,Math.round(VH*dpr));
  cv.style.width=VW+'px'; cv.style.height=VH+'px'; vign=null; clampCam();
  if(V3&&V3.resize) V3.resize();
}
/* screen space hidden behind the top bar and the bottom panels, so the camera can pull every tile clear of them */
const INS={top:0,bot:0};
function clampCam(){
  const mw=W*T,mh=H*T,vw=VW/cam.z,vh=VH/cam.z, t=INS.top/cam.z, bt=INS.bot/cam.z, side=24/cam.z;
  const minX=-side, maxX=mw-vw+side, minY=-t, maxY=mh-vh+bt;
  cam.x = maxX<minX ? (mw-vw)/2 : Math.max(minX,Math.min(maxX,cam.x));
  cam.y = maxY<minY ? (mh-vh)/2 : Math.max(minY,Math.min(maxY,cam.y));
}
function centerOn(x,y){cam.x=x*T-VW/cam.z/2;cam.y=y*T-VH/cam.z/2;clampCam(); if(V3&&V3.on) V3.centerOn(x,y);}
function s2w(sx,sy){ if(V3&&V3.on) return V3.pick(sx,sy); return {x:(sx/cam.z+cam.x)/T,y:(sy/cam.z+cam.y)/T}; }
function w2s(x,y,h){ if(V3&&V3.on) return V3.project(x,y,h||0); return {x:(x*T-cam.x)*cam.z,y:(y*T-cam.y)*cam.z}; }
function zoomAt(sx,sy,f){ if(V3&&V3.on){ V3.zoom(f); return; } const w=s2w(sx,sy);cam.z=Math.max(0.42,Math.min(2.2,cam.z*f));cam.x=w.x*T-sx/cam.z;cam.y=w.y*T-sy/cam.z;clampCam();}
function panBy(dx,dy){ if(V3&&V3.on){ V3.pan(dx,dy); return; } cam.x-=dx/cam.z; cam.y-=dy/cam.z; clampCam(); }
function viewCenter(){ if(V3&&V3.on) return {x:V3.tx,y:V3.ty}; return {x:(cam.x+VW/cam.z/2)/T,y:(cam.y+VH/cam.z/2)/T}; }

const C={ally:'#3f74c2',allyD:'#22457a',foe:'#b23c2c',foeD:'#6e1d14',skin:'#e2bd8f',stoneL:'#c4bdac',gold:'#d6a03c'};
function aiOf(o){ return o&&o.owner&&G&&G.ais ? G.ais.find(a=>a.id===o.owner) : null; }
function bannerCol(o){ if(!o||o.team===0) return C.ally; const a=aiOf(o); return a?a.color:C.foe; }
function teamCols(u){ if(u.team===0) return [C.ally,C.allyD]; const a=aiOf(u); return a?[a.color,a.dark]:[C.foe,C.foeD]; }
function flag(c,x,y,col,len){ const t=performance.now(); c.fillStyle='#2e2014';c.fillRect(x-1,y,2,len||18); const wv=Math.sin(t/300+x)*2; c.fillStyle=col;c.beginPath();c.moveTo(x+1,y);c.lineTo(x+15,y+3+wv);c.lineTo(x+1,y+8);c.fill(); }
function house(c,x,y,w,h,wallC,roofC){
  c.fillStyle='rgba(0,0,0,.28)';c.fillRect(x+6,y+7,w-6,h-6);
  c.fillStyle=wallC;c.fillRect(x+3,y+h*.42,w-6,h*.52);
  c.fillStyle=roofC;c.fillRect(x+1,y+2,w-2,h*.6);
  c.fillStyle='rgba(0,0,0,.2)';c.fillRect(x+1,y+2+h*.3,w-2,h*.3);
  c.fillStyle='rgba(255,255,255,.18)';c.fillRect(x+1,y+1+h*.3,w-2,2);
  c.fillStyle='#24180e';c.fillRect(x+w/2-3,y+h-11,6,9);
}
function crenels(c,x,y,w,h,col,s){
  c.fillStyle=col;
  if(s.t) for(let i=1;i<w-3;i+=7) c.fillRect(x+i,y,4,4);
  if(s.b) for(let i=1;i<w-3;i+=7) c.fillRect(x+i,y+h-4,4,4);
  if(s.l) for(let j=1;j<h-3;j+=7) c.fillRect(x,y+j,4,4);
  if(s.r) for(let j=1;j<h-3;j+=7) c.fillRect(x+w-4,y+j,4,4);
}
function field(c,x,y,w,h,ground,row,fence){
  c.fillStyle=ground;c.fillRect(x+2,y+2,w-4,h-4);
  c.strokeStyle=fence;c.lineWidth=2;c.strokeRect(x+2,y+2,w-4,h-4);
  c.fillStyle=row; for(let j=8;j<h-6;j+=8) c.fillRect(x+6,y+j,w-12,4);
}
function stoneBox(c,px,py,w,h){
  c.fillStyle='rgba(0,0,0,.33)';c.fillRect(px+7,py+8,w,h);
  c.fillStyle='#958f82';c.fillRect(px,py,w,h);
  c.fillStyle='#78726a';c.fillRect(px+5,py+5,w-10,h-10);
}
function isCastle(b,team){return b&&b.def.castle&&!b.def.isKeep&&b.team===team;}
function drawGate(c,b,px,py){
  const ang={E:0,S:Math.PI/2,W:Math.PI,N:-Math.PI/2}[b.dir||'E'];
  const w=b.w*T,h=b.h*T, cx=px+w/2, cy=py+h/2;
  c.fillStyle='rgba(0,0,0,.35)';c.fillRect(px+8,py+10,w,h);
  c.save(); c.translate(cx,cy); c.rotate(ang);
  const L=-T, R=T, Tp=-1.5*T;
  c.fillStyle='#5a5348'; c.fillRect(L,-T/2,2*T,T);
  c.fillStyle='rgba(0,0,0,.18)'; for(let k=0;k<4;k++) c.fillRect(L+k*16,-T/2,1,T);
  const a=b.anim||0;
  c.fillStyle='#6b4a2b'; c.fillRect(R-8,-T/2+2,6,T-4);
  c.fillStyle='#3a2a1a'; for(let k=0;k<3;k++) c.fillRect(R-8,-T/2+5+k*8,6,1.5);
  for(const y0 of [Tp, T/2]){
    c.fillStyle='#958f82'; c.fillRect(L,y0,2*T,T);
    c.fillStyle='#6f6a60'; c.fillRect(L+6,y0+6,2*T-12,T-12);
    crenels(c,L,y0,2*T,T,C.stoneL,{t:1,b:1,l:1,r:1});
  }
  const len=T*1.05*(1-a)+5*a;
  c.fillStyle='rgba(0,0,0,.25)'; c.fillRect(R+2,-T/2+6,len,T-6);
  c.fillStyle=a>.5?'#5e3e22':'#86603a'; c.fillRect(R,-T/2+3,len,T-6);
  c.strokeStyle='rgba(0,0,0,.35)'; c.lineWidth=1;
  for(let k=1;k<5;k++){const x=R+len*k/5; c.beginPath(); c.moveTo(x,-T/2+3); c.lineTo(x,T/2-3); c.stroke();}
  c.strokeStyle='#26221e'; c.lineWidth=1.2; c.beginPath(); c.moveTo(R-3,-T/2+1); c.lineTo(R+len,-T/2+4); c.moveTo(R-3,T/2-1); c.lineTo(R+len,T/2-4); c.stroke();
  c.restore();
  if(b.team===1) flag(c,px+w/2,py-10,bannerCol(b),14);
}
function tent(c,px,py,w,h,col,dark){
  c.fillStyle='rgba(0,0,0,.3)';c.fillRect(px+6,py+8,w-4,h-4);
  c.fillStyle=col;c.beginPath();c.moveTo(px+2,py+h-2);c.lineTo(px+w/2,py+3);c.lineTo(px+w-2,py+h-2);c.closePath();c.fill();
  c.fillStyle=dark;c.beginPath();c.moveTo(px+w/2,py+3);c.lineTo(px+w-2,py+h-2);c.lineTo(px+w/2,py+h-2);c.closePath();c.fill();
  c.fillStyle='#1a0d08';c.fillRect(px+w/2-3,py+h-10,6,8);
}
function engine(c,cx,cy,kind,ang,fire){
  c.save(); c.translate(cx,cy); c.rotate(ang||0);
  if(kind==='ballista'){
    c.fillStyle='#5a3e24'; c.fillRect(-8,-4,16,8);
    c.strokeStyle='#8a6a42'; c.lineWidth=3; c.beginPath(); c.arc(4,0,11,-1.25,1.25); c.stroke();
    c.strokeStyle='#d8d2c4'; c.lineWidth=.8; c.beginPath(); c.moveTo(4+Math.cos(-1.25)*11,Math.sin(-1.25)*11); c.lineTo(fire?2:-5,0); c.lineTo(4+Math.cos(1.25)*11,Math.sin(1.25)*11); c.stroke();
    if(!fire){ c.strokeStyle='#3a2a1a'; c.lineWidth=2; c.beginPath(); c.moveTo(-5,0); c.lineTo(16,0); c.stroke(); }
  } else {
    c.fillStyle='#6b4a2b'; c.fillRect(-12,-5,24,10);
    const a=fire?-1.2:.6; c.rotate(a); c.fillStyle='#8a6a42'; c.fillRect(-2,-20,4,22); c.fillStyle='#3a2a1a'; c.beginPath(); c.arc(0,-20,4,0,7); c.fill();
  }
  c.restore();
}
function drawTower(c,b,px,py,w,h){
  const great=b.def.great;
  c.fillStyle='rgba(0,0,0,.38)';c.fillRect(px+(great?12:8),py+(great?14:10),w,h);
  c.fillStyle='#958f82';c.fillRect(px,py,w,h);
  c.fillStyle='#6f6a60';c.fillRect(px+7,py+7,w-14,h-14);
  if(great){
    c.fillStyle='#7d776c'; c.fillRect(px+14,py+14,w-28,h-28);
    c.strokeStyle='#5a554c'; c.lineWidth=1; for(let i=0;i<6;i++){ c.beginPath(); c.arc(px+w/2,py+h/2,8+i*5,0,7); c.stroke(); }
    for(const [cx,cy] of [[px+9,py+9],[px+w-9,py+9],[px+9,py+h-9],[px+w-9,py+h-9]]){ c.fillStyle='#a39d90'; c.beginPath(); c.arc(cx,cy,10,0,7); c.fill(); c.fillStyle='#6b665d'; c.beginPath(); c.arc(cx,cy,5,0,7); c.fill(); }
  } else { c.fillStyle='#857f73';for(let i=0;i<4;i++)c.fillRect(px+9,py+12+i*11,w-18,2); }
  crenels(c,px,py,w,h,C.stoneL,{t:1,b:1,l:1,r:1});
  if(b.mangonel) engine(c,px+w/2,py+h/2+4,'mangonel',0,b.mangonel.fire>0);
  if(b.ballista) engine(c,px+w/2,py+h/2,'ballista',b.ballista.ang===undefined?(b.team===0?0:Math.PI):b.ballista.ang,b.ballista.fire>0);
  if(b.team===1||great) flag(c,px+w-10,py-12,bannerCol(b),16);
}
function drawKeep(c,b,px,py,w,h){
  const t=performance.now();
  c.fillStyle='rgba(0,0,0,.35)';c.fillRect(px+10,py+12,w,h);
  c.fillStyle='#8f897c';c.fillRect(px,py,w,h);
  c.fillStyle='#625d54';c.fillRect(px+10,py+10,w-20,h-20);
  c.fillStyle='#7a746a';c.fillRect(px+16,py+16,w-32,h-32);
  c.fillStyle='rgba(255,255,255,.06)'; c.fillRect(px+16,py+16,w-32,6);
  crenels(c,px,py,w,h,C.stoneL,{t:1,b:1,l:1,r:1});
  for(const [cx,cy] of [[px+8,py+8],[px+w-8,py+8],[px+8,py+h-8],[px+w-8,py+h-8]]){c.fillStyle='#9c9689';c.beginPath();c.arc(cx,cy,11,0,7);c.fill();c.fillStyle='#5c574f';c.beginPath();c.arc(cx,cy,6,0,7);c.fill();}
  const cx=px+w/2, cy=py+h/2, col=bannerCol(b);
  c.fillStyle='#3a2a1a';c.fillRect(cx-1.5,cy-24,3,28);
  const wv=Math.sin(t/300)*2;
  c.fillStyle=col;c.beginPath();c.moveTo(cx+1.5,cy-24);c.lineTo(cx+24,cy-19+wv);c.lineTo(cx+1.5,cy-12);c.fill();
  c.fillStyle=C.gold;c.fillRect(cx+6,cy-20,3,3);
  c.fillStyle=col; c.fillRect(px+w/2-6,py+h-4,12,14); c.fillStyle='rgba(0,0,0,.25)'; c.fillRect(px+w/2-6,py+h+6,12,4);
}
function drawBld(c,b,px,py){
  const d=b.def, w=(b.w||d.w)*T, h=(b.h||d.h)*T;
  const t=performance.now();
  switch(b.type){
    case 'keep': drawKeep(c,b,px,py,w,h); break;
    case 'powcamp':{
      c.fillStyle='#7d6a4a'; c.fillRect(px+3,py+3,w-6,h-6);
      c.fillStyle='rgba(0,0,0,.12)'; for(let i=0;i<14;i++){ const r=(b.id*37+i*53)%97/97; c.fillRect(px+8+r*(w-20),py+8+((i*29)%97)/97*(h-20),3,2); }
      tent(c,px+10,py+10,24,20,'#b8ab8e','#8a7e62'); tent(c,px+w-36,py+h-32,24,20,'#b8ab8e','#8a7e62');
      const n=Math.min(12,G&&G.prisoners||0);
      for(let i=0;i<n;i++){ const a=t/2400+i*2.4, ox=px+w/2+Math.cos(a)*(14+(i%3)*7), oy=py+h/2+Math.sin(a*1.3)*(12+(i%2)*8);
        c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(ox+1,oy+3,4,2.4,0,0,7); c.fill(); c.fillStyle='#8c8476'; c.beginPath(); c.arc(ox,oy,3.6,0,7); c.fill(); c.fillStyle='#e2bd8f'; c.beginPath(); c.arc(ox,oy-.4,1.8,0,7); c.fill(); }
      c.strokeStyle='#4a3420'; c.lineWidth=3; c.strokeRect(px+4,py+4,w-8,h-8);
      c.fillStyle='#6b4a2b'; for(let i=4;i<=w-4;i+=7){ c.fillRect(px+i-2,py+1,4,6); c.fillRect(px+i-2,py+h-7,4,6); } for(let j=4;j<=h-4;j+=7){ c.fillRect(px+1,py+j-2,6,4); c.fillRect(px+w-7,py+j-2,6,4); }
      c.fillStyle='#3a2a1a'; c.fillRect(px+w/2-6,py+h-7,12,7);
      flag(c,px+w-8,py+2,C.ally,18); break;}
    case 'warcamp':{
      c.fillStyle='#7a6a48';c.fillRect(px+4,py+4,w-8,h-8);
      c.fillStyle='#6b4a2b'; for(let i=0;i<w;i+=6){ c.beginPath(); c.arc(px+i+3,py+4,3,0,7); c.arc(px+i+3,py+h-4,3,0,7); c.fill(); } for(let j=0;j<h;j+=6){ c.beginPath(); c.arc(px+4,py+j+3,3,0,7); c.arc(px+w-4,py+j+3,3,0,7); c.fill(); }
      tent(c,px+30,py+22,w-60,h-44,'#3f74c2','#22457a');
      tent(c,px+12,py+12,26,24,'#d8cfb8','#a89c80'); tent(c,px+w-38,py+h-38,26,24,'#d8cfb8','#a89c80');
      flag(c,px+w/2,py+6,C.ally,22); break;}
    case 'stockpile':{
      c.fillStyle='#7d6648';c.fillRect(px+2,py+2,w-4,h-4);
      c.strokeStyle='#4f3d28';c.lineWidth=2;c.strokeRect(px+3,py+3,w-6,h-6);
      const R=G&&G.R?G.R:{wood:40,stone:40,iron:0,wheat:20,flour:0,hops:0,ale:0};
      for(let i=0;i<Math.min(8,Math.ceil(R.wood/20));i++){const lx=px+8+(i%4)*9,ly=py+10+((i/4)|0)*8;c.fillStyle='#8a5a32';c.fillRect(lx,ly,8,6);c.fillStyle='#d2a46a';c.fillRect(lx+6,ly,2,6);}
      for(let i=0;i<Math.min(8,Math.ceil(R.stone/15));i++){const sx=px+52+(i%3)*10-((i/3)|0)*3,sy=py+10+((i/3)|0)*9;c.fillStyle=i%2?'#aaa496':'#8f897c';c.fillRect(sx,sy,9,8);}
      for(let i=0;i<Math.min(4,Math.ceil(R.iron/10));i++){c.fillStyle='#7a4a38';c.fillRect(px+10+i*9,py+h-24,8,6);}
      for(let i=0;i<Math.min(4,Math.ceil((R.wheat+R.flour+R.hops)/15));i++){c.fillStyle=i%2?'#d8b450':'#efe6d4';c.beginPath();c.ellipse(px+54+i*9,py+h-18,4.5,6,0,0,7);c.fill();}
      if(R.ale>0){c.fillStyle='#7a4a24';c.beginPath();c.arc(px+18,py+h-10,5,0,7);c.fill();}
      break;}
    case 'granary':{
      c.fillStyle='rgba(0,0,0,.3)';c.fillRect(px+6,py+7,w-6,h-6);
      c.fillStyle='#7a5a3a';c.fillRect(px+3,py+8,w-6,h-10);
      c.fillStyle='#c9a35a';c.beginPath();c.ellipse(px+w/2,py+h/2-2,w/2-2,h/2-6,0,0,7);c.fill();
      c.strokeStyle='rgba(90,60,20,.5)';c.lineWidth=1;for(let i=1;i<4;i++){c.beginPath();c.ellipse(px+w/2,py+h/2-2,(w/2-2)*i/4,(h/2-6)*i/4,0,0,7);c.stroke();}
      const food=G&&G.R?foodTotal():40; for(let i=0;i<Math.min(5,Math.ceil(food/40));i++){c.fillStyle='#d8c08a';c.beginPath();c.ellipse(px+10+i*10,py+h-5,5,4,0,0,7);c.fill();}
      break;}
    case 'armory':{
      stoneBox(c,px,py,w,h);
      c.fillStyle='#5a544b';c.fillRect(px+8,py+8,w-16,h-16);
      c.strokeStyle='#cfd3d6';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(px+18+i*13,py+h-12);c.lineTo(px+24+i*13,py+16);c.stroke();}
      c.fillStyle='#8c939a';c.beginPath();c.arc(px+w-18,py+h/2,7,0,7);c.fill();
      break;}
    case 'barracks':{
      stoneBox(c,px,py,w,h);
      c.fillStyle='#5f3a2a';c.fillRect(px+4,py+4,w-8,h*.55);
      c.fillStyle='rgba(0,0,0,.2)';c.fillRect(px+4,py+4+h*.27,w-8,h*.28);
      c.fillStyle='#24180e';c.fillRect(px+w/2-5,py+h-14,10,12);
      flag(c,px+w-14,py-8,bannerCol(b),22);
      break;}
    case 'wall': case 'palisade':{
      const con={t:isCastle(bAt(b.x,b.y-1),b.team),b:isCastle(bAt(b.x,b.y+1),b.team),l:isCastle(bAt(b.x-1,b.y),b.team),r:isCastle(bAt(b.x+1,b.y),b.team)};
      const pal=b.type==='palisade';
      c.fillStyle='rgba(0,0,0,.3)';c.fillRect(px+5,py+6,T,T);
      c.fillStyle=pal?'#7a5230':'#9a9486';c.fillRect(px,py,T,T);
      c.fillStyle=pal?'#5e3e22':'#827c70';c.fillRect(px+6,py+6,T-12,T-12);
      if(con.t)c.fillRect(px+6,py,T-12,6); if(con.b)c.fillRect(px+6,py+T-6,T-12,6);
      if(con.l)c.fillRect(px,py+6,6,T-12); if(con.r)c.fillRect(px+T-6,py+6,6,T-12);
      if(!pal){ c.fillStyle='rgba(0,0,0,.12)'; c.fillRect(px+((b.x*7+b.y*3)%3)*8+3,py+((b.x*3+b.y*5)%3)*8+3,7,1.5); }
      if(pal){c.fillStyle='#a9774a';const s={t:!con.t,b:!con.b,l:!con.l,r:!con.r};
        if(s.t)for(let i=3;i<T;i+=6){c.beginPath();c.arc(px+i,py+3,2.6,0,7);c.fill();}
        if(s.b)for(let i=3;i<T;i+=6){c.beginPath();c.arc(px+i,py+T-3,2.6,0,7);c.fill();}
        if(s.l)for(let j=3;j<T;j+=6){c.beginPath();c.arc(px+3,py+j,2.6,0,7);c.fill();}
        if(s.r)for(let j=3;j<T;j+=6){c.beginPath();c.arc(px+T-3,py+j,2.6,0,7);c.fill();}
      } else crenels(c,px,py,T,T,C.stoneL,{t:!con.t,b:!con.b,l:!con.l,r:!con.r});
      if(b.oil){c.fillStyle='#222';c.beginPath();c.arc(px+16,py+16,6,0,7);c.fill();c.fillStyle='#4a3a20';c.beginPath();c.arc(px+16,py+16,4,0,7);c.fill();if(b.oil.cd>5){c.fillStyle='rgba(255,140,40,.6)';c.beginPath();c.arc(px+16,py+16,3,0,7);c.fill();}}
      break;}
    case 'gatehouse': drawGate(c,b,px,py); break;
    case 'tower': case 'greattower': drawTower(c,b,px,py,w,h); break;
    case 'pit':{
      c.save(); c.globalAlpha*=0.55;
      c.fillStyle='#3b2a1a';c.fillRect(px+4,py+4,T-8,T-8);
      c.strokeStyle='#c9b48a';c.lineWidth=1.2;
      for(let i=0;i<3;i++)for(let j=0;j<3;j++){const x=px+9+i*7,y=py+9+j*7;c.beginPath();c.moveTo(x-2,y+2);c.lineTo(x,y-2);c.lineTo(x+2,y+2);c.stroke();}
      c.restore(); break;}
    case 'moat': c.fillStyle='#28465a';c.fillRect(px,py,T,T); break;
    case 'woodcutter':
      house(c,px,py,w,h,'#6b4a2b','#8f5a33');
      for(let i=0;i<3;i++){c.fillStyle='#7a4f2b';c.fillRect(px+w-14,py+h-8-i*5,12,4);c.fillStyle='#d2a46a';c.fillRect(px+w-4,py+h-8-i*5,2,4);}
      break;
    case 'quarry': case 'ironmine':{
      const iron=b.type==='ironmine';
      c.fillStyle=iron?'#5e4a40':'#6d6960';c.fillRect(px+2,py+2,w-4,h-4);
      c.fillStyle=iron?'#3a2a24':'#4e4b45';c.fillRect(px+10,py+10,w-20,h-20);
      for(let i=0;i<5;i++){c.fillStyle=iron?(i%2?'#9a5a40':'#7a4a38'):(i%2?'#b3ad9f':'#9b9588');c.fillRect(px+8+(i*17)%(w-24),py+h-20+((i*7)%10),12,9);}
      c.strokeStyle='#6b4a2b';c.lineWidth=3;c.beginPath();c.moveTo(px+w-14,py+h-6);c.lineTo(px+w-14,py+10);c.lineTo(px+w/2,py+18);c.stroke();
      c.strokeStyle='#3a2a1a';c.lineWidth=1;c.beginPath();c.moveTo(px+w/2,py+18);c.lineTo(px+w/2,py+32);c.stroke();
      break;}
    case 'market':{
      c.fillStyle='#8a7353';c.fillRect(px+2,py+2,w-4,h-4);
      const cols=['#b23c2c','#3f74c2','#d6a03c','#5a8a3a'];
      for(let i=0;i<4;i++){const sx=px+6+(i%2)*44,sy=py+6+((i/2)|0)*44; c.fillStyle='rgba(0,0,0,.25)';c.fillRect(sx+3,sy+4,38,34); c.fillStyle=cols[i];c.fillRect(sx,sy,38,16); c.fillStyle='rgba(255,255,255,.35)';for(let k=0;k<38;k+=8)c.fillRect(sx+k,sy,4,16); c.fillStyle='#6b4a2b';c.fillRect(sx+2,sy+16,34,16);}
      break;}
    case 'orchard': {
      const bare=G&&G.snow>.5;
      c.fillStyle=bare?'#5a5a3a':'#4f6a2a';c.fillRect(px+2,py+2,w-4,h-4);
      c.strokeStyle='#8a6a42';c.lineWidth=2;c.strokeRect(px+2,py+2,w-4,h-4);
      for(let i=0;i<3;i++)for(let j=0;j<3;j++){const x=px+22+i*42,y=py+20+j*40;
        c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(x+3,y+5,11,8,0,0,7);c.fill();
        if(bare){ c.strokeStyle='#4a3420'; c.lineWidth=2; c.beginPath(); for(let k=0;k<5;k++){ c.moveTo(x,y); c.lineTo(x+Math.cos(k*1.3)*10,y+Math.sin(k*1.3)*10); } c.stroke(); continue; }
        c.fillStyle='#2f5a22';c.beginPath();c.arc(x,y,11,0,7);c.fill();
        c.fillStyle='#3e7330';c.beginPath();c.arc(x-2,y-2,7,0,7);c.fill();
        c.fillStyle='#d0402e';for(let k=0;k<4;k++){c.beginPath();c.arc(x-6+((k*7)%12),y-5+((k*5)%10),1.8,0,7);c.fill();}}
      break; }
    case 'wheatfarm': { const bare=G&&G.snow>.5; field(c,px,py,w,h,bare?'#6a5a3a':'#7a6a34',bare?'#7a6a4a':'#d8b450','#8a6a42'); house(c,px+w-34,py+h-30,30,26,'#7c5a3a','#b8914f'); break; }
    case 'hopsfarm': { const bare=G&&G.snow>.5; field(c,px,py,w,h,bare?'#5a5a3a':'#4a5a2a',bare?'#6a6a4a':'#7aa83a','#8a6a42'); for(let i=10;i<w-30;i+=14){c.fillStyle='#5a3a20';c.fillRect(px+i,py+6,2,h-12);} house(c,px+w-34,py+h-30,30,26,'#7c5a3a','#8f5a33'); break; }
    case 'dairy':{
      c.fillStyle='#5f7a34';c.fillRect(px+2,py+2,w-4,h-4); c.strokeStyle='#8a6a42';c.lineWidth=2;c.strokeRect(px+2,py+2,w-4,h-4);
      for(const [x,y] of [[22,24],[52,40],[30,62]]){ c.fillStyle='#f2efe6';c.beginPath();c.ellipse(px+x,py+y,9,5,0,0,7);c.fill(); c.fillStyle='#2a2420';c.beginPath();c.arc(px+x-3,py+y-1,2.5,0,7);c.arc(px+x+4,py+y+1,2,0,7);c.fill(); c.fillStyle='#f2efe6';c.beginPath();c.arc(px+x+10,py+y-1,3,0,7);c.fill(); }
      house(c,px+w-32,py+4,28,24,'#7c5a3a','#b8914f'); break;}
    case 'hunter': house(c,px,py,w,h,'#5e4a2a','#6b5a2a'); c.fillStyle='#e8dcc4';c.beginPath();c.moveTo(px+w/2-8,py+12);c.lineTo(px+w/2,py+18);c.lineTo(px+w/2+8,py+12);c.lineTo(px+w/2,py+22);c.closePath();c.fill(); break;
    case 'mill':{
      house(c,px,py,w,h,'#c8b89a','#8f5a33');
      const a=t/700, cx=px+w/2, cy=py+h*.35;
      c.strokeStyle='#5a3a20';c.lineWidth=3;for(let k=0;k<4;k++){c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a+k*Math.PI/2)*26,cy+Math.sin(a+k*Math.PI/2)*26);c.stroke();}
      c.fillStyle='#efe6d4';for(let k=0;k<4;k++){const an=a+k*Math.PI/2;c.save();c.translate(cx+Math.cos(an)*16,cy+Math.sin(an)*16);c.rotate(an);c.fillRect(-9,-3,18,6);c.restore();}
      break;}
    case 'bakery': house(c,px,py,w,h,'#a87a4a','#7d3b2a'); c.fillStyle='#e8b57a';c.beginPath();c.ellipse(px+w/2,py+16,9,5,0,0,7);c.fill(); break;
    case 'brewery': house(c,px,py,w,h,'#7a5a3a','#5c4a2a'); c.fillStyle='#7a4a24';c.beginPath();c.arc(px+w-10,py+h-10,6,0,7);c.fill();c.fillStyle='#b07a2a';c.fillRect(px+w-16,py+h-11,12,2); break;
    case 'inn':{
      house(c,px,py,w,h,'#8a6a42','#7d3b2a');
      c.fillStyle='#3a2a1a';c.fillRect(px+w-18,py+h-34,2,14);c.fillStyle='#d6a03c';c.fillRect(px+w-26,py+h-30,14,10);c.fillStyle='#7a4a24';c.fillRect(px+w-22,py+h-28,6,6);
      break;}
    case 'hovel': house(c,px,py,w,h,'#7c5a3a','#b8914f'); break;
    case 'chapel': house(c,px,py,w,h,'#a39d8f','#55606b'); c.fillStyle='#e9dcb9';c.fillRect(px+w/2-1.5,py+8,3,14);c.fillRect(px+w/2-5,py+12,10,3); break;
    case 'cathedral':{
      c.fillStyle='rgba(0,0,0,.35)';c.fillRect(px+10,py+12,w-6,h-6);
      c.fillStyle='#b3ab98';c.fillRect(px+10,py+30,w-20,h-34);
      c.fillStyle='#4e5864';c.fillRect(px+6,py+26,w-12,h*.55);
      c.fillStyle='rgba(255,255,255,.12)';c.fillRect(px+6,py+26,(w-12)/2,h*.55);
      c.fillStyle='#4e5864';c.fillRect(px,py+h*.42,w,30);
      c.fillStyle='rgba(255,255,255,.12)';c.fillRect(px,py+h*.42,w,4);
      c.fillStyle='#b3ab98';c.fillRect(px+w/2-18,py,36,36);
      c.fillStyle='#4e5864';c.beginPath();c.moveTo(px+w/2-20,py+8);c.lineTo(px+w/2,py-22);c.lineTo(px+w/2+20,py+8);c.closePath();c.fill();
      c.fillStyle='#e9dcb9';c.fillRect(px+w/2-1.5,py-34,3,14);c.fillRect(px+w/2-5,py-30,10,3);
      c.fillStyle='#2a2f3a';c.beginPath();c.arc(px+w/2,py+22,7,0,7);c.fill();
      for(let k=0;k<6;k++){c.fillStyle=['#b23c2c','#3f74c2','#d6a03c'][k%3];c.beginPath();c.arc(px+w/2,py+22,5,k*Math.PI/3,(k+1)*Math.PI/3);c.lineTo(px+w/2,py+22);c.fill();}
      c.fillStyle='#24180e';c.fillRect(px+w/2-6,py+h-14,12,12);
      break;}
    case 'joustfield':{
      c.fillStyle='#c8b080';c.fillRect(px+2,py+8,w-4,h-16);
      c.strokeStyle='#8a6a42';c.lineWidth=2;c.strokeRect(px+2,py+8,w-4,h-16);
      c.fillStyle='#e6d6b0';c.fillRect(px+10,py+h/2-2,w-20,4); c.fillStyle='#8a2a20';for(let i=12;i<w-12;i+=16) c.fillRect(px+i,py+h/2-2,8,4);
      for(const yy of [py,py+h-10]){ c.fillStyle='#6b4a2b';c.fillRect(px+20,yy,w-40,10); c.fillStyle=yy===py?'#3f74c2':'#b23c2c'; for(let i=20;i<w-24;i+=12){ c.fillRect(px+i,yy,6,10); } }
      flag(c,px+8,py-6,C.ally,14); flag(c,px+w-10,py-6,'#d6a03c',14);
      break;}
    case 'well': c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.arc(px+18,py+19,12,0,7);c.fill(); c.fillStyle='#958f82';c.beginPath();c.arc(px+16,py+16,12,0,7);c.fill(); c.fillStyle='#2f5a78';c.beginPath();c.arc(px+16,py+16,7,0,7);c.fill(); c.strokeStyle='#5a3a20';c.lineWidth=2;c.beginPath();c.moveTo(px+4,py+16);c.lineTo(px+28,py+16);c.stroke(); break;
    case 'latrine': house(c,px+4,py+2,24,28,'#6b4a2b','#5e3e22'); break;
    case 'ratcatcher': house(c,px,py,w,h,'#6b5a3a','#6b5a2a'); c.fillStyle='#3a3530';c.beginPath();c.ellipse(px+w/2,py+16,6,4,0,0,7);c.fill();c.strokeStyle='#3a3530';c.lineWidth=1.5;c.beginPath();c.moveTo(px+w/2+6,py+16);c.quadraticCurveTo(px+w/2+12,py+12,px+w/2+14,py+18);c.stroke(); break;
    case 'guardpost':{
      c.fillStyle='rgba(0,0,0,.3)';c.fillRect(px+8,py+9,w-8,h-8);
      c.fillStyle='#6b4a2b';c.fillRect(px+4,py+4,w-8,h-8); c.fillStyle='#86603a';c.fillRect(px+10,py+10,w-20,h-20);
      flag(c,px+w/2,py-6,C.ally,16);
      break;}
    case 'stocks': c.fillStyle='rgba(0,0,0,.3)';c.fillRect(px+8,py+18,20,8); c.fillStyle='#7a5230';c.fillRect(px+4,py+12,24,8);c.fillRect(px+6,py+20,3,10);c.fillRect(px+23,py+20,3,10); c.fillStyle='#2a1a10';for(const x of [10,16,22]){c.beginPath();c.arc(px+x,py+16,2,0,7);c.fill();} break;
    case 'gaol': stoneBox(c,px,py,w,h); c.strokeStyle='#2a2622';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(px+16+i*8,py+18);c.lineTo(px+16+i*8,py+h-14);c.stroke();} break;
    case 'gallows':{
      c.fillStyle='rgba(0,0,0,.3)';c.fillRect(px+10,py+14,w-10,h-14);
      c.fillStyle='#6b4a2b';c.fillRect(px+6,py+20,w-12,h-26); c.fillStyle='#86603a';c.fillRect(px+8,py+22,w-16,h-30);
      c.fillStyle='#4a3420';c.fillRect(px+14,py+2,5,h-10);c.fillRect(px+14,py+2,w-26,5);
      c.strokeStyle='#c8b48a';c.lineWidth=1.3;c.beginPath();c.moveTo(px+w-16,py+7);c.lineTo(px+w-16,py+20);c.stroke();c.beginPath();c.arc(px+w-16,py+23,3,0,7);c.stroke();
      break;}
    case 'rack':{
      c.fillStyle='rgba(0,0,0,.3)';c.fillRect(px+10,py+12,w-10,h-14);
      c.fillStyle='#5e3e22';c.fillRect(px+8,py+16,w-16,h-26);
      c.fillStyle='#86603a';for(let i=0;i<4;i++) c.fillRect(px+10+i*12,py+18,8,h-30);
      c.strokeStyle='#3a2a1a';c.lineWidth=3;c.beginPath();c.arc(px+14,py+h/2+3,8,0,7);c.stroke();c.beginPath();c.arc(px+w-14,py+h/2+3,8,0,7);c.stroke();
      const a=t/900; c.lineWidth=1.5; for(const cx of [px+14,px+w-14]){ c.beginPath(); for(let k=0;k<4;k++){ c.moveTo(cx,py+h/2+3); c.lineTo(cx+Math.cos(a+k*1.57)*8,py+h/2+3+Math.sin(a+k*1.57)*8);} c.stroke(); }
      break;}
    case 'fletcher':
      house(c,px,py,w,h,'#6b4a2b','#7d3b2a');
      c.strokeStyle='#e0b070';c.lineWidth=2;c.beginPath();c.arc(px+w/2-8,py+18,10,-1.1,1.1);c.stroke(); break;
    case 'poleturner':
      house(c,px,py,w,h,'#6b4a2b','#5c4a2a');
      c.strokeStyle='#c8a070';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.moveTo(px+w-6-i*5,py+h-2);c.lineTo(px+w-14-i*5,py+h-30);c.stroke();} break;
    case 'blacksmith':
      house(c,px,py,w,h,'#5a544b','#3d3a36');
      c.fillStyle='#2a2622';c.fillRect(px+w-18,py+h-12,12,6);c.fillRect(px+w-14,py+h-8,4,6);
      if(G&&G.parts&&b.worker&&b.worker.work&&rand()<.3) G.parts.push({x:b.x+b.w-.4,y:b.y+.4,vx:(rand()-.5)*.3,vy:-1,life:1,max:1,c:'rgba(70,65,60,.5)',s:4,smoke:true});
      break;
    case 'armourer': house(c,px,py,w,h,'#5a544b','#55606b'); c.fillStyle='#c8ccd0';c.beginPath();c.moveTo(px+w/2-7,py+10);c.lineTo(px+w/2+7,py+10);c.lineTo(px+w/2+5,py+24);c.lineTo(px+w/2-5,py+24);c.closePath();c.fill(); break;
    case 'etent': tent(c,px,py,w,h,'#8a2a20','#5a1810'); break;
    case 'eworkshop': tent(c,px,py,w,h,'#5a4a3a','#3a2a20'); c.strokeStyle='#2a1a10';c.lineWidth=3;c.beginPath();c.moveTo(px+10,py+h-6);c.lineTo(px+w-10,py+16);c.stroke(); break;
    case 'epavilion':{
      tent(c,px,py,w,h,'#7a1a14','#4a0e0a');
      c.fillStyle='#8a8a8a'; c.fillRect(px+w/2-5,py+h/2,10,6);
      flag(c,px+w/2,py-12,'#8a8a8a',18);
      break;}
  }
  if(b.team===1 && !d.castle && !d.isKeep && !d.enemy && d.w>1) flag(c,px+w-8,py-6,bannerCol(b),12);
  if(b.fire>0){
    for(let k=0;k<Math.min(6,b.w*b.h);k++){
      const r=mulberry(b.id*13+k); const fx=px+r()*w, fy=py+r()*h; const fl=Math.sin(t/80+k)*3;
      c.fillStyle='rgba(240,120,30,.85)';c.beginPath();c.moveTo(fx-6,fy+4);c.quadraticCurveTo(fx,fy-14-fl,fx+6,fy+4);c.fill();
      c.fillStyle='rgba(255,220,90,.9)';c.beginPath();c.moveTo(fx-3,fy+4);c.quadraticCurveTo(fx,fy-6-fl,fx+3,fy+4);c.fill();
    }
  }
}
function estateCol(e){ if(e.owner===1) return C.ally; if(e.owner===2){ const a=G.ais.find(a=>a.id===e.ai); return a?a.color:C.foe; } return '#e8dcc4'; }
function drawEstate(c,e){
  const px=e.x*T, py=e.y*T, col=estateCol(e);
  c.save(); c.globalAlpha=.3; c.strokeStyle=e.owner?col:'#d8c497'; c.lineWidth=2; c.setLineDash([5,5]); c.beginPath(); c.arc(px,py,3.2*T,0,7); c.stroke(); c.restore();
  house(c,px-40,py-10,30,26,'#7c5a3a','#b8914f'); house(c,px+8,py-26,30,26,'#7c5a3a','#8f5a33'); house(c,px-8,py+12,34,28,'#a39d8f','#55606b');
  flag(c,px,py-44,col,30);
  c.fillStyle='rgba(20,12,8,.78)';c.font='bold 12px "Alegreya Sans",sans-serif';c.textAlign='center';c.textBaseline='middle';
  const own=e.owner===1?'':e.owner===2?` (${(G.ais.find(a=>a.id===e.ai)||{name:'enemy'}).name})`:' (unclaimed)';
  const label=e.name+own; const tw=c.measureText(label).width+10; c.fillRect(px-tw/2,py+44,tw,16);
  c.fillStyle=e.owner===1?'#bcd6ff':e.owner===2?'#ffc7b8':'#f2e6c4'; c.fillText(label,px,py+52);
  if(e.claim>0&&e.claim<8){ c.fillStyle='rgba(0,0,0,.6)';c.fillRect(px-22,py+62,44,5); c.fillStyle=e.owner===2||e.claimBy===2?col:C.ally;c.fillRect(px-22,py+62,44*e.claim/8,5); }
  if(e.owner===1){ const n=Object.values(e.store).reduce((a,b)=>a+b,0); if(n){ c.fillStyle='#e8c76a'; c.fillRect(px+22,py+30,8,6); c.fillStyle='#6b4a2b'; c.fillRect(px+22,py+36,8,2); } }
}
function drawWagon(c,u,px,py,covered,cargo){
  c.save(); c.translate(px,py); c.rotate(u.face);
  c.fillStyle='rgba(0,0,0,.3)'; c.fillRect(-14,-6,30,15);
  c.fillStyle='#3a2a1a'; for(const wx of [-10,4]) for(const wy of [-8,6]) c.fillRect(wx,wy,6,3);
  c.fillStyle='#7a5230'; c.fillRect(-14,-7,20,14);
  if(covered){ c.fillStyle='#e8dcc4'; c.fillRect(-13,-8,18,16); c.fillStyle='rgba(0,0,0,.12)'; for(let k=-10;k<5;k+=5) c.fillRect(k,-8,1.5,16); }
  else if(cargo){ let i=0; for(const k in cargo){ c.fillStyle=CARRY_COL[k]||'#c8ccd0'; c.fillRect(-12+(i%3)*6,-5+((i/3)|0)*6,5,5); i++; } }
  c.fillStyle='#5a3a20'; c.fillRect(6,-1,8,2);
  c.fillStyle='#6a4a2a'; c.beginPath(); c.ellipse(17,0,6,4,0,0,7); c.fill(); c.fillStyle='#4a3420'; c.beginPath(); c.arc(23,0,2.6,0,7); c.fill();
  if(u.hitT>0){c.fillStyle='rgba(255,255,255,.35)';c.fillRect(-15,-9,40,18);}
  c.restore();
  c.fillStyle=C.ally; c.fillRect(px-2,py-14,4,5);
}
function drawUnit(c,u){
  const e=u.el||0;
  const px=u.x*T, py=u.y*T-(e?6:0)-(e>=2?3:0);
  const bob=u.moving?Math.sin(u.walk*14)*1.2:(u.work?Math.sin(performance.now()/90)*1:0);
  if(u.fade>0) c.globalAlpha=Math.max(0,1-u.fade);
  const team0=u.team===0, d=u.def, [tc1,tc2]=teamCols(u);
  if(d.cart){ drawWagon(c,u,px,py,d.caravan,u.cargo); if(u.sel){c.strokeStyle='#f2d36b';c.lineWidth=1.5;c.beginPath();c.ellipse(px,py+3,20,12,0,0,7);c.stroke();} c.globalAlpha=1; return; }
  if(d.big){ drawEngine(c,u,px,py,tc1,tc2,team0); c.globalAlpha=1; return; }
  if(u.kind==='deer'||u.kind==='wolf'){
    c.save();c.translate(px,py);c.rotate(u.face);
    c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(1,3,8,4,0,0,7);c.fill();
    c.fillStyle=u.kind==='deer'?'#9a6a3a':'#6e6a64';c.beginPath();c.ellipse(0,0,8,4,0,0,7);c.fill();
    c.beginPath();c.ellipse(8,-1,3.5,2.5,0,0,7);c.fill();
    if(u.kind==='deer'){c.fillStyle='#e8dcc4';c.beginPath();c.arc(-7,0,1.6,0,7);c.fill();c.strokeStyle='#5a3a20';c.lineWidth=1;c.beginPath();c.moveTo(9,-2);c.lineTo(11,-6);c.moveTo(9,-2);c.lineTo(7,-6);c.stroke();}
    else {c.fillStyle='#4a4642';c.beginPath();c.moveTo(-8,0);c.lineTo(-13,-2);c.lineTo(-8,2);c.fill();}
    if(u.hitT>0){c.fillStyle='rgba(255,255,255,.5)';c.beginPath();c.ellipse(0,0,8,4,0,0,7);c.fill();}
    c.restore(); c.globalAlpha=1; return;
  }
  if(u.kind==='rat'){ c.fillStyle='#2e2a26';c.beginPath();c.ellipse(px,py,3.5,2.2,u.face,0,7);c.fill(); c.strokeStyle='#2e2a26';c.lineWidth=.8;c.beginPath();c.moveTo(px-Math.cos(u.face)*3,py-Math.sin(u.face)*3);c.lineTo(px-Math.cos(u.face)*7,py-Math.sin(u.face)*7+1);c.stroke(); c.globalAlpha=1; return; }
  const boss=u.kind==='warlord'||u.kind==='rothgar'||u.kind==='elord';
  const sc=(boss?1.32:u.kind==='lord'?1.18:1)*1.12, r=6*sc;
  c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(u.x*T+2,u.y*T+4,(d.cav?11:7)*sc,(d.cav?6:4.2)*sc,0,0,7);c.fill();
  if(u.sel){c.strokeStyle='#f2d36b';c.lineWidth=1.5;c.beginPath();c.ellipse(px,py+3,r+(d.cav?8:4),r*.8+(d.cav?5:2),0,0,7);c.stroke();}
  if(boss||u.kind==='lord'){ c.strokeStyle=u.kind==='lord'?'rgba(210,170,255,.5)':'rgba(255,120,90,.45)'; c.lineWidth=1; c.beginPath(); c.ellipse(px,py+3,r+7,r*.8+5,0,0,7); c.stroke(); }
  drawFigure(c,u,px,py+bob,sc,tc1,tc2,team0);
  if(u.carry){c.fillStyle=u.kind==='thief'?'#8a7a5a':(CARRY_COL[u.carry.k]||'#c8ccd0');c.fillRect(px-3.5,py-r-8+bob,7,5);c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=.8;c.strokeRect(px-3.5,py-r-8+bob,7,5);}
  if(u.squad && u.sel){c.fillStyle='#1a120b';c.beginPath();c.arc(px+7,py-r-3,5,0,7);c.fill();c.fillStyle='#f2d36b';c.font='bold 8px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(u.squad,px+7,py-r-2.5);}
  if(u.lordName){ c.font='bold 10px "Alegreya Sans",sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillStyle='rgba(0,0,0,.55)'; const tw=c.measureText(u.lordName).width+8; c.fillRect(px-tw/2,py+r+5,tw,13); c.fillStyle='#ffd9c8'; c.fillText(u.lordName,px,py+r+11.5); }
  c.globalAlpha=1;
}

/* ---------- soldiers, seen from above: legs, tabard in the lord's colors, helm, weapon, shield ---------- */
const HELM={archer:'hood',earcher:'hood',xbow:'cap',exbow:'kettle',spearman:'kettle',pikeman:'kettle',maceman:'nasal',swordsman:'great',knight:'great',eknight:'great',eswords:'great',raider:'bare',ladder:'bare',pladder:'cap',engineer:'cap',monk:'tonsure',peasant:'hair',thief:'hood',lord:'crown',elord:'crown',warlord:'horned',rothgar:'horned'};
const METAL={swordsman:1,knight:1,eswords:1,eknight:1,lord:1,elord:1,warlord:1,rothgar:1,maceman:.6,pikeman:.6,xbow:.4,exbow:.4};
function tint(hex,k){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255; const f=v=>Math.max(0,Math.min(255,Math.round(k>1?v+(255-v)*(k-1):v*k))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function drawFigure(c,u,px,py,sc,tc1,tc2,team0){
  const k=u.kind, d=u.def, walk=u.moving?Math.sin(u.walk*14):0, str=u.strike>0?Math.min(1,u.strike/.15):0;
  const civ=k==='peasant'||k==='thief'||k==='monk'||k==='engineer';
  const cloth=k==='peasant'?'#a88a5c':k==='thief'?'#3e3a36':k==='monk'?'#6b4a2b':k==='engineer'?'#b8742a':tc1;
  const clothD=k==='peasant'?'#6b5434':k==='thief'?'#1e1b18':k==='monk'?'#3e2a18':k==='engineer'?'#7a4a14':tc2;
  const metal=METAL[k]||0, steel=team0?'#9aa2aa':'#7d7468';
  c.save(); c.translate(px,py); c.rotate(u.face); c.scale(sc,sc); c.lineCap='round'; c.lineJoin='round';
  if(d.cav) drawHorse(c,u,walk,tc1,tc2);
  else { c.fillStyle='#2e241a'; c.beginPath(); c.ellipse(walk*2.4,2.4,2,1.4,0,0,7); c.ellipse(-walk*2.4,-2.4,2,1.4,0,0,7); c.fill(); }
  if(k==='lord'||k==='elord'||k==='warlord'||k==='rothgar'){ c.fillStyle=k==='lord'?'#5a2a7a':k==='rothgar'?'#4a4a46':tc2; c.beginPath(); c.moveTo(.5,-5.6); c.quadraticCurveTo(-9-walk*1.5,0,.5,5.6); c.closePath(); c.fill(); }
  if(k==='archer'||k==='earcher'){ c.fillStyle='#5a3a20'; c.fillRect(-5.2,-3.6,4.4,2.6); c.fillStyle='#efe6cc'; for(let i=0;i<3;i++) c.fillRect(-6.2,-3.4+i*.8,1.2,.6); }
  if((k==='ladder'||k==='pladder')&&!u.placed){ c.strokeStyle='#8a6a42'; c.lineWidth=1.4; c.beginPath(); c.moveTo(-9,-3.2); c.lineTo(11,-3.2); c.moveTo(-9,3.2); c.lineTo(11,3.2); c.stroke(); c.lineWidth=1; c.beginPath(); for(let x=-7;x<11;x+=3.5){ c.moveTo(x,-3.2); c.lineTo(x,3.2); } c.stroke(); }
  /* torso: a mail or plate shell under the tabard */
  c.fillStyle=metal?tint(steel,.7):clothD; c.beginPath(); c.ellipse(0,0,3.9,5.8,0,0,7); c.fill();
  c.fillStyle=u.hitT>0?'#ffffff':metal>=1?steel:cloth; c.beginPath(); c.ellipse(0,0,3.3,5.1,0,0,7); c.fill();
  if(metal>=1&&u.hitT<=0){ c.fillStyle=cloth; c.beginPath(); c.ellipse(-.4,0,2.5,3.6,0,0,7); c.fill(); c.fillStyle=clothD; c.fillRect(-2.6,-.55,4.6,1.1); }
  else if(!civ&&u.hitT<=0){ c.fillStyle=clothD; c.fillRect(-2.8,-.55,5,1.1); if(metal){ c.strokeStyle=tint(steel,1.1); c.lineWidth=.7; c.beginPath(); c.ellipse(0,0,3.3,5.1,0,-1.2,1.2); c.stroke(); } }
  if(k==='monk'){ c.strokeStyle='#d8c08a'; c.lineWidth=.8; c.beginPath(); c.moveTo(-3,0); c.lineTo(2.5,0); c.stroke(); }
  /* arms */
  c.fillStyle=metal>=1?tint(steel,.85):clothD; c.beginPath(); c.arc(1.2,4.6,1.5,0,7); c.arc(1.2,-4.6,1.5,0,7); c.fill();
  drawArms(c,u,k,str,steel,tc1,tc2,team0);
  /* head and helm */
  const hx=.7; c.fillStyle='#e2bd8f'; c.beginPath(); c.arc(hx,0,2.7,0,7); c.fill();
  const h=HELM[k]||'bare';
  if(h==='hood'){ c.fillStyle=k==='thief'?'#1e1b18':team0?'#3e5a2a':'#4a3a2a'; c.beginPath(); c.arc(hx-.4,0,3,Math.PI*.35,Math.PI*1.65); c.lineTo(hx-4.2,0); c.closePath(); c.fill(); }
  else if(h==='cap'){ c.fillStyle='#6b4a2b'; c.beginPath(); c.arc(hx-.3,0,2.8,0,7); c.fill(); c.fillStyle='#8a6a42'; c.fillRect(hx-.6,-2.6,.9,5.2); }
  else if(h==='kettle'){ c.fillStyle=tint(steel,.8); c.beginPath(); c.arc(hx,0,4,0,7); c.fill(); c.fillStyle=steel; c.beginPath(); c.arc(hx,0,2.6,0,7); c.fill(); c.fillStyle='rgba(255,255,255,.35)'; c.beginPath(); c.arc(hx-.6,-.8,1,0,7); c.fill(); }
  else if(h==='nasal'){ c.fillStyle=steel; c.beginPath(); c.arc(hx,0,2.95,0,7); c.fill(); c.strokeStyle=tint(steel,.7); c.lineWidth=1; c.beginPath(); c.moveTo(hx+1.5,0); c.lineTo(hx+3.9,0); c.stroke(); c.fillStyle='rgba(255,255,255,.3)'; c.beginPath(); c.arc(hx-.7,-.9,.9,0,7); c.fill(); }
  else if(h==='great'){ c.fillStyle=tint(steel,.8); c.beginPath(); c.roundRect?c.roundRect(hx-2.9,-2.9,5.8,5.8,1.6):c.rect(hx-2.9,-2.9,5.8,5.8); c.fill(); c.fillStyle=steel; c.fillRect(hx-2.2,-2.2,4.4,4.4); c.strokeStyle='#1d1a17'; c.lineWidth=.9; c.beginPath(); c.moveTo(hx+2.3,-1.7); c.lineTo(hx+2.3,1.7); c.stroke(); if(k==='knight'||k==='eknight'){ c.fillStyle=tc1; c.fillRect(hx-3.4,-.7,2.2,1.4); } }
  else if(h==='bare'){ c.fillStyle='#4a3020'; c.beginPath(); c.arc(hx-.7,0,2.6,Math.PI*.4,Math.PI*1.6); c.fill(); }
  else if(h==='hair'){ c.fillStyle='#6b4a2b'; c.beginPath(); c.arc(hx-.6,0,2.6,Math.PI*.45,Math.PI*1.55); c.fill(); if(u.work&&!u.wintering){ c.fillStyle='#d8bd6a'; c.beginPath(); c.arc(hx,0,3.6,0,7); c.fill(); c.fillStyle='#bfa050'; c.beginPath(); c.arc(hx,0,2,0,7); c.fill(); } }
  else if(h==='tonsure'){ c.fillStyle='#5a3a20'; c.beginPath(); c.arc(hx,0,2.8,0,7); c.fill(); c.fillStyle='#e2bd8f'; c.beginPath(); c.arc(hx,0,1.5,0,7); c.fill(); }
  else if(h==='crown'){ c.fillStyle=k==='lord'?'#4a3020':tint(steel,.8); c.beginPath(); c.arc(hx-.3,0,2.7,0,7); c.fill(); c.strokeStyle=C.gold; c.lineWidth=1.2; c.beginPath(); c.arc(hx,0,2.4,0,7); c.stroke(); c.fillStyle=C.gold; for(let i=0;i<5;i++){ const a=i/5*6.283; c.beginPath(); c.arc(hx+Math.cos(a)*2.9,Math.sin(a)*2.9,.75,0,7); c.fill(); } }
  else if(h==='horned'){ c.fillStyle='#3a3632'; c.beginPath(); c.arc(hx,0,3.1,0,7); c.fill(); c.strokeStyle='#e8e0cc'; c.lineWidth=1.3; c.beginPath(); c.moveTo(hx,-2.6); c.quadraticCurveTo(hx-1,-5.6,hx+2,-6.2); c.moveTo(hx,2.6); c.quadraticCurveTo(hx-1,5.6,hx+2,6.2); c.stroke(); }
  if(u.hitT>0){ c.fillStyle='rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(0,0,4.5,6,0,0,7); c.fill(); }
  c.restore();
}
/* what each soldier carries, in his own frame: x points the way he faces, y is his right hand */
function drawArms(c,u,k,str,steel,tc1,tc2,team0){
  const sw=str?(1-str)*2.1-1.1:.45;            // a sword or mace swings across his front
  const blade=(len,w,col)=>{ const ex=1.4+Math.cos(sw)*len, ey=4.6+Math.sin(sw)*len*.9; c.strokeStyle=col; c.lineWidth=w; c.beginPath(); c.moveTo(1.4,4.6); c.lineTo(ex,ey); c.stroke(); return [ex,ey]; };
  const shield=(kind)=>{ c.save(); c.translate(2.2,-5); c.fillStyle=tint(tc2,.9); c.strokeStyle='#2a1f15'; c.lineWidth=.7;
    if(kind==='round'){ c.beginPath(); c.arc(0,0,3.2,0,7); c.fill(); c.stroke(); c.fillStyle=tc1; c.beginPath(); c.arc(0,0,2.3,0,7); c.fill(); c.fillStyle='#c8ccd0'; c.beginPath(); c.arc(0,0,.9,0,7); c.fill(); }
    else { c.beginPath(); c.moveTo(-1,-3.4); c.lineTo(2.6,-3.4); c.lineTo(2.6,1); c.quadraticCurveTo(2.6,3.2,.8,4.2); c.quadraticCurveTo(-1,3.2,-1,1); c.closePath(); c.fillStyle=tc1; c.fill(); c.stroke(); c.fillStyle=tc2; c.fillRect(.4,-3.4,.9,7); }
    c.restore(); };
  if(k==='swordsman'||k==='eswords'||k==='knight'||k==='eknight'||k==='lord'||k==='elord'){
    const [ex,ey]=blade(k==='lord'||k==='elord'?10:9,1.5,'#e6e9ec'); c.strokeStyle='#8a6a2a'; c.lineWidth=1.3; const gx=1.4+Math.cos(sw)*2, gy=4.6+Math.sin(sw)*1.8; c.beginPath(); c.moveTo(gx-Math.sin(sw)*1.6,gy+Math.cos(sw)*1.6); c.lineTo(gx+Math.sin(sw)*1.6,gy-Math.cos(sw)*1.6); c.stroke();
    shield(k==='swordsman'||k==='eswords'||k==='lord'?'heater':'heater'); }
  else if(k==='maceman'||k==='raider'||k==='warlord'||k==='rothgar'){
    const big=k==='warlord'||k==='rothgar'; const [ex,ey]=blade(big?11:8,1.4,'#6b4a2b');
    if(k==='raider'){ c.fillStyle='#b9bec2'; c.beginPath(); c.moveTo(ex,ey); c.lineTo(ex-1.5+Math.cos(sw+1.6)*3.2,ey+Math.sin(sw+1.6)*3.2); c.lineTo(ex+1.5+Math.cos(sw+1.6)*3.2,ey+Math.sin(sw+1.6)*3.2); c.closePath(); c.fill(); }
    else { c.fillStyle='#8c939a'; c.beginPath(); c.arc(ex,ey,big?3:2.2,0,7); c.fill(); c.fillStyle='#5a5f64'; for(let i=0;i<4;i++){ const a=i*1.57+sw; c.fillRect(ex+Math.cos(a)*2-0.6,ey+Math.sin(a)*2-0.6,1.2,1.2); } }
    if(k==='raider') shield('round'); }
  else if(k==='spearman'||k==='pikeman'||k==='ladder'&&false){
    const L=k==='pikeman'?21:13, th=str?(1-str)*3:0; c.strokeStyle='#8a6a42'; c.lineWidth=1.3; c.beginPath(); c.moveTo(-6+th,3.6); c.lineTo(L+th,3.6); c.stroke();
    c.fillStyle='#d8dde0'; c.beginPath(); c.moveTo(L+th+3,3.6); c.lineTo(L+th,2.4); c.lineTo(L+th,4.8); c.closePath(); c.fill(); shield(k==='pikeman'?'heater':'round'); }
  else if(k==='archer'||k==='earcher'){
    c.strokeStyle='#b07a3a'; c.lineWidth=1.4; c.beginPath(); c.arc(1.5,0,6.2,-1.15,1.15); c.stroke();
    const draw=u.cd>0&&u.cd<.5?0:1.6; c.strokeStyle='rgba(240,232,210,.9)'; c.lineWidth=.5; c.beginPath(); c.moveTo(1.5+Math.cos(1.15)*6.2,Math.sin(1.15)*6.2); c.lineTo(1.5-draw,0); c.lineTo(1.5+Math.cos(-1.15)*6.2,Math.sin(-1.15)*6.2); c.stroke();
    if(draw){ c.strokeStyle='#d8c8a0'; c.lineWidth=.7; c.beginPath(); c.moveTo(1.5-draw,0); c.lineTo(9,0); c.stroke(); } }
  else if(k==='xbow'||k==='exbow'){
    c.strokeStyle='#6b4a2b'; c.lineWidth=2.2; c.beginPath(); c.moveTo(-.5,1.2); c.lineTo(9,1.2); c.stroke();
    c.strokeStyle='#8c939a'; c.lineWidth=1.3; c.beginPath(); c.moveTo(7.5,-3.8); c.quadraticCurveTo(9.2,1.2,7.5,6.2); c.stroke(); c.strokeStyle='rgba(240,232,210,.8)'; c.lineWidth=.5; c.beginPath(); c.moveTo(7.5,-3.8); c.lineTo(5,1.2); c.lineTo(7.5,6.2); c.stroke(); }
  else if(k==='engineer'){ c.strokeStyle='#6b4a2b'; c.lineWidth=1.3; c.beginPath(); c.moveTo(1,4.6); c.lineTo(8,6.5); c.stroke(); c.fillStyle='#8c939a'; c.fillRect(7.2,4.8,3,3); if(u.fill!==undefined&&u.work){ c.fillStyle='#6b5a40'; c.fillRect(8,6,4,3); } }
  else if(k==='monk'){ c.strokeStyle='#7a5a32'; c.lineWidth=1.3; c.beginPath(); c.moveTo(-3,4.8); c.lineTo(10,4.8); c.stroke(); }
  else if(k==='thief'){ c.strokeStyle='#cfd3d6'; c.lineWidth=1; c.beginPath(); c.moveTo(1.4,4.6); c.lineTo(5,5.4); c.stroke(); }
  else if(k==='peasant'&&u.work&&!u.wintering){ const a=Math.sin(performance.now()/120)*.8; c.strokeStyle='#8a6a42'; c.lineWidth=1.2; c.beginPath(); c.moveTo(1.4,4.6); c.lineTo(1.4+Math.cos(a-.4)*7,4.6+Math.sin(a-.4)*7); c.stroke(); c.fillStyle='#cfd3d6'; c.beginPath(); c.arc(1.4+Math.cos(a-.4)*7,4.6+Math.sin(a-.4)*7,1.3,0,7); c.fill(); }
}
function drawHorse(c,u,walk,tc1,tc2){
  const coat=u.team===0?'#6a4a2a':'#4a3a30', gait=u.moving?Math.sin(u.walk*14):0;
  c.fillStyle='#2a1f15'; for(const [lx,ly,ph] of [[5,3.2,1],[5,-3.2,-1],[-6,3.2,-1],[-6,-3.2,1]]){ c.beginPath(); c.ellipse(lx+gait*ph*2,ly*1.15,1.6,1.1,0,0,7); c.fill(); }
  c.fillStyle=coat; c.beginPath(); c.ellipse(-.5,0,9.5,4.4,0,0,7); c.fill();
  c.beginPath(); c.ellipse(10,0,3.6,2.1,0,0,7); c.fill(); c.fillStyle='#2a1f15'; c.beginPath(); c.ellipse(7.5,0,2.4,1.2,0,0,7); c.fill();
  c.fillStyle='#1d1612'; c.beginPath(); c.moveTo(-10,0); c.lineTo(-13.5,-.8+gait*.6); c.lineTo(-13.5,.8+gait*.6); c.closePath(); c.fill();
  c.fillStyle=tc1; c.beginPath(); c.ellipse(-1.5,0,7.4,4.9,0,0,7); c.fill(); c.strokeStyle=tc2; c.lineWidth=1; c.stroke();
  c.fillStyle=tc2; c.fillRect(-7,-.6,11,1.2);
}
/* ---------- siege engines: heavy timber, hides against fire, iron where it hits ---------- */
function drawEngine(c,u,px,py,tc1,tc2,team0){
  const d=u.def;
  c.fillStyle='rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(px+3,py+5,18,11,0,0,7); c.fill();
  c.save(); c.translate(px,py); c.rotate(u.face); c.lineCap='round';
  const wheel=(x,y,r)=>{ c.fillStyle='#2a1f15'; c.beginPath(); c.ellipse(x,y,r,r*.45,0,0,7); c.fill(); c.fillStyle='#5a4028'; c.fillRect(x-r*.7,y-.6,r*1.4,1.2); };
  if(d.ram||u.kind==='ram'){
    for(const wx of [-9,7]) for(const wy of [-9.5,9.5]) wheel(wx,wy,3.4);
    c.fillStyle='#3a2a1a'; c.fillRect(-15,-8.5,29,17);
    const hit=u.strike>0?4:0;
    c.fillStyle='#4e4b45'; c.fillRect(8+hit,-2.2,9,4.4); c.fillStyle='#6e6a62'; c.beginPath(); c.moveTo(17+hit,-3.4); c.lineTo(20+hit,-2); c.lineTo(20+hit,2); c.lineTo(17+hit,3.4); c.closePath(); c.fill();
    c.fillStyle='#7a5a3a'; c.beginPath(); c.moveTo(-15,-8.5); c.lineTo(12,-8.5); c.lineTo(12,0); c.lineTo(-15,0); c.fill();
    c.fillStyle='#6a4c30'; c.beginPath(); c.moveTo(-15,0); c.lineTo(12,0); c.lineTo(12,8.5); c.lineTo(-15,8.5); c.fill();
    c.strokeStyle='#3a2a1a'; c.lineWidth=.8; c.beginPath(); for(let x=-12;x<12;x+=4){ c.moveTo(x,-8.5); c.lineTo(x,8.5); } c.stroke();
    c.fillStyle='rgba(140,110,70,.55)'; for(const [hx,hy,hw,hh] of [[-11,-7,7,5],[-1,-6,8,4],[-8,2,9,5],[3,3,7,4]]) c.fillRect(hx,hy,hw,hh);
    c.strokeStyle='#2a1f15'; c.lineWidth=1.2; c.beginPath(); c.moveTo(-15,0); c.lineTo(12,0); c.stroke();
    c.fillStyle=tc1; c.fillRect(-15,-8.5,4,3.5); c.fillStyle=tc2; c.fillRect(-15,-5,4,1.2);
  } else if(d.stower){
    for(const wx of [-11,9]) for(const wy of [-14,14]) wheel(wx,wy,3.6);
    c.fillStyle='#4a3420'; c.fillRect(-17,-15,32,30);
    c.fillStyle='#7a5530'; c.fillRect(-15,-13,28,26);
    c.strokeStyle='#4a3420'; c.lineWidth=1; c.beginPath(); for(let y=-11;y<13;y+=3.5){ c.moveTo(-15,y); c.lineTo(13,y); } c.stroke();
    c.fillStyle='rgba(150,118,74,.6)'; c.fillRect(-14,-12,12,10); c.fillRect(0,2,12,10);
    c.fillStyle='#5a3e22'; for(let i=-15;i<13;i+=5){ c.fillRect(i,-15,3,3); c.fillRect(i,12,3,3); } for(let j=-12;j<12;j+=5) c.fillRect(-17,j,3,3);
    if(u.docked){ c.fillStyle='#8a6438'; c.fillRect(14,-6,15,12); c.strokeStyle='#4a3420'; c.lineWidth=1; c.beginPath(); for(let x=17;x<29;x+=3){ c.moveTo(x,-6); c.lineTo(x,6); } c.stroke(); }
    else { c.fillStyle='#6a4a28'; c.fillRect(13,-6,3,12); }
    c.fillStyle='#2e2014'; c.fillRect(-14,-14,1.4,9); c.fillStyle=tc1; c.beginPath(); c.moveTo(-12.6,-14); c.lineTo(-6,-12.2); c.lineTo(-12.6,-10.4); c.fill();
  } else {
    const treb=u.kind==='etreb'||u.kind==='ptreb', fire=u.fireT>0;
    for(const wx of [-9,7]) for(const wy of [-10.5,10.5]) wheel(wx,wy,3.2);
    c.fillStyle='#4a3420'; c.fillRect(-14,-9.5,26,3); c.fillRect(-14,6.5,26,3); c.fillRect(-14,-9.5,3,19); c.fillRect(9,-9.5,3,19);
    c.fillStyle=team0?'#7a5a38':'#6a4a30'; c.fillRect(-11,-6.5,20,13);
    if(treb){ c.fillStyle='#3a2a1a'; c.fillRect(-3,-11,6,4); c.fillRect(-3,7,6,4);
      const a=fire?-.6:2.6; c.save(); c.rotate(a); c.fillStyle='#8a6a42'; c.fillRect(-7,-1.3,30,2.6); c.fillStyle='#4e4b45'; c.fillRect(-11,-4,6,8); c.strokeStyle='#cbb88a'; c.lineWidth=.7; c.beginPath(); c.moveTo(23,0); c.lineTo(27,fire?0:3); c.stroke(); c.restore(); }
    else { const a=fire?-1.1:.2; c.save(); c.translate(-6,0); c.rotate(a); c.fillStyle='#8a6a42'; c.fillRect(0,-1.4,20,2.8); c.fillStyle='#4a3420'; c.beginPath(); c.arc(20,0,3.4,0,7); c.fill(); if(!fire){ c.fillStyle='#7a776e'; c.beginPath(); c.arc(20,0,2.2,0,7); c.fill(); } c.restore();
      c.strokeStyle='#cbb88a'; c.lineWidth=1.2; c.beginPath(); c.moveTo(-8,-6.5); c.lineTo(-6,0); c.lineTo(-8,6.5); c.stroke(); }
    c.fillStyle=tc1; c.fillRect(-14,-9.5,4,3.5);
  }
  if(u.hitT>0){ c.fillStyle='rgba(255,255,255,.35)'; c.fillRect(-17,-15,32,30); }
  c.restore();
  if(u.sel){ c.strokeStyle='#f2d36b'; c.lineWidth=1.5; c.beginPath(); c.ellipse(px,py+3,20,13,0,0,7); c.stroke(); }
}
function hpBar(c,x,y,w,f,team){
  c.fillStyle='rgba(0,0,0,.6)';c.fillRect(x-1,y-1,w+2,5);
  c.fillStyle=f>.5?(team===1?'#e0604a':'#7bc04a'):f>.25?'#e0b13a':'#e0503a';c.fillRect(x,y,w*Math.max(0,f),3);
}
function ring(c,x,y,r,col){c.save();c.strokeStyle=col;c.lineWidth=1.5;c.setLineDash([6,6]);c.beginPath();c.arc(x*T,y*T,r*T,0,7);c.stroke();c.restore();}

/* ---------- court shows ---------- */
function drawShow(c){
  const s=G.show; if(!s||!s.b||s.b.dead) return;
  const t=G.time-s.t0, b=s.b, now=performance.now();
  if(s.kind==='joust'){
    const L=(b.w-1)*T, x0=b.x*T+T*.5, y=b.y*T+b.h*T/2, p=(t%4)/4, ease=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const ax=x0+L*ease, bx=x0+L*(1-ease);
    for(const [x,yy,col,dir] of [[ax,y-9,C.ally,1],[bx,y+9,'#b23c2c',-1]]){
      c.fillStyle='#6a4a2a';c.beginPath();c.ellipse(x,yy,11,5,0,0,7);c.fill(); c.fillStyle='#4a3420';c.beginPath();c.arc(x+dir*11,yy,3.2,0,7);c.fill();
      c.fillStyle=col;c.beginPath();c.ellipse(x,yy,7,4,0,0,7);c.fill(); c.fillStyle='#c8ccd0';c.beginPath();c.arc(x,yy-3,4,0,7);c.fill();
      c.strokeStyle='#e8dcc4';c.lineWidth=2;c.beginPath();c.moveTo(x-dir*4,yy-dir*0);c.lineTo(x+dir*20,yy+(dir>0?6:-6));c.stroke();
    }
    if(Math.abs(p-.5)<.03) for(let k=0;k<4;k++) G.parts.push({x:(b.x+b.w/2),y:b.y+b.h/2,vx:(rand()-.5)*4,vy:(rand()-.5)*4,life:.6,max:.6,c:'#e8dcc4',s:3});
  } else if(s.kind==='feast'){
    const x=b.x*T+b.w*T/2, y=(b.y+b.h)*T+20;
    for(const dy of [0,22]){ c.fillStyle='#6b4a2b'; c.fillRect(x-50,y+dy,100,10); for(let i=0;i<8;i++){ c.fillStyle=['#c43b2b','#e8c04a','#c08a4a','#a8443a'][i%4]; c.beginPath(); c.arc(x-44+i*12,y+dy+5,2.6,0,7); c.fill(); c.fillStyle=i%2?C.ally:'#a88a5c'; c.beginPath(); c.arc(x-44+i*12,y+dy-5+Math.sin(now/200+i)*1,3.4,0,7); c.fill(); c.beginPath(); c.arc(x-44+i*12,y+dy+15,3.4,0,7); c.fill(); } }
  } else {
    const x=b.x*T+b.w*T/2, y=(b.y+b.h)*T+44;
    c.fillStyle='#6b4a2b'; c.fillRect(x-2,y-30,4,34);
    const cols=['#b23c2c','#3f74c2','#d6a03c','#5a8a3a','#e8dcc4','#7a4fb0'];
    for(let k=0;k<6;k++){ const a=now/600+k*Math.PI/3, dx=Math.cos(a)*24, dy=Math.sin(a)*12; c.strokeStyle=cols[k]; c.lineWidth=1.5; c.beginPath(); c.moveTo(x,y-30); c.quadraticCurveTo(x+dx*.5,y-10,x+dx,y+dy); c.stroke(); c.fillStyle=k%2?C.ally:'#a88a5c'; c.beginPath(); c.arc(x+dx,y+dy,3.6,0,7); c.fill(); }
  }
  if(rand()<.3) G.parts.push({x:b.x+rand()*b.w,y:b.y+b.h+rand()*2,vx:(rand()-.5),vy:-1.2,life:1,max:1,c:['#d6a03c','#b23c2c','#3f74c2','#e8dcc4'][(rand()*4)|0],s:2});
}

/* ---------- atmosphere: water, clouds, snow, vignette ---------- */
let waterList=null, waterVer=-1;
function waterTiles(){ if(waterVer===terrVer&&waterList) return waterList; const a=[]; for(let i=0;i<N;i++){ const t=ter[i]; if(t===5||t===7) a.push(i); } waterList=a; waterVer=terrVer; return a; }
function drawWater(c,x0,y0,x1,y1){
  const now=performance.now()/1000, list=waterTiles(), frozen=G.snow>.7;
  if(frozen||!list.length) return;
  c.fillStyle='rgba(255,255,255,.13)';
  for(const i of list){ const x=i%W, y=(i/W)|0; if(x<x0||x>x1||y<y0||y>y1) continue;
    const ph=now*.9+x*.7+y*1.3, s=Math.sin(ph);
    if(s>.2) c.fillRect(x*T+6+((x*13+y*7)%14)+Math.sin(now+y)*3,y*T+8+((x*5+y*11)%16),8*s,1.4); }
}
let cloudSprite=null;
const clouds=[]; for(let i=0;i<5;i++) clouds.push({x:Math.random(),y:Math.random(),s:.7+Math.random()*.8});
function makeCloud(){
  const cc=document.createElement('canvas'); cc.width=cc.height=256; const x=cc.getContext('2d'); const r=mulberry(77);
  for(let k=0;k<9;k++){ const cx=60+r()*136, cy=70+r()*116, rr=40+r()*40; const g=x.createRadialGradient(cx,cy,0,cx,cy,rr); g.addColorStop(0,'rgba(10,16,24,.55)'); g.addColorStop(1,'rgba(10,16,24,0)'); x.fillStyle=g; x.fillRect(0,0,256,256); }
  return cc;
}
function drawClouds(c){
  if(!cloudSprite) cloudSprite=makeCloud();
  const t=performance.now()/1000, mw=W*T, mh=H*T;
  c.globalAlpha=.16;
  for(const cl_ of clouds){ const x=((cl_.x*mw+t*9*cl_.s)%(mw+600))-300, y=cl_.y*mh+Math.sin(t*.05+cl_.x*9)*40; const s=380*cl_.s; c.drawImage(cloudSprite,x-s/2,y-s/2,s,s*.7); }
  c.globalAlpha=1;
}
const flakes=[]; for(let i=0;i<160;i++) flakes.push({x:Math.random(),y:Math.random(),v:.4+Math.random()*.8,s:1+Math.random()*2.2,p:Math.random()*6});
function drawSnowfall(c){
  if(!G||G.snow<.25||!isWinter()) return;
  const t=performance.now()/1000;
  c.fillStyle='rgba(255,255,255,.85)';
  const n=Math.floor(flakes.length*Math.min(1,G.snow));
  for(let i=0;i<n;i++){ const f=flakes[i]; const y=((f.y+t*.06*f.v)%1)*VH, x=((f.x+Math.sin(t*.7+f.p)*.01+t*.008)%1)*VW; c.beginPath(); c.arc(x,y,f.s,0,7); c.fill(); }
}
let vign=null;
function drawVignette(c){
  if(!vign){ vign=document.createElement('canvas'); vign.width=Math.max(1,Math.round(VW)); vign.height=Math.max(1,Math.round(VH)); const x=vign.getContext('2d');
    const g=x.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.35,VW/2,VH/2,Math.max(VW,VH)*.75); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(10,6,2,.42)'); x.fillStyle=g; x.fillRect(0,0,VW,VH); }
  c.drawImage(vign,0,0,VW,VH);
}

let hover=null, lineStart=null, lineEnd=null, boxSel=null;
function footprint(key,w,dir){const dm=dims(key,dir);return {x:Math.round(w.x-dm.w/2),y:Math.round(w.y-dm.h/2)};}
function edgeMarks(){
  if(G.editor) return;
  const tw=totalWaves();
  const soon = G.wave<tw && G.nextWave-G.time<=25;
  const left = (G.wave>=tw && !G.spawnQ.length && tw>0) ? G.units.filter(u=>u.team===1&&!u.def.beast&&!u.dead&&!u.ai&&!u.guard) : [];
  if(!soon && !G.spawnQ.length && !(left.length&&left.length<=8)) return;
  const P=d=>{ if(d&&d.x!==undefined) return d; return ({e:{x:W-1,y:H/2},w:{x:1,y:H/2},ne:{x:W*.85,y:1},se:{x:W*.85,y:H-1},n:{x:W*.52,y:1},s:{x:W*.52,y:H-1},camp:LV.ecamp?{x:LV.ecamp.x-5,y:LV.ecamp.y}:{x:W-1,y:H/2}})[d]||{x:W-1,y:H/2}; };
  let pts;
  if(left.length&&!soon&&!G.spawnQ.length) pts=left.map(u=>({x:u.x,y:u.y}));
  else { const dirs = G.spawnQ.length ? [...new Set(G.spawnQ.map(q=>typeof q.dir==='string'?q.dir:'u'))].filter(d=>d!=='u') : waveDef(G.wave).dirs; pts=dirs.map(P); }
  const pulse=.55+.45*Math.sin(performance.now()/180);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  for(const p of pts){
    let {x:sx,y:sy}=w2s(p.x,p.y);
    const m=30, inside = sx>m&&sy>m+30&&sx<VW-m&&sy<VH-m-140;
    const cx=VW/2, cy=VH/2;
    if(!inside){ const dx=sx-cx, dy=sy-cy; const k=Math.min((VW/2-m)/Math.abs(dx||1e-6),(VH/2-m-60)/Math.abs(dy||1e-6)); sx=cx+dx*k; sy=cy+dy*k; }
    const ang=Math.atan2(sy-cy,sx-cx);
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(ang); ctx.globalAlpha=pulse;
    ctx.fillStyle='#c0392b'; ctx.strokeStyle='#1a0d08'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-12); ctx.lineTo(-3,0); ctx.lineTo(-8,12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
function drawBoxSel(){ if(!boxSel) return; ctx.setTransform(dpr,0,0,dpr,0,0);ctx.strokeStyle='#f2d36b';ctx.lineWidth=1;ctx.fillStyle='rgba(242,211,107,.1)';const x=Math.min(boxSel.x0,boxSel.x1),y=Math.min(boxSel.y0,boxSel.y1),w=Math.abs(boxSel.x1-boxSel.x0),h=Math.abs(boxSel.y1-boxSel.y0);ctx.fillRect(x,y,w,h);ctx.strokeRect(x+.5,y+.5,w,h); }
function render(){
  ctx.setTransform(1,0,0,1,0,0);
  if(V3&&V3.on&&G){ ctx.clearRect(0,0,cv.width,cv.height); V3.draw(); ctx.setTransform(dpr,0,0,dpr,0,0); drawSnowfall(ctx); edgeMarks(); drawBoxSel(); return; }
  ctx.fillStyle='#1d2614';ctx.fillRect(0,0,cv.width,cv.height);
  if(!G) return;
  const z=cam.z*dpr;
  ctx.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);
  ctx.drawImage(tc,0,0,W*T,H*T);
  const x0=Math.floor(cam.x/T)-1, y0=Math.floor(cam.y/T)-1, x1=x0+Math.ceil(VW/cam.z/T)+2, y1=y0+Math.ceil(VH/cam.z/T)+2;
  drawWater(ctx,x0,y0,x1,y1);
  if(G.snow>0.02){ ctx.globalAlpha=Math.min(1,G.snow); ctx.drawImage(sc,0,0,W*T,H*T); ctx.globalAlpha=1; }
  if(G.editor){ drawEditor(ctx); ctx.setTransform(dpr,0,0,dpr,0,0); drawVignette(ctx); drawBoxSel(); return; }
  const cp=G.home.camp;
  {const fx=cp.x*T,fy=cp.y*T;ctx.fillStyle='#4a3a2a';ctx.beginPath();ctx.arc(fx,fy,9,0,7);ctx.fill();
   const fl=Math.sin(performance.now()/90)*1.5;ctx.fillStyle='#e8892a';ctx.beginPath();ctx.moveTo(fx-5,fy+2);ctx.quadraticCurveTo(fx,fy-12-fl,fx+5,fy+2);ctx.fill();
   ctx.fillStyle='#f6d36b';ctx.beginPath();ctx.moveTo(fx-2.5,fy+2);ctx.quadraticCurveTo(fx,fy-6-fl,fx+2.5,fy+2);ctx.fill();
   const gl=ctx.createRadialGradient(fx,fy,2,fx,fy,40); gl.addColorStop(0,'rgba(255,170,60,.18)'); gl.addColorStop(1,'rgba(255,170,60,0)'); ctx.fillStyle=gl; ctx.fillRect(fx-40,fy-40,80,80);}
  {const r=G.rally;ctx.fillStyle='#3a2a1a';ctx.fillRect(r.x*T-1,r.y*T-16,2,18);ctx.fillStyle=C.ally;ctx.beginPath();ctx.moveTo(r.x*T+1,r.y*T-16);ctx.lineTo(r.x*T+11,r.y*T-12);ctx.lineTo(r.x*T+1,r.y*T-8);ctx.fill();}
  for(const e of G.estates) drawEstate(ctx,e);
  for(const dc of G.decals){
    ctx.globalAlpha=Math.min(1,dc.t/6);
    if(dc.kind==='rubble'){ctx.fillStyle='#57524a';for(let i=0;i<dc.w*dc.h*3;i++){const r=mulberry(i+dc.x*31+dc.y*7);ctx.fillRect((dc.x+r()*dc.w)*T,(dc.y+r()*dc.h)*T,5,4);}}
    else if(dc.kind==='wreck'){ctx.fillStyle='#3a2a1a';ctx.fillRect(dc.x*T-12,dc.y*T-6,24,12);}
    else {ctx.fillStyle=dc.team===1?'#5e1d14':dc.team===2?'#5a3a20':'#22355a';ctx.beginPath();ctx.ellipse(dc.x*T,dc.y*T+2,6,3,0,0,7);ctx.fill();}
    ctx.globalAlpha=1;
  }
  const bl=G.blds.filter(b=>b.x<=x1&&b.x+b.w>=x0&&b.y<=y1&&b.y+b.h>=y0).sort((a,b)=>(a.y+a.h)-(b.y+b.h));
  for(const b of bl){
    if(b.hitT>0){ctx.save();ctx.translate((rand()-.5)*2,0);}
    drawBld(ctx,b,b.x*T,b.y*T);
    if(G.snow>.4 && !b.def.trap && b.type!=='moat'){ ctx.fillStyle=`rgba(240,245,250,${(G.snow-.4)*.45})`; ctx.fillRect(b.x*T+2,b.y*T+2,b.w*T-4,b.h*T*.45); }
    if(b.hitT>0) ctx.restore();
    if(b===G.selB){ctx.strokeStyle=b.team===1?'#ff7a5a':'#f2d36b';ctx.lineWidth=2;ctx.strokeRect(b.x*T-1,b.y*T-1,b.w*T+2,b.h*T+2);}
    if(b.def.worker&&!b.worker&&b.team===0){const x=(b.x+b.w/2)*T,y=b.y*T-4;ctx.fillStyle='#1a120b';ctx.beginPath();ctx.arc(x,y,7,0,7);ctx.fill();ctx.fillStyle='#f2d36b';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',x,y+.5);}
  }
  drawShow(ctx);
  ctx.strokeStyle='#8a6a42'; ctx.lineWidth=2;
  for(const l of G.ladders){ const b=l.b; const tx_=cl(l.x,b.x+.1,b.x+b.w-.1), ty_=cl(l.y,b.y+.1,b.y+b.h-.1); const ang=Math.atan2(ty_-l.y,tx_-l.x), nx=-Math.sin(ang)*3, ny=Math.cos(ang)*3;
    ctx.beginPath(); ctx.moveTo(l.x*T+nx,l.y*T+ny); ctx.lineTo(tx_*T+nx,ty_*T+ny); ctx.moveTo(l.x*T-nx,l.y*T-ny); ctx.lineTo(tx_*T-nx,ty_*T-ny); ctx.stroke(); }
  const selN=G.units.some(u=>u.sel);
  const hb=hover&&bAt(hover.x|0,hover.y|0);
  for(const b of [G.selB, selN&&hb&&hb.def.cap?hb:null]){
    if(!b||!b.def.cap||b.team!==0) continue;
    const used=new Set(garrison(b).map(u=>u.slot));
    for(let k=0;k<b.def.cap;k++){const s=slotPos(b,k);ctx.strokeStyle=used.has(k)?'rgba(242,211,107,.9)':'rgba(242,211,107,.45)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(s.x*T,s.y*T-6,8,0,7);ctx.stroke();}
    ring(ctx,b.x+b.w/2,b.y+b.h/2,UD.archer.range+elevRange(b.def.great?3:2),'rgba(242,211,107,.35)');
    if(b.mangonel) ring(ctx,b.x+b.w/2,b.y+b.h/2,b.def.great?MANG_GREAT_R:MANG_R,'rgba(255,170,120,.35)');
    if(b.ballista) ring(ctx,b.x+b.w/2,b.y+b.h/2,BALL_R,'rgba(160,200,255,.35)');
  }
  const us=G.units.filter(u=>u.x>=x0-1&&u.x<=x1+1&&u.y>=y0-1&&u.y<=y1+1).sort((a,b)=>a.y-b.y);
  for(const u of us) drawUnit(ctx,u);
  const selA=G.units.filter(u=>u.sel&&u.def.range);
  if(selA.length&&selA.length<=8) for(const u of selA) ring(ctx,u.x,u.y,u.def.range+elevRange(u.el||0),'rgba(242,211,107,.22)');
  ctx.lineCap='round';
  for(const p of G.proj){
    const t=p.t/p.dur, x=p.x0+(p.fx-p.x0)*t, y=p.y0+(p.fy-p.y0)*t;
    const L=Math.hypot(p.fx-p.x0,p.fy-p.y0);
    if(p.type==='stone'){ const hgt=Math.sin(Math.PI*t)*Math.max(1.5,L*.25)+p.h0*(1-t); ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.arc(x*T,y*T,4,0,7);ctx.fill(); ctx.fillStyle='#6e675c';ctx.beginPath();ctx.arc(x*T,(y-hgt)*T,5,0,7);ctx.fill(); continue; }
    const hgt=Math.sin(Math.PI*t)*L*(p.type==='ballista'?.04:.12)+p.h0*(1-t);
    const t2=Math.max(0,t-(p.type==='ballista'?.1:.06)), x2=p.x0+(p.fx-p.x0)*t2, y2=p.y0+(p.fy-p.y0)*t2, h2=Math.sin(Math.PI*t2)*L*(p.type==='ballista'?.04:.12)+p.h0*(1-t2);
    ctx.strokeStyle=p.fire?'#ff9a3a':p.type==='ballista'?'#3a2a1a':p.team===0?'#f1e3c0':'#2b1a12';ctx.lineWidth=p.type==='ballista'?3:p.type==='bolt'?1.8:1.3;
    ctx.beginPath();ctx.moveTo(x2*T,(y2-h2)*T);ctx.lineTo(x*T,(y-hgt)*T);ctx.stroke();
  }
  for(const q of G.parts){ctx.globalAlpha=Math.max(0,q.life/q.max)*(q.smoke?.7:1);ctx.fillStyle=q.c;const s=q.smoke?q.s*(2-q.life/q.max):q.s;ctx.fillRect(q.x*T-s/2,q.y*T-s/2,s,s);}
  ctx.globalAlpha=1;
  drawClouds(ctx);
  for(const b of bl) if(b.hp<b.maxHp && !b.def.trap) hpBar(ctx,b.x*T+4,b.y*T-7,b.w*T-8,b.hp/b.maxHp,b.team);
  const barMode=SETTINGS.bars;
  for(const u of us) if((barMode==='always'?(u.def.mil||u.team===1):barMode==='sel'?u.sel:(u.hp<u.maxHp||u.sel))&&u.kind!=='rat'){const e=u.el?6:0; hpBar(ctx,u.x*T-7,u.y*T-17-e-(u.def.big?6:0),14,u.hp/u.maxHp,u.team);}
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='bold 12px "Alegreya Sans",sans-serif';
  for(const t of G.texts){const k=1-t.t/1.4; ctx.globalAlpha=Math.min(1,t.t*1.5); ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillText(t.s,t.x*T+1,(t.y-k*.8)*T+1); ctx.fillStyle=t.c; ctx.fillText(t.s,t.x*T,(t.y-k*.8)*T);}
  ctx.globalAlpha=1;
  if(mode&&mode.type==='build'&&hover){
    const d=DEF[mode.key];
    let tiles=[];
    if(d.line && lineStart && lineEnd) tiles=lineTiles(lineStart,lineEnd).map(t=>({x:t.x,y:t.y,ok:!canPlace(mode.key,t.x,t.y)}));
    else {const dm=dims(mode.key,mode.dir); const f=footprint(mode.key,hover,mode.dir); const ok=!canPlace(mode.key,f.x,f.y,mode.dir)&&afford(d.cost);
      ctx.globalAlpha=.65; drawBld(ctx,{type:mode.key,def:d,x:f.x,y:f.y,w:dm.w,h:dm.h,dir:mode.dir,anim:0,id:0,team:0},f.x*T,f.y*T); ctx.globalAlpha=1;
      for(let j=0;j<dm.h;j++)for(let i=0;i<dm.w;i++) tiles.push({x:f.x+i,y:f.y+j,ok});
      if(d.cap) ring(ctx,f.x+dm.w/2,f.y+dm.h/2,UD.archer.range+elevRange(d.great?3:d.towerish?2:2),'rgba(242,211,107,.3)');}
    for(const t of tiles){ctx.fillStyle=t.ok?'rgba(120,220,90,.28)':'rgba(230,70,50,.32)';ctx.fillRect(t.x*T,t.y*T,T,T);}
    if(d.line && lineStart && lineEnd){const k=Object.keys(d.cost)[0];ctx.fillStyle='#f6edd8';ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.fillText(`${tiles.filter(t=>t.ok).length*d.cost[k]} ${k}`,(lineEnd.x+1.2)*T,(lineEnd.y+.2)*T);}
  }
  if(mode&&mode.type==='demolish'&&hover){const b=bAt(hover.x|0,hover.y|0); if(b){ctx.fillStyle=b.def.fixed||b.team===1?'rgba(120,120,120,.3)':'rgba(230,60,40,.35)';ctx.fillRect(b.x*T,b.y*T,b.w*T,b.h*T);} else if(ter[tileOf(hover.x,hover.y)]===7){ctx.fillStyle='rgba(230,60,40,.35)';ctx.fillRect((hover.x|0)*T,(hover.y|0)*T,T,T);}}
  if(mode&&mode.type==='rally'&&hover){ctx.globalAlpha=.6;ctx.fillStyle=C.ally;ctx.beginPath();ctx.arc(hover.x*T,hover.y*T,6,0,7);ctx.fill();ctx.globalAlpha=1;}
  if(G.moveMark && G.moveMark.t>0){const m=G.moveMark;ctx.strokeStyle=m.atk?`rgba(255,110,80,${m.t})`:`rgba(242,211,107,${m.t})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(m.x*T,m.y*T,12*(1.4-m.t*.4),7*(1.4-m.t*.4),0,0,7);ctx.stroke();}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawSnowfall(ctx);
  drawVignette(ctx);
  edgeMarks();
  drawBoxSel();
}

/* minimap */
const mini=document.getElementById('mini'), mctx=mini.getContext('2d');
let mimg=null;
function rgb(hex){ const n=parseInt(hex.slice(1),16); return [n>>16,(n>>8)&255,n&255]; }
function drawMini(){
  if(!G||mini.offsetParent===null) return;
  const s=3; if(mini.width!==W*s||mini.height!==H*s){mini.width=W*s;mini.height=H*s;mimg=null;}
  if(!mimg) mimg=mctx.createImageData(W*s,H*s);
  const data=mimg.data, snow=G.snow>.5;
  const aiC={}; for(const a of G.ais||[]) aiC[a.id]=rgb(a.color);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=idx(x,y),t=ter[i];const b=occB[i];let r,g,bb;
    if(b&&!b.def.trap){ if(b.team===1){ const a=aiC[b.owner]; if(a){[r,g,bb]=a; if(!b.def.castle){r=r*.7|0;g=g*.7|0;bb=bb*.7|0;}} else {r=170;g=40;bb=30;} } else if(b.def.isKeep){r=70;g=120;bb=200;} else if(b.type==='gatehouse'){r=b.raised?150:210;g=b.raised?110:180;bb=b.raised?80:120;} else if(b.def.castle){r=180;g=175;bb=160;} else {r=160;g=120;bb=70;} }
    else if(t===1){r=38;g=66;bb=30;} else if(t===2){r=110;g=107;bb=100;} else if(t===4){r=120;g=72;bb=56;} else if(t===5||t===7){r=40;g=80;bb=110; if(snow){r=170;g=190;bb=205;}} else if(t===6){r=80;g=115;bb=118;} else {r=78;g=104;bb=48; if(snow){r=200;g=208;bb=214;}}
    for(let j=0;j<s;j++)for(let k=0;k<s;k++){const q=((y*s+j)*W*s+(x*s+k))*4;data[q]=r;data[q+1]=g;data[q+2]=bb;data[q+3]=255;}}
  mctx.putImageData(mimg,0,0);
  for(const e of G.estates){mctx.fillStyle=estateCol(e);mctx.fillRect(e.x*s-2,e.y*s-2,5,5);}
  for(const u of G.units){ if(u.team===2) continue; mctx.fillStyle=u.team===1?(u.def.beast?'#c0c0c0':(aiOf(u)?aiOf(u).color:'#ff5a40')):u.kind==='peasant'?'#e8d9b4':u.kind==='lord'?'#e0b0ff':'#8fb8ff';const sz=u.def.big||u.kind==='lord'||u.aiLord?4:2.5;mctx.fillRect(u.x*s-1,u.y*s-1,sz,sz);}
  if(!(V3&&V3.on)){ mctx.strokeStyle='#fff';mctx.lineWidth=1;mctx.strokeRect(cam.x/T*s+.5,cam.y/T*s+.5,VW/cam.z/T*s,VH/cam.z/T*s); }
  else { const c=viewCenter(); mctx.strokeStyle='#fff'; mctx.beginPath(); mctx.arc(c.x*s,c.y*s,6,0,7); mctx.stroke(); }
}
mini.addEventListener('pointerdown',e=>{e.stopPropagation();const r=mini.getBoundingClientRect();centerOn((e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H);});
