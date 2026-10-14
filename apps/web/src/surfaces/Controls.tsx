import { CheckIcon, GripHorizontalIcon, PauseIcon, PlayIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";

import { elapsedMs } from "@pudu/contracts";

import { pudu, useNow, useRecorderState } from "../bridge";
import { cn, formatDuration } from "../lib/utils";

function HudButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "no-drag flex size-9 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/12 hover:text-white disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

// The floating recording toolbar. It is content-protected, so it never shows
// up in the video. Native `title` tooltips, because the window is only 56px wide.
export function Controls() {
  const state = useRecorderState();
  const live = state?.phase === "recording";
  const now = useNow(live);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  if (!state) return null;
  const paused = state.phase === "paused";
  const rolling = live || paused;

  return (
    <div className="flex h-full items-end justify-center p-1">
      <div className="hud-glass flex w-12 flex-col items-center gap-1 rounded-full py-1.5">
        <button
          type="button"
          title="Stop and save (⌘⇧L)"
          onClick={() => void pudu.stop()}
          className="no-drag group flex size-9 cursor-pointer items-center justify-center rounded-full bg-red-500 shadow-[0_0_0_3px_rgb(239_68_68/25%)] transition-transform hover:scale-105 active:scale-95"
        >
          <span className="size-3 rounded-[3px] bg-white" />
        </button>

        <div
          className={cn(
            "my-1 flex flex-col items-center gap-1 font-mono text-[11px] font-medium tabular-nums text-white/90",
            paused && "text-amber-300",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              live ? "animate-recording-dot bg-red-500" : paused ? "bg-amber-300" : "bg-white/40",
            )}
          />
          {formatDuration(elapsedMs(state, now))}
        </div>

        <HudButton
          title={paused ? "Resume (⌥⇧P)" : "Pause (⌥⇧P)"}
          disabled={!rolling}
          onClick={() => void pudu.togglePause()}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </HudButton>
        <HudButton title="Restart (⌘⇧R)" disabled={!rolling} onClick={() => void pudu.restart()}>
          <RotateCcwIcon />
        </HudButton>
        <HudButton
          title={confirmingDelete ? "Click again to delete" : "Cancel and delete (⌥⇧C)"}
          onClick={() => (confirmingDelete ? void pudu.cancel() : setConfirmingDelete(true))}
          className={cn(confirmingDelete && "bg-red-500/90 text-white hover:bg-red-500")}
        >
          {confirmingDelete ? <CheckIcon /> : <Trash2Icon />}
        </HudButton>

        <div className="drag-region flex h-5 w-full cursor-grab items-center justify-center text-white/35">
          <GripHorizontalIcon className="size-3.5" />
        </div>
      </div>
    </div>
  );
}
