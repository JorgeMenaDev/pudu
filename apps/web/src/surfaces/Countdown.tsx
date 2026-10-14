import { pudu, useRecorderState } from "../bridge";

// 3-2-1 over the recorded display. Clicking it starts right away.
export function Countdown() {
  const state = useRecorderState();
  const count = state?.countdown;
  if (count == null) return null;
  return (
    <button
      type="button"
      onClick={() => void pudu.skipCountdown()}
      className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-3"
    >
      <div className="hud-glass flex size-40 items-center justify-center rounded-full">
        <span key={count} className="animate-countdown-pop font-semibold text-7xl text-white tabular-nums">
          {count}
        </span>
      </div>
      <span className="hud-glass rounded-full px-3 py-1 text-white/80 text-xs">Click to start now</span>
    </button>
  );
}
