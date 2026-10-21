import { nativeImage, type NativeImage } from "electron";

// Draws the menu bar glyph (a ring around a dot) as a macOS template image, so
// the app ships without icon assets and the glyph follows light/dark menu bars.
// `warning` adds a "!" badge in the bottom-right corner, cut out of the ring.
export function createTrayIcon(warning = false): NativeImage {
  const scale = 2;
  const size = 18 * scale;
  const pixels = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - center, y - center) / scale;
      // Ring between radius 6.25 and 7.75, dot up to radius 3.5, 1px anti-aliasing.
      const ring = Math.min(clamp(d - 6.25 + 0.5), clamp(7.75 - d + 0.5));
      const dot = clamp(3.5 - d + 0.5);
      const glyph = Math.max(ring, dot);
      const alpha = warning ? withBadge(glyph, x / scale, y / scale, scale) : glyph;
      pixels.writeUInt32LE((Math.round(255 * alpha) << 24) >>> 0, (y * size + x) * 4); // BGRA, black
    }
  }
  const image = nativeImage.createFromBitmap(pixels, { width: size, height: size, scaleFactor: scale });
  image.setTemplateImage(true);
  return image;
}

// A disc of radius 3.25 at (14, 14) with a 0.75 gap around it and "!" cut out.
// Distances are in points; `scale` turns them into one-pixel anti-aliasing.
function withBadge(glyph: number, x: number, y: number, scale: number): number {
  const fill = (distance: number) => clamp(0.5 - distance * scale);
  const d = Math.hypot(x - 14, y - 14);
  const bar = Math.hypot(x - 14, y - Math.min(Math.max(y, 12.3), 14.2)) - 0.5;
  const point = Math.hypot(x - 14, y - 15.75) - 0.6;
  const mark = Math.max(fill(bar), fill(point));
  return Math.max(glyph * (1 - fill(d - 4)), fill(d - 3.25) * (1 - mark));
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
