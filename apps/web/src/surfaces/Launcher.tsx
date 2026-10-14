import {
  AppWindowIcon,
  CircleAlertIcon,
  LibraryBigIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  VideoIcon,
  VideoOffIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import type {
  CaptureSource,
  CaptureSourceKind,
  PermissionKind,
  Permissions,
  RecorderSettings,
} from "@glimpse/contracts";

import { glimpse, useRecorderState, useSystemTheme } from "../bridge";
import { Button } from "../components/ui/button";
import { Kbd, KbdGroup } from "../components/ui/kbd";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../components/ui/select";
import { Spinner } from "../components/ui/spinner";
import { Switch } from "../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { cn } from "../lib/utils";

function useSources() {
  const [sources, setSources] = useState<ReadonlyArray<CaptureSource> | null>(null);
  const refresh = useCallback(() => void glimpse.listSources().then(setSources), []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  return sources;
}

function usePermissions() {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const refresh = useCallback(() => void glimpse.getPermissions().then(setPermissions), []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  return { permissions, refresh };
}

function useDevices(kind: MediaDeviceKind, enabled: boolean) {
  const [devices, setDevices] = useState<ReadonlyArray<MediaDeviceInfo>>([]);
  useEffect(() => {
    if (!enabled) return;
    const load = () =>
      void navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setDevices(all.filter((device) => device.kind === kind && device.deviceId !== "")));
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => navigator.mediaDevices.removeEventListener("devicechange", load);
  }, [kind, enabled]);
  return devices;
}

// 0–1 input level of the selected microphone, so you can see it hears you.
function useMicLevel(enabled: boolean, deviceId: string | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!enabled) return setLevel(0);
    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let cancelled = false;
    void navigator.mediaDevices
      .getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true })
      .then((next) => {
        if (cancelled) return next.getTracks().forEach((track) => track.stop());
        stream = next;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(next).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
          setLevel(Math.min(1, rms * 6));
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => setLevel(0));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [enabled, deviceId]);
  return level;
}

function SourceTile({
  source,
  selected,
  onSelect,
}: {
  source: CaptureSource;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl p-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
        selected && "bg-accent",
      )}
    >
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-lg border bg-muted ring-offset-2 ring-offset-popover transition-shadow",
          selected && "ring-2 ring-primary",
        )}
      >
        <img src={source.thumbnailDataUrl} alt="" className="size-full object-cover" draggable={false} />
      </div>
      <div className="flex min-w-0 items-center gap-1.5 px-0.5">
        {source.appIconDataUrl ? (
          <img src={source.appIconDataUrl} alt="" className="size-3.5 shrink-0" draggable={false} />
        ) : null}
        <span className="truncate text-xs text-secondary-label">{source.name}</span>
      </div>
    </button>
  );
}

function DeviceRow({
  icon,
  offIcon,
  label,
  enabled,
  devices,
  deviceId,
  onToggle,
  onDevice,
  trailing,
}: {
  icon: ReactNode;
  offIcon: ReactNode;
  label: string;
  enabled: boolean;
  devices: ReadonlyArray<MediaDeviceInfo>;
  deviceId: string | null;
  onToggle: (enabled: boolean) => void;
  onDevice: (deviceId: string) => void;
  trailing?: ReactNode;
}) {
  const current = devices.find((device) => device.deviceId === deviceId) ?? devices[0];
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground [&_svg]:size-4",
          enabled && "text-foreground",
        )}
      >
        {enabled ? icon : offIcon}
      </div>
      <Select
        value={current?.deviceId ?? ""}
        onValueChange={(value) => typeof value === "string" && onDevice(value)}
        disabled={!enabled || devices.length === 0}
      >
        <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={label}>
          <SelectValue>
            {() => (enabled ? (current?.label ?? `Default ${label.toLowerCase()}`) : `No ${label.toLowerCase()}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${device.deviceId.slice(0, 4)}`}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {trailing}
      <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`${label} on`} />
    </div>
  );
}

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="flex h-4 items-end gap-0.5" aria-hidden>
      {[0.15, 0.3, 0.5, 0.7, 0.9].map((threshold, index) => (
        <span
          key={threshold}
          className={cn(
            "w-[3px] rounded-full transition-colors duration-75",
            level >= threshold ? "bg-emerald-500" : "bg-input",
          )}
          style={{ height: `${40 + index * 15}%` }}
        />
      ))}
    </div>
  );
}

