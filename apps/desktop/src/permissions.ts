import { shell, systemPreferences } from "electron";

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

// Camera and mic can be asked for in-app. Screen recording can only be granted
// in System Settings, so for it we open the right pane instead.
export async function requestPermission(kind: PermissionKind): Promise<void> {
  if (kind === "screen") return openPermissionSettings(kind);
  await systemPreferences.askForMediaAccess(kind);
}

export async function openPermissionSettings(kind: PermissionKind): Promise<void> {
  await shell.openExternal(
    `x-apple.systempreferences:com.apple.preference.security?${SETTINGS_PANES[kind]}`,
  );
}
