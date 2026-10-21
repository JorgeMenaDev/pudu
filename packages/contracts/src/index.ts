// Shared types between the Electron main process, the preload bridge and the
// React renderer. The main process owns all recording state; renderers read it
// through `PuduBridge` and send intents back.

export type CaptureSourceKind = "screen" | "window";

export interface CaptureSource {
  readonly id: string;
  readonly name: string;
  readonly kind: CaptureSourceKind;
  readonly thumbnailDataUrl: string;
  readonly appIconDataUrl: string | null;
}

export type BubbleSize = "sm" | "md" | "lg";

export const BUBBLE_DIAMETER: Record<BubbleSize, number> = { sm: 152, md: 224, lg: 336 };

export interface RecorderSettings {
  readonly sourceId: string | null;
  readonly cameraEnabled: boolean;
  readonly cameraDeviceId: string | null;
  readonly micEnabled: boolean;
  readonly micDeviceId: string | null;
  readonly bubbleSize: BubbleSize;
  readonly mirrorCamera: boolean;
  readonly countdownSeconds: 0 | 3 | 5;
}

export const DEFAULT_SETTINGS: RecorderSettings = {
  sourceId: null,
  cameraEnabled: true,
  cameraDeviceId: null,
  micEnabled: true,
  micDeviceId: null,
  bubbleSize: "md",
  mirrorCamera: true,
  countdownSeconds: 3,
};

// idle → preparing (recorder acquiring streams) → countdown → recording ⇄ paused → saving → idle
export type RecordingPhase = "idle" | "preparing" | "countdown" | "recording" | "paused" | "saving";

// What the hidden recorder window captures for the current take.
export interface CaptureTarget {
  readonly sourceId: string;
  readonly maxWidth: number;
  readonly maxHeight: number;
}

export interface RecorderState {
  readonly phase: RecordingPhase;
  readonly target: CaptureTarget | null;
  readonly countdown: number | null;
  // Elapsed time is `accumulatedMs + (now - resumedAtMs)` while recording, so
  // every window can tick its own timer without a stream of IPC updates.
  readonly accumulatedMs: number;
  readonly resumedAtMs: number | null;
  readonly settings: RecorderSettings;
  readonly error: string | null;
}

export function elapsedMs(state: RecorderState, now: number): number {
  return state.accumulatedMs + (state.resumedAtMs === null ? 0 : now - state.resumedAtMs);
}

export interface Recording {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly videoUrl: string;
  readonly thumbnailUrl: string | null;
}

// Share copies: smaller H.264/AAC MP4s that Teams, Jira, Slack and email all
// play inline. `approxMbps` is measured on screen recordings, for size estimates.
export const SHARE_PRESETS = [
  { id: "720p", label: "Small · 720p", detail: "Best for Teams, Jira and email", approxMbps: 1.6 },
  { id: "540p", label: "Smallest · 540p", detail: "For strict email size limits", approxMbps: 1.3 },
  { id: "1080p", label: "Sharp · 1080p", detail: "Keeps small text crisp", approxMbps: 3.8 },
] as const;

export type SharePresetId = (typeof SHARE_PRESETS)[number]["id"];

export interface CompressProgress {
  readonly id: string;
  readonly progress: number; // 0–1
}

export const PERMISSION_KINDS = ["screen", "camera", "microphone"] as const;
export type PermissionKind = (typeof PERMISSION_KINDS)[number];
export type PermissionStatus = "granted" | "denied" | "not-determined" | "restricted" | "unknown";
export type Permissions = Record<PermissionKind, PermissionStatus>;

export const PERMISSION_LABELS: Record<PermissionKind, string> = {
  screen: "Screen Recording",
  camera: "Camera",
  microphone: "Microphone",
};

// Screen Recording is always needed; the camera and microphone only while they are on.
export function missingPermissions(
  permissions: Permissions,
  settings: Pick<RecorderSettings, "cameraEnabled" | "micEnabled">,
): PermissionKind[] {
  const needed = { screen: true, camera: settings.cameraEnabled, microphone: settings.micEnabled };
  return PERMISSION_KINDS.filter((kind) => needed[kind] && permissions[kind] !== "granted");
}

// What main reads from macOS for the menu bar and the Settings window. macOS
// announces none of it, so main reads it again whenever Pudu is used.
export interface AppStatus {
  readonly permissions: Permissions;
  // Pudu opened the Screen Recording pane since launch. macOS applies a grant
  // there only after a relaunch, and can report Denied until then, so Settings
  // offers Restart Pudu instead of waiting for the status to change.
  readonly screenSettingsOpened: boolean;
  readonly openAtLogin: boolean;
  // With ~ for the home folder, as Finder shows it.
  readonly recordingsFolder: string;
}

// The Settings window opens on a pane through its hash: `#/settings/<pane>`.
export type SettingsPane = "general" | "permissions" | "shortcuts";

