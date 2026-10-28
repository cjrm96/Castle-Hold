'use strict';
/* Castle Siege desktop app: the web game in its own window, with Steam achievements and expansion checks. */
const { app, BrowserWindow, ipcMain, shell, Menu, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

/* Fill these in from Steamworks once the store page exists.
   appId: your game's Steam app id. dlc: the Steam app id of each paid expansion (0 means it ships with the game). */
const STEAM = { appId: 0, dlc: { frontier: 0 } };

let steam = null;
function startSteam() {
  if (!STEAM.appId) return;
  try {
    const sw = require('steamworks.js');
    if (app.isPackaged && sw.restartAppIfNecessary(STEAM.appId)) { app.quit(); return 'restart'; }
    steam = sw.init(STEAM.appId);
    sw.electronEnableSteamOverlay();
  } catch (e) { console.warn('Steam is not available:', e.message); steam = null; }
}

ipcMain.handle('steam:achievement', (e, id) => { try { return steam ? steam.achievement.activate(String(id)) : false; } catch (err) { return false; } });
ipcMain.handle('steam:packs', () => {
  const owned = [];
  for (const [key, id] of Object.entries(STEAM.dlc)) {
    if (!id) { owned.push(key); continue; }
    try { if (steam && steam.apps.isDlcInstalled(id)) owned.push(key); } catch (e) {}
  }
  return owned;
});
ipcMain.handle('steam:openUrl', (e, url) => {
  if (!/^https:\/\//.test(String(url))) return;
  if (steam) { try { steam.overlay.activateToWebPage(url); return; } catch (err) {} }
  shell.openExternal(url);
});

/* the game is served from app://game so saves, sound and music behave exactly as on the web */
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const ROOT = path.join(__dirname, 'app');
function serve() {
  protocol.handle('app', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640, backgroundColor: '#14100c', title: 'Castle Siege', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadURL('app://game/index.html');
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.alt && input.key === 'Enter'))) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://game/')) e.preventDefault(); });
}

app.whenReady().then(() => {
  if (startSteam() === 'restart') return;
  serve();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
