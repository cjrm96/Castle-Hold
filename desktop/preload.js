'use strict';
/* the only doors from the game page to the desktop: achievements, expansions, store links */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('steam', {
  achievement: id => ipcRenderer.invoke('steam:achievement', id),
  packs: () => ipcRenderer.invoke('steam:packs'),
  openUrl: url => ipcRenderer.invoke('steam:openUrl', url),
});
