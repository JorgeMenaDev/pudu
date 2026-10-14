import { useEffect, useState } from "react";

import type { GlimpseBridge, RecorderState } from "@glimpse/contracts";

declare global {
  interface Window {
    readonly glimpse: GlimpseBridge;
  }
}

export const glimpse = window.glimpse;

// Live recorder state from the main process; null until the first read lands.
export function useRecorderState(): RecorderState | null {
  const [state, setState] = useState<RecorderState | null>(null);
  useEffect(() => {
    let active = true;
    void glimpse.getState().then((initial) => active && setState(initial));
    const unsubscribe = glimpse.onState(setState);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return state;
}

// Re-renders every `intervalMs` while `enabled`, for ticking clocks.
export function useNow(enabled: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);
  return now;
}

// Follows the macOS appearance, like T3 Code's `.dark` class switch.
export function useSystemTheme(): void {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
}
