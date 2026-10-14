import { expect, test } from "bun:test";

import { formatDuration } from "./utils";

test("formatDuration", () => {
  expect(formatDuration(0)).toBe("0:00");
  expect(formatDuration(83_400)).toBe("1:23");
  expect(formatDuration(3_723_000)).toBe("1:02:03");
});
