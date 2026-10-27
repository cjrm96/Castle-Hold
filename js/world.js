'use strict';
/* Hollowmere Keep: maps, terrain art, flow fields, pathfinding */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rand = Math.random;
function cl(v,a,b){return v<a?a:v>b?b:v;}

/* terrain codes: 0 grass, 1 tree, 2 rock, 3 stump, 4 iron, 5 water, 6 ford, 7 moat */
let W=64, H=44, N=W*H;
let ter, treeW, shade, reserved, occB, distG, distC, distS, pWalk, LV=null;
function idx(x,y){return y*W+x;}
function inb(x,y){return x>=0&&y>=0&&x<W&&y<H;}
function bAt(x,y){return inb(x,y)?occB[y*W+x]:null;}
function tileOf(x,y){return idx(cl(x|0,0,W-1),cl(y|0,0,H-1));}
function homeLayout(k){
  return {stock:{x:k.x+5,y:k.y-2}, gran:{x:k.x+5,y:k.y+2}, armory:{x:k.x,y:k.y+5}, barracks:{x:k.x+8,y:k.y+5},
    camp:{x:k.x-2.5,y:k.y+7.5}, rally:{x:k.x+7,y:k.y+10}};
}
function allocMap(){
  N=W*H;
  ter=new Uint8Array(N); treeW=new Uint8Array(N); shade=new Float32Array(N); reserved=new Uint8Array(N); occB=new Array(N).fill(null);
  distG=new Float64Array(N); distC=new Float64Array(N); distS=new Float64Array(N); pWalk=new Uint8Array(N);
  coarse=null;
}
/* L.terrain: base64 of a saved Uint8 terrain grid (editor maps and save games) */
function b64ToBytes(s){ const bin=atob(s); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a; }
function bytesToB64(a){ let s=''; for(let i=0;i<a.length;i+=0x8000) s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000)); return btoa(s); }
function genMap(L){
  W=L.W; H=L.H; allocMap();
  const r=mulberry(L.seed||1);
  for(let i=0;i<N;i++) shade[i]=r();
  if(L.terrain){ const t=b64ToBytes(L.terrain); ter.set(t.subarray(0,N)); clearsFor(L,true); return; }
  const S=MAPS[L.map]||{};
  const blob=(bx,by,br,val,prob=.88)=>{
    for(let y=Math.floor(by-br-1);y<=by+br+1;y++)for(let x=Math.floor(bx-br-1);x<=bx+br+1;x++){
      if(!inb(x,y))continue; const d=Math.hypot(x-bx,y-by);
      if(d<br*(0.75+0.45*r()) && r()<prob) ter[idx(x,y)]=val;
    }
  };
  for(const b of S.forest||[]) blob(b[0],b[1],b[2],1,S.forestProb||.88);
  for(let k=0;k<(S.scatter||0);k++){const x=(r()*W)|0,y=(r()*H)|0; if(ter[idx(x,y)]===0) ter[idx(x,y)]=1;}
  for(const [x0,y0,x1,y1] of S.hedge||[]){ const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0)); for(let k=0;k<=n;k++){ const x=Math.round(x0+(x1-x0)*k/n), y=Math.round(y0+(y1-y0)*k/n); if(inb(x,y)&&r()<.82) ter[idx(x,y)]=1; } }
  for(const b of S.rock||[]) blob(b[0],b[1],b[2],2,1);
  for(const b of S.iron||[]) blob(b[0],b[1],b[2],4,1);
  for(const [x,y0,y1] of S.ridge||[]) for(let y=y0;y<=y1;y++){ const xx=x+((y*7)%3===0?1:0); if(inb(xx,y)) ter[idx(xx,y)]=2; if(inb(xx+1,y)) ter[idx(xx+1,y)]=2; if(r()<.5&&inb(xx+2,y)) ter[idx(xx+2,y)]=2; }
  for(const b of S.lake||[]){ for(let y=Math.floor(b[1]-b[2]-1);y<=b[1]+b[2]+1;y++)for(let x=Math.floor(b[0]-b[2]*1.4-1);x<=b[0]+b[2]*1.4+1;x++){ if(!inb(x,y)) continue; if(Math.hypot((x-b[0])/1.4,y-b[1])<b[2]*(0.85+0.2*r())) ter[idx(x,y)]=5; } }
  if(S.river){ const R=S.river;
    for(let y=0;y<H;y++){ const cx=R.cx+R.amp*Math.sin(y/R.per);
      for(let x=Math.floor(cx-2);x<=Math.ceil(cx+2);x++){ if(!inb(x,y)) continue; if(Math.abs(x+.5-cx)<1.8){ const ford=(R.fords||[]).some(([a,b])=>y>=a&&y<=b); ter[idx(x,y)]=ford?6:5; } } } }
  clearsFor(L,false);
}
/* clear the ground around keeps, estates, camps and castles */
function clearsFor(L,small){
  const clears=[{x:L.keep.x+2,y:L.keep.y+2,r:small?5:10}];
  for(const e of L.estates||[]) clears.push({x:e.x,y:e.y,r:3.2});
  if(L.ecamp) clears.push({x:L.ecamp.x,y:L.ecamp.y,r:10});
  for(const a of L.ais||[]) clears.push({x:a.x+2,y:a.y+2,r:small?5:12});
  if(L.enemyCastle){ const c=L.enemyCastle, sz=c.kind==='large'?{w:21,h:17}:{w:15,h:13}; clears.push({x:c.x+sz.w/2,y:c.y+sz.h/2,r:Math.max(sz.w,sz.h)*.62+3}); }
  if(L.playerCastle){ const c=L.playerCastle, sz=c.kind==='large'?{w:21,h:17}:{w:15,h:13}; clears.push({x:c.x+sz.w/2,y:c.y+sz.h/2,r:Math.max(sz.w,sz.h)*.62+3}); }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=idx(x,y);
    for(const c of clears) if(Math.hypot(x-c.x,y-c.y)<c.r && (small || (ter[i]!==5 && ter[i]!==6))){ ter[i]=0; break; }
    if(!small && (x>=W-2||y<=1||y>=H-2) && (ter[i]===2||ter[i]===4) && x>W*.5) ter[i]=0;
    if(ter[i]===1) treeW[i]=3;
  }
}