// Global shortcuts in Electron accelerator syntax. The same defaults as Loom, so
// they feel familiar.
export const SHORTCUTS = {
  startStop: "Command+Shift+L",
  pause: "Alt+Shift+P",
  restart: "Command+Shift+R",
  cancel: "Alt+Shift+C",
} as const;

// What the hidden recorder window reports once its MediaRecorder has flushed.
// Duration comes from main's own clock, which already excludes pauses.
export interface RecorderResult {
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly thumbnailJpeg: ArrayBuffer | null;
}

export type RecorderCommand = "begin" | "pause" | "resume" | "stop" | "discard";

export type Surface = "library" | "launcher" | "bubble" | "controls" | "countdown" | "recorder" | "settings";

export type Unsubscribe = () => void;

// Exposed on `window.pudu` by the preload script.
export interface PuduBridge {
  readonly platform: string;

  getState(): Promise<RecorderState>;
  onState(listener: (state: RecorderState) => void): Unsubscribe;
  updateSettings(patch: Partial<RecorderSettings>): Promise<void>;

  listSources(): Promise<ReadonlyArray<CaptureSource>>;
  getAppStatus(): Promise<AppStatus>;
  onAppStatus(listener: (status: AppStatus) => void): Unsubscribe;
  // Only the camera and microphone are asked for in-app; Screen Recording is
  // allowed in System Settings. Main sends the new status once macOS answers.
  requestPermission(kind: Exclude<PermissionKind, "screen">): Promise<void>;
  openPermissionSettings(kind: PermissionKind): Promise<void>;
  setOpenAtLogin(enabled: boolean): Promise<void>;
  revealRecordingsFolder(): Promise<void>;
  // Applies a new Screen Recording grant; does nothing during a take.
  relaunch(): Promise<void>;
  openSettings(): Promise<void>;

  openLauncher(): Promise<void>;
  openLibrary(): Promise<void>;
  hideLauncher(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  togglePause(): Promise<void>;
  restart(): Promise<void>;
  cancel(): Promise<void>;
  skipCountdown(): Promise<void>;

  // Moves the calling window; used by the custom-dragged camera bubble.
  moveWindowBy(dx: number, dy: number): void;

  listRecordings(): Promise<ReadonlyArray<Recording>>;
  renameRecording(id: string, title: string): Promise<void>;
  deleteRecording(id: string): Promise<void>;
  revealRecording(id: string): Promise<void>;
  shareRecording(id: string): Promise<void>;
  copyRecording(id: string): Promise<void>;
  // Makes a smaller copy next to the original and resolves with the copy's id.
  compressRecording(id: string, preset: SharePresetId): Promise<string>;
  onCompressProgress(listener: (progress: CompressProgress) => void): Unsubscribe;
  onLibraryChanged(listener: (focusId: string | null) => void): Unsubscribe;

  recorder: {
    onCommand(listener: (command: RecorderCommand) => void): Unsubscribe;
    ready(): void;
    chunk(data: ArrayBuffer): void;
    finished(result: RecorderResult): void;
    failed(message: string): void;
  };
}

export const IPC = {
  state: "pudu:state",
  getState: "pudu:get-state",
  updateSettings: "pudu:update-settings",
  listSources: "pudu:list-sources",
  appStatus: "pudu:app-status",
  getAppStatus: "pudu:get-app-status",
  requestPermission: "pudu:request-permission",
  openPermissionSettings: "pudu:open-permission-settings",
  setOpenAtLogin: "pudu:set-open-at-login",
  revealRecordingsFolder: "pudu:reveal-recordings-folder",
  relaunch: "pudu:relaunch",
  openSettings: "pudu:open-settings",
  openLauncher: "pudu:open-launcher",
  openLibrary: "pudu:open-library",
  hideLauncher: "pudu:hide-launcher",
  start: "pudu:start",
  stop: "pudu:stop",
  togglePause: "pudu:toggle-pause",
  restart: "pudu:restart",
  cancel: "pudu:cancel",
  skipCountdown: "pudu:skip-countdown",
  moveWindowBy: "pudu:move-window-by",
  listRecordings: "pudu:list-recordings",
  renameRecording: "pudu:rename-recording",
  deleteRecording: "pudu:delete-recording",
  revealRecording: "pudu:reveal-recording",
  shareRecording: "pudu:share-recording",
  copyRecording: "pudu:copy-recording",
  compressRecording: "pudu:compress-recording",
  compressProgress: "pudu:compress-progress",
  libraryChanged: "pudu:library-changed",
  recorderCommand: "pudu:recorder-command",
  recorderReady: "pudu:recorder-ready",
  recorderChunk: "pudu:recorder-chunk",
  recorderFinished: "pudu:recorder-finished",
  recorderFailed: "pudu:recorder-failed",
} as const;

export const MEDIA_SCHEME = "pudu-media";
