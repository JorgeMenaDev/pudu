import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import { IPC, type GlimpseBridge } from "@glimpse/contracts";

function subscribe<T>(channel: string, listener: (value: T) => void) {
  const wrapped = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, wrapped);
  return () => void ipcRenderer.removeListener(channel, wrapped);
}

const bridge: GlimpseBridge = {
  platform: process.platform,

  getState: () => ipcRenderer.invoke(IPC.getState),
  onState: (listener) => subscribe(IPC.state, listener),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),

  listSources: () => ipcRenderer.invoke(IPC.listSources),
  getPermissions: () => ipcRenderer.invoke(IPC.getPermissions),
  requestPermission: (kind) => ipcRenderer.invoke(IPC.requestPermission, kind),
  openPermissionSettings: (kind) => ipcRenderer.invoke(IPC.openPermissionSettings, kind),

  openLauncher: () => ipcRenderer.invoke(IPC.openLauncher),
  openLibrary: () => ipcRenderer.invoke(IPC.openLibrary),
  hideLauncher: () => ipcRenderer.invoke(IPC.hideLauncher),
  start: () => ipcRenderer.invoke(IPC.start),
  stop: () => ipcRenderer.invoke(IPC.stop),
  togglePause: () => ipcRenderer.invoke(IPC.togglePause),
  restart: () => ipcRenderer.invoke(IPC.restart),
  cancel: () => ipcRenderer.invoke(IPC.cancel),
  skipCountdown: () => ipcRenderer.invoke(IPC.skipCountdown),

  moveWindowBy: (dx, dy) => ipcRenderer.send(IPC.moveWindowBy, dx, dy),

  listRecordings: () => ipcRenderer.invoke(IPC.listRecordings),
  renameRecording: (id, title) => ipcRenderer.invoke(IPC.renameRecording, id, title),
  deleteRecording: (id) => ipcRenderer.invoke(IPC.deleteRecording, id),
  revealRecording: (id) => ipcRenderer.invoke(IPC.revealRecording, id),
  shareRecording: (id) => ipcRenderer.invoke(IPC.shareRecording, id),
  copyRecording: (id) => ipcRenderer.invoke(IPC.copyRecording, id),
  compressRecording: (id, preset) => ipcRenderer.invoke(IPC.compressRecording, id, preset),
  onCompressProgress: (listener) => subscribe(IPC.compressProgress, listener),
  onLibraryChanged: (listener) => subscribe(IPC.libraryChanged, listener),

  recorder: {
    onCommand: (listener) => subscribe(IPC.recorderCommand, listener),
    ready: () => ipcRenderer.send(IPC.recorderReady),
    chunk: (data) => ipcRenderer.send(IPC.recorderChunk, data),
    finished: (result) => ipcRenderer.send(IPC.recorderFinished, result),
    failed: (message) => ipcRenderer.send(IPC.recorderFailed, message),
  },
};

contextBridge.exposeInMainWorld("glimpse", bridge);
