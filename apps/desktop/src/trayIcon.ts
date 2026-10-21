import { nativeImage, type NativeImage } from "electron";
import { TRAY_GLYPH } from "./trayGlyph.ts";

// The menu bar icon: the Pudu face from assets/tray.svg at 1x and 2x, as a macOS
// template image so it follows light/dark menu bars. `warning` adds a "!" badge
// in the bottom-right corner, cut out of the face.
export function createTrayIcon(warning = false): NativeImage {
  const image = nativeImage.createEmpty();
  for (const scale of [1, 2] as const) {
    const size = 18 * scale;
    const glyph = Buffer.from(TRAY_GLYPH[scale], "base64");
    const pixels = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const alpha = glyph.readUInt8(i) / 255;
        const pixel = warning ? withBadge(alpha, (x + 0.5) / scale, (y + 0.5) / scale, scale) : alpha;
        pixels.writeUInt32LE((Math.round(255 * pixel) << 24) >>> 0, i * 4); // BGRA, black
      }
    }
    image.addRepresentation({ scaleFactor: scale, width: size, height: size, buffer: pixels });
  }
  image.setTemplateImage(true);
  return image;
}

// A disc of radius 3 at (14.5, 14.5) with a 0.6 gap around it and "!" cut out.
// The corner keeps the gap clear of the eyes and nose; on the half point, the
// "!" lands on whole pixels at 1x and 2x. Distances are in points; `scale`
// turns them into one-pixel anti-aliasing.
function withBadge(glyph: number, x: number, y: number, scale: number): number {
  const fill = (distance: number) => clamp(0.5 - distance * scale);
  const d = Math.hypot(x - 14.5, y - 14.5);
  const bar = Math.hypot(x - 14.5, y - Math.min(Math.max(y, 12.9), 14.5)) - 0.5;
  const point = Math.hypot(x - 14.5, y - 16.05) - 0.6;
  const mark = Math.max(fill(bar), fill(point));
  return Math.max(glyph * (1 - fill(d - 3.6)), fill(d - 3) * (1 - mark));
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
