import { createReadStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";

import type { Library } from "./library.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
};

// Parses a single `bytes=start-end` range. <video> seeking depends on 206s.
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, rawStart = "", rawEnd = ""] = match;
  if (rawStart === "" && rawEnd === "") return null;
  if (rawStart === "") {
    const suffix = Math.min(Number(rawEnd), size);
    return { start: size - suffix, end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  return start <= end && start < size ? { start, end } : null;
}

// Serves glimpse-media://media/<file> from the library folder.
export async function handleMediaRequest(library: Library, request: Request): Promise<Response> {
  const fileName = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ""));
  const filePath = library.resolveMediaFile(fileName);
  const stat = filePath ? await fs.stat(filePath).catch(() => null) : null;
  if (!filePath || !stat) return new Response("Not found", { status: 404 });

  const contentType = CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
  const range = parseRange(request.headers.get("range"), stat.size);
  const body = (start: number, end: number) =>
    Readable.toWeb(createReadStream(filePath, { start, end }));

  if (stat.size === 0) return new Response(null, { headers: { "Content-Type": contentType } });
  if (!range) {
    return new Response(body(0, stat.size - 1), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
      },
    });
  }
  return new Response(body(range.start, range.end), {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(range.end - range.start + 1),
      "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
      "Accept-Ranges": "bytes",
    },
  });
}