/* terrain art */
const tc=document.createElement('canvas'); const tx=tc.getContext('2d');
const sc=document.createElement('canvas'); const sx_=sc.getContext('2d');
let coarse=null, terrVer=0;
function smooth(x,y){
  if(!coarse){const r=mulberry(99);coarse=[];for(let j=0;j<=H/5+2;j++){coarse.push([]);for(let i=0;i<=W/5+2;i++)coarse[j].push(r());}}
  const gx=x/5, gy=y/5, i=Math.floor(gx), j=Math.floor(gy), fx=gx-i, fy=gy-j;
  const sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
  const a=coarse[j][i], b=coarse[j][i+1], c=coarse[j+1][i], d=coarse[j+1][i+1];
  return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;
}
function isWet(x,y){ if(!inb(x,y)) return false; const t=ter[idx(x,y)]; return t===5||t===6||t===7; }
function groundStyle(){ const m=MAPS[LV&&LV.map]||{}; return LV&&LV.ground?LV.ground:(m.ground||''); }
function drawTile(i){
  const x=i%W, y=(i/W)|0, px=x*T, py=y*T, s=shade[i];
  const r=mulberry(i*9277+13);
  const g=groundStyle();
  for(let q=0;q<4;q++){const qx=x+(q&1)*.5+.25, qy=y+(q>>1)*.5+.25; const v=smooth(qx,qy)*.8+s*.2;
    tx.fillStyle=g==='moor'?`hsl(${62+v*20},${22+v*8}%,${27+v*6}%)`:g==='snow'?`hsl(${100+v*20},${18+v*8}%,${27+v*6}%)`:`hsl(${86+v*12},${30+v*8}%,${28+v*6}%)`;
    tx.fillRect(px+(q&1)*16,py+(q>>1)*16,16,16);}
  for(let k=0;k<6;k++){tx.fillStyle=r()<.5?'rgba(20,38,8,.28)':'rgba(170,200,110,.10)';tx.fillRect(px+r()*T,py+r()*T,2,3);}
  if(r()<.06){ tx.fillStyle=['#e8d36a','#e9e6f0','#d98fb0'][(r()*3)|0]; for(let k=0;k<3;k++) tx.fillRect(px+4+r()*24,py+4+r()*24,2,2); }
  const t=ter[i];
  let snow=null;
  if(t===1){
    const cx=px+16+(r()-.5)*6, cy=py+15+(r()-.5)*5, rad=11+r()*3;
    tx.fillStyle='rgba(0,0,0,.28)';tx.beginPath();tx.ellipse(cx+4,cy+6,rad,rad*.7,0,0,7);tx.fill();
    tx.fillStyle='#4b3220';tx.fillRect(cx-1.5,cy+3,3,7);
    const conifer=g==='snow'||r()<.25;
    if(conifer){
      tx.fillStyle=`hsl(${140+r()*15},30%,${15+r()*5}%)`; tx.beginPath(); tx.moveTo(cx,cy-rad-2); tx.lineTo(cx+rad*.9,cy+rad*.6); tx.lineTo(cx-rad*.9,cy+rad*.6); tx.closePath(); tx.fill();
      tx.fillStyle=`hsl(${140+r()*15},28%,${22+r()*5}%)`; tx.beginPath(); tx.moveTo(cx,cy-rad-2); tx.lineTo(cx+rad*.5,cy); tx.lineTo(cx-rad*.6,cy+rad*.3); tx.closePath(); tx.fill();
      snow={type:'pine',cx,cy,rad};
    } else {
      tx.fillStyle=`hsl(${105+r()*20},38%,${17+r()*6}%)`;tx.beginPath();tx.arc(cx,cy,rad,0,7);tx.fill();
      tx.fillStyle=`hsl(${100+r()*20},34%,${25+r()*6}%)`;tx.beginPath();tx.arc(cx-3,cy-3,rad*.62,0,7);tx.fill();
      tx.fillStyle='rgba(200,230,140,.12)';tx.beginPath();tx.arc(cx-5,cy-5,rad*.3,0,7);tx.fill();
      snow={type:'tree',cx,cy,rad};
    }
  } else if(t===2||t===4){
    const iron=t===4;
    tx.fillStyle=iron?'#5e4136':'#5f5c55';tx.fillRect(px,py,T,T);
    for(let k=0;k<3;k++){
      const cx=px+6+r()*20, cy=py+6+r()*20, rr=7+r()*6;
      tx.fillStyle=iron?'#7d4f3c':'#77736a';tx.beginPath();
      for(let a=0;a<6;a++){const ang=a/6*Math.PI*2+r()*.5;const rad=rr*(.7+r()*.4);tx.lineTo(cx+Math.cos(ang)*rad,cy+Math.sin(ang)*rad);}
      tx.fill();
      tx.fillStyle=iron?'rgba(230,140,90,.25)':'rgba(255,255,255,.13)';tx.fillRect(cx-rr*.5,cy-rr*.5,rr*.6,2);
    }
    snow={type:'rock'};
  } else if(t===3){
    tx.fillStyle='#5a3d24';tx.beginPath();tx.arc(px+16,py+18,3.5,0,7);tx.fill();
    tx.fillStyle='#b58a5a';tx.beginPath();tx.arc(px+16,py+18,2,0,7);tx.fill();
  } else if(t===5||t===6||t===7){
    tx.fillStyle=t===5?'#2f5a78':t===6?'#557a7c':'#28465a';tx.fillRect(px,py,T,T);
    tx.fillStyle=t===6?'rgba(170,150,110,.35)':'rgba(255,255,255,.07)';
    for(let k=0;k<4;k++){tx.fillRect(px+r()*24,py+r()*28,8,1.5);}
    if(t===7){
      tx.fillStyle='#6e675c';
      if(!isWet(x,y-1)) tx.fillRect(px,py,T,3); if(!isWet(x,y+1)) tx.fillRect(px,py+T-3,T,3);
      if(!isWet(x-1,y)) tx.fillRect(px,py,3,T); if(!isWet(x+1,y)) tx.fillRect(px+T-3,py,3,T);
    } else {
      tx.fillStyle='rgba(120,150,90,.35)';
      if(!isWet(x,y-1)) tx.fillRect(px,py,T,2); if(!isWet(x,y+1)) tx.fillRect(px,py+T-2,T,2);
      if(!isWet(x-1,y)) tx.fillRect(px,py,2,T); if(!isWet(x+1,y)) tx.fillRect(px+T-2,py,2,T);
    }
    snow={type:'water'};
  }
  drawSnowTile(i,snow);
  terrVer++;
}
function drawSnowTile(i,snow){
  const x=i%W, y=(i/W)|0, px=x*T, py=y*T; const r=mulberry(i*311+7);
  sx_.clearRect(px,py,T,T);
  if(snow&&snow.type==='water'){ sx_.fillStyle='rgba(225,236,244,.55)'; sx_.fillRect(px,py,T,T); return; }
  sx_.fillStyle='#eef2f5'; sx_.fillRect(px,py,T,T);
  const g=sx_.createLinearGradient(px,py,px,py+T); g.addColorStop(0,'rgba(255,255,255,.0)'); g.addColorStop(1,'rgba(200,214,228,.35)'); sx_.fillStyle=g; sx_.fillRect(px,py,T,T);
  for(let k=0;k<4;k++){ sx_.fillStyle=r()<.5?'rgba(196,210,224,.32)':'rgba(255,255,255,.7)'; sx_.beginPath(); sx_.ellipse(px+r()*T,py+r()*T,5+r()*7,2+r()*2.5,0,0,7); sx_.fill(); }
  if(snow&&(snow.type==='tree'||snow.type==='pine')){
    sx_.fillStyle='rgba(60,80,60,.85)';
    if(snow.type==='pine'){ sx_.beginPath(); sx_.moveTo(snow.cx,snow.cy-snow.rad-2); sx_.lineTo(snow.cx+snow.rad*.9,snow.cy+snow.rad*.6); sx_.lineTo(snow.cx-snow.rad*.9,snow.cy+snow.rad*.6); sx_.closePath(); sx_.fill();
      sx_.fillStyle='#f4f7fa'; sx_.beginPath(); sx_.moveTo(snow.cx,snow.cy-snow.rad-2); sx_.lineTo(snow.cx+snow.rad*.45,snow.cy-snow.rad*.2); sx_.lineTo(snow.cx-snow.rad*.5,snow.cy-snow.rad*.1); sx_.closePath(); sx_.fill(); }
    else { sx_.fillStyle='rgba(70,60,50,.8)'; sx_.beginPath(); sx_.arc(snow.cx,snow.cy,snow.rad,0,7); sx_.fill(); sx_.fillStyle='#f4f7fa'; sx_.beginPath(); sx_.arc(snow.cx-2,snow.cy-3,snow.rad*.75,Math.PI,0); sx_.fill(); }
  } else if(snow&&snow.type==='rock'){ for(let k=0;k<3;k++){ const cx=px+6+r()*20, cy=py+8+r()*18; sx_.fillStyle='rgba(98,96,92,.85)'; sx_.beginPath(); sx_.ellipse(cx,cy+2,7,5,0,0,7); sx_.fill(); sx_.fillStyle='#f4f7fa'; sx_.beginPath(); sx_.ellipse(cx-1,cy-1,6,3,0,0,7); sx_.fill(); } }
}
function buildTerrain(){ tc.width=W*T; tc.height=H*T; sc.width=W*T; sc.height=H*T; for(let i=0;i<N;i++) drawTile(i); }
function redrawAround(i){ const x=i%W,y=(i/W)|0; for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++) if(inb(x+k,y+j)) drawTile(idx(x+k,y+j)); }

