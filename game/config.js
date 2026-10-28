'use strict';
/* Castle Siege build settings. The packaging script rewrites this file for each build:
   full web game, free demo for game websites, and the Steam desktop app. */
const BUILD={
  version:'1.1.0',
  edition:'full',          // 'full' or 'demo'
  ads:'none',              // 'none', 'crazygames' or 'poki' (ads only ever play between battles)
  platform:'web',          // 'web' or 'steam'
  packs:['frontier'],      // expansion packs this build includes
  storeUrl:'',             // where the demo sends players for the full game
  packUrl:{frontier:''},   // where to buy each expansion pack
};
