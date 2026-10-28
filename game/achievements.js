'use strict';
/* Castle Siege: achievements. Ids double as Steam achievement names in the desktop build. */
const ACHIEVEMENTS=[
  {id:'TUTORIAL',name:'Squire',desc:'Finish the tutorial',icon:'keep'},
  {id:'FIRST_WIN',name:'First Victory',desc:'Win any mission or battle',icon:'army'},
  {id:'WAR_CAMPAIGN',name:'Warlord Slayer',desc:'Finish the war campaign',icon:'army'},
  {id:'BUILDER_CAMPAIGN',name:'Master Builder',desc:'Finish the builder campaign',icon:'town'},
  {id:'FRONTIER_CAMPAIGN',name:'Frontier Lord',desc:'Finish the frontier campaign',icon:'castle'},
  {id:'ALL_STARS',name:'Flawless',desc:'Earn three stars on every war campaign mission',icon:'keep'},
  {id:'SIEGE_THORN_HARD',name:'Thornwall Taken',desc:'Take Thornwall on Hard',icon:'castle'},
  {id:'SIEGE_RAVEN_HARD',name:'Ravenscar Taken',desc:'Take Ravenscar on Hard',icon:'castle'},
  {id:'SIEGE_HOLD_HARD',name:'Unbroken',desc:'Hold a castle through every wave on Hard',icon:'castle'},
  {id:'LIGHT_LOSSES',name:'Few Fell',desc:'Take a castle in Siege mode and lose fewer than 5 soldiers',icon:'army'},
  {id:'SKIRMISH_WIN',name:'Conqueror',desc:'Win a skirmish',icon:'keep'},
  {id:'SKIRMISH_THREE',name:'Last Lord Standing',desc:'Beat three rivals in one skirmish',icon:'keep'},
  {id:'SKIRMISH_HARD',name:'Iron Will',desc:'Win a skirmish on Hard',icon:'keep'},
  {id:'FFA_WIN',name:'Last Banner',desc:'Win a free for all',icon:'army'},
  {id:'FFA_TEN',name:'King of Ten',desc:'Win a free for all against nine rivals',icon:'army'},
  {id:'RAM_GATE',name:'Knock Knock',desc:'Break an enemy gatehouse with a battering ram',icon:'weap'},
  {id:'TOWER_DOCK',name:'Over the Top',desc:'Dock a siege tower against an enemy wall',icon:'weap'},
  {id:'TOWER_TOPPLER',name:'Tower Toppler',desc:'Bring down an enemy tower with a catapult or trebuchet',icon:'weap'},
  {id:'MOAT_FILL',name:'Ditch Diggers',desc:'Fill 10 moat tiles in one battle',icon:'ind'},
  {id:'LORD_DUEL',name:"Lord's Justice",desc:'Slay an enemy lord with your own lord',icon:'army'},
  {id:'KILLS_1000',name:'A Thousand Fallen',desc:'Defeat 1,000 enemies across all your games',icon:'army'},
  {id:'POP_100',name:'Bustling Town',desc:'Have 100 peasants at once',icon:'town'},
  {id:'GOLD_5000',name:'Full Coffers',desc:'Hold 5,000 gold at once',icon:'trade'},
  {id:'RANK_TOP',name:'Duke',desc:'Reach the highest rank',icon:'keep'},
  {id:'WALLS_200',name:'Great Wall',desc:'Have 200 wall sections standing at once',icon:'castle'},
  {id:'TURNCOATS',name:'New Banners',desc:'Take 10 or more of a beaten lord\'s soldiers into your army',icon:'army'},
  {id:'WARDEN',name:'Warden',desc:'Hold 10 or more prisoners in your prison camp',icon:'law'},
  {id:'MERCY',name:'Mercy',desc:'Send 10 or more of a beaten lord\'s soldiers home',icon:'keep'},
  {id:'MAPMAKER',name:'Cartographer',desc:'Save a map in the editor',icon:'ind'},
  {id:'HERALD',name:'Herald',desc:'Share a map code',icon:'trade'},
];
const ACH_BY=Object.fromEntries(ACHIEVEMENTS.map(a=>[a.id,a]));
function unlock(id){
  if(ACH.got[id]||!ACH_BY[id]) return; if(G&&G.attract) return;
  ACH.got[id]=Date.now(); saveProgress(); Platform.achievement(id);
  toast(`Achievement: ${ACH_BY[id].name}`,'ach'); sfx('cheer');
}
function achCount(k,n){ if(G&&G.attract) return; ACH.stats[k]=(ACH.stats[k]||0)+n; }
/* checked once a second during play */
function achTick(){
  if(!G||G.attract||G.editor||G.over) return;
  if(ACH.stats.kills>=1000) unlock('KILLS_1000');
  if(!ACH.got.POP_100&&peasants().length>=100) unlock('POP_100');
  if(G.R.gold>=5000) unlock('GOLD_5000');
  if(rankOf(G.honorTotal)>=RANKS.length-1) unlock('RANK_TOP');
  if(!ACH.got.WALLS_200&&G.time%5<1&&G.blds.filter(b=>b.team===0&&b.def.wallish&&!b.dead).length>=200) unlock('WALLS_200');
}
function campDone(camp){ const Ls=LEVELS.filter(l=>l.camp===camp); return Ls.length&&Ls.every(l=>progress[l.id]); }
function achEnd(win){
  if(!G||G.attract) return;
  saveProgress();
  if(!win) return;
  unlock('FIRST_WIN');
  const L=G.L;
  if(L.camp){ if(campDone('war')) unlock('WAR_CAMPAIGN'); if(campDone('peace')) unlock('BUILDER_CAMPAIGN'); if(campDone('frontier')) unlock('FRONTIER_CAMPAIGN');
    if(LEVELS.filter(l=>l.camp==='war').every(l=>(progress[l.id]||0)>=3)) unlock('ALL_STARS'); }
  if(L.mode==='siege'){
    if(L.id==='siege_thornwall_a'&&L.diffSel==='hard') unlock('SIEGE_THORN_HARD');
    if(L.id==='siege_ravenscar_a'&&L.diffSel==='hard') unlock('SIEGE_RAVEN_HARD');
    if(/_d$/.test(L.id)&&L.diffSel==='hard') unlock('SIEGE_HOLD_HARD');
    if(/_a$/.test(L.id)&&G.lostU<5) unlock('LIGHT_LOSSES');
  }
  if(L.ffa){ unlock('FFA_WIN'); if((L.ais||[]).length>=9) unlock('FFA_TEN'); }
  else if(L.mode==='kingmaker'){ unlock('SKIRMISH_WIN'); if((L.ais||[]).length>=3) unlock('SKIRMISH_THREE'); if(L.diffSel==='hard') unlock('SKIRMISH_HARD'); }
}
/* ---------- the achievements screen ---------- */
function showAch(){
  const n=ACHIEVEMENTS.filter(a=>ACH.got[a.id]).length;
  $('achSub').textContent=`${n} of ${ACHIEVEMENTS.length} earned · ${(ACH.stats.kills||0).toLocaleString()} enemies defeated in all`;
  $('achGrid').innerHTML=ACHIEVEMENTS.map(a=>{ const t=ACH.got[a.id];
    return `<div class="ach${t?' got':''}"><span class="ai">${TAB_ICON[a.icon]||''}</span><span class="at"><b>${a.name}</b><small>${a.desc}</small>${t?`<em>${new Date(t).toLocaleDateString()}</em>`:''}</span></div>`; }).join('');
  show('ovAch');
}
