import {
  ArrowLeftIcon,
  ClapperboardIcon,
  CopyIcon,
  FolderOpenIcon,
  LibraryBigIcon,
  SearchIcon,
  ShareIcon,
  ShrinkIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { SHARE_PRESETS, type Recording, type SharePresetId } from "@pudu/contracts";

import { pudu, useRecorderState, useSystemTheme } from "../bridge";
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
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger } from "../components/ui/menu";
import { Spinner } from "../components/ui/spinner";
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
        <span className="relative flex size-4.5 items-center justify-center rounded-full border-2 border-foreground/85">
          <span className="size-1.5 rounded-full bg-red-500" />
        </span>
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

// Makes a smaller copy for Teams, Jira or email. The copy opens when ready.
function CompressMenu({ recording }: { recording: Recording }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => pudu.onCompressProgress((update) => update.id === recording.id && setProgress(update.progress)),
    [recording.id],
  );

  const compress = async (preset: SharePresetId) => {
    setError(null);
    setProgress(0);
    try {
      await pudu.compressRecording(recording.id, preset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setProgress(null);
    }
  };

  if (progress !== null) {
    return (
      <Button variant="outline" disabled className="tabular-nums">
        <Spinner />
        Compressing… {Math.round(progress * 100)}%
      </Button>
    );
  }
  const estimateBytes = (mbps: number) => ((recording.durationMs / 1000) * mbps * 1_000_000) / 8;
  // Only offer sizes that would actually shrink this file.
  const presets = SHARE_PRESETS.filter((preset) => estimateBytes(preset.approxMbps) < recording.sizeBytes * 0.8);
  return (
    <Menu>
      <MenuTrigger render={<Button variant="outline" title={error ?? undefined} />}>
        <ShrinkIcon />
        {error ? "Compress failed" : "Compress"}
      </MenuTrigger>
      <MenuPopup align="end" className="w-72">
        <MenuGroup>
          <MenuGroupLabel>Make a smaller copy · now {formatBytes(recording.sizeBytes)}</MenuGroupLabel>
          {presets.length === 0 && (
            <MenuItem disabled className="text-muted-foreground">
              Already small enough to share
            </MenuItem>
          )}
          {presets.map((preset) => (
            <MenuItem key={preset.id} onClick={() => void compress(preset.id)} className="items-start py-1.5">
              <div className="flex flex-1 flex-col">
                <span>{preset.label}</span>
                <span className="text-xs text-muted-foreground">{preset.detail}</span>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">≈ {formatBytes(estimateBytes(preset.approxMbps))}</span>
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

function RecordingDetail({ recording, onBack }: { recording: Recording; onBack: () => void }) {
  const [title, setTitle] = useState(recording.title);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => setTitle(recording.title), [recording.title]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const saveTitle = () => {
    if (title.trim() && title !== recording.title) void pudu.renameRecording(recording.id, title);
    else setTitle(recording.title);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-8 pt-2 pb-10">
      <div className="overflow-hidden rounded-2xl border bg-black shadow-lg/10">
        <video
          key={recording.id}
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
          <CompressMenu recording={recording} />
          <Button variant="outline" onClick={() => void pudu.copyRecording(recording.id).then(() => setCopied(true))}>
            <CopyIcon />
            {copied ? "Copied" : "Copy video"}
          </Button>
          <Button onClick={() => void pudu.shareRecording(recording.id)}>
            <ShareIcon />
            Share
          </Button>
          <IconAction label="Show in Finder" onClick={() => void pudu.revealRecording(recording.id)}>
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
              <RecordingDetail recording={selected} onBack={() => setFocusId(null)} />
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
