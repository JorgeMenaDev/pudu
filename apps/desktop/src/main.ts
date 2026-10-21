import * as path from "node:path";

import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  protocol,
  shell,
  ShareMenu,
  Tray,
} from "electron";

import {
  IPC,
  MEDIA_SCHEME,
  PERMISSION_LABELS,
  SHORTCUTS,
  elapsedMs,
  missingPermissions,
  type AppStatus,
  type CompressProgress,
  type PermissionKind,
  type RecorderResult,
  type RecorderSettings,
  type RecorderState,
  type Recording,
  type SharePresetId,
} from "@pudu/contracts";

import { Library } from "./library.ts";
import { handleMediaRequest } from "./mediaProtocol.ts";
import * as Permissions from "./permissions.ts";
import { SettingsStore } from "./settings.ts";
import { Studio } from "./studio.ts";
import { createTrayIcon } from "./trayIcon.ts";

protocol.registerSchemesAsPrivileged([
  { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let tray: Tray | null = null;
let trayTimer: NodeJS.Timeout | null = null;
let appStatus: AppStatus | null = null;
let screenSettingsOpened = false;
const listFormat = new Intl.ListFormat("en-GB");

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Mirrors the take in the menu bar: a running clock while recording.
function syncTray(state: RecorderState): void {
  if (!tray) return;
  if (trayTimer) clearInterval(trayTimer);
  trayTimer = null;
  const live = state.phase === "recording" || state.phase === "paused";
  const render = () => tray?.setTitle(live ? ` ${formatClock(elapsedMs(state, Date.now()))}` : "");
  render();
  if (state.phase === "recording") trayTimer = setInterval(render, 500);
  syncTrayWarning(state.settings);
}

// A warning mark, and a tooltip naming what's missing, while the current setup lacks a permission.
function syncTrayWarning(settings: RecorderSettings): void {
  if (!tray || !appStatus) return;
  const missing = missingPermissions(appStatus.permissions, settings).map((kind) => PERMISSION_LABELS[kind]);
  tray.setImage(createTrayIcon(missing.length > 0));
  tray.setToolTip(missing.length > 0 ? `Pudu needs ${listFormat.format(missing)} access` : "Pudu");
}

// macOS announces no permission or login item change, so main reads them again
// whenever Pudu is used, then updates the menu bar and every window.
function refreshAppStatus(studio: Studio): AppStatus {
  const permissions = Permissions.getPermissions();
  const home = app.getPath("home");
  const dir = studio.recordings.dir;
  const status: AppStatus = {
    permissions,
    screenSettingsOpened,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    recordingsFolder: dir.startsWith(`${home}/`) ? `~${dir.slice(home.length)}` : dir,
  };
  appStatus = status;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.appStatus, status);
  }
  syncTrayWarning(studio.getState().settings);
  return status;
}

function setOpenAtLogin(studio: Studio, enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled });
  refreshAppStatus(studio);
}

// Pauses, asks, and resumes if the answer is no, so a stray ⌥⇧C can't lose a take.
async function confirmCancel(studio: Studio): Promise<void> {
  const wasRecording = studio.getState().phase === "recording";
  if (wasRecording) studio.togglePause();
  const { response } = await dialog.showMessageBox({
    type: "warning",
    message: "Delete this recording?",
    detail: "What you've recorded so far will be discarded.",
    buttons: ["Delete", "Keep recording"],
    defaultId: 1,
    cancelId: 1,
  });
  if (response === 0) studio.cancel();
  else if (wasRecording) studio.togglePause();
}

function busyMenu(studio: Studio): Menu {
  const paused = studio.getState().phase === "paused";
  return Menu.buildFromTemplate([
    { label: "Stop and save", accelerator: SHORTCUTS.startStop, click: () => studio.stop() },
    { label: paused ? "Resume" : "Pause", accelerator: SHORTCUTS.pause, click: () => studio.togglePause() },
    { label: "Restart", accelerator: SHORTCUTS.restart, click: () => void studio.restart() },
    { type: "separator" },
    { label: "Cancel and delete…", accelerator: SHORTCUTS.cancel, click: () => void confirmCancel(studio) },
  ]);
}

function idleMenu(studio: Studio, status: AppStatus, recent: ReadonlyArray<Recording>): Menu {
  const missing = missingPermissions(status.permissions, studio.getState().settings);
  return Menu.buildFromTemplate([
    { label: "New recording", accelerator: SHORTCUTS.startStop, click: () => studio.openLauncher() },
    { label: "Open library", click: () => studio.showLibrary() },
    ...recent.map((recording) => ({ label: recording.title, click: () => studio.showLibrary(recording.id) })),
    { type: "separator" },
    ...(missing.length > 0 ? [{ label: "Fix permissions…", click: () => studio.showSettings("permissions") }] : []),
    { label: "Settings…", click: () => studio.showSettings() },
    {
      label: "Open at login",
      type: "checkbox",
      checked: status.openAtLogin,
      click: (item) => setOpenAtLogin(studio, item.checked),
    },
    { type: "separator" },
    { role: "quit", label: "Quit Pudu" },
  ]);
}

function registerShortcuts(studio: Studio): void {
  globalShortcut.register(SHORTCUTS.startStop, () => {
    if (studio.isBusy) studio.stop();
    else void studio.start();
  });
  globalShortcut.register(SHORTCUTS.pause, () => studio.togglePause());
  globalShortcut.register(SHORTCUTS.restart, () => void studio.restart());
  globalShortcut.register(SHORTCUTS.cancel, () => {
    if (studio.isBusy) void confirmCancel(studio);
  });
}

