import * as path from "node:path";

import { app, BrowserWindow, nativeTheme, screen, type Display, type Rectangle } from "electron";

import { BUBBLE_DIAMETER, type BubbleSize, type SettingsPane, type Surface } from "@pudu/contracts";

// Every surface is the same React bundle; the hash picks the screen to render.
const DEV_URL = process.env.PUDU_DEV_URL;
// Resolved from the app root: the bundler bakes `__dirname` in at build time.
const appFile = (relative: string) => path.join(app.getAppPath(), relative);

// Bubble window = circle + room for its drop shadow and hover controls.
export const BUBBLE_PADDING = 20;
const CONTROLS_SIZE = { width: 56, height: 244 };
const EDGE_MARGIN = 24;

function load(win: BrowserWindow, route: Surface | `settings/${SettingsPane}`): void {
  if (DEV_URL) void win.loadURL(`${DEV_URL}#/${route}`);
  else void win.loadFile(appFile("dist-renderer/index.html"), { hash: `/${route}` });
}

function background(): string {
  return nativeTheme.shouldUseDarkColors ? "#0a0a0a" : "#fcfcfc";
}

const overlayBase = {
  frame: false,
  transparent: true,
  hasShadow: false,
  resizable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  skipTaskbar: true,
  show: false,
  // An NSPanel floats over full-screen apps without stealing the Space.
  type: "panel",
} as const;

function webPreferences(extra: Electron.WebPreferences = {}): Electron.WebPreferences {
  return { preload: appFile("dist-electron/preload.cjs"), contextIsolation: true, sandbox: true, ...extra };
}

// Keeps overlays above normal windows and on every Space, full-screen included.
function float(win: BrowserWindow): void {
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

export function createLibraryWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 560,
    show: false,
    title: "Pudu",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: background(),
    webPreferences: webPreferences(),
  });
  win.once("ready-to-show", () => win.show());
  load(win, "library");
  return win;
}

export function createSettingsWindow(pane: SettingsPane): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: "Pudu Settings",
    titleBarStyle: "hiddenInset",
    backgroundColor: background(),
    webPreferences: webPreferences(),
  });
  win.once("ready-to-show", () => win.show());
  showSettingsPane(win, pane);
  return win;
}

// Only the hash changes, so an open Settings window switches pane without reloading.
export function showSettingsPane(win: BrowserWindow, pane: SettingsPane): void {
  load(win, `settings/${pane}`);
}

// The launcher hangs under the menu bar icon, like Loom's popover.
export function createLauncherWindow(anchor: Rectangle | null): BrowserWindow {
  const width = 360;
  const height = 548;
  const display = anchor ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
  const x = anchor
    ? Math.round(anchor.x + anchor.width / 2 - width / 2)
    : display.workArea.x + display.workArea.width - width - 16;
  const y = display.workArea.y + 8;
  const win = new BrowserWindow({
    ...overlayBase,
    width,
    height,
    x: Math.min(Math.max(x, display.workArea.x + 8), display.workArea.x + display.workArea.width - width - 8),
    y,
    focusable: true,
    webPreferences: webPreferences(),
  });
  float(win);
  win.setContentProtection(true);
  win.once("ready-to-show", () => win.show());
  load(win, "launcher");
  return win;
}

export function bubbleBounds(display: Display, size: BubbleSize): Rectangle {
  const side = BUBBLE_DIAMETER[size] + BUBBLE_PADDING * 2;
  const area = display.workArea;
  return {
    x: area.x + EDGE_MARGIN + CONTROLS_SIZE.width + 8,
    y: area.y + area.height - side - EDGE_MARGIN + BUBBLE_PADDING,
    width: side,
    height: side,
  };
}

export function createBubbleWindow(display: Display, size: BubbleSize): BrowserWindow {
  const win = new BrowserWindow({
    ...overlayBase,
    ...bubbleBounds(display, size),
    focusable: false,
    webPreferences: webPreferences(),
  });
  float(win);
  // Deliberately NOT content-protected: the bubble must appear in the video.
  win.once("ready-to-show", () => win.showInactive());
  load(win, "bubble");
  return win;
}

// Keeps the bubble's bottom-left corner fixed while it changes size.
export function resizeBubble(win: BrowserWindow, size: BubbleSize): void {
  const side = BUBBLE_DIAMETER[size] + BUBBLE_PADDING * 2;
  const current = win.getBounds();
  win.setBounds({ x: current.x, y: current.y + current.height - side, width: side, height: side });
}

export function createControlsWindow(display: Display): BrowserWindow {
  const area = display.workArea;
  const win = new BrowserWindow({
    ...overlayBase,
    ...CONTROLS_SIZE,
    x: area.x + EDGE_MARGIN,
    y: area.y + area.height - CONTROLS_SIZE.height - EDGE_MARGIN,
    focusable: false,
    webPreferences: webPreferences(),
  });
  float(win);
  // Hidden from the capture so the recording shows the screen, not our chrome.
  win.setContentProtection(true);
  win.once("ready-to-show", () => win.showInactive());
  load(win, "controls");
  return win;
}

export function createCountdownWindow(display: Display): BrowserWindow {
  const side = 240;
  const area = display.workArea;
  const win = new BrowserWindow({
    ...overlayBase,
    width: side,
    height: side,
    x: Math.round(area.x + area.width / 2 - side / 2),
    y: Math.round(area.y + area.height / 2 - side / 2),
    focusable: false,
    webPreferences: webPreferences(),
  });
  float(win);
  win.setContentProtection(true);
  win.once("ready-to-show", () => win.showInactive());
  load(win, "countdown");
  return win;
}

// Hidden window that owns getDisplayMedia + MediaRecorder for one take.
export function createRecorderWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    webPreferences: webPreferences({ backgroundThrottling: false }),
  });
  load(win, "recorder");
  return win;
}
