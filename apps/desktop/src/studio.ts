import * as fs from "node:fs";
import * as path from "node:path";

import {
  BrowserWindow,
  desktopCapturer,
  screen,
  type Display,
  type Rectangle,
} from "electron";

import {
  IPC,
  type CaptureSource,
  type RecorderCommand,
  type RecorderResult,
  type RecorderSettings,
  type RecorderState,
} from "@glimpse/contracts";

import { Library, newRecordingId } from "./library.ts";
import type { SettingsStore } from "./settings.ts";
import * as Windows from "./windows.ts";

interface Take {
  readonly id: string;
  readonly createdAt: Date;
  readonly tempPath: string;
  readonly stream: fs.WriteStream;
  readonly display: Display;
}

// Owns the recording lifecycle and every recording-related window. All state
// changes go through `setState`, which broadcasts to every renderer.
export class Studio {
  private state: RecorderState;
  private library: BrowserWindow | null = null;
  private launcher: BrowserWindow | null = null;
  private bubble: BrowserWindow | null = null;
  private controls: BrowserWindow | null = null;
  private countdownWindow: BrowserWindow | null = null;
  private recorder: BrowserWindow | null = null;
  private take: Take | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  // desktopCapturer source id → Electron display id, for placing overlays.
  private readonly sourceDisplayIds = new Map<string, string>();

  constructor(
    private readonly store: SettingsStore,
    readonly recordings: Library,
    private readonly onChange: (state: RecorderState) => void,
  ) {
    this.state = {
      phase: "idle",
      target: null,
      countdown: null,
      accumulatedMs: 0,
      resumedAtMs: null,
      settings: store.load(),
      error: null,
    };
  }

  getState(): RecorderState {
    return this.state;
  }

  get isBusy(): boolean {
    return this.state.phase !== "idle";
  }

