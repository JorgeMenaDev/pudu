import { expect, test } from "bun:test";

import { resolveRelease } from "./release-version.ts";

const pushToMain = (packageVersion: string, tags: string[]) =>
  resolveRelease({ ref: "refs/heads/main", packageVersion, tags, runNumber: 42 });

test("a push to main ships the patch after the latest stable as a beta", () => {
  expect(pushToMain("0.1.0", ["v0.1.0"])).toEqual({
    tag: "v0.1.1-beta.42",
    version: "0.1.1-beta.42",
    prerelease: true,
    notesStart: "v0.1.0",
  });
});

test("a package version ahead of the latest stable names the beta", () => {
  expect(pushToMain("0.2.0", ["v0.1.0", "v0.1.1-beta.7"]).tag).toBe("v0.2.0-beta.42");
});

test("beta notes start at the previous beta, compared numerically", () => {
  expect(pushToMain("0.1.0", ["v0.1.0", "v0.1.1-beta.9", "v0.1.1-beta.10"]).notesStart).toBe("v0.1.1-beta.10");
});

test("a stable tag ships itself, with notes since the previous stable", () => {
  const tags = ["v0.1.0", "v0.1.1-beta.9", "v0.2.0"];
  expect(resolveRelease({ ref: "refs/tags/v0.2.0", packageVersion: "0.1.0", tags, runNumber: 50 })).toEqual({
    tag: "v0.2.0",
    version: "0.2.0",
    prerelease: false,
    notesStart: "v0.1.0",
  });
});

test("a tag outside the scheme fails the run", () => {
  expect(() => resolveRelease({ ref: "refs/tags/v2", packageVersion: "0.1.0", tags: [], runNumber: 1 })).toThrow();
});
