import { useEffect, useState } from "react";

import type { AppStatus, PuduBridge, RecorderState, Unsubscribe } from "@pudu/contracts";

declare global {
  interface Window {
    readonly pudu: PuduBridge;
  }
}

export const pudu = window.pudu;

// A value main owns and broadcasts; null until the first read lands.
function useMainValue<T>(read: () => Promise<T>, subscribe: (listener: (value: T) => void) => Unsubscribe): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let active = true;
    void read().then((initial) => active && setValue(initial));
    const unsubscribe = subscribe(setValue);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [read, subscribe]);
  return value;
}

export function useRecorderState(): RecorderState | null {
  return useMainValue(pudu.getState, pudu.onState);
}

// Permissions, the login item and the recordings folder, as main last read them.
export function useAppStatus(): AppStatus | null {
  return useMainValue(pudu.getAppStatus, pudu.onAppStatus);
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
