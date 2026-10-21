import {
  ArrowLeftIcon,
  ClapperboardIcon,
  CopyIcon,
  DownloadIcon,
  FolderOpenIcon,
  LibraryBigIcon,
  SearchIcon,
  ShareIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { SHARE_PRESETS, type ExportSize, type Recording, type SharePresetId } from "@pudu/contracts";

import { pudu, useRecorderState, useSystemTheme } from "../bridge";
import { PuduMark } from "../components/PuduMark";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Kbd, KbdGroup } from "../components/ui/kbd";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../components/ui/popover";
import { Radio, RadioGroup } from "../components/ui/radio-group";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { cn, formatBytes, formatDuration, formatRelative } from "../lib/utils";

function useRecordings() {
  const [recordings, setRecordings] = useState<ReadonlyArray<Recording> | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const refresh = useCallback(() => void pudu.listRecordings().then(setRecordings), []);
  useEffect(() => {
    refresh();
    // Main pings after a save (with the new id) or any rename/delete.
    return pudu.onLibraryChanged((id) => {
      refresh();
      if (id) setFocusId(id);
    });
  }, [refresh]);
  return { recordings, refresh, focusId, setFocusId };
}

function ShortcutKbd() {
  return (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>⇧</Kbd>
      <Kbd>L</Kbd>
    </KbdGroup>
  );
}

function IconAction({ label, onClick, children, destructive = false }: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            onClick={onClick}
            aria-label={label}
            className={cn(destructive && "hover:text-destructive-foreground")}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function Sidebar({ count, onNew, onHome }: { count: number; onNew: () => void; onHome: () => void }) {
  const state = useRecorderState();
  const busy = state !== null && state.phase !== "idle";
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand beside the traffic lights, as in T3 Code; the strip drags the window. */}
      <div className="drag-region flex h-[var(--workspace-topbar-height)] shrink-0 items-center gap-2 ps-[84px]">
        <PuduMark className="size-4.5" />
        <span className="font-semibold text-sm tracking-tight">Pudu</span>
      </div>
      <div className="flex flex-col gap-3 px-[var(--sidebar-content-inset)] pt-1">
        <Button className="w-full justify-between" onClick={onNew} disabled={busy}>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-white" />
            {busy ? "Recording…" : "New recording"}
          </span>
          <span className="flex gap-0.5 opacity-80">
            <Kbd className="bg-white/15 text-white">⌘⇧L</Kbd>
          </span>
        </Button>
        <nav className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onHome}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-[var(--control-radius)] bg-sidebar-row-active px-[var(--sidebar-row-content-inset)] text-sm shadow-xs/5"
          >
            <LibraryBigIcon className="size-4 text-[var(--sidebar-icon-color)]" />
            <span className="flex-1 text-left">Library</span>
            <span className="text-xs tabular-nums text-sidebar-muted-foreground">{count}</span>
          </button>
        </nav>
      </div>
      <div className="mt-auto px-4 py-4 text-[11px] leading-relaxed text-sidebar-muted-foreground">
        Recordings are saved to <span className="font-medium text-sidebar-foreground">Movies/Pudu</span>.
      </div>
    </aside>
  );
}

