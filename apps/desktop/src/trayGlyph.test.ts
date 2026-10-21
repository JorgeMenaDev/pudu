import { expect, test } from "bun:test";
import { renderTrayGlyph } from "../scripts/tray-icon.ts";
import { TRAY_GLYPH } from "./trayGlyph.ts";

test("trayGlyph.ts matches assets/tray.svg (regenerate: bun apps/desktop/scripts/tray-icon.ts)", async () => {
  expect(TRAY_GLYPH).toEqual(await renderTrayGlyph());
});
