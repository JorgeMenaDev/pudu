import { expect, test } from "bun:test";

import { filenamesPlist } from "./pasteboard.ts";

test("escapes XML special characters in the file path", () => {
  expect(filenamesPlist("/Movies/Pudu/Q&A <draft>.mp4")).toContain(
    "<string>/Movies/Pudu/Q&amp;A &lt;draft&gt;.mp4</string>",
  );
});
