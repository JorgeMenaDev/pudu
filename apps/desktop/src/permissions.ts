import { desktopCapturer, shell, systemPreferences } from "electron";

import type { PermissionKind, PermissionStatus, Permissions } from "@pudu/contracts";

const SETTINGS_PANES: Record<PermissionKind, string> = {
  screen: "Privacy_ScreenCapture",
  camera: "Privacy_Camera",
  microphone: "Privacy_Microphone",
};

export function getPermissions(): Permissions {
  return {
    screen: systemPreferences.getMediaAccessStatus("screen") as PermissionStatus,
    camera: systemPreferences.getMediaAccessStatus("camera") as PermissionStatus,
    microphone: systemPreferences.getMediaAccessStatus("microphone") as PermissionStatus,
  };
}

// macOS asks for the camera and microphone in-app, once.
export async function requestPermission(kind: Exclude<PermissionKind, "screen">): Promise<void> {
  await systemPreferences.askForMediaAccess(kind);
}

// Screen Recording is allowed only in System Settings, and Pudu is listed there
// only after it has asked to capture once. So ask first; the answer doesn't matter.
export async function openPermissionSettings(kind: PermissionKind): Promise<void> {
  if (kind === "screen") {
    await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).catch(() => {});
  }
  await shell.openExternal(
    `x-apple.systempreferences:com.apple.preference.security?${SETTINGS_PANES[kind]}`,
  );
}
