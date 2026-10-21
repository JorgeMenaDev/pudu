// Renders assets/tray.svg into src/trayGlyph.ts, the menu bar icon the app embeds.
// Run after editing the SVG: bun apps/desktop/scripts/tray-icon.ts
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = path.join(import.meta.dir, "../../..");
const output = path.join(import.meta.dir, "../src/trayGlyph.ts");

// The glyph's alpha at 18 pt for each scale factor, one byte per pixel, row by row, in base64.
export async function renderTrayGlyph(): Promise<Record<1 | 2, string>> {
  const svg = await Bun.file(path.join(root, "assets/tray.svg")).text();
  const alpha = (scale: number) => {
    const { pixels } = new Resvg(svg, { fitTo: { mode: "width", value: 18 * scale } }).render();
    return Buffer.from(pixels.filter((_, i) => i % 4 === 3)).toString("base64"); // RGBA → A
  };
  return { 1: alpha(1), 2: alpha(2) };
}

if (import.meta.main) {
  const glyph = await renderTrayGlyph();
  await Bun.write(
    output,
    `// Generated from assets/tray.svg by apps/desktop/scripts/tray-icon.ts. Do not edit.
// The menu bar glyph's alpha at 18x18 pt per scale factor, one byte per pixel, row by row.
export const TRAY_GLYPH = {
  1: "${glyph[1]}",
  2: "${glyph[2]}",
};
`,
  );
}
