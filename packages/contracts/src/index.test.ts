import { describe, expect, test } from "bun:test";

import { missingPermissions, type Permissions } from "./index.ts";

const allowed: Permissions = { screen: "granted", camera: "granted", microphone: "granted" };
const devicesOff = { cameraEnabled: false, micEnabled: false };

describe("missingPermissions", () => {
  test("Screen Recording is always needed", () => {
    expect(missingPermissions({ ...allowed, screen: "denied" }, devicesOff)).toEqual(["screen"]);
    expect(missingPermissions(allowed, devicesOff)).toEqual([]);
  });

  test("camera and microphone are needed only while they are on", () => {
    const blocked: Permissions = { screen: "granted", camera: "denied", microphone: "not-determined" };
    expect(missingPermissions(blocked, { cameraEnabled: true, micEnabled: true })).toEqual(["camera", "microphone"]);
    expect(missingPermissions(blocked, { cameraEnabled: false, micEnabled: true })).toEqual(["microphone"]);
    expect(missingPermissions(blocked, devicesOff)).toEqual([]);
  });
});
