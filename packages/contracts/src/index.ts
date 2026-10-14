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

export type PermissionKind = "screen" | "camera" | "microphone";
export type PermissionStatus = "granted" | "denied" | "not-determined" | "restricted" | "unknown";
export type Permissions = Record<PermissionKind, PermissionStatus>;

// What the hidden recorder window reports once its MediaRecorder has flushed.
// Duration comes from main's own clock, which already excludes pauses.
export interface RecorderResult {
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly thumbnailJpeg: ArrayBuffer | null;
}

export type RecorderCommand = "begin" | "pause" | "resume" | "stop" | "discard";

export type Surface = "library" | "launcher" | "bubble" | "controls" | "countdown" | "recorder";

export type Unsubscribe = () => void;

// Exposed on `window.pudu` by the preload script.
export interface PuduBridge {
  readonly platform: string;

  getState(): Promise<RecorderState>;
  onState(listener: (state: RecorderState) => void): Unsubscribe;
  updateSettings(patch: Partial<RecorderSettings>): Promise<void>;

  listSources(): Promise<ReadonlyArray<CaptureSource>>;
  getPermissions(): Promise<Permissions>;
  requestPermission(kind: PermissionKind): Promise<PermissionStatus>;
  openPermissionSettings(kind: PermissionKind): Promise<void>;

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
  getPermissions: "pudu:get-permissions",
  requestPermission: "pudu:request-permission",
  openPermissionSettings: "pudu:open-permission-settings",
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
