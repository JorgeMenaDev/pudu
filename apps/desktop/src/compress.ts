import { spawn } from "node:child_process";

import type { SharePresetId } from "@pudu/contracts";

// avconvert presets fit the video inside the box in their name, keeping its aspect ratio.
export const AV_PRESETS: Record<SharePresetId, string> = {
  "1080p": "Preset1920x1080",
  "720p": "Preset1280x720",
  "540p": "Preset960x540",
};

// "avconvert progress:  42.90% complete" → 0.429 (the last value in the chunk).
export function parseProgress(output: string): number | null {
  const matches = [...output.matchAll(/([\d.]+)% complete/g)];
  const last = matches.at(-1)?.[1];
  return last === undefined ? null : Math.min(1, Number(last) / 100);
}

export function runAvconvert(
  source: string,
  output: string,
  preset: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/avconvert", [
      "--source", source,
      "--output", output,
      "--preset", preset,
      "--replace",
      "--progress",
    ]);
    let log = "";
    const read = (data: Buffer) => {
      const text = data.toString();
      log = (log + text).slice(-2000);
      const progress = parseProgress(text);
      if (progress !== null) onProgress(progress);
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const reason = log.split("\n").find((line) => line.includes("avconvert:"))?.trim();
      reject(new Error(reason ?? `avconvert exited with code ${code}`));
    });
  });
}
