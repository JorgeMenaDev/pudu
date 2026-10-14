import { FlipHorizontal2Icon, VideoOffIcon } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { BUBBLE_DIAMETER, type BubbleSize } from "@pudu/contracts";

import { pudu, useRecorderState } from "../bridge";
import { cn } from "../lib/utils";

const SIZES: ReadonlyArray<{ size: BubbleSize; label: string; name: string }> = [
  { size: "sm", label: "S", name: "Small" },
  { size: "md", label: "M", name: "Medium" },
  { size: "lg", label: "L", name: "Large" },
];

function useCamera(deviceId: string | null) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      })
      .then((next) => {
        if (cancelled) return next.getTracks().forEach((track) => track.stop());
        current = next;
        setStream(next);
        setError(null);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
    return () => {
      cancelled = true;
      current?.getTracks().forEach((track) => track.stop());
    };
  }, [deviceId]);
  return { stream, error };
}

// Moves the whole window with the pointer. A CSS drag region would swallow the
// hover that reveals the size controls, so the drag is done by hand.
function useWindowDrag() {
  const last = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("button")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      last.current = { x: event.screenX, y: event.screenY };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!last.current) return;
      const dx = event.screenX - last.current.x;
      const dy = event.screenY - last.current.y;
      if (dx === 0 && dy === 0) return;
      last.current = { x: event.screenX, y: event.screenY };
      pudu.moveWindowBy(dx, dy);
    },
    onPointerUp: () => (last.current = null),
  };
}

export function Bubble() {
  const state = useRecorderState();
  const settings = state?.settings;
  const { stream, error } = useCamera(settings?.cameraDeviceId ?? null);
  const video = useRef<HTMLVideoElement>(null);
  const drag = useWindowDrag();

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  if (!settings) return null;
  const diameter = BUBBLE_DIAMETER[settings.bubbleSize];

  return (
    <div className="group flex h-full w-full items-center justify-center">
      <div
        {...drag}
        className="relative cursor-grab overflow-hidden rounded-full bg-neutral-900 shadow-[0_12px_32px_-8px_rgb(0_0_0/55%)] ring-1 ring-white/15 active:cursor-grabbing"
        style={{ width: diameter, height: diameter }}
      >
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          className={cn(
            "size-full object-cover transition-opacity duration-300",
            settings.mirrorCamera && "-scale-x-100",
            stream ? "opacity-100" : "opacity-0",
          )}
        />
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
            <VideoOffIcon className="size-6" />
            <span className="text-xs leading-tight">Camera unavailable</span>
          </div>
        )}

        {/* Hover controls, inside the circle so they never leave the window. */}
        <div className="absolute inset-x-0 bottom-3 flex justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <div className="hud-glass flex items-center gap-0.5 rounded-full p-0.5 text-white">
            {SIZES.map(({ size, label, name }) => (
              <button
                key={size}
                type="button"
                title={`${name} bubble`}
                onClick={() => void pudu.updateSettings({ bubbleSize: size })}
                className={cn(
                  "flex size-6 cursor-pointer items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  settings.bubbleSize === size ? "bg-white text-black" : "text-white/75 hover:bg-white/15",
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              title="Mirror camera"
              onClick={() => void pudu.updateSettings({ mirrorCamera: !settings.mirrorCamera })}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/15"
            >
              <FlipHorizontal2Icon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
