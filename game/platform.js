'use strict';
/* Castle Siege: the platform layer.
   Game websites get their ad toolkit, the Steam app gets achievements and expansion checks,
   everything else gets plain no-ops. Ads only ever play between battles, never during one. */
const Platform={
  sdk:null, kind:BUILD.ads, lastAd:0, inPlay:false, played:false, steam:window.steam||null,
  async init(){
    try{
      if(this.kind==='crazygames'){ await this.load('https://sdk.crazygames.com/crazygames-sdk-v3.js'); await window.CrazyGames.SDK.init(); this.sdk=window.CrazyGames.SDK; }
      else if(this.kind==='poki'){ await this.load('https://game-cdn.poki.com/scripts/v2/poki-sdk.js'); await window.PokiSDK.init(); this.sdk=window.PokiSDK; }
    }catch(e){ this.kind='none'; this.sdk=null; }
    if(this.steam&&this.steam.packs){ try{ const owned=await this.steam.packs(); if(Array.isArray(owned)) BUILD.packs=owned; }catch(e){} }
  },
  load(src){ return new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); },
  loaded(){ if(this.kind==='poki'&&this.sdk) try{ this.sdk.gameLoadingFinished(); }catch(e){} },
  gameplayStart(){ if(this.inPlay) return; this.inPlay=true; try{ if(this.kind==='crazygames') this.sdk.game.gameplayStart(); else if(this.kind==='poki') this.sdk.gameplayStart(); }catch(e){} },
  gameplayStop(){ if(!this.inPlay) return; this.inPlay=false; try{ if(this.kind==='crazygames') this.sdk.game.gameplayStop(); else if(this.kind==='poki') this.sdk.gameplayStop(); }catch(e){} },
  /* a break between battles; resolves when the next battle may begin */
  adBreak(){
    if(!this.sdk||this.kind==='none'||!this.played) return Promise.resolve();
    if(Date.now()-this.lastAd<150000) return Promise.resolve();
    this.gameplayStop();
    const mute=()=>{ try{ if(AU.out) AU.out.gain.setTargetAtTime(0,AU.c.currentTime,.05); Music.stop(.2); }catch(e){} };
    return new Promise(ok=>{
      let over=false; const done=()=>{ if(over) return; over=true; this.lastAd=Date.now(); applyVolumes(); ok(); };
      try{
        if(this.kind==='crazygames') this.sdk.ad.requestAd('midgame',{adStarted:mute,adFinished:done,adError:done});
        else if(this.kind==='poki'){ mute(); this.sdk.commercialBreak(()=>{}).then(done,done); }
        else done();
      }catch(e){ done(); }
      setTimeout(done,45000);   // never strand the player behind an ad that never answers
    });
  },
  achievement(id){ try{ if(this.steam&&this.steam.achievement) this.steam.achievement(id); }catch(e){} },
  hasPack(id){ return (BUILD.packs||[]).includes(id); },
  demo(){ return BUILD.edition==='demo'; },
  openStore(url){ url=url||BUILD.storeUrl; if(!url) return false; try{ if(this.steam&&this.steam.openUrl) this.steam.openUrl(url); else window.open(url,'_blank','noopener'); }catch(e){} return true; },
};
/* what the free demo holds back */
const DEMO={warMissions:3, builderMissions:1, skirmishMaps:1, maxRivals:1, ffaRivals:3, siegeCastles:1, freeMaps:2};
function demoLock(kind,i){
  if(!Platform.demo()) return '';
  if(kind==='camp-war'&&i>=DEMO.warMissions) return 'The full game has all 8 war missions';
  if(kind==='camp-peace'&&i>=DEMO.builderMissions) return 'The full game has all 4 builder missions';
  if(kind==='skirmish-map'&&i>=DEMO.skirmishMaps) return 'More maps in the full game';
  if(kind==='skirmish-rivals'&&i>DEMO.maxRivals) return 'Up to three rivals in the full game';
  if(kind==='ffa-rivals'&&i>DEMO.ffaRivals) return 'Up to nine rivals in the full game';
  if(kind==='siege-castle'&&i>=DEMO.siegeCastles) return 'Ravenscar is in the full game';
  if(kind==='free-map'&&i>=DEMO.freeMaps) return 'More lands in the full game';
  if(kind==='editor') return 'The map editor is in the full game';
  return '';
}
function gameplayOn(){ Platform.gameplayStart(); }
function gameplayOff(){ Platform.gameplayStop(); }