function registerIpc(studio: Studio, library: Library): void {
  const handle = (channel: string, fn: (...args: never[]) => unknown) =>
    ipcMain.handle(channel, (_event, ...args) => fn(...(args as never[])));

  handle(IPC.getState, () => studio.getState());
  handle(IPC.updateSettings, (patch: Partial<RecorderSettings>) => studio.updateSettings(patch));
  handle(IPC.listSources, () => studio.listSources());
  handle(IPC.getAppStatus, () => refreshAppStatus(studio));
  handle(IPC.requestPermission, async (kind: Exclude<PermissionKind, "screen">) => {
    await Permissions.requestPermission(kind);
    refreshAppStatus(studio);
  });
  handle(IPC.openPermissionSettings, async (kind: PermissionKind) => {
    await Permissions.openPermissionSettings(kind);
    if (kind === "screen") screenSettingsOpened = true;
    refreshAppStatus(studio);
  });
  handle(IPC.setOpenAtLogin, (enabled: boolean) => setOpenAtLogin(studio, enabled));
  handle(IPC.revealRecordingsFolder, async () => {
    await library.ensureDir();
    await shell.openPath(library.dir);
  });
  // macOS applies a Screen Recording grant only after a relaunch. Never cut a take short.
  handle(IPC.relaunch, () => {
    if (studio.isBusy) return;
    app.relaunch();
    app.quit();
  });
  handle(IPC.openSettings, () => studio.showSettings());
  handle(IPC.openLauncher, () => studio.openLauncher(tray?.getBounds() ?? null));
  handle(IPC.hideLauncher, () => studio.hideLauncher());
  handle(IPC.openLibrary, () => studio.showLibrary());
  handle(IPC.start, () => studio.start());
  handle(IPC.stop, () => studio.stop());
  handle(IPC.togglePause, () => studio.togglePause());
  handle(IPC.restart, () => studio.restart());
  handle(IPC.cancel, () => studio.cancel());
  handle(IPC.skipCountdown, () => studio.skipCountdown());

  handle(IPC.listRecordings, () => library.list());
  handle(IPC.renameRecording, async (id: string, title: string) => {
    await library.rename(id, title);
    studio.notifyLibraryChanged();
  });
  handle(IPC.deleteRecording, async (id: string) => {
    await library.remove(id);
    studio.notifyLibraryChanged();
  });
  handle(IPC.revealRecording, async (id: string) => {
    const file = await library.videoFileFor(id);
    if (file) shell.showItemInFolder(file);
  });
  handle(IPC.shareRecording, async (id: string) => {
    const file = await library.videoFileFor(id);
    if (file) new ShareMenu({ filePaths: [file] }).popup();
  });
  // Puts the file itself on the pasteboard, so ⌘V attaches it in Slack, Mail, Finder…
  handle(IPC.compressRecording, async (id: string, preset: SharePresetId) => {
    const copyId = await library.createShareCopy(id, preset, (progress) =>
      BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send(IPC.compressProgress, { id, progress } satisfies CompressProgress),
      ),
    );
    studio.notifyLibraryChanged(copyId);
    return copyId;
  });
  handle(IPC.copyRecording, async (id: string) => {
    const file = await library.videoFileFor(id);
    if (!file) return;
    const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${file}</string></array></plist>`;
    clipboard.writeBuffer("NSFilenamesPboardType", Buffer.from(plist));
  });

  ipcMain.on(IPC.moveWindowBy, (event, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) studio.moveWindowBy(win, dx, dy);
  });
  ipcMain.on(IPC.recorderReady, () => studio.handleRecorderReady());
  ipcMain.on(IPC.recorderChunk, (_event, data: ArrayBuffer) => studio.handleChunk(data));
  ipcMain.on(IPC.recorderFinished, (_event, result: RecorderResult) => void studio.handleFinished(result));
  ipcMain.on(IPC.recorderFailed, (_event, message: string) => studio.handleRecorderFailed(message));
}

void app.whenReady().then(() => {
  // PUDU_LIBRARY_DIR points the app at another folder, for demos and screenshots.
  const library = new Library(process.env.PUDU_LIBRARY_DIR ?? path.join(app.getPath("videos"), "Pudu"));
  const studio = new Studio(new SettingsStore(app.getPath("userData")), library, syncTray);

  protocol.handle(MEDIA_SCHEME, (request) => handleMediaRequest(library, request));
  registerIpc(studio, library);
  registerShortcuts(studio);

  tray = new Tray(createTrayIcon());
  refreshAppStatus(studio);
  // Like Loom: a click stops a take or toggles the launcher; right-click has the rest.
  tray.on("click", () => {
    if (studio.isBusy) studio.stop();
    else studio.toggleLauncher(tray?.getBounds() ?? null);
  });
  // A take can start while the library loads, so the menu is chosen after it.
  // An unreadable library still opens the menu, without recent recordings.
  tray.on("right-click", async () => {
    const recent = studio.isBusy ? [] : await studio.recordings.list().then((all) => all.slice(0, 3), () => []);
    tray?.popUpContextMenu(studio.isBusy ? busyMenu(studio) : idleMenu(studio, refreshAppStatus(studio), recent));
  });
  // Hovering the icon or focusing a window reads permissions again, so the warning,
  // its tooltip and an open Settings window stay current.
  tray.on("mouse-enter", () => refreshAppStatus(studio));
  app.on("browser-window-focus", () => refreshAppStatus(studio));

  app.dock?.setMenu(
    Menu.buildFromTemplate([{ label: "New recording", click: () => studio.openLauncher() }]),
  );
  app.on("activate", () => studio.showLibrary());
  // Opened at login, Pudu waits in the menu bar.
  if (!app.getLoginItemSettings().wasOpenedAtLogin) studio.showLibrary();
});

// Pudu lives in the menu bar; closing the library keeps it running.
app.on("window-all-closed", () => {});
app.on("will-quit", () => globalShortcut.unregisterAll());
