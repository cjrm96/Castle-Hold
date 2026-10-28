# Castle Siege

Medieval castle building and siege warfare in the browser. Build a town, raise walls, hold them against waves, and storm your rivals' castles.

## Play

Open `index.html` in a browser. No build step and no install.

To host it, push this folder to a GitHub repository and turn on GitHub Pages (Settings, Pages, deploy from the main branch, root folder).

For itch.io, upload `castle-siege-itch.zip` as an HTML project and tick "This file will be played in the browser". Its `index.html` sits at the top of the zip, as itch.io expects.

## What is in it

| Mode | What you do |
| --- | --- |
| Tutorial | Ten guided steps: economy, walls, towers, recruiting, defending, attacking |
| War campaign | 8 missions of siege and defense |
| Builder campaign | 4 missions of towns, trade and honor |
| Frontier campaign | Expansion pack: 5 harder missions on new lands |
| Skirmish | You against up to three computer lords on 4 maps |
| Free for all | Up to ten lords on one huge map, 168 by 120 tiles. Every lord fights every other lord |
| Siege | Storm or hold Thornwall or Ravenscar on Easy, Normal or Hard |
| Free build | 7 lands, with or without raids |
| Map editor | Paint a land, place keeps and rivals, share it as a code or a file |

Beat a rival lord and his castle, farms, estates, stores and people become yours. You decide what happens to his soldiers: take them into your army, send them to a prison camp for ransom, or let them go home for honor.

Also: 30 achievements, a written soundtrack that turns to battle music when fighting starts, settings for volume, scrolling, autosave and health bars, save slots, and a 3D view that is the default on computers. Phones start on the 2D map. Press V to switch; the game remembers your pick.

## Controls

| Input | Action |
| --- | --- |
| Click | Place the chosen building. Drag for walls and moats. R rotates a gatehouse |
| Drag | Box select troops. Double click a soldier to select all of that type on screen |
| Right click | Move, attack, or garrison a tower. Right click an enemy castle and each soldier takes his job |
| Storm castle | Lines up out of range of the enemy bows and engines, waits for the rams and siege towers, then charges |
| Aggressive | On: troops attack anything nearby. Off: they guard where you put them |
| Battle line | Heavy foot in front, bowmen behind, siege engines at the back |
| Shift 1 to 5, then 1 to 5 | Save and recall squads |
| L / G | Select your lord / raise every drawbridge |
| V, then Q and E | 3D view, then turn it |
| WASD, scroll | Pan and zoom. Space pauses |

## Builds

`config.js` decides what a build is. The packaging script writes it for each one.

| Setting | Values |
| --- | --- |
| `edition` | `full` or `demo` (demo: first 3 war missions, first builder mission, Thornwall, one skirmish map, no editor) |
| `ads` | `none`, `crazygames` or `poki`. Ads only play between battles |
| `platform` | `web` or `steam` |
| `packs` | Expansion packs this build includes, for example `["frontier"]` |
| `storeUrl` | Where the demo sends players for the full game |

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout and styles |
| `config.js` | Build settings |
| `data.js` | Buildings, troops, maps, missions |
| `world.js` | Map generation, terrain art, pathfinding |
| `sim.js` | Economy, peasants, combat, troop behavior |
| `ai.js` | Castle layouts and rival lords |
| `modes.js` | Level setup, waves, estates, court, win and loss |
| `render.js` | 2D drawing, including soldiers and siege engines |
| `render3d.js` | 3D view, loads `three.min.js` on demand |
| `save.js` | Saves, progress, achievements, custom maps |
| `editor.js` | Map editor and map sharing |
| `ui.js` | Settings, sound, music, input, panels |
| `platform.js` | Ads between battles, Steam bridge, demo limits |
| `achievements.js` | Achievements and their screen |
| `tutorial.js` | The guided tutorial |
| `menus.js` | Title, campaigns, setup screens, main loop |
| `music/`, `sfx/` | Soundtrack and sound effects (MP3) |
| `fonts/` | Bundled fonts |

Saves and maps are kept in the browser's local storage. See `CREDITS.md` for licenses.
