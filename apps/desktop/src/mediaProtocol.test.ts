import { describe, expect, test } from "bun:test";

import { parseRange } from "./mediaProtocol.ts";

describe("parseRange", () => {
  test("reads an open-ended range, as <video> sends first", () => {
    expect(parseRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
  });

  test("clamps the end to the file size", () => {
    expect(parseRange("bytes=500-5000", 1000)).toEqual({ start: 500, end: 999 });
  });

  test("reads a suffix range", () => {
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  test("rejects ranges outside the file and malformed headers", () => {
    expect(parseRange("bytes=1000-", 1000)).toBeNull();
    expect(parseRange("bytes=9-3", 1000)).toBeNull();
    expect(parseRange("items=0-1", 1000)).toBeNull();
    expect(parseRange(null, 1000)).toBeNull();
  });
});