/* passability */
function isPassage(b,x,y){ return (b.dir==='E'||b.dir==='W') ? y===b.y+1 : x===b.x+1; }
function blockedFor(kind,i){
  const t=ter[i];
  if(t===2||t===5) return true;
  if(kind==='S' && t===7) return true;
  const b=occB[i]; if(!b||b.def.trap||b.team===1) return false;
  if(kind==='C' && b.def.castle && !b.def.isKeep) return false;
  return true;
}
function enterCost(kind,i){
  const t=ter[i];
  if(t===2||t===5) return Infinity;
  if(t===7 && kind==='S') return Infinity;
  const b=occB[i];
  if(b && !b.def.trap && b.team!==1){
    if(b===G.keep) return 1;
    if(kind==='C' && b.def.castle && !b.def.isKeep) return 1.2;
    const eff=(b.type==='gatehouse'&&b.raised)?b.hp/0.4:b.hp;
    return 1+Math.min(eff,4000)/8;
  }
  if(t===7) return 6;
  if(t===6) return 2;
  return t===1?2.5:1;
}
const heapI=[], heapD=[];
function hpush(i,d){heapI.push(i);heapD.push(d);let n=heapI.length-1;while(n>0){const p=(n-1)>>1;if(heapD[p]<=d)break;heapI[n]=heapI[p];heapD[n]=heapD[p];n=p;}heapI[n]=i;heapD[n]=d;}
function hpop(){const ri=heapI[0],rd=heapD[0];const li=heapI.pop(),ld=heapD.pop();if(heapI.length){let n=0;const L=heapI.length;while(true){let c=2*n+1;if(c>=L)break;if(c+1<L&&heapD[c+1]<heapD[c])c++;if(heapD[c]>=ld)break;heapI[n]=heapI[c];heapD[n]=heapD[c];n=c;}heapI[n]=li;heapD[n]=ld;}return [ri,rd];}
const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
function flowFor(kind,dist){
  dist.fill(Infinity); heapI.length=0; heapD.length=0;
  const k=G.keep; if(!k||k.dead) return;
  for(let j=0;j<k.h;j++)for(let i=0;i<k.w;i++){const q=idx(k.x+i,k.y+j);dist[q]=0;hpush(q,0);}
  while(heapI.length){
    const [i,d]=hpop(); if(d>dist[i]) continue;
    const x=i%W, y=(i/W)|0;
    const c=enterCost(kind,i); if(c===Infinity) continue;
    for(const [dx,dy,l] of NB){
      const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue;
      if(dx&&dy && (blockedFor(kind,idx(nx,y))||blockedFor(kind,idx(x,ny)))) continue;
      const n=idx(nx,ny); const tn=ter[n]; if(tn===2||tn===5) continue;
      const nd=d+c*l;
      if(nd<dist[n]){dist[n]=nd;hpush(n,nd);}
    }
  }
}
/* enemy castle tiles your troops can walk: every wall, tower or gate joined to a ladder or docked siege tower */
function computePWalk(){
  pWalk.fill(0); const q=[];
  for(const b of G.blds){ if(b.team!==1||!b.def.castle||b.def.isKeep) continue; if(b.pladders>0||b.pdock>0) for(let j=0;j<b.h;j++)for(let i=0;i<b.w;i++){const t=idx(b.x+i,b.y+j); if(!pWalk[t]){pWalk[t]=1;q.push(t);}} }
  while(q.length){ const i=q.pop(), x=i%W, y=(i/W)|0;
    for(const [dx,dy] of NB){ if(dx&&dy) continue; const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; const n=idx(nx,ny); if(pWalk[n]) continue; const b=occB[n]; if(b&&b.team===1&&b.def.castle&&!b.def.isKeep){ pWalk[n]=1; q.push(n); } } }
}
function computeFlow(){ flowFor('G',distG); flowFor('C',distC); flowFor('S',distS); computePWalk(); G.flowDirty=false; }

