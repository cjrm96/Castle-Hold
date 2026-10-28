# Castle Siege: desktop app for Steam

The full game in its own window, built with Electron. It talks to Steam for achievements and the expansion pack.

## Run it

```sh
npm install
npm start
```

F11 or Alt+Enter switches full screen.

## Connect it to Steam

1. In Steamworks, create the app and note its app id. Create the Frontier campaign as a DLC and note its app id.
2. In `main.js`, set `STEAM.appId` and `STEAM.dlc.frontier`. With `dlc.frontier` left at 0 the expansion ships with the base game.
3. In Steamworks, add these achievements with exactly these API names:

| API name | Name | Unlocks when |
| --- | --- | --- |
| `TUTORIAL` | Squire | Finish the tutorial |
| `FIRST_WIN` | First Victory | Win any mission or battle |
| `WAR_CAMPAIGN` | Warlord Slayer | Finish the war campaign |
| `BUILDER_CAMPAIGN` | Master Builder | Finish the builder campaign |
| `FRONTIER_CAMPAIGN` | Frontier Lord | Finish the frontier campaign |
| `ALL_STARS` | Flawless | Earn three stars on every war campaign mission |
| `SIEGE_THORN_HARD` | Thornwall Taken | Take Thornwall on Hard |
| `SIEGE_RAVEN_HARD` | Ravenscar Taken | Take Ravenscar on Hard |
| `SIEGE_HOLD_HARD` | Unbroken | Hold a castle through every wave on Hard |
| `LIGHT_LOSSES` | Few Fell | Take a castle in Siege mode and lose fewer than 5 soldiers |
| `SKIRMISH_WIN` | Conqueror | Win a skirmish |
| `SKIRMISH_THREE` | Last Lord Standing | Beat three rivals in one skirmish |
| `SKIRMISH_HARD` | Iron Will | Win a skirmish on Hard |
| `FFA_WIN` | Last Banner | Win a free for all |
| `FFA_TEN` | King of Ten | Win a free for all against nine rivals |
| `RAM_GATE` | Knock Knock | Break an enemy gatehouse with a battering ram |
| `TOWER_DOCK` | Over the Top | Dock a siege tower against an enemy wall |
| `TOWER_TOPPLER` | Tower Toppler | Bring down an enemy tower with a catapult or trebuchet |
| `MOAT_FILL` | Ditch Diggers | Fill 10 moat tiles in one battle |
| `LORD_DUEL` | Lord's Justice | Slay an enemy lord with your own lord |
| `KILLS_1000` | A Thousand Fallen | Defeat 1,000 enemies across all your games |
| `POP_100` | Bustling Town | Have 100 peasants at once |
| `GOLD_5000` | Full Coffers | Hold 5,000 gold at once |
| `RANK_TOP` | Duke | Reach the highest rank |
| `WALLS_200` | Great Wall | Have 200 wall sections standing at once |
| `TURNCOATS` | New Banners | Take 10 or more of a beaten lord's soldiers into your army |
| `WARDEN` | Warden | Hold 10 or more prisoners in your prison camp |
| `MERCY` | Mercy | Send 10 or more of a beaten lord's soldiers home |
| `MAPMAKER` | Cartographer | Save a map in the editor |
| `HERALD` | Herald | Share a map code |

4. Build the folder Steam needs:

```sh
npm run dist:win      # dist/win-unpacked
npm run dist:linux    # dist/linux-unpacked
npm run dist:mac      # dist/mac (build this one on a Mac)
```

5. Upload the unpacked folder with SteamPipe and set the launch option to `Castle Siege.exe` (Windows) or `castle-siege` (Linux).

`steamworks.js` already includes the Steam runtime libraries for Windows, Linux and Mac.

## How it is wired

- `main.js` serves the game from `app://game`, starts Steam, and answers three requests: unlock an achievement, list owned expansions, open a store link in the Steam overlay.
- `preload.js` exposes exactly those three to the page as `window.steam`. Nothing else from the desktop reaches the page.
- `app/` is the full web build with `platform: "steam"` in `config.js`.
