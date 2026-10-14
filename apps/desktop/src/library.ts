import * as fs from "node:fs/promises";
import * as path from "node:path";

import { MEDIA_SCHEME, type Recording } from "@glimpse/contracts";

// Recordings live as plain files so they stay usable outside the app:
//   <id>.mp4 (or .webm)  the video
//   <id>.jpg             first-frame thumbnail
//   <id>.json            metadata (title, duration, size)
interface RecordingMeta {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly videoFile: string;
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
  constructor(readonly dir: string) {}

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
    const files = [`${id}.json`, `${id}.jpg`, meta?.videoFile].filter(
      (file): file is string => file !== undefined,
    );
    await Promise.all(files.map((file) => fs.rm(path.join(this.dir, file), { force: true })));
  }

  async videoFileFor(id: string): Promise<string | null> {
    const meta = await this.readMeta(id);
    return meta ? path.join(this.dir, meta.videoFile) : null;
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