/* friendly pathfinding: 'P' peasants and carts, 'T' troops, 'TS' your siege engines */
const PMAX=96*64;
const prevA=new Int32Array(PMAX), seenA=new Uint32Array(PMAX), qA=new Int32Array(PMAX); let stamp=0;
function blockedPT(kind,i){
  const t=ter[i];
  if(t===2||t===5) return true;
  const b=occB[i];
  if(b && b.team===1){ if(kind==='T' && pWalk[i]) return false; return true; }
  if(kind==='TS') return t===7;
  if(kind==='T') return false;
  if(t===7) return true;
  if(!b||!b.def.castle) return false;
  if(b.type==='gatehouse') return b.raised || !isPassage(b,i%W,(i/W)|0);
  return true;
}
function bridgeOK(i){
  const x=i%W, y=(i/W)|0;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const b=bAt(x-dx,y-dy); if(b&&b.team===0&&b.type==='gatehouse'&&!b.raised&&isPassage(b,x-dx,y-dy)){ const dir={E:[1,0],W:[-1,0],S:[0,1],N:[0,-1]}[b.dir]; if(dir[0]===dx&&dir[1]===dy) return true; } }
  return false;
}
function blockedK(kind,i){ if(kind==='P' && ter[i]===7) return !bridgeOK(i); return blockedPT(kind,i); }
function clearAtK(kind,x,y){return !blockedK(kind,tileOf(x,y));}
function lineClear(kind,x0,y0,x1,y1){
  const d=Math.hypot(x1-x0,y1-y0), n=Math.ceil(d*3);
  for(let s=1;s<n;s++){
    const x=x0+(x1-x0)*s/n, y=y0+(y1-y0)*s/n;
    if(!clearAtK(kind,x-.22,y-.22)||!clearAtK(kind,x+.22,y-.22)||!clearAtK(kind,x-.22,y+.22)||!clearAtK(kind,x+.22,y+.22)) return false;
  }
  return true;
}
function findPath(kind,sx,sy,tx_,ty_){
  const s=tileOf(sx,sy), t=tileOf(tx_,ty_);
  if(s===t || lineClear(kind,sx,sy,tx_,ty_)) return [{x:tx_,y:ty_}];
  stamp++; let h=0,tl=0; qA[tl++]=s; seenA[s]=stamp; prevA[s]=-1; let found=false;
  while(h<tl){
    const i=qA[h++]; if(i===t){found=true;break;}
    const x=i%W,y=(i/W)|0;
    for(const [dx,dy] of NB){
      const nx=x+dx,ny=y+dy; if(!inb(nx,ny)) continue;
      const n=idx(nx,ny); if(seenA[n]===stamp) continue;
      if(n!==t && blockedK(kind,n)) continue;
      if(dx&&dy&&(blockedK(kind,idx(nx,y))||blockedK(kind,idx(x,ny)))) continue;
      seenA[n]=stamp; prevA[n]=i; qA[tl++]=n;
    }
  }
  if(!found) return null;
  const tiles=[]; for(let i=t;i!==-1;i=prevA[i]) tiles.push(i); tiles.reverse();
  const pts=tiles.slice(1).map(i=>({x:i%W+.5,y:((i/W)|0)+.5})); pts[pts.length-1]={x:tx_,y:ty_};
  const out=[]; let cx=sx,cy=sy,k=0;
  while(k<pts.length){ let far=k; for(let j=k+1;j<pts.length&&j<k+14;j++){ if(lineClear(kind,cx,cy,pts[j].x,pts[j].y)) far=j; } out.push(pts[far]); cx=pts[far].x; cy=pts[far].y; k=far+1; }
  return out;
}
function spawnPoint(dir){
  let x=W-.5,y=H/2;
  for(let tries=0;tries<30;tries++){
    if(dir==='e'){x=W-0.5;y=H*.27+rand()*H*.46;}
    else if(dir==='w'){x=0.5;y=H*.27+rand()*H*.46;}
    else if(dir==='ne'){x=W*.7+rand()*(W*.3-2);y=0.5;}
    else if(dir==='se'){x=W*.7+rand()*(W*.3-2);y=H-0.5;}
    else if(dir==='n'){x=W*.35+rand()*W*.35;y=0.5;}
    else if(dir==='s'){x=W*.35+rand()*W*.35;y=H-0.5;}
    else if(dir==='camp'){const c=LV.ecamp; x=c.x-6+rand()*3; y=c.y-4+rand()*8;}
    else if(dir&&dir.x!==undefined){ x=dir.x+(rand()-.5)*3; y=dir.y+(rand()-.5)*3; }
    const t=ter[tileOf(x,y)]; if(t!==2&&t!==5&&t!==4&&!occB[tileOf(x,y)]) break;
  }
  return {x,y};
}