  private setState(patch: Partial<RecorderState>): void {
    this.state = { ...this.state, ...patch };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.state, this.state);
    }
    this.onChange(this.state);
  }

  // ── Library ───────────────────────────────────────────────────────────

  showLibrary(focusId: string | null = null): void {
    if (!this.library || this.library.isDestroyed()) {
      this.library = Windows.createLibraryWindow();
      this.library.on("closed", () => (this.library = null));
    } else {
      this.library.show();
      this.library.focus();
    }
    const win = this.library;
    const notify = () => win.webContents.send(IPC.libraryChanged, focusId);
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", notify);
    else notify();
  }

  notifyLibraryChanged(focusId: string | null = null): void {
    this.library?.webContents.send(IPC.libraryChanged, focusId);
  }

  // ── Launcher + camera preview ─────────────────────────────────────────

  openLauncher(anchor: Rectangle | null = null): void {
    if (this.isBusy) return;
    if (this.launcher && !this.launcher.isDestroyed()) {
      this.launcher.show();
      this.launcher.focus();
    } else {
      this.launcher = Windows.createLauncherWindow(anchor);
      this.launcher.on("closed", () => {
        this.launcher = null;
        if (!this.isBusy) this.closeBubble();
      });
    }
    if (this.state.error) this.setState({ error: null });
    this.syncBubble(this.displayForSource(this.state.settings.sourceId));
  }

  toggleLauncher(anchor: Rectangle | null): void {
    if (this.launcher?.isVisible()) this.hideLauncher();
    else this.openLauncher(anchor);
  }

  hideLauncher(): void {
    this.launcher?.close();
  }

  async listSources(): Promise<CaptureSource[]> {
    const ownIds = new Set(
      BrowserWindow.getAllWindows().map((win) => win.getMediaSourceId()),
    );
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 480, height: 300 },
      fetchWindowIcons: true,
    });
    for (const source of sources) {
      if (source.display_id) this.sourceDisplayIds.set(source.id, source.display_id);
    }
    return sources
      .filter((source) => !ownIds.has(source.id) && source.name.trim() !== "")
      .map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.id.startsWith("screen:") ? "screen" : "window",
        thumbnailDataUrl: source.thumbnail.toDataURL(),
        appIconDataUrl: source.appIcon?.isEmpty() === false ? source.appIcon.toDataURL() : null,
      }));
  }

  updateSettings(patch: Partial<RecorderSettings>): void {
    const settings = { ...this.state.settings, ...patch };
    this.store.save(settings);
    this.setState({ settings });
    if ("bubbleSize" in patch && this.bubble && !this.bubble.isDestroyed()) {
      Windows.resizeBubble(this.bubble, settings.bubbleSize);
    }
    if ("cameraEnabled" in patch || "sourceId" in patch) {
      this.syncBubble(this.displayForSource(settings.sourceId), "sourceId" in patch);
    }
  }

  // Shows the camera bubble when the camera is on, on the display being recorded.
  private syncBubble(display: Display, reposition = false): void {
    if (!this.state.settings.cameraEnabled) return this.closeBubble();
    if (!this.bubble || this.bubble.isDestroyed()) {
      this.bubble = Windows.createBubbleWindow(display, this.state.settings.bubbleSize);
      this.bubble.on("closed", () => (this.bubble = null));
    } else if (reposition) {
      this.bubble.setBounds(Windows.bubbleBounds(display, this.state.settings.bubbleSize));
    }
  }

  private closeBubble(): void {
    this.bubble?.close();
    this.bubble = null;
  }

  private displayForSource(sourceId: string | null): Display {
    const displayId = sourceId ? this.sourceDisplayIds.get(sourceId) : undefined;
    return (
      screen.getAllDisplays().find((display) => String(display.id) === displayId) ??
      screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    );
  }

  // ── Recording lifecycle ──────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isBusy) return;
    const sourceId = this.state.settings.sourceId ?? (await this.primaryScreenSourceId());
    if (!sourceId) return this.fail("No screen available to record.");

    const display = this.displayForSource(sourceId);
    const createdAt = new Date();
    const id = newRecordingId(createdAt);
    await this.recordings.ensureDir();
    const tempPath = path.join(this.recordings.dir, `.${id}.part`);
    this.take = { id, createdAt, tempPath, stream: fs.createWriteStream(tempPath), display };

    this.hideLauncher();
    // Out of the shot, like Loom: the library comes back when the take is saved.
    this.library?.hide();
    this.syncBubble(display, true);
    this.setState({
      phase: "preparing",
      error: null,
      accumulatedMs: 0,
      resumedAtMs: null,
      countdown: null,
      target: {
        sourceId,
        maxWidth: Math.min(Math.round(display.size.width * display.scaleFactor), 3840),
        maxHeight: Math.min(Math.round(display.size.height * display.scaleFactor), 2160),
      },
    });
    this.recorder = Windows.createRecorderWindow();
    this.recorder.on("closed", () => (this.recorder = null));
  }

  // The recorder window has its streams; count down, then roll.
  handleRecorderReady(): void {
    if (this.state.phase !== "preparing" || !this.take) return;
    this.controls = Windows.createControlsWindow(this.take.display);
    this.controls.on("closed", () => (this.controls = null));

    const seconds = this.state.settings.countdownSeconds;
    if (seconds === 0) return this.begin();
    this.setState({ phase: "countdown", countdown: seconds });
    this.countdownWindow = Windows.createCountdownWindow(this.take.display);
    this.countdownTimer = setInterval(() => {
      const next = (this.state.countdown ?? 1) - 1;
      if (next <= 0) this.begin();
      else this.setState({ countdown: next });
    }, 1000);
  }

  skipCountdown(): void {
    if (this.state.phase === "countdown") this.begin();
  }

  private begin(): void {
    this.clearCountdown();
    this.sendToRecorder("begin");
    this.setState({ phase: "recording", countdown: null, resumedAtMs: Date.now() });
  }

  private clearCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
    this.countdownWindow?.close();
    this.countdownWindow = null;
  }

  togglePause(): void {
    const now = Date.now();
    if (this.state.phase === "recording" && this.state.resumedAtMs !== null) {
      this.sendToRecorder("pause");
      this.setState({
        phase: "paused",
        accumulatedMs: this.state.accumulatedMs + now - this.state.resumedAtMs,
        resumedAtMs: null,
      });
    } else if (this.state.phase === "paused") {
      this.sendToRecorder("resume");
      this.setState({ phase: "recording", resumedAtMs: now });
    }
  }

  stop(): void {
    const { phase, resumedAtMs, accumulatedMs } = this.state;
    if (phase === "preparing" || phase === "countdown") return void this.cancel();
    if (phase !== "recording" && phase !== "paused") return;
    const total = accumulatedMs + (resumedAtMs === null ? 0 : Date.now() - resumedAtMs);
    this.controls?.close();
    this.setState({ phase: "saving", accumulatedMs: total, resumedAtMs: null });
    this.sendToRecorder("stop");
  }

  handleChunk(data: ArrayBuffer): void {
    this.take?.stream.write(Buffer.from(data));
  }

  async handleFinished(result: RecorderResult): Promise<void> {
    const take = this.take;
    if (!take || this.state.phase !== "saving") return;
    this.take = null;
    await new Promise<void>((resolve) => take.stream.end(resolve));
    await this.recordings.save({
      id: take.id,
      createdAt: take.createdAt,
      tempVideoPath: take.tempPath,
      durationMs: this.state.accumulatedMs,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
      thumbnailJpeg: result.thumbnailJpeg,
    });
    this.teardown();
    this.showLibrary(take.id);
  }

  async restart(): Promise<void> {
    if (this.state.phase === "idle" || this.state.phase === "saving") return;
    this.discardTake();
    this.teardown({ keepBubble: true });
    await this.start();
  }

  cancel(): void {
    if (this.state.phase === "idle" || this.state.phase === "saving") return;
    this.discardTake();
    this.teardown();
  }

  handleRecorderFailed(message: string): void {
    this.discardTake();
    this.fail(message);
  }

  private fail(message: string): void {
    this.teardown();
    this.setState({ error: message });
    this.openLauncher();
  }

  private discardTake(): void {
    this.sendToRecorder("discard");
    const take = this.take;
    this.take = null;
    if (take) {
      take.stream.destroy();
      fs.rm(take.tempPath, { force: true }, () => {});
    }
  }

  private teardown({ keepBubble = false, restoreLibrary = !keepBubble }: { keepBubble?: boolean; restoreLibrary?: boolean } = {}): void {
    this.clearCountdown();
    this.recorder?.destroy();
    this.recorder = null;
    this.controls?.close();
    this.controls = null;
    if (!keepBubble) this.closeBubble();
    if (restoreLibrary && this.library && !this.library.isDestroyed()) this.library.showInactive();
    this.setState({ phase: "idle", target: null, countdown: null, resumedAtMs: null, accumulatedMs: 0 });
  }

  private sendToRecorder(command: RecorderCommand): void {
    if (this.recorder && !this.recorder.isDestroyed()) {
      this.recorder.webContents.send(IPC.recorderCommand, command);
    }
  }

  private async primaryScreenSourceId(): Promise<string | null> {
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } });
    const primaryId = String(screen.getPrimaryDisplay().id);
    for (const source of sources) this.sourceDisplayIds.set(source.id, source.display_id);
    return (sources.find((source) => source.display_id === primaryId) ?? sources[0])?.id ?? null;
  }

  // Used by the custom-dragged bubble; clamps nothing so it can cross displays.
  moveWindowBy(win: BrowserWindow, dx: number, dy: number): void {
    const [x = 0, y = 0] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
  }
}