function PermissionCallout({ kind, onFix }: { kind: PermissionKind; onFix: () => void }) {
  const copy: Record<PermissionKind, string> = {
    screen: "Allow Screen Recording for Glimpse in System Settings, then reopen this panel.",
    camera: "Glimpse can't use your camera yet.",
    microphone: "Glimpse can't use your microphone yet.",
  };
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-surface px-2.5 py-2 text-xs text-warning-foreground">
      <CircleAlertIcon className="mt-px size-3.5 shrink-0" />
      <span className="flex-1 leading-snug">{copy[kind]}</span>
      <button type="button" onClick={onFix} className="shrink-0 cursor-pointer font-medium underline-offset-2 hover:underline">
        {kind === "screen" ? "Open Settings" : "Allow"}
      </button>
    </div>
  );
}

export function Launcher() {
  useSystemTheme();
  const state = useRecorderState();
  const sources = useSources();
  const { permissions, refresh: refreshPermissions } = usePermissions();
  const settings = state?.settings;
  const cameras = useDevices("videoinput", permissions?.camera === "granted");
  const mics = useDevices("audioinput", permissions?.microphone === "granted");
  const micLevel = useMicLevel(Boolean(settings?.micEnabled && permissions?.microphone === "granted"), settings?.micDeviceId ?? null);
  const [tab, setTab] = useState<CaptureSourceKind>("screen");

  const update = (patch: Partial<RecorderSettings>) => void glimpse.updateSettings(patch);
  const ask = async (kind: PermissionKind) => {
    await glimpse.requestPermission(kind);
    refreshPermissions();
  };

  // Turning a device on is the moment to ask macOS for access to it.
  useEffect(() => {
    if (!permissions || !settings) return;
    if (settings.cameraEnabled && permissions.camera === "not-determined") void ask("camera");
    else if (settings.micEnabled && permissions.microphone === "not-determined") void ask("microphone");
  }, [permissions, settings?.cameraEnabled, settings?.micEnabled]);

  const visible = sources?.filter((source) => source.kind === tab) ?? [];
  const selectedId =
    settings?.sourceId && sources?.some((source) => source.id === settings.sourceId)
      ? settings.sourceId
      : (sources?.find((source) => source.kind === "screen")?.id ?? null);

  const blocked: PermissionKind[] = permissions
    ? (["screen", "camera", "microphone"] as const).filter(
        (kind) =>
          (permissions[kind] === "denied" || permissions[kind] === "restricted") &&
          (kind === "screen" || (kind === "camera" ? settings?.cameraEnabled : settings?.micEnabled)),
      )
    : [];

  const start = async () => {
    if (selectedId !== settings?.sourceId) await glimpse.updateSettings({ sourceId: selectedId });
    await glimpse.start();
  };

  return (
    <div className="h-full p-2">
      <div className="dropdown-glass flex h-full flex-col overflow-hidden rounded-2xl text-foreground">
        <header className="drag-region flex h-12 shrink-0 items-center gap-2 px-3.5">
          <span className="relative flex size-5 items-center justify-center rounded-full border-2 border-foreground/85">
            <span className="size-2 rounded-full bg-red-500" />
          </span>
          <span className="font-semibold text-sm tracking-tight">Glimpse</span>
          <div className="no-drag ms-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Open library"
              onClick={() => {
                void glimpse.hideLauncher();
                void glimpse.openLibrary();
              }}
            >
              <LibraryBigIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" title="Close" onClick={() => void glimpse.hideLauncher()}>
              <XIcon />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-3.5 pb-3.5">
          <ToggleGroup
            value={[tab]}
            onValueChange={(value) => {
              const next = value[0];
              if (next === "screen" || next === "window") setTab(next);
            }}
            variant="outline"
            size="sm"
            className="w-full *:flex-1"
          >
            <ToggleGroupItem value="screen">
              <MonitorIcon /> Screen
            </ToggleGroupItem>
            <ToggleGroupItem value="window">
              <AppWindowIcon /> Window
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="thin-scrollbar -mx-1.5 min-h-0 flex-1 overflow-y-auto">
            {sources === null ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Spinner />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
                {permissions?.screen === "granted"
                  ? "No windows to record."
                  : "Glimpse needs Screen Recording access to show your screens."}
              </div>
            ) : (
              <div className={cn("grid gap-1", tab === "window" && "grid-cols-2")}>
                {visible.map((source) => (
                  <SourceTile
                    key={source.id}
                    source={source}
                    selected={source.id === selectedId}
                    onSelect={() => update({ sourceId: source.id })}
                  />
                ))}
              </div>
            )}
          </div>

          {settings && (
            <div className="flex flex-col gap-2">
              <DeviceRow
                icon={<VideoIcon />}
                offIcon={<VideoOffIcon />}
                label="Camera"
                enabled={settings.cameraEnabled}
                devices={cameras}
                deviceId={settings.cameraDeviceId}
                onToggle={(cameraEnabled) => update({ cameraEnabled })}
                onDevice={(cameraDeviceId) => update({ cameraDeviceId })}
              />
              <DeviceRow
                icon={<MicIcon />}
                offIcon={<MicOffIcon />}
                label="Microphone"
                enabled={settings.micEnabled}
                devices={mics}
                deviceId={settings.micDeviceId}
                onToggle={(micEnabled) => update({ micEnabled })}
                onDevice={(micDeviceId) => update({ micDeviceId })}
                trailing={settings.micEnabled ? <LevelMeter level={micLevel} /> : null}
              />
              <div className="flex items-center justify-between pt-0.5 text-xs text-muted-foreground">
                <span>Countdown</span>
                <ToggleGroup
                  value={[String(settings.countdownSeconds)]}
                  onValueChange={(value) => {
                    const seconds = Number(value[0]);
                    if (seconds === 0 || seconds === 3 || seconds === 5) update({ countdownSeconds: seconds });
                  }}
                  variant="outline"
                  size="xs"
                >
                  <ToggleGroupItem value="0">Off</ToggleGroupItem>
                  <ToggleGroupItem value="3">3s</ToggleGroupItem>
                  <ToggleGroupItem value="5">5s</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          )}

          {state?.error && (
            <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-surface px-2.5 py-2 text-xs text-error-foreground">
              <CircleAlertIcon className="mt-px size-3.5 shrink-0" />
              <span className="leading-snug">{state.error}</span>
            </div>
          )}
          {blocked.map((kind) => (
            <PermissionCallout
              key={kind}
              kind={kind}
              onFix={() => void (kind === "screen" ? glimpse.openPermissionSettings(kind) : ask(kind))}
            />
          ))}

          <Button
            size="lg"
            className="w-full border-red-500 bg-red-500 shadow-red-500/25 [:hover,[data-pressed]]:bg-red-500/90"
            disabled={!selectedId || state?.phase !== "idle"}
            onClick={() => void start()}
          >
            <span className="size-2.5 rounded-full bg-white" />
            Start recording
          </Button>
          <div className="-mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>⇧</Kbd>
              <Kbd>L</Kbd>
            </KbdGroup>
            <span>to start and stop from anywhere</span>
          </div>
        </div>
      </div>
    </div>
  );
}