/* connected regions your troops can walk, rebuilt whenever walls, gates or ladders change */
let compT=null, compVer=-1, compG=null;
function compsT(){
  if(compT&&compVer===G.pathVer&&compG===G&&compT.length===N) return compT;
  compT=new Int32Array(N).fill(-1); let c=0;
  for(let s=0;s<N;s++){
    if(compT[s]!==-1||blockedK('T',s)) continue;
    let h=0,tl=0; qA[tl++]=s; compT[s]=c;
    while(h<tl){ const i=qA[h++], x=i%W, y=(i/W)|0;
      for(const [dx,dy] of NB){ const nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; const n=idx(nx,ny); if(compT[n]!==-1||blockedK('T',n)) continue;
        if(dx&&dy&&(blockedK('T',idx(nx,y))||blockedK('T',idx(x,ny)))) continue; compT[n]=c; qA[tl++]=n; } }
    c++;
  }
  compVer=G.pathVer; compG=G; return compT;
}
function compOf(x,y){ return compsT()[tileOf(x,y)]; }
function sameComp(a,b){ const ca=compOf(a.x,a.y), cb=compOf(b.x,b.y); return ca<0||cb<0||ca===cb; }
/* can a unit standing in region `my` get right up to building b */
function touchesComp(b,my){
  const C=compsT();
  for(let i=-1;i<=b.w;i++) for(const j of [-1,b.h]){ const x=b.x+i,y=b.y+j; if(inb(x,y)&&C[idx(x,y)]===my) return true; }
  for(let j=0;j<b.h;j++) for(const i of [-1,b.w]){ const x=b.x+i,y=b.y+j; if(inb(x,y)&&C[idx(x,y)]===my) return true; }
  return false;
}
function canReachB(u,b){ const my=compOf(u.x,u.y); return my<0||rectDist(u.x,u.y,b)<=.8||touchesComp(b,my); }
