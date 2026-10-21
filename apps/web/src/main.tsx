import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";

import type { Surface } from "@pudu/contracts";

import "./index.css";
import { Bubble } from "./surfaces/Bubble";
import { Controls } from "./surfaces/Controls";
import { Countdown } from "./surfaces/Countdown";
import { Launcher } from "./surfaces/Launcher";
import { Library } from "./surfaces/Library";
import { Recorder } from "./surfaces/Recorder";
import { Settings } from "./surfaces/Settings";

// Each Electron window loads this bundle with `#/<surface>`; a surface may read
// more of the hash, like `#/settings/permissions`.
const SURFACES: Record<Surface, ComponentType> = {
  library: Library,
  launcher: Launcher,
  bubble: Bubble,
  controls: Controls,
  countdown: Countdown,
  recorder: Recorder,
  settings: Settings,
};

const OVERLAYS: ReadonlySet<Surface> = new Set(["launcher", "bubble", "controls", "countdown"]);

function isSurface(value: string): value is Surface {
  return Object.hasOwn(SURFACES, value);
}

const requested = window.location.hash.replace(/^#\/?/, "").split("/")[0] ?? "";
const surface: Surface = isSurface(requested) ? requested : "library";
if (OVERLAYS.has(surface)) document.documentElement.dataset.overlay = surface;

const Root = SURFACES[surface];
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
