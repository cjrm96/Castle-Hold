# Castle Siege: free demo for game websites

This folder is the free demo with the ad network's toolkit switched on. Upload the folder (or this zip) to the developer portal.

## What the demo holds back

The first 3 war missions, the first builder mission, Thornwall in Siege mode, one skirmish map with one rival, free for all with up to three rivals, and two free build lands. Everything else shows a "Full game" tag. Set `storeUrl` in `config.js` to your Steam page so the "Get the full game" button appears.

## Ads

Ads only ever play between battles: when a player starts a new battle after finishing one, at most once every two and a half minutes. Sound is muted while the ad plays. The game tells the network when play starts and stops (pause menu, end of battle).

## Before you submit

- Play it once on a phone-sized window. The game works by mouse and touch, but a castle builder is busy on a small screen.
- The demo is about 7 MB. Music streams in when it plays, so the first load is smaller.
