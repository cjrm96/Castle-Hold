# Castle Siege

Version 1.1.0. A browser castle building and siege game. Plain script files and a canvas, with three.js for the 3D view. No framework and no bundler.

## The packages

| File | What it is |
| --- | --- |
| `castle-siege-web.zip` | Full game for any web host (GitHub Pages, your own site) |
| `castle-siege-itch.zip` | Same full game with `index.html` at the top of the zip, for itch.io browser play |
| `castle-siege-demo-crazygames.zip` | Free demo with the CrazyGames ad toolkit. Ads only play between battles |
| `castle-siege-demo-poki.zip` | Free demo with the Poki ad toolkit |
| `castle-siege-desktop.zip` | Steam desktop app (Electron). See `docs/DESKTOP.md` |
| `castle-siege.html` | The whole game in one file, for phones and offline play |

None of these are kept in the repo. `python3 build.py` writes them all to `dist/`, which git ignores. Pushing to `main` builds the web package and publishes it to GitHub Pages (`.github/workflows/pages.yml`).

## Build and run

```sh
python3 build.py                          # Python 3, no packages needed; writes everything to dist/
cd dist/castle-siege && python3 -m http.server 8000
# open http://localhost:8000
```

Edit files in `game/`, never in `dist/`. `game/index.html` has no doctype or head on purpose, because `build.py` wraps it. `build.py` also rewrites `game/config.js` for each package: edition, ads, platform, expansion packs and store links.

## Layout

| Path | What it holds |
| --- | --- |
| `game/` | The game. `index.html` loads the scripts in this order and they share globals: config, data, world, sim, ai, modes, render, render3d, save, editor, ui, platform, achievements, tutorial, menus |
| `game/music`, `game/sfx`, `game/fonts` | Rendered audio and bundled fonts (licenses in `docs/CREDITS.md`) |
| `build.py` | Makes every package |
| `desktop/` | Electron main process, preload bridge, `package.json` |
| `docs/` | README (modes, controls, file map), DEMO, DESKTOP (Steam setup and achievement names), CREDITS |
| `audio/` | `compose.py` writes the soundtrack as MIDI into `mid/`. `sfx.py` synthesizes the sound effects. Render with fluidsynth and the FluidR3_GM soundfont, convert to MP3, then copy into `game/music` and `game/sfx` |

## Where things live in the code

- **Simulation:** `sim.js` (units, combat, economy), `world.js` (map, pathing, flow fields), `ai.js` (computer lords, surrender, prison camp), `modes.js` (levels, waves, estates, goals)
- **Free for all:** hostility is decided per lord in `sim.js` (`lordOf`, `foe`). Each lord's keep gets its own flow fields on demand in `world.js` (`ffaField`)
- **Huge maps:** terrain is drawn at reduced resolution so it fits phone memory (`TSC` in `world.js`)
- **Views:** 2D in `render.js`, 3D in `render3d.js`. Computers start in 3D and phones in 2D, and the player's choice is remembered
- **Saves:** browser local storage. On claude.ai, the page's private store
- **Ads, Steam and the demo:** `platform.js`. Steam achievement names live in `achievements.js` and are listed in `docs/DESKTOP.md`
- **Test hook:** `window.__hm` exposes the game state and level builders for automated browser tests

## Still to do before launch

1. Steam: set `STEAM.appId` and `STEAM.dlc.frontier` in `desktop/main.js`, then add the 30 achievements in Steamworks.
2. Store links: fill `storeUrl` and `packUrl` in the `config()` defaults in `build.py`, so the demo's "Get the full game" button appears.
3. Multiplayer is not built.
