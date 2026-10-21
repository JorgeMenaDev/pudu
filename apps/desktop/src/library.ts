import * as fs from "node:fs/promises";
import * as path from "node:path";

import { MEDIA_SCHEME, type ExportSize, type Recording, type SharePresetId } from "@pudu/contracts";

import { AV_PRESETS, runAvconvert } from "./compress.ts";

// Recordings live as plain files so they stay usable outside the app:
//   <id>.mp4 (or .webm)  the video
//   <id>.jpg             first-frame thumbnail
//   <id>.json            metadata (title, duration, size, share copies)
//   <id>.720p.mp4        a smaller share copy made by the Export panel
interface RecordingMeta {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly videoFile: string;
  readonly copies?: Partial<Record<SharePresetId, string>>;
}

export function extensionForMime(mimeType: string): "mp4" | "webm" {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

// "Recording – 14 Oct 2026, 18:42" in the user's locale.
export function defaultTitle(date: Date): string {
  const stamp = date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Recording – ${stamp}`;
}

export function newRecordingId(date: Date): string {
  const iso = date.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  return `${iso}-${Math.random().toString(36).slice(2, 6)}`;
}

export class Library {
  // Share copies being made, so a second request joins the first instead of
  // writing the same file.
  private readonly preparing = new Map<string, Promise<number>>();

  // `convert` is swapped out in tests.
  constructor(
    readonly dir: string,
    private readonly convert = runAvconvert,
  ) {}

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  videoPath(id: string, mimeType: string): string {
    return path.join(this.dir, `${id}.${extensionForMime(mimeType)}`);
  }

  // Resolves a file name served through the media protocol, refusing anything
  // that escapes the library folder.
  resolveMediaFile(fileName: string): string | null {
    const resolved = path.resolve(this.dir, fileName);
    return path.dirname(resolved) === path.resolve(this.dir) ? resolved : null;
  }

  async save(input: {
    id: string;
    createdAt: Date;
    tempVideoPath: string;
    durationMs: number;
    width: number;
    height: number;
    mimeType: string;
    thumbnailJpeg: ArrayBuffer | null;
  }): Promise<void> {
    const videoPath = this.videoPath(input.id, input.mimeType);
    await fs.rename(input.tempVideoPath, videoPath);
    if (input.thumbnailJpeg) {
      await fs.writeFile(path.join(this.dir, `${input.id}.jpg`), Buffer.from(input.thumbnailJpeg));
    }
    const meta: RecordingMeta = {
      id: input.id,
      title: defaultTitle(input.createdAt),
      createdAt: input.createdAt.toISOString(),
      durationMs: input.durationMs,
      width: input.width,
      height: input.height,
      mimeType: input.mimeType,
      videoFile: path.basename(videoPath),
    };
    await this.writeMeta(meta);
  }

  async list(): Promise<Recording[]> {
    await this.ensureDir();
    const names = await fs.readdir(this.dir);
    const recordings = await Promise.all(
      names.filter((name) => name.endsWith(".json")).map((name) => this.load(name.slice(0, -5))),
    );
    return recordings
      .filter((recording): recording is Recording => recording !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async rename(id: string, title: string): Promise<void> {
    const meta = await this.readMeta(id);
    if (meta) await this.writeMeta({ ...meta, title: title.trim() || meta.title });
  }

  async remove(id: string): Promise<void> {
    const meta = await this.readMeta(id);
    const files = [`${id}.json`, `${id}.jpg`, meta?.videoFile, ...Object.values(meta?.copies ?? {})].filter(
      (file): file is string => file !== undefined,
    );
    await Promise.all(files.map((file) => fs.rm(path.join(this.dir, file), { force: true })));
  }

  // Re-encodes a recording with macOS's built-in `avconvert` into a smaller,
  // fast-start MP4 next to it, listed in its metadata. An existing copy is
  // reused. Resolves with the copy's size in bytes.
  prepareCopy(id: string, preset: SharePresetId, onProgress: (progress: number) => void): Promise<number> {
    const key = `${id}.${preset}`;
    const job =
      this.preparing.get(key) ?? this.makeCopy(id, preset, onProgress).finally(() => this.preparing.delete(key));
    this.preparing.set(key, job);
    return job;
  }

  // The file to hand out for a size, and the name to suggest when saving it.
  // Null when the recording, or that copy of it, doesn't exist.
  async exportFile(id: string, size: ExportSize): Promise<{ path: string; saveName: string } | null> {
    const meta = await this.readMeta(id);
    const file = size === "original" ? meta?.videoFile : meta?.copies?.[size];
    if (!meta || !file) return null;
    // macOS file names can't contain "/" or ":".
    const title = meta.title.replace(/[/:]/g, "-");
    const suffix = size === "original" ? "" : ` (${size})`;
    return { path: path.join(this.dir, file), saveName: `${title}${suffix}${path.extname(file)}` };
  }

  private async makeCopy(id: string, preset: SharePresetId, onProgress: (progress: number) => void): Promise<number> {
    const meta = await this.readMeta(id);
    if (!meta) throw new Error("Recording not found.");
    const existing = meta.copies?.[preset];
    const stat = existing ? await fs.stat(path.join(this.dir, existing)).catch(() => null) : null;
    if (stat) return stat.size;

    const file = `${id}.${preset}.mp4`;
    const tempPath = path.join(this.dir, `.${id}.${preset}.part.mp4`);
    try {
      await this.convert(path.join(this.dir, meta.videoFile), tempPath, AV_PRESETS[preset], onProgress);
      await fs.rename(tempPath, path.join(this.dir, file));
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      throw error;
    }
    // Read again: the recording may have been renamed or deleted meanwhile.
    const latest = await this.readMeta(id);
    if (!latest) {
      await fs.rm(path.join(this.dir, file), { force: true });
      throw new Error("Recording not found.");
    }
    await this.writeMeta({ ...latest, copies: { ...latest.copies, [preset]: file } });
    return (await fs.stat(path.join(this.dir, file))).size;
  }

  private async load(id: string): Promise<Recording | null> {
    const meta = await this.readMeta(id);
    if (!meta) return null;
    const [video, thumb] = await Promise.all([
      fs.stat(path.join(this.dir, meta.videoFile)).catch(() => null),
      fs.stat(path.join(this.dir, `${id}.jpg`)).catch(() => null),
    ]);
    if (!video) return null;
    // The mtime query busts the renderer cache when a file is replaced.
    const url = (file: string, mtime: Date) =>
      `${MEDIA_SCHEME}://media/${encodeURIComponent(file)}?v=${mtime.getTime()}`;
    return {
      id: meta.id,
      title: meta.title,
      createdAt: meta.createdAt,
      durationMs: meta.durationMs,
      width: meta.width,
      height: meta.height,
      mimeType: meta.mimeType,
      sizeBytes: video.size,
      videoUrl: url(meta.videoFile, video.mtime),
      thumbnailUrl: thumb ? url(`${id}.jpg`, thumb.mtime) : null,
    };
  }

  private async readMeta(id: string): Promise<RecordingMeta | null> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.dir, `${id}.json`), "utf8")) as RecordingMeta;
    } catch {
      return null;
    }
  }

  private async writeMeta(meta: RecordingMeta): Promise<void> {
    await fs.writeFile(path.join(this.dir, `${meta.id}.json`), `${JSON.stringify(meta, null, 2)}\n`);
  }
}
