import { nativeImage, type NativeImage } from "electron";

// Draws the menu bar glyph (a ring around a dot) as a macOS template image, so
// the app ships without icon assets and the glyph follows light/dark menu bars.
export function createTrayIcon(): NativeImage {
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
      const alpha = Math.round(255 * Math.max(ring, dot));
      pixels.writeUInt32LE((alpha << 24) >>> 0, (y * size + x) * 4); // BGRA, black
    }
  }
  const image = nativeImage.createFromBitmap(pixels, { width: size, height: size, scaleFactor: scale });
  image.setTemplateImage(true);
  return image;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