function RecordingCard({ recording, onOpen }: { recording: Recording; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex cursor-pointer flex-col gap-2.5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted shadow-xs/5 transition-shadow group-hover:shadow-md/10">
        {recording.thumbnailUrl ? (
          <img
            src={recording.thumbnailUrl}
            alt=""
            draggable={false}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ClapperboardIcon className="size-6" />
          </div>
        )}
        <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 font-medium text-[11px] text-white tabular-nums backdrop-blur-sm">
          {formatDuration(recording.durationMs)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="truncate font-medium text-sm">{recording.title}</span>
        <span className="text-xs text-muted-foreground">{formatRelative(recording.createdAt)}</span>
      </div>
    </button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 pb-16 text-center">
      <div className="relative flex size-16 items-center justify-center rounded-2xl border bg-card shadow-xs/5">
        <ClapperboardIcon className="size-7 text-muted-foreground" />
        <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-red-500">
          <span className="size-2 rounded-full bg-white" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-base">No recordings yet</h2>
        <p className="max-w-72 text-sm text-muted-foreground">
          Record your screen with your camera in a bubble, then share the video anywhere.
        </p>
      </div>
      <Button onClick={onNew}>
        <span className="size-2 rounded-full bg-white" />
        New recording
      </Button>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        or press <ShortcutKbd /> from any app
      </div>
    </div>
  );
}

type CopyState = { readonly progress: number } | { readonly bytes: number } | { readonly error: string };

// Pick a size, then copy, save, share or reveal that file. A smaller size is
// prepared first (or reused) by main, which keeps the copy next to the original.
function ExportPanel({ recording }: { recording: Recording }) {
  const [size, setSize] = useState<ExportSize>("original");
  const [copies, setCopies] = useState<Partial<Record<SharePresetId, CopyState>>>({});
  const [notice, setNotice] = useState<{ readonly text: string; readonly failed: boolean } | null>(null);
  const setCopy = (preset: SharePresetId, state: CopyState) => setCopies((current) => ({ ...current, [preset]: state }));
  useEffect(
    () =>
      pudu.onExportProgress(({ id, preset, progress }) => {
        if (id !== recording.id) return;
        setCopies((current) => {
          const copy = current[preset];
          // A ready copy shows progress again when main has to remake it.
          return copy && !("error" in copy) ? { ...current, [preset]: { progress } } : current;
        });
      }),
    [recording.id],
  );

  // Makes the copy, or checks a ready one is still on disk. A ready copy stays
  // shown while main checks it; main remakes it, with progress, if it's gone.
  const prepare = async (preset: SharePresetId) => {
    const copy = copies[preset];
    if (copy && "progress" in copy) return;
    if (!copy || "error" in copy) setCopy(preset, { progress: 0 });
    try {
      setCopy(preset, { bytes: await pudu.prepareExport(recording.id, preset) });
    } catch (reason) {
      setCopy(preset, { error: reason instanceof Error ? reason.message : String(reason) });
    }
  };

  const choose = (next: ExportSize) => {
    setSize(next);
    setNotice(null);
    if (next !== "original") void prepare(next);
  };

  // Shows how an action button went: its message, or `failure`. Clicking again
  // retries. A failed copy may have been deleted outside Pudu, so prepare it again.
  const report = (action: Promise<string | null>, failure: string) =>
    void action.then(
      (text) => setNotice(text ? { text, failed: false } : null),
      () => {
        setNotice({ text: failure, failed: true });
        if (size !== "original") void prepare(size);
      },
    );

  const estimateBytes = (mbps: number) => ((recording.durationMs / 1000) * mbps * 1_000_000) / 8;
  // Only offer sizes that would actually shrink this file.
  const presets = SHARE_PRESETS.filter((preset) => estimateBytes(preset.approxMbps) < recording.sizeBytes * 0.8);
  const label = size === "original" ? "Original" : size;
  const status: CopyState = size === "original" ? { bytes: recording.sizeBytes } : (copies[size] ?? { progress: 0 });

  return (
    <div className="flex flex-col gap-3">
      <PopoverTitle>Export recording</PopoverTitle>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Size</span>
        <RadioGroup
          value={size}
          onValueChange={(value: ExportSize) => choose(value)}
          aria-label="Size"
          className="gap-0"
        >
          <SizeOption value="original" label="Original" detail={formatBytes(recording.sizeBytes)} />
          {presets.map((preset) => {
            const copy = copies[preset.id];
            const detail =
              copy && "bytes" in copy ? formatBytes(copy.bytes) : `≈ ${formatBytes(estimateBytes(preset.approxMbps))}`;
            return <SizeOption key={preset.id} value={preset.id} label={preset.id} detail={detail} />;
          })}
        </RadioGroup>
        {presets.length === 0 && (
          <p className="text-xs text-muted-foreground">Already small enough to share.</p>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t pt-3">
        {"progress" in status && (
          <>
            <p className="text-sm tabular-nums">
              Preparing {label}… {Math.round(status.progress * 100)}%
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${status.progress * 100}%` }} />
            </div>
          </>
        )}
        {"error" in status && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-destructive-foreground" title={status.error}>
              Couldn't prepare {label}.
            </p>
            <Button variant="outline" size="sm" onClick={() => choose(size)}>
              Try again
            </Button>
          </div>
        )}
        {"bytes" in status && (
          <>
            <p className="text-sm">
              <span className="font-medium">Ready</span>
              <span className="text-muted-foreground tabular-nums">
                {" · "}
                {label} · {formatBytes(status.bytes)}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  report(
                    pudu.copyRecording(recording.id, size).then(() => "Copied. Paste with ⌘V."),
                    "Couldn't copy. Try again.",
                  )
                }
              >
                <CopyIcon />
                Copy to clipboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  report(
                    pudu.saveRecording(recording.id, size).then((saved) => (saved ? "Saved." : null)),
                    "Couldn't save. Try again.",
                  )
                }
              >
                <DownloadIcon />
                Save to…
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  report(pudu.shareRecording(recording.id, size).then(() => null), "Couldn't share. Try again.")
                }
              >
                <ShareIcon />
                Share…
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  report(
                    pudu.revealRecording(recording.id, size).then(() => null),
                    "Couldn't show in Finder. Try again.",
                  )
                }
              >
                <FolderOpenIcon />
                Show in Finder
              </Button>
            </div>
            {notice && (
              <p className={cn("text-xs", notice.failed ? "text-destructive-foreground" : "text-muted-foreground")}>
                {notice.text}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SizeOption({ value, label, detail }: { value: ExportSize; label: string; detail: string }) {
  return (
    <label className="-mx-2 flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-accent">
      <Radio value={value} />
      <span className="flex-1">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{detail}</span>
    </label>
  );
}

function RecordingDetail({ recording, onBack }: { recording: Recording; onBack: () => void }) {
  const [title, setTitle] = useState(recording.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => setTitle(recording.title), [recording.title]);

  const saveTitle = () => {
    if (title.trim() && title !== recording.title) void pudu.renameRecording(recording.id, title);
    else setTitle(recording.title);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-8 pt-2 pb-10">
      <div className="overflow-hidden rounded-2xl border bg-black shadow-lg/10">
        <video
          src={recording.videoUrl}
          poster={recording.thumbnailUrl ?? undefined}
          controls
          autoPlay
          className="aspect-video w-full bg-black"
        />
      </div>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setTitle(recording.title);
                event.currentTarget.blur();
              }
            }}
            aria-label="Title"
            className="-mx-1.5 rounded-md bg-transparent px-1.5 py-0.5 font-semibold text-xl tracking-tight outline-none transition-colors hover:bg-accent focus:bg-accent"
          />
          <p className="text-sm text-muted-foreground">
            {new Date(recording.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            {" · "}
            {formatDuration(recording.durationMs)}
            {recording.width > 0 && ` · ${recording.width}×${recording.height}`}
            {" · "}
            {formatBytes(recording.sizeBytes)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Popover>
            <PopoverTrigger render={<Button />}>
              <UploadIcon />
              Export…
            </PopoverTrigger>
            <PopoverPopup align="end" width="lg">
              <ExportPanel recording={recording} />
            </PopoverPopup>
          </Popover>
          {/* A missing original has nothing to reveal: stay quiet, as before the Export panel. */}
          <IconAction
            label="Show in Finder"
            onClick={() => void pudu.revealRecording(recording.id, "original").catch(() => undefined)}
          >
            <FolderOpenIcon />
          </IconAction>
          <IconAction label="Delete" destructive onClick={() => setConfirmingDelete(true)}>
            <Trash2Icon />
          </IconAction>
          <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
            <DeleteDialog recording={recording} onDeleted={onBack} />
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({ recording, onDeleted }: { recording: Recording; onDeleted: () => void }) {
  return (
    <AlertDialogPopup>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this recording?</AlertDialogTitle>
        <AlertDialogDescription>
          “{recording.title}” will be removed from Movies/Pudu. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
        <AlertDialogClose
          render={<Button variant="destructive" />}
          onClick={() => void pudu.deleteRecording(recording.id).then(onDeleted)}
        >
          Delete
        </AlertDialogClose>
      </AlertDialogFooter>
    </AlertDialogPopup>
  );
}

export function Library() {
  useSystemTheme();
  const { recordings, focusId, setFocusId } = useRecordings();
  const [query, setQuery] = useState("");
  const selected = recordings?.find((recording) => recording.id === focusId) ?? null;
  const filtered = useMemo(
    () =>
      recordings?.filter((recording) => recording.title.toLowerCase().includes(query.trim().toLowerCase())) ?? [],
    [recordings, query],
  );
  const openLauncher = () => void pudu.openLauncher();

  return (
    <TooltipProvider delay={400}>
      <div className="flex h-full bg-background text-foreground">
        <Sidebar count={recordings?.length ?? 0} onNew={openLauncher} onHome={() => setFocusId(null)} />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="drag-region flex h-[var(--workspace-topbar-height)] shrink-0 items-center gap-3 px-6">
            {selected ? (
              <Button variant="ghost" size="sm" className="no-drag -ms-2" onClick={() => setFocusId(null)}>
                <ArrowLeftIcon />
                Library
              </Button>
            ) : (
              <h1 className="font-semibold text-sm">Library</h1>
            )}
            {!selected && recordings && recordings.length > 0 && (
              <div className="no-drag relative ms-auto w-64">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  size="sm"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search recordings"
                  className="*:data-[slot=input]:ps-7.5"
                />
              </div>
            )}
          </header>
          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
            {recordings === null ? null : selected ? (
              // Keyed so another recording never inherits this one's export or title state.
              <RecordingDetail key={selected.id} recording={selected} onBack={() => setFocusId(null)} />
            ) : recordings.length === 0 ? (
              <EmptyState onNew={openLauncher} />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-5 gap-y-6 px-6 pt-2 pb-10">
                {filtered.map((recording) => (
                  <RecordingCard key={recording.id} recording={recording} onOpen={() => setFocusId(recording.id)} />
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
                    No recordings match “{query}”.
                  </p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
