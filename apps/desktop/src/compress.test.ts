import { describe, expect, test } from "bun:test";

import { fitWithin, parseProgress } from "./compress.ts";

describe("fitWithin", () => {
  const box = { width: 1280, height: 720 };

  test("scales an ultrawide recording down to the box width", () => {
    expect(fitWithin(3440, 1440, box)).toEqual({ width: 1280, height: 536 });
  });

  test("never upscales", () => {
    expect(fitWithin(1024, 640, box)).toEqual({ width: 1024, height: 640 });
  });
});

describe("parseProgress", () => {
  test("reads the latest percentage in a chunk", () => {
    expect(parseProgress("avconvert progress:  0.00% complete\ravconvert progress:  42.90% complete")).toBeCloseTo(0.429);
  });

  test("ignores output without progress", () => {
    expect(parseProgress("avconvert completed with error:0.")).toBeNull();
  });
});
