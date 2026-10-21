import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { Library } from "./library.ts";

let dir: string;
let library: Library;
let conversions: string[];

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "pudu-library-"));
  conversions = [];
  // Stands in for avconvert: records the preset and writes a small file.
  library = new Library(dir, async (_source, output, avPreset) => {
    conversions.push(avPreset);
    await fs.writeFile(output, "small");
  });
});

afterEach(() => fs.rm(dir, { recursive: true, force: true }));

async function saveTake(id: string, createdAt: Date, mimeType = "video/mp4;codecs=avc1,mp4a.40.2") {
  const temp = path.join(dir, `.${id}.part`);
  await fs.writeFile(temp, "video-bytes");
  await library.save({
    id,
    createdAt,
    tempVideoPath: temp,
    durationMs: 4200,
    width: 1920,
    height: 1080,
    mimeType,
    thumbnailJpeg: new TextEncoder().encode("jpeg").buffer,
  });
}

describe("Library", () => {
  test("saves a take as video + thumbnail + metadata and lists newest first", async () => {
    await saveTake("a", new Date("2026-10-14T10:00:00Z"));
    await saveTake("b", new Date("2026-10-14T11:00:00Z"), "video/webm;codecs=vp9,opus");

    const recordings = await library.list();
    expect(recordings.map((recording) => recording.id)).toEqual(["b", "a"]);
    expect(recordings[0]?.videoUrl).toStartWith("pudu-media://media/b.webm?v=");
    expect(recordings[1]?.thumbnailUrl).toStartWith("pudu-media://media/a.jpg?v=");
    expect(recordings[1]).toMatchObject({ durationMs: 4200, width: 1920, sizeBytes: 11 });
    expect(await fs.readdir(dir)).not.toContain(".a.part");
  });

  test("renames, keeping the old title when the new one is blank", async () => {
    await saveTake("a", new Date());
    await library.rename("a", "Bug repro");
    await library.rename("a", "   ");
    expect((await library.list())[0]?.title).toBe("Bug repro");
  });

  test("removes every file of a recording", async () => {
    await saveTake("a", new Date());
    await library.remove("a");
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test("keeps a share copy next to the original, listed in its metadata", async () => {
    await saveTake("a", new Date());
    expect(await library.prepareCopy("a", "720p", () => {})).toBe(5);

    expect((await fs.readdir(dir)).sort()).toEqual(["a.720p.mp4", "a.jpg", "a.json", "a.mp4"]);
    const meta = JSON.parse(await fs.readFile(path.join(dir, "a.json"), "utf8"));
    expect(meta.copies).toEqual({ "720p": "a.720p.mp4" });
    expect((await library.list()).map((recording) => recording.id)).toEqual(["a"]);
    await library.rename("a", "Login bug: 2/3");
    expect(await library.exportFile("a", "720p")).toEqual({
      path: path.join(dir, "a.720p.mp4"),
      saveName: "Login bug- 2-3 (720p).mp4",
    });
  });

  test("reuses a share copy, including one still being made", async () => {
    await saveTake("a", new Date());
    await Promise.all([library.prepareCopy("a", "720p", () => {}), library.prepareCopy("a", "720p", () => {})]);
    await library.prepareCopy("a", "720p", () => {});
    await library.prepareCopy("a", "540p", () => {});
    expect(conversions).toEqual(["Preset1280x720", "Preset960x540"]);
  });

  test("lists share copies made at the same time, and deletes them with the original", async () => {
    await saveTake("a", new Date());
    await Promise.all([library.prepareCopy("a", "720p", () => {}), library.prepareCopy("a", "540p", () => {})]);
    const meta = JSON.parse(await fs.readFile(path.join(dir, "a.json"), "utf8"));
    expect(meta.copies).toEqual({ "720p": "a.720p.mp4", "540p": "a.540p.mp4" });
    await library.remove("a");
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test("only resolves media files inside the library folder", () => {
    expect(library.resolveMediaFile("a.mp4")).toBe(path.join(dir, "a.mp4"));
    expect(library.resolveMediaFile("../secrets.txt")).toBeNull();
  });
});
