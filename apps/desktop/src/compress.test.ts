import { describe, expect, test } from "bun:test";

import { parseProgress } from "./compress.ts";

describe("parseProgress", () => {
  test("reads the latest percentage in a chunk", () => {
    expect(parseProgress("avconvert progress:  0.00% complete\ravconvert progress:  42.90% complete")).toBeCloseTo(0.429);
  });

  test("ignores output without progress", () => {
    expect(parseProgress("avconvert completed with error:0.")).toBeNull();
  });
});
