import iconUrl from "../../../../assets/icon.svg";
import { cn } from "../lib/utils";

/**
 * The Pudu app icon beside the "Pudu" wordmark. `className` sets the size of the visible
 * rounded square: icon.svg pads it by 100 of 1024 units per side, so the image scales up
 * by 1024/824 to crop that margin without changing layout.
 */
export function PuduMark({ className }: { className?: string }) {
  return <img src={iconUrl} alt="" draggable={false} className={cn("shrink-0 scale-[1.243]", className)} />;
}
