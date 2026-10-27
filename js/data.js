'use strict';
/* Hollowmere Keep: data tables, buildings, units, campaigns, maps */
const T = 32;
const DIRS = ['E','S','W','N'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const RES_KEYS = {
  stock:['wood','stone','iron','wheat','flour','hops','ale'],
  food:['apples','cheese','meat','bread'],
  arms:['bows','xbows','spears','pikes','maces','swords','armor'],
};
const ALL_RES = [...RES_KEYS.stock, ...RES_KEYS.food, ...RES_KEYS.arms];
const RES_NAME = {wood:'wood',stone:'stone',iron:'iron',wheat:'wheat',flour:'flour',hops:'hops',ale:'ale',apples:'apples',cheese:'cheese',meat:'meat',bread:'bread',bows:'bows',xbows:'crossbows',spears:'spears',pikes:'pikes',maces:'maces',swords:'swords',armor:'armor',gold:'gold',honor:'honor'};
const RES_ONE = {bows:'bow',xbows:'crossbow',spears:'spear',pikes:'pike',maces:'mace',swords:'sword',armor:'armor'};
const RES_COL = {wood:'#e2b27a',stone:'#d8d2c4',iron:'#d49a7a',wheat:'#f0d27a',flour:'#f6eedd',hops:'#a9d46a',ale:'#e8b84a',apples:'#ff8a73',cheese:'#ffd86a',meat:'#ff9a8a',bread:'#e8b57a',gold:'#f2c35a',honor:'#c9a7ff',bows:'#e2b27a',xbows:'#e2b27a',spears:'#d8d2c4',pikes:'#d8d2c4',maces:'#d8d2c4',swords:'#e6e9ec',armor:'#c8ccd0'};
const CARRY_COL = {wood:'#8a5a32',stone:'#aaa496',iron:'#8b5a44',wheat:'#d8b450',flour:'#efe6d4',hops:'#6f9a3a',ale:'#b07a2a',apples:'#c43b2b',cheese:'#e8c04a',meat:'#a8443a',bread:'#c08a4a',gold:'#d6a03c'};
function storeOf(k){ return RES_KEYS.food.includes(k)?'gran':RES_KEYS.arms.includes(k)?'armory':'stock'; }

/* buildings. job types: tree, gather, hunt, craft, inn, well, rats, guard */
const DEF = {
  keep:{name:'Keep',w:4,h:4,hp:3000,fixed:true,castle:true,isKeep:true,desc:'Seat of a lord. Its garrison shoots at enemies close by. If yours falls, the level is lost.'},
  warcamp:{name:'War Camp',w:4,h:4,hp:2400,fixed:true,castle:true,isKeep:true,desc:'Your field headquarters. If it falls, the assault is over.'},
  stockpile:{name:'Stockpile',w:3,h:3,hp:1e9,fixed:true,desc:'Stores wood, stone, iron, wheat, flour, hops and ale.'},
  granary:{name:'Granary',w:2,h:2,hp:1e9,fixed:true,desc:'Stores apples, cheese, meat and bread.'},
  armory:{name:'Armory',w:3,h:2,hp:1e9,fixed:true,desc:'Stores every weapon and suit of armor your workshops make.'},
  barracks:{name:'Barracks',w:3,h:3,hp:900,cost:{wood:20,stone:10},desc:'Troops are trained here. You need one to recruit soldiers.'},
  wall:{name:'Stone Wall',w:1,h:1,hp:260,cost:{stone:1},castle:true,line:true,wallish:true,desc:'Raiders need ladders to get over it. Troops can walk the walls. Drag to build. Click a wall to add an oil cauldron.'},
  palisade:{name:'Palisade',w:1,h:1,hp:110,cost:{wood:1},castle:true,line:true,wallish:true,desc:'Cheap wooden wall. Weaker than stone. Drag to build.'},
  gatehouse:{name:'Gatehouse',w:2,h:3,hp:1400,cost:{stone:20},castle:true,gate:true,cap:4,desc:'Lets your peasants through the wall, and its drawbridge spans a moat. Raise the drawbridge to seal it. Holds 4 troops. Can be placed over a wall. R rotates.'},
  tower:{name:'Bastion Tower',w:2,h:2,hp:1000,cost:{stone:15},castle:true,cap:4,towerish:true,desc:'Holds 4 troops. Archers up here gain range and take far less damage. Can mount a mangonel or a ballista.'},
  greattower:{name:'Great Tower',w:3,h:3,hp:1900,cost:{stone:35},castle:true,cap:8,towerish:true,great:true,desc:'A tall keep-tower that holds 8 troops. Bowmen here gain the most range. Mount a mangonel up here and the field before it becomes no-man\'s-land.'},
  moat:{name:'Moat',w:1,h:1,cost:{gold:2},line:true,terrain:true,desc:'Rams, siege towers and catapults cannot cross it. Infantry wade slowly. Peasants need a drawbridge. Drag to dig. Engineers can fill an enemy moat.'},
  pit:{name:'Spike Pit',w:1,h:1,hp:1,cost:{wood:4},trap:true,desc:'Hidden from the enemy. Badly wounds the first one that steps in.'},
  woodcutter:{name:"Woodcutter's Hut",w:2,h:2,hp:140,cost:{wood:3},worker:true,wooden:true,job:{type:'tree',out:'wood',n:6,t:3},desc:'Fells nearby trees and hauls planks to the stockpile.'},
  quarry:{name:'Quarry',w:3,h:3,hp:220,cost:{wood:15},worker:true,needsTer:2,job:{type:'gather',out:'stone',n:5,t:5},desc:'Cuts stone. Must touch a rock outcrop.'},
  ironmine:{name:'Iron Mine',w:3,h:3,hp:220,cost:{wood:20},worker:true,needsTer:4,job:{type:'gather',out:'iron',n:4,t:7},desc:'Digs iron for maces, swords and armor. Must touch a rust-red iron deposit.'},
  market:{name:'Market',w:3,h:3,hp:300,cost:{wood:20,gold:50},wooden:true,desc:'Opens the Market tab, where you buy and sell goods.'},
  orchard:{name:'Apple Orchard',w:4,h:4,hp:110,cost:{wood:5},worker:true,wooden:true,farm:true,job:{type:'gather',out:'apples',n:8,t:7,inside:true},desc:'Grows apples for the granary. Idle in winter.'},
  dairy:{name:'Dairy Farm',w:3,h:3,hp:120,cost:{wood:10},worker:true,wooden:true,job:{type:'gather',out:'cheese',n:6,t:9,inside:true},desc:'Makes cheese for the granary. Slower in winter.'},
  hunter:{name:"Hunter's Post",w:2,h:2,hp:120,cost:{wood:5},worker:true,wooden:true,job:{type:'hunt',out:'meat',n:6},desc:'The hunter shoots deer and brings back meat, even in winter. Build near the forest.'},
  wheatfarm:{name:'Wheat Farm',w:4,h:4,hp:110,cost:{wood:10},worker:true,wooden:true,farm:true,job:{type:'gather',out:'wheat',n:8,t:8,inside:true},desc:'Grows wheat. A mill turns it into flour, a bakery into bread. Idle in winter.'},
  hopsfarm:{name:'Hops Farm',w:4,h:4,hp:110,cost:{wood:10},worker:true,wooden:true,farm:true,job:{type:'gather',out:'hops',n:8,t:8,inside:true},desc:'Grows hops for the brewery. Idle in winter.'},
  mill:{name:'Mill',w:2,h:2,hp:160,cost:{wood:15,gold:20},worker:true,wooden:true,job:{type:'craft',modes:[{in:{wheat:3},out:'flour',n:3,t:5,label:'Flour'}]},desc:'Grinds 3 wheat into 3 flour.'},
  bakery:{name:'Bakery',w:2,h:2,hp:140,cost:{wood:10,gold:20},worker:true,wooden:true,job:{type:'craft',modes:[{in:{flour:2},out:'bread',n:8,t:6,label:'Bread'}]},desc:'Bakes 2 flour into 8 bread.'},
  brewery:{name:'Brewery',w:2,h:2,hp:140,cost:{wood:10,gold:20},worker:true,wooden:true,job:{type:'craft',modes:[{in:{hops:2},out:'ale',n:2,t:6,label:'Ale'}]},desc:'Brews 2 hops into 2 ale.'},
  inn:{name:'Inn',w:3,h:3,hp:220,cost:{wood:20,gold:60},worker:true,wooden:true,job:{type:'inn'},desc:'The innkeeper carries ale from the stockpile and serves it. Ale raises popularity.'},
  hovel:{name:'Hovel',w:2,h:2,hp:140,cost:{wood:6},housing:8,wooden:true,desc:'Houses 8 more peasants.'},
  chapel:{name:'Chapel',w:3,h:3,hp:400,cost:{stone:10,gold:80},desc:'Popularity +2 and a little honor each week (up to 3 count). Monks are ordained here.'},
  cathedral:{name:'Cathedral',w:4,h:5,hp:1500,cost:{stone:120,gold:400},desc:'Popularity +4 and 2 honor every week. Monks are ordained here too.'},
  joustfield:{name:'Jousting Field',w:5,h:3,hp:300,cost:{wood:40,gold:100},wooden:true,desc:'Hold jousts from the Keep tab once you have 2 knights. Jousts earn great honor.'},
  well:{name:'Well',w:1,h:1,hp:120,cost:{wood:10},worker:true,job:{type:'well'},desc:'The well keeper runs to put out fires nearby.'},
  latrine:{name:'Latrine',w:1,h:1,hp:80,cost:{wood:4},wooden:true,desc:'Keeps the town cleaner, which keeps the rats away.'},
  ratcatcher:{name:"Rat Catcher's Hut",w:2,h:2,hp:120,cost:{wood:8},worker:true,wooden:true,job:{type:'rats'},desc:'Hunts rats and cleans up the town.'},
  guardpost:{name:'Guard Post',w:2,h:2,hp:200,cost:{wood:10},worker:true,wooden:true,job:{type:'guard'},desc:'A watchman patrols the streets, catches thieves and lowers crime.'},
  stocks:{name:'Stocks',w:1,h:1,hp:80,cost:{wood:6},wooden:true,fear:1,desc:'Lowers crime a little. Popularity -1. Fear makes workers 3% faster.'},
  gaol:{name:'Gaol',w:2,h:2,hp:400,cost:{stone:15,gold:40},fear:1,desc:'Lowers crime a lot. Popularity -1. Workers 3% faster.'},
  gallows:{name:'Gallows',w:2,h:2,hp:200,cost:{wood:10,stone:10},fear:2,desc:'Crime drops fast. Popularity -2. Fear makes workers 6% faster.'},
  rack:{name:'Torture Rack',w:2,h:2,hp:200,cost:{wood:20,gold:40},fear:3,desc:'The harshest deterrent. Popularity -3. Workers 9% faster.'},
  fletcher:{name:'Fletcher',w:2,h:2,hp:140,cost:{wood:20,gold:40},worker:true,wooden:true,job:{type:'craft',modes:[{in:{wood:2},out:'bows',n:1,t:6,label:'Bows'},{in:{wood:3},out:'xbows',n:1,t:8,label:'Crossbows'}]},desc:'Makes bows from 2 wood, or crossbows from 3.'},
  poleturner:{name:'Poleturner',w:2,h:2,hp:140,cost:{wood:20,gold:40},worker:true,wooden:true,job:{type:'craft',modes:[{in:{wood:1},out:'spears',n:1,t:5,label:'Spears'},{in:{wood:2},out:'pikes',n:1,t:7,label:'Pikes'}]},desc:'Makes spears from 1 wood, or pikes from 2.'},
  blacksmith:{name:'Blacksmith',w:2,h:2,hp:180,cost:{wood:20,gold:60},worker:true,job:{type:'craft',modes:[{in:{iron:1},out:'maces',n:1,t:6,label:'Maces'},{in:{iron:2},out:'swords',n:1,t:8,label:'Swords'}]},desc:'Forges maces from 1 iron, or swords from 2.'},
  armourer:{name:'Armourer',w:2,h:2,hp:180,cost:{wood:20,gold:60},worker:true,job:{type:'craft',modes:[{in:{iron:2},out:'armor',n:1,t:8,label:'Armor'}]},desc:'Makes metal armor from 2 iron.'},
  etent:{name:'War Tent',w:2,h:2,hp:600,enemy:true,desc:'Part of the warlord\'s camp.'},
  eworkshop:{name:'Siege Workshop',w:3,h:3,hp:1000,enemy:true,desc:'Builds the warlord\'s catapults and trebuchets. Destroy it to stop them.'},
  epavilion:{name:"Warlord's Pavilion",w:3,h:3,hp:1600,enemy:true,desc:'The warlord\'s command tent.'},
};
const TABS = [
  {id:'castle',name:'Castle',items:['wall','palisade','gatehouse','tower','greattower','moat','pit']},
  {id:'ind',name:'Industry',items:['woodcutter','quarry','ironmine','market','barracks']},
  {id:'farm',name:'Farms',items:['orchard','dairy','hunter','wheatfarm','hopsfarm']},
  {id:'food',name:'Food and ale',items:['mill','bakery','brewery','inn']},
  {id:'town',name:'Town',items:['hovel','chapel','cathedral','joustfield','well','latrine','ratcatcher']},
  {id:'law',name:'Law and order',items:['guardpost','stocks','gaol','gallows','rack']},
  {id:'weap',name:'Weapons',items:['fletcher','poleturner','blacksmith','armourer']},
  {id:'army',name:'Army'},
  {id:'keep',name:'Keep and court'},
  {id:'trade',name:'Market'},
];

/* units */
const UD = {
  peasant:{name:'Peasant',hp:25,speed:2.0,team:0},
  thief:{name:'Thief',hp:25,speed:2.3,team:0,thief:true},
  lord:{name:'Your lord',hp:800,speed:1.9,team:0,dmg:28,rate:1,mil:true,melee:true,lord:true,armor:.5},
  archer:{name:'Archer',hp:40,speed:1.8,team:0,range:7,dmg:9,rate:1.6,mil:true,ranged:true},
  xbow:{name:'Crossbowman',hp:60,speed:1.5,team:0,range:6.5,dmg:20,rate:2.6,mil:true,ranged:true,ap:true,armor:.8},
  spearman:{name:'Spearman',hp:80,speed:2.2,team:0,dmg:12,rate:1,mil:true,melee:true,antiSiege:2.5},
  pikeman:{name:'Pikeman',hp:170,speed:1.4,team:0,dmg:11,rate:1.1,mil:true,melee:true,armor:.5,antiSiege:2.5},
  maceman:{name:'Maceman',hp:110,speed:2.0,team:0,dmg:18,rate:.9,mil:true,melee:true,armor:.8},
  swordsman:{name:'Swordsman',hp:220,speed:1.2,team:0,dmg:28,rate:1.2,mil:true,melee:true,armor:.4},
  knight:{name:'Knight',hp:260,speed:2.8,team:0,dmg:30,rate:1.1,mil:true,melee:true,armor:.4,cav:true},
  monk:{name:'Monk',hp:60,speed:1.6,team:0,mil:true,healer:true,heal:5},
  engineer:{name:'Engineer',hp:30,speed:1.8,team:0,mil:true,eng:true},
  pladder:{name:'Ladderman',hp:30,speed:2.2,team:0,mil:true,pladder:true},
  pcatapult:{name:'Catapult',hp:300,speed:.7,team:0,mil:true,artillery:true,range:11,minRange:2.5,bdmg:70,splash:30,rate:4.5,big:true},
  ptreb:{name:'Trebuchet',hp:350,speed:.5,team:0,mil:true,artillery:true,range:16,minRange:4,bdmg:150,splash:18,rate:7,bldFirst:true,big:true},
  pram:{name:'Battering ram',hp:420,speed:.6,team:0,mil:true,siege:true,ram:true,bdmg:80,rate:2.2,arrowRes:.2,big:true},
  ptower:{name:'Siege tower',hp:700,speed:.5,team:0,mil:true,siege:true,stower:true,arrowRes:.15,big:true},
  cart:{name:'Supply cart',hp:140,speed:1.5,team:0,big:true,cart:true},
  caravan:{name:'Refugee caravan',hp:200,speed:1.05,team:0,big:true,cart:true,caravan:true},
  raider:{name:'Raider',hp:50,speed:1.25,team:1,dmg:7,bdmg:12,rate:1},
  earcher:{name:'Enemy archer',hp:32,speed:1.2,team:1,dmg:6,bdmg:2,rate:1.8,range:6.5,ranged:true},
  exbow:{name:'Enemy crossbowman',hp:55,speed:1.1,team:1,dmg:16,bdmg:3,rate:2.6,range:6.5,ranged:true,ap:true,armor:.8},
  eswords:{name:'Enemy swordsman',hp:180,speed:1.0,team:1,dmg:20,bdmg:20,rate:1.2,armor:.5},
  eknight:{name:'Enemy knight',hp:230,speed:2.5,team:1,dmg:24,bdmg:14,rate:1.1,armor:.45,cav:true},
  ladder:{name:'Ladderman',hp:30,speed:1.4,team:1,dmg:4,bdmg:3,rate:1,ladder:true},
  ram:{name:'Battering ram',hp:380,speed:.55,team:1,bdmg:70,rate:2.2,siege:true,arrowRes:.2,big:true},
  stower:{name:'Siege tower',hp:700,speed:.45,team:1,siege:true,stower:true,arrowRes:.15,big:true},
  ecat:{name:'Enemy catapult',hp:220,speed:.6,team:1,siege:true,artillery:true,range:10,minRange:2,bdmg:60,splash:25,rate:5,arrowRes:.5,big:true},
  etreb:{name:'Enemy trebuchet',hp:320,speed:.45,team:1,siege:true,artillery:true,range:15,minRange:4,bdmg:120,splash:15,rate:8,bldFirst:true,arrowRes:.5,big:true},
  warlord:{name:'Warlord',hp:900,speed:1.0,team:1,dmg:22,bdmg:35,rate:1,armor:.5,boss:true},
  elord:{name:'Enemy lord',hp:950,speed:1.6,team:1,dmg:26,bdmg:20,rate:1,armor:.5,boss:true,regen:2},
  rothgar:{name:'Rothgar the Grey',hp:1900,speed:1.3,team:1,dmg:34,bdmg:40,rate:1,armor:.45,boss:true,regen:3},
  wolf:{name:'Wolf',hp:45,speed:2.6,team:1,dmg:8,rate:.9,beast:true},
  deer:{name:'Deer',hp:20,speed:2.4,team:2,animal:true},
  rat:{name:'Rat',hp:6,speed:1.6,team:2,rat:true},
};
const RECRUIT = {
  archer:{w:{bows:1},gold:12},
  xbow:{w:{xbows:1},gold:20},
  spearman:{w:{spears:1},gold:8},
  pikeman:{w:{pikes:1,armor:1},gold:20},
  maceman:{w:{maces:1},gold:20},
  swordsman:{w:{swords:1,armor:1},gold:40},
  knight:{w:{swords:1,armor:1},gold:60,honor:15,rank:1},
  monk:{gold:30,needs:'chapel'},
  engineer:{gold:30},
  pladder:{gold:10},
  pram:{gold:100,wood:30,crew:1},
  ptower:{gold:150,wood:60,crew:2},
  pcatapult:{gold:150,wood:20,crew:2,rank:2},
  ptreb:{gold:250,wood:40,crew:3,rank:3},
};
const ARMY_ORDER = ['archer','xbow','spearman','pikeman','maceman','swordsman','knight','monk','engineer','pladder','pram','ptower','pcatapult','ptreb'];
const RANKS = [{n:'Squire',h:0},{n:'Knight',h:40},{n:'Baron',h:120},{n:'Earl',h:250},{n:'Duke',h:450}];
const RATIONS = [{n:'None',m:0,p:-8},{n:'Half',m:.5,p:-4},{n:'Normal',m:1,p:0},{n:'Extra',m:1.5,p:4},{n:'Double',m:2,p:8}];
const TAXES = [{n:'Bribe',g:-.6,p:4},{n:'None',g:0,p:1},{n:'Low',g:.4,p:0},{n:'Average',g:.8,p:-2},{n:'High',g:1.2,p:-4},{n:'Cruel',g:1.6,p:-7}];
const BANQUETS = [{n:'None',food:0,ale:0,gold:0,h:0},{n:'Modest',food:4,ale:1,gold:5,h:1},{n:'Fine',food:8,ale:2,gold:12,h:2},{n:'Lavish',food:14,ale:4,gold:25,h:3}];
const COURT = {
  feast:{name:'Hold a feast',cost:{food:40,ale:10,gold:50},honor:15,pop:4,weeks:5,desc:'+15 honor and popularity +4 for a while'},
  dance:{name:'Hold a dance',cost:{gold:60},honor:6,pop:3,weeks:4,desc:'+6 honor and popularity +3 for a while'},
  joust:{name:'Hold a joust',cost:{gold:150},honor:30,pop:2,weeks:4,needs:'joustfield',knights:2,desc:'+30 honor. Needs a jousting field and 2 knights'},
};
const PRICES = {wood:[6,3],stone:[10,5],iron:[30,15],wheat:[8,4],flour:[12,6],hops:[8,4],ale:[16,8],apples:[6,3],cheese:[8,4],meat:[8,4],bread:[8,4],bows:[50,20],xbows:[90,40],spears:[30,12],pikes:[60,25],maces:[70,30],swords:[110,50],armor:[100,45]};
const AI_LORDS = [
  {name:'Rothgar the Grey',color:'#b23c2c',dark:'#6e1d14',style:'aggressive',unit:'rothgar'},
  {name:'Lady Isolde',color:'#7a4fb0',dark:'#3e2560',style:'builder',unit:'elord'},
  {name:'Baron Mortlake',color:'#c4801c',dark:'#6a420c',style:'balanced',unit:'elord'},
];

/* map specs: forests, rocks, iron, lakes are [x,y,r]; ridges are [x,y0,y1]; hedges are [x0,y0,x1,y1] */
const MAPS = {
  hollow:{forest:[[5,6,6.5],[4,37,6],[22,3,5],[30,41,5],[47,6,5],[50,38,5],[33,21,2.2],[59,13,3],[59,31,3],[19,9,3],[19,35,3.2],[2,22,2.5],[36,9,3],[36,33,3]],scatter:110,rock:[[25,12,2.4],[23,32,2.2],[46,22,1.3]],iron:[[31,38,1.6]],ridge:[[40,7,17],[40,27,37]]},
  vale:{forest:[[4,5,6],[4,36,6.5],[22,2,4],[24,40,4],[44,4,5],[46,40,5],[40,14,4],[42,29,4],[60,6,4],[60,36,4],[27,22,2.5],[2,21,3],[52,13,3],[52,30,3]],scatter:140,rock:[[24,11,2.3],[22,31,2.1]],iron:[[47,23,1.5]]},
  river:{forest:[[4,5,5],[4,38,5],[20,2,3.5],[22,41,3.5],[48,6,5],[50,38,5],[58,22,4],[29,19,2],[44,20,3]],scatter:90,rock:[[21,9,2.3],[22,32,2.2]],iron:[[15,38,1.6]],river:{cx:37,amp:2.5,per:6,fords:[[9,11],[31,33]]}},
  fields:{forest:[[3,4,4],[3,40,4],[30,2,3],[34,42,3],[62,4,3],[62,40,3]],scatter:40,rock:[[18,8,2],[16,34,2]],iron:[[26,40,1.4]],hedge:[[24,6,24,16],[24,26,24,38],[34,4,34,14],[34,30,34,40],[44,10,44,20],[44,26,44,36],[30,22,40,22],[50,14,58,14],[50,30,58,30]]},
  moor:{forest:[[6,6,4],[6,40,4],[60,6,3.5],[60,42,3.5],[46,24,2.5],[12,24,3],[30,4,3],[34,44,3]],forestProb:.7,scatter:70,rock:[[18,12,2],[40,34,2],[50,14,1.6],[14,36,1.8]],iron:[[20,8,1.6],[40,39,1.6],[47,10,1.4]],ground:'moor'},
  greywater:{forest:[[4,5,5],[4,40,5],[24,3,4],[26,44,4],[66,4,4],[66,42,4],[36,24,2.5]],scatter:80,rock:[[16,9,2.3],[17,36,2.2]],iron:[[28,40,1.6]],lake:[[52,4,4],[56,44,3.5]]},
  winter:{forest:[[4,5,6],[4,38,6],[22,3,5],[28,40,5],[46,6,5],[50,38,5],[58,22,4],[34,22,2.5],[2,22,3]],scatter:150,rock:[[24,12,2.3],[22,31,2.1]],iron:[[44,22,1.4]],ground:'snow'},
  camp:{forest:[[4,5,5],[4,38,5],[20,2,4],[22,41,4],[30,12,2.5],[30,31,2.5],[46,5,4],[46,39,4],[66,4,3],[66,40,3]],scatter:90,rock:[[20,9,2.3],[19,32,2.2]],iron:[[26,38,1.6]],ridge:[[38,4,15],[38,29,40]]},
  brightwater:{forest:[[4,5,5],[4,38,5],[40,4,5],[44,40,5],[58,20,5],[30,30,3]],scatter:90,rock:[[34,12,2.2],[10,34,2]],iron:[[48,32,1.5]],lake:[[50,16,3.2]]},
  goldmere:{forest:[[4,5,5],[4,38,5],[50,4,4],[54,40,4]],scatter:60,rock:[[34,10,2.6],[36,30,2.5],[14,32,2],[48,20,2]],iron:[[38,20,2],[20,8,1.8],[52,34,1.8]],ground:'moor'},
  aldric:{forest:[[4,5,5],[4,38,5],[44,4,5],[46,40,5],[58,20,4]],scatter:100,rock:[[34,12,2.4],[34,30,2.4],[12,36,2]],iron:[[48,22,1.5]]},
  tourney:{forest:[[4,5,5],[4,38,5],[48,4,4],[50,40,4],[60,22,3]],scatter:70,rock:[[32,10,2.2],[30,34,2.2]],iron:[[46,24,1.5]]},
  km_twin:{forest:[[4,5,5],[4,42,5],[66,5,5],[66,42,5],[24,4,3],[46,44,3],[30,24,2],[42,24,2]],scatter:110,rock:[[18,10,2.2],[54,38,2.2],[20,36,1.8],[52,10,1.8]],iron:[[14,40,1.5],[58,8,1.5]],river:{cx:36,amp:2,per:7,fords:[[6,8],[22,26],[39,41]]}},
  km_crowns:{forest:[[20,16,4],[60,16,4],[20,44,4],[60,44,4],[40,4,4],[40,56,4],[4,30,4],[76,30,4]],scatter:150,rock:[[20,6,2],[60,6,2],[20,54,2],[60,54,2]],iron:[[30,30,1.5],[50,30,1.5],[40,20,1.4],[40,40,1.4]],lake:[[40,30,4]]},
  siege_field:{forest:[[4,5,5],[4,38,5],[26,3,4],[26,41,4],[62,4,3],[62,40,3]],scatter:70,rock:[[14,10,2],[14,34,2]],iron:[[22,40,1.4]]},
};

/* story: The Ember Crown, as told by Brother Anselm of Hollowmere */
const STORY = {
  w1:{intro:'Winter\'s end, in the year 1083. Duke Aldous of Varn lies three weeks in his tomb, and no heir stands to take the Ember Crown. Out of the eastern hills ride the Grey Company, sellswords who answer to Rothgar the Grey. Hollowmere is the first keep on their road, and you are its castellan. Hold it.',outro:'The Grey Company breaks against Hollowmere\'s walls and limps back east. Rothgar does not forget an insult.'},
  w2:{intro:'The barons of Varn will not follow a mere castellan. You need standing. Feast your knights, claim the estates of Wolfden Vale, and earn the king\'s notice before the snows. Wolves and raiders will test you.',outro:'The king\'s letter arrives under red wax. You are named lord of the vale, and the barons begin to listen.'},
  w3:{intro:'Rothgar\'s engineers have built ladders, siege towers and catapults. His host will cross the River Ash at its two fords. If Ashford falls, the road to the heartland lies open.',outro:'The Ash runs red, then clear again. The fords hold.'},
  w4:{intro:'Rothgar\'s riders are burning the farms east of Hollowmere. Six caravans of refugees are fleeing toward your gates. Ride out and bring at least four of them home before the riders catch them.',outro:'The refugees fill your hovels and your fields. Their hands will rebuild what was burned.'},
  w5:{intro:'Blackmoor is a hard town of miners and thieves, and Rothgar\'s agents are stirring it. Keep order, keep the rats from the granary, and hold against attacks from three sides.',outro:'Blackmoor\'s forges ring for you now. Swords for the war to come.'},
  w6:{intro:'Lady Isolde of Greywater has opened her gates to Rothgar. Her keep guards the western road. Take it. Ladders on the walls, rams at the gate, and the lady\'s banner in the dust.',outro:'Greywater falls. Isolde flees east to her master with what is left of her household.'},
  w7:{intro:'The worst winter in living memory closes over Varn. No crop will grow until spring. Fill your granary while you can, keep your people alive, and hold until the thaw.',outro:'Spring comes late, but it comes. Hollowmere\'s banners still fly over a living town.'},
  w8:{intro:'Rothgar has made camp on the eastern plain with every engine he owns. End it. Burn his camp to the ground and face the Grey himself.',outro:'Rothgar the Grey falls on the plain he meant to rule from. The barons of Varn kneel, and the Ember Crown is yours.'},
  p1:{intro:'The war is over and the people of Varn come home. Build Brightwater into a town of eighty souls, and keep them content while you do it.',outro:'Brightwater hums with markets and gossip. Peace suits it.'},
  p2:{intro:'The war emptied your treasury. Goldmere sits on stone and iron. Mine it, sell it, and fill the coffers with three thousand gold.',outro:'The coffers are full. Your steward weeps with relief.'},
  p3:{intro:'The bishop asks for a cathedral where Saint Aldric fell. Raise it, and raise the honor of Varn with it.',outro:'The bells of Saint Aldric\'s ring across the March for the first time.'},
  p4:{intro:'The king rides to Varn for a great tournament. Build the lists, raise six knights, and hold three jousts in his honor.',outro:'The king raises his cup to the Duke of Varn. The quiet years have begun.'},
};

const CAMPAIGNS = {
  war:{name:'The Ember Crown',sub:'The war campaign',map:'war'},
  peace:{name:'The Quiet Years',sub:'The peace campaign',map:'peace'},
};
const LEVELS = [
  {id:'w1', camp:'war', name:'Hollowmere', sub:'The first siege', tag:'Defend', map:'hollow', W:64, H:44, keep:{x:12,y:20}, seed:20261026,
   goal:{type:'survive'}, goals:['Survive 5 waves','Keep your lord and your keep alive'],
   start:{wood:150,stone:40,apples:80,gold:400,bows:6,spears:2}, peasants:10, troops:{archer:2}, prebuilt:['barracks'],
   firstWave:240, gap:150, crime:.4, dirt:.4, events:['harvest','gift','merchant'], evGap:[120,200],
   waves:[{raider:6,dirs:['e']},{raider:8,earcher:4,dirs:['e']},{raider:10,earcher:5,ram:1,dirs:['e']},{raider:12,earcher:6,ladder:3,ram:1,dirs:['e','ne']},{raider:16,earcher:8,ladder:4,ram:2,warlord:1,dirs:['e','ne','se']}],
   date:{y:1083,m:3}},
  {id:'w2', camp:'war', name:'Wolfden Vale', sub:'Honor and estates', tag:'Honor', map:'vale', W:64, H:44, keep:{x:13,y:19}, seed:7741,
   goal:{type:'honor', honor:220, estates:2, by:1260}, goals:['Earn 220 honor','Own 2 estates','Do it within 21 minutes','Keep your lord and keep alive'],
   start:{wood:200,stone:30,apples:60,wheat:20,gold:500,bows:4,spears:4}, peasants:12, troops:{archer:4,spearman:2}, prebuilt:['barracks'],
   firstWave:330, gap:300, crime:.7, dirt:.6, events:['wolves','harvest','gift','merchant','wolves'], evGap:[90,140],
   estates:[{x:33,y:6,name:'Ashby',yield:{wheat:10},desc:'wheat',cost:40},{x:34,y:37,name:'Thornfield',yield:{gold:20},desc:'gold',cost:50},{x:54,y:21,name:'Mossgate',yield:{iron:6,stone:6},desc:'iron and stone',cost:60}],
   waves:[{raider:6,earcher:2,dirs:['e']},{raider:10,earcher:4,ladder:2,dirs:['e','ne']},{raider:14,earcher:6,ram:1,dirs:['e','se']}],
   date:{y:1084,m:2}},
  {id:'w3', camp:'war', name:'Ashford Crossing', sub:'Hold the river', tag:'Defend', map:'river', W:64, H:44, keep:{x:10,y:19}, seed:9113,
   goal:{type:'survive'}, goals:['Survive 6 waves','Keep your lord and your keep alive'],
   start:{wood:220,stone:140,apples:100,gold:800,bows:8,spears:4}, peasants:14, troops:{archer:4,engineer:2}, prebuilt:['barracks'],
   firstWave:270, gap:150, crime:.8, dirt:.8, events:['harvest','merchant','fire'], evGap:[120,180],
   waves:[{raider:8,earcher:4,dirs:['e']},{raider:10,earcher:6,ladder:4,dirs:['e']},{raider:12,earcher:6,ladder:4,stower:1,dirs:['e']},{raider:12,earcher:8,eswords:3,ecat:1,ram:1,dirs:['e']},{raider:16,earcher:8,eswords:4,stower:2,ecat:2,ladder:4,dirs:['e','ne']},{raider:20,earcher:10,eswords:6,stower:2,ecat:2,ram:2,warlord:1,dirs:['e','ne','se']}],
   date:{y:1084,m:5}},
  {id:'w4', camp:'war', name:'The Burning Fields', sub:'Bring them home', tag:'Escort', map:'fields', W:64, H:44, keep:{x:10,y:19}, seed:6262,
   goal:{type:'escort', need:4, total:6}, goals:['Bring 4 of the 6 refugee caravans to your campfire','Survive the riders','Keep your lord and keep alive'],
   start:{wood:200,stone:60,apples:100,gold:600,bows:8,spears:6,swords:2,armor:2}, peasants:12, troops:{archer:6,spearman:4,maceman:4,knight:2}, prebuilt:['barracks'],
   firstWave:220, gap:190, crime:.6, dirt:.6, events:['harvest','merchant'], evGap:[120,180], honorTotal:45, honor:20,
   caravans:{times:[40,120,200,280,360,440]},
   waves:[{raider:6,eknight:2,dirs:['e']},{raider:8,earcher:4,eknight:3,dirs:['e','ne']},{raider:10,earcher:6,eknight:4,ram:1,dirs:['e','se']}],
   date:{y:1084,m:8}},
  {id:'w5', camp:'war', name:'Blackmoor', sub:'A town under fire', tag:'Defend', map:'moor', W:68, H:48, keep:{x:28,y:21}, seed:4242,
   goal:{type:'survive'}, goals:['Survive 6 waves from three sides','Keep order in the town','Keep your lord and your keep alive'],
   start:{wood:260,stone:90,iron:20,apples:140,cheese:60,bread:30,gold:700,bows:6,maces:2}, peasants:20, troops:{archer:6,maceman:2}, prebuilt:['barracks'],
   firstWave:300, gap:150, crime:1.4, dirt:1.4, startCrime:12, startDirt:22, events:['fire','rats','bandits','merchant','harvest'], evGap:[80,140],
   waves:[{raider:8,earcher:4,dirs:['e']},{raider:10,earcher:6,fire:true,dirs:['n','s']},{raider:12,earcher:8,eswords:2,ladder:4,fire:true,dirs:['e','n']},{raider:14,earcher:8,eswords:4,ram:2,fire:true,dirs:['e','s']},{raider:18,earcher:10,eswords:6,stower:1,ecat:1,fire:true,dirs:['e','n','s']},{raider:22,earcher:12,eswords:8,ram:2,stower:2,ecat:2,warlord:1,fire:true,dirs:['e','n','s']}],
   date:{y:1085,m:5}},
  {id:'w6', camp:'war', name:'Greywater Keep', sub:'Take the western road', tag:'Assault', map:'greywater', W:72, H:48, keep:{x:7,y:20}, seed:3131, keepType:'warcamp',
   goal:{type:'conquer'}, goals:['Destroy Greywater\'s keep or defeat Lady Isolde','Keep your lord and your war camp alive'],
   start:{wood:300,stone:80,iron:30,apples:150,bread:40,gold:1100,bows:6,spears:6,maces:6,swords:2,armor:2}, peasants:14, troops:{archer:10,xbow:4,spearman:6,maceman:6,swordsman:2,pladder:6,engineer:6,pcatapult:2,ptreb:1}, prebuilt:['barracks'], honorTotal:130, honor:30,
   firstWave:1e9, gap:1e9, crime:.6, dirt:.6, events:['merchant','harvest'], evGap:[140,200], waves:[],
   enemyCastle:{kind:'large', x:50, y:15, face:'W', ai:1, garrison:{earcher:10,exbow:4,eswords:6,raider:8}, sortie:200},
   date:{y:1086,m:4}},
  {id:'w7', camp:'war', name:'The Long Winter', sub:'Hold until the thaw', tag:'Survive', map:'winter', W:64, H:44, keep:{x:14,y:20}, seed:1212, monthLen:120,
   goal:{type:'winter', until:{y:1088,m:3}, peasants:30}, goals:['Hold until April','Have at least 30 peasants when spring comes','Keep your lord and keep alive'],
   start:{wood:220,stone:80,apples:120,cheese:40,meat:30,gold:600,bows:8,spears:4}, peasants:22, troops:{archer:6,spearman:4}, prebuilt:['barracks'], longWinter:true,
   firstWave:300, gap:130, crime:.8, dirt:.7, events:['wolves','wolves','harvest','merchant'], evGap:[70,120],
   waves:[{raider:8,earcher:4,dirs:['e']},{raider:10,earcher:6,ladder:3,dirs:['e','n']},{raider:12,earcher:6,eknight:3,ram:1,dirs:['e']},{raider:14,earcher:8,eswords:3,ladder:4,dirs:['e','n','s']}],
   date:{y:1087,m:9}},
  {id:'w8', camp:'war', name:"The Warlord's Reckoning", sub:'Face the Grey', tag:'Assault', map:'camp', W:72, H:44, keep:{x:9,y:19}, seed:5150,
   goal:{type:'destroy', boss:true}, goals:['Destroy every building in Rothgar\'s camp','Slay Rothgar the Grey','Keep your lord and your keep alive'],
   start:{wood:320,stone:160,iron:40,apples:120,bread:40,gold:1300,bows:8,spears:4,maces:4,swords:2,armor:2}, peasants:20, troops:{archer:6,spearman:4,maceman:4,engineer:4}, prebuilt:['barracks'], honorTotal:130, honor:40,
   firstWave:300, gap:170, crime:.8, dirt:.8, events:['gift','merchant','bandits'], evGap:[120,180], endless:true,
   ecamp:{x:59,y:20}, boss:'rothgar',
   date:{y:1088,m:4}},
  {id:'p1', camp:'peace', name:'Brightwater', sub:'A town of eighty', tag:'Grow', map:'brightwater', W:64, H:44, keep:{x:18,y:18}, seed:8801,
   goal:{type:'pop', peasants:80, popularity:70}, goals:['Grow to 80 peasants','With popularity at 70 or more'],
   start:{wood:250,stone:60,apples:120,gold:600}, peasants:12, troops:{}, prebuilt:['barracks'],
   firstWave:1e9, gap:1e9, crime:.8, dirt:.8, events:['harvest','merchant','rats','wolves'], evGap:[100,160], waves:[],
   date:{y:1089,m:3}},
  {id:'p2', camp:'peace', name:'Goldmere', sub:'Fill the coffers', tag:'Trade', map:'goldmere', W:64, H:44, keep:{x:22,y:18}, seed:5577,
   goal:{type:'gold', gold:3000, by:1500}, goals:['Hold 3000 gold at once','Within 25 minutes'],
   start:{wood:220,stone:40,apples:100,gold:300}, peasants:14, troops:{archer:2}, prebuilt:['barracks'],
   firstWave:1e9, gap:1e9, crime:1, dirt:.8, events:['merchant','merchant','bandits','harvest'], evGap:[90,150], waves:[],
   date:{y:1089,m:5}},
  {id:'p3', camp:'peace', name:"Saint Aldric's Rest", sub:'A cathedral for Varn', tag:'Build', map:'aldric', W:64, H:44, keep:{x:20,y:18}, seed:3003,
   goal:{type:'cathedral', honor:150}, goals:['Build the cathedral','Earn 150 honor'],
   start:{wood:250,stone:80,apples:120,gold:500}, peasants:14, troops:{}, prebuilt:['barracks'],
   firstWave:1e9, gap:1e9, crime:.8, dirt:.8, events:['harvest','gift','merchant','fire'], evGap:[100,160], waves:[],
   date:{y:1090,m:3}},
  {id:'p4', camp:'peace', name:'The Royal Tournament', sub:'The king rides to Varn', tag:'Tourney', map:'tourney', W:64, H:44, keep:{x:18,y:18}, seed:7007,
   goal:{type:'tourney', jousts:3, knights:6}, goals:['Raise 6 knights','Hold 3 jousts'],
   start:{wood:300,stone:80,iron:30,apples:140,gold:900}, peasants:16, troops:{}, prebuilt:['barracks'], honorTotal:20,
   firstWave:1e9, gap:1e9, crime:.8, dirt:.8, events:['harvest','gift','merchant'], evGap:[100,160], waves:[],
   date:{y:1090,m:4}},
];
function campWave(k, workshops){
  const w={raider:6+3*k, earcher:3+2*k, eswords:k, dirs:['camp']};
  if(k>=1) w.ladder=3;
  if(k>=2) w.ram=1;
  if(k>=3) w.eknight=Math.min(6,k-1);
  if(workshops>0){ if(k>=2) w.ecat=1+(k>=4?1:0); if(k>=3) w.etreb=1+(k>=6?1:0); if(k>=3) w.stower=1; }
  return w;
}
/* Kingmaker maps */
const KM_MAPS = [
  {id:'km_twin', name:'Twin Rivers', W:72, H:48, seed:4411, desc:'Two lords on either side of a river with three fords.', player:{x:8,y:21}, slots:[{x:59,y:22}],
   estates:[{x:24,y:6,name:'Ashby',yield:{wheat:10},desc:'wheat',cost:40},{x:24,y:40,name:'Fenwick',yield:{gold:20},desc:'gold',cost:50},{x:48,y:8,name:'Harrowgate',yield:{stone:8},desc:'stone',cost:40},{x:48,y:40,name:'Coldbrook',yield:{iron:6},desc:'iron',cost:50}]},
  {id:'km_crowns', name:'Four Crowns', W:80, H:60, seed:9944, desc:'Four keeps at the corners of a lake country.', player:{x:7,y:45}, slots:[{x:7,y:8},{x:67,y:8},{x:67,y:45}],
   estates:[{x:40,y:14,name:'Northmere',yield:{wheat:10},desc:'wheat',cost:40},{x:40,y:46,name:'Southmere',yield:{gold:20},desc:'gold',cost:50},{x:26,y:30,name:'Westbridge',yield:{stone:8},desc:'stone',cost:40},{x:54,y:30,name:'Eastbridge',yield:{iron:6},desc:'iron',cost:50},{x:40,y:24,name:'Lakeholm',yield:{apples:12},desc:'apples',cost:40}]},
];
/* Siege mode castles */
const SIEGE = [
  {id:'thornwall', name:'Thornwall', kind:'small', desc:'A compact stone castle with four towers.'},
  {id:'ravenscar', name:'Ravenscar', kind:'large', desc:'A great castle with six towers, a moat and boiling oil.'},
];
const EVENTS = {harvest:{},gift:{},merchant:{},wolves:{},fire:{},rats:{},bandits:{}};

/* icons */
const RES_ICON = {
  wood:'<svg viewBox="0 0 16 16"><rect x="1" y="5" width="13" height="6" rx="3" fill="#8a5a32"/><ellipse cx="13" cy="8" rx="2.4" ry="3" fill="#d2a46a"/><circle cx="13" cy="8" r="1" fill="#8a5a32"/></svg>',
  stone:'<svg viewBox="0 0 16 16"><path d="M2 12 4 5l5-2 5 4-1 6z" fill="#a9a396"/><path d="M4 5l5-2 5 4-5 1z" fill="#cfc9bb"/></svg>',
  iron:'<svg viewBox="0 0 16 16"><path d="M2 11l3-6h7l2 6z" fill="#8b5a44"/><path d="M5 5h7l1 2H4z" fill="#c08066"/></svg>',
  food:'<svg viewBox="0 0 16 16"><circle cx="8" cy="9.5" r="5.5" fill="#c43b2b"/><path d="M8 4c0-2 1-3 3-3" stroke="#5b3a1a" stroke-width="1.4" fill="none"/><ellipse cx="6" cy="7.5" rx="1.4" ry="1" fill="#f08a73"/></svg>',
  gold:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="#d6a03c"/><circle cx="8" cy="8" r="4.3" fill="none" stroke="#9a6d1c" stroke-width="1.2"/></svg>',
  honor:'<svg viewBox="0 0 16 16"><path d="M8 1l2 4 5 .7-3.6 3.4.9 5L8 11.8 3.7 14l.9-5L1 5.7 6 5z" fill="#b99af0"/></svg>',
  people:'<svg viewBox="0 0 16 16"><circle cx="8" cy="4.5" r="3" fill="#e2c08f"/><path d="M2.5 15c0-5 11-5 11 0z" fill="#e2c08f"/></svg>',
  pop:'<svg viewBox="0 0 16 16"><path d="M8 14 2 8a3.5 3.5 0 0 1 6-4 3.5 3.5 0 0 1 6 4z" fill="#d9655a"/></svg>',
};
const TAB_ICON = {
  castle:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h3v2h2V4h3v2h2V4h3v2h2V4h3v6h-2v11H5V10H3z"/><path d="M10 21v-5a2 2 0 0 1 4 0v5z" fill="#1a120b"/></svg>',
  ind:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 20 15 9l2 2L6 22z"/><path d="M13 3c4 0 8 3 8 8l-3 1c0-3-2-5-5-5z"/></svg>',
  farm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V8"/><path d="M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zm0 4c3 0 5-2 5-5-3 0-5 2-5 5zm0 4c-3 0-5-2-5-5 3 0 5 2 5 5z" fill="currentColor"/></svg>',
  food:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13c0-5 4-8 9-8s9 3 9 8v2H3z"/><path d="M3 17h18v3H3z"/><path d="M8 9l1 3m3-4v4m3-3-1 3" stroke="#1a120b" stroke-width="1.5"/></svg>',
  town:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11h3v10h14V11h3z"/><path d="M10 21v-6h4v6z" fill="#1a120b"/></svg>',
  law:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 21V4h12v4"/><path d="M17 8v3"/><circle cx="17" cy="13" r="2"/><path d="M3 21h8"/></svg>',
  weap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2q16 10 0 20"/><path d="M6 2v20" stroke-width="1"/><path d="M3 12h17m-3-3 3 3-3 3"/></svg>',
  army:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 6 4 9 8 11 4-2 8-5 8-11V5z"/><path d="M12 6v12M8 10h8" stroke="#1a120b" stroke-width="2"/></svg>',
  keep:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/><rect x="5" y="20" width="14" height="2"/></svg>',
  trade:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 21h14M4 7h16"/><path d="M4 7l-3 7h6zM20 7l-3 7h6z" fill="currentColor"/></svg>',
  demo:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 3l7 7-3 3-7-7z"/><path d="M12 9l3 3-9 9-3-3z"/></svg>',
};
