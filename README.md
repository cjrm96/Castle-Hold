# Hollowmere Keep

A castle building and siege game for the browser, in the spirit of Stronghold 2. Every mission, map and character is original.

## Play

Open `index.html` in a browser. No build step and no install.

To host it, push this folder to a GitHub repository and turn on GitHub Pages (Settings, Pages, deploy from the main branch, root folder). The game is then live at `https://<your-name>.github.io/<repo>/`.

## What is in it

- The Ember Crown: an 8 mission war campaign
- The Quiet Years: a 4 mission peace campaign
- Kingmaker: up to 3 rival lords who build castles, claim estates and march on you
- Siege: attack or defend Thornwall or Ravenscar
- Free build on 7 maps, with or without raids
- Scenario editor: paint terrain, place keeps, rival lords and estates
- Seasons, estates and supply carts, feasts, dances and jousts, crime and punishment
- Save slots plus autosave, and an optional 3D view

## Controls

| Input | Action |
| --- | --- |
| Click | Place the chosen building. Drag for walls and moats. R rotates a gatehouse |
| Drag | Box select troops. Double click a soldier to select all of that type on screen |
| Right click | Move, attack, garrison a tower, raise a ladder, fill a moat |
| Storm castle | Sends the selected army at the nearest enemy castle |
| Shift 1 to 5, then 1 to 5 | Save and recall squads |
| L / G | Select your lord / raise every drawbridge |
| V, then Q and E | 3D view, then turn it |
| WASD, scroll | Pan and zoom. Space pauses |

## Files

```
index.html     page layout, styles, script order
js/            game code
vendor/        three.js (3D view only)
```

| File | What it does |
| --- | --- |
| `index.html` | Page layout and styles |
| `js/data.js` | Buildings, troops, maps, story, missions |
| `js/world.js` | Map generation, terrain art, pathfinding |
| `js/sim.js` | Economy, peasants, combat, troop behavior |
| `js/ai.js` | Castle layouts and rival lords |
| `js/modes.js` | Level setup, waves, estates, court, win and loss |
| `js/render.js` | 2D drawing |
| `js/render3d.js` | 3D view, loads `vendor/three.min.js` on demand |
| `js/save.js` | Save games, progress and custom scenarios |
| `js/editor.js` | Scenario editor |
| `js/ui.js` | Sound, music, input, panels |
| `js/menus.js` | Title, campaigns, setup screens, main loop |

Saves and scenarios are kept in the browser's local storage.

## Credits

`vendor/three.min.js` is three.js r128, MIT license, copyright 2010 to 2021 three.js authors.
