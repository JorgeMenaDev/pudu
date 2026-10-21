import {
  FolderOpenIcon,
  KeyboardIcon,
  MicIcon,
  MonitorIcon,
  SettingsIcon,
  ShieldCheckIcon,
  VideoIcon,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import {
  PERMISSION_KINDS,
  PERMISSION_LABELS,
  SHORTCUTS,
  missingPermissions,
  type PermissionKind,
  type PermissionStatus,
  type SettingsPane,
} from "@pudu/contracts";

import { pudu, useAppStatus, useRecorderState, useSystemTheme } from "../bridge";
import { Button } from "../components/ui/button";
import { Kbd, KbdGroup } from "../components/ui/kbd";
import { Switch } from "../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { cn } from "../lib/utils";

function Group({ children }: { children: ReactNode }) {
  return <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs/5">{children}</div>;
}

function Row({ icon, title, detail, children }: {
  icon?: ReactNode;
  title: string;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      {icon && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground [&_svg]:size-4">
          {icon}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm">{title}</span>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </div>
      {children}
    </div>
  );
}

function GeneralPane() {
  const status = useAppStatus();
  const settings = useRecorderState()?.settings;
  if (!status || !settings) return null;
  return (
    <Group>
      <Row title="Open at login" detail="Start Pudu in the menu bar when you log in.">
        <Switch
          checked={status.openAtLogin}
          onCheckedChange={(enabled) => void pudu.setOpenAtLogin(enabled)}
          aria-label="Open at login"
        />
      </Row>
      <Row
        title="Countdown"
        detail={
          settings.countdownSeconds > 0
            ? `Counts down ${settings.countdownSeconds} seconds before recording starts.`
            : "Recording starts right away."
        }
      >
        <Switch
          checked={settings.countdownSeconds > 0}
          onCheckedChange={(on) => void pudu.updateSettings({ countdownSeconds: on ? 3 : 0 })}
          aria-label="Countdown"
        />
      </Row>
      <Row title="Recordings folder" detail={status.recordingsFolder}>
        <Button variant="outline" size="sm" onClick={() => void pudu.revealRecordingsFolder()}>
          <FolderOpenIcon />
          Show in Finder
        </Button>
      </Row>
    </Group>
  );
}

const PERMISSION_ROWS: Record<PermissionKind, { icon: ReactNode; detail: string }> = {
  screen: { icon: <MonitorIcon />, detail: "Always needed to record." },
  camera: { icon: <VideoIcon />, detail: "Needed while the camera is on." },
  microphone: { icon: <MicIcon />, detail: "Needed while the microphone is on." },
};

const STATUS_LABELS: Record<PermissionStatus, string> = {
  granted: "Allowed",
  "not-determined": "Not asked yet",
  denied: "Denied",
  restricted: "Denied",
  unknown: "Unknown",
};

function PermissionsPane() {
  const status = useAppStatus();
  const state = useRecorderState();
  if (!status || !state) return null;
  const missing = missingPermissions(status.permissions, state.settings);
  return (
    <div className="flex flex-col gap-3">
      <Group>
        {PERMISSION_KINDS.map((kind) => {
          const permission = status.permissions[kind];
          // macOS asks only once; after that, access changes in System Settings.
          const canAsk = permission === "not-determined";
          return (
            <Row key={kind} icon={PERMISSION_ROWS[kind].icon} title={PERMISSION_LABELS[kind]} detail={PERMISSION_ROWS[kind].detail}>
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  permission === "granted"
                    ? "text-success-foreground"
                    : missing.includes(kind)
                      ? "text-warning-foreground"
                      : "text-muted-foreground",
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {STATUS_LABELS[permission]}
              </span>
              {permission !== "granted" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void (canAsk ? pudu.requestPermission(kind) : pudu.openPermissionSettings(kind))}
                >
                  {canAsk ? "Allow" : "Open System Settings"}
                </Button>
              )}
            </Row>
          );
        })}
      </Group>
      {status.restartNeeded && (
        <div className="flex items-center gap-3 rounded-xl border border-info/30 bg-info/8 px-4 py-3">
          <span className="flex-1 text-sm">Screen Recording is allowed. macOS applies it after Pudu restarts.</span>
          <Button size="sm" disabled={state.phase !== "idle"} onClick={() => void pudu.relaunch()}>
            Restart Pudu
          </Button>
        </div>
      )}
    </div>
  );
}

const KEY_SYMBOLS: Record<string, string> = { Command: "⌘", Shift: "⇧", Alt: "⌥" };

const SHORTCUT_ROWS = [
  { title: "Start or stop recording", accelerator: SHORTCUTS.startStop },
  { title: "Pause or resume", accelerator: SHORTCUTS.pause },
  { title: "Restart the take", accelerator: SHORTCUTS.restart },
  { title: "Cancel and delete (asks first)", accelerator: SHORTCUTS.cancel },
];

function ShortcutsPane() {
  return (
    <div className="flex flex-col gap-3">
      <Group>
        {SHORTCUT_ROWS.map(({ title, accelerator }) => (
          <Row key={accelerator} title={title}>
            <KbdGroup>
              {accelerator.split("+").map((key) => (
                <Kbd key={key}>{KEY_SYMBOLS[key] ?? key}</Kbd>
              ))}
            </KbdGroup>
          </Row>
        ))}
      </Group>
      <p className="px-1 text-xs text-muted-foreground">These work from any app.</p>
    </div>
  );
}

const PANES: Record<SettingsPane, { label: string; icon: ReactNode; Content: ComponentType }> = {
  general: { label: "General", icon: <SettingsIcon />, Content: GeneralPane },
  permissions: { label: "Permissions", icon: <ShieldCheckIcon />, Content: PermissionsPane },
  shortcuts: { label: "Shortcuts", icon: <KeyboardIcon />, Content: ShortcutsPane },
};

function isPane(value: unknown): value is SettingsPane {
  return typeof value === "string" && Object.hasOwn(PANES, value);
}

// The pane lives in the hash, `#/settings/<pane>`, so main can open any pane.
function readPane(): SettingsPane {
  const requested = window.location.hash.split("/")[2];
  return isPane(requested) ? requested : "general";
}

function usePane(): SettingsPane {
  const [pane, setPane] = useState(readPane);
  useEffect(() => {
    const sync = () => setPane(readPane());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return pane;
}

export function Settings() {
  useSystemTheme();
  const pane = usePane();
  const { Content } = PANES[pane];
  useEffect(() => {
    document.title = "Pudu Settings";
  }, []);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="drag-region flex h-[52px] shrink-0 items-center justify-center">
        <ToggleGroup
          value={[pane]}
          onValueChange={(value) => {
            if (isPane(value[0])) window.location.hash = `/settings/${value[0]}`;
          }}
          variant="outline"
          size="sm"
          className="no-drag"
        >
          {Object.entries(PANES).map(([id, { label, icon }]) => (
            <ToggleGroupItem key={id} value={id}>
              {icon} {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>
      <main className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">
        <Content />
      </main>
    </div>
  );
}
