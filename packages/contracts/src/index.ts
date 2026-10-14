// Shared types between the Electron main process, the preload bridge and the
// React renderer. The main process owns all recording state; renderers read it
// through `GlimpseBridge` and send intents back.

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

// Exposed on `window.glimpse` by the preload script.
export interface GlimpseBridge {
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
  state: "glimpse:state",
  getState: "glimpse:get-state",
  updateSettings: "glimpse:update-settings",
  listSources: "glimpse:list-sources",
  getPermissions: "glimpse:get-permissions",
  requestPermission: "glimpse:request-permission",
  openPermissionSettings: "glimpse:open-permission-settings",
  openLauncher: "glimpse:open-launcher",
  openLibrary: "glimpse:open-library",
  hideLauncher: "glimpse:hide-launcher",
  start: "glimpse:start",
  stop: "glimpse:stop",
  togglePause: "glimpse:toggle-pause",
  restart: "glimpse:restart",
  cancel: "glimpse:cancel",
  skipCountdown: "glimpse:skip-countdown",
  moveWindowBy: "glimpse:move-window-by",
  listRecordings: "glimpse:list-recordings",
  renameRecording: "glimpse:rename-recording",
  deleteRecording: "glimpse:delete-recording",
  revealRecording: "glimpse:reveal-recording",
  shareRecording: "glimpse:share-recording",
  copyRecording: "glimpse:copy-recording",
  libraryChanged: "glimpse:library-changed",
  recorderCommand: "glimpse:recorder-command",
  recorderReady: "glimpse:recorder-ready",
  recorderChunk: "glimpse:recorder-chunk",
  recorderFinished: "glimpse:recorder-finished",
  recorderFailed: "glimpse:recorder-failed",
} as const;

export const MEDIA_SCHEME = "glimpse-media";
