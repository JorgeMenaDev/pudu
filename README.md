# Glimpse

A small Loom for macOS: record your screen with your camera in a floating bubble, then share the video file anywhere.

- **Launcher** from the menu bar icon: pick a screen or window, camera and microphone, countdown.
- **Camera bubble** you can drag anywhere, in three sizes, mirrored or not. It is recorded with the screen.
- **Recording toolbar**: stop, pause/resume, restart, delete. It is hidden from the recording.
- **Global shortcuts** (Loom's defaults): ⌘⇧L start/stop, ⌥⇧P pause/resume, ⌘⇧R restart, ⌥⇧C cancel. Click the menu bar icon to stop; right-click it for the rest.
- **Library**: every take is an H.264 MP4 in `~/Movies/Glimpse`. Play, rename, copy the file, share (AirDrop, Mail, Messages…), show in Finder, delete.

Everything stays on your Mac. There is no account and no upload.

## Run it

```sh
bun install
bun run dev      # Vite + Electron, renderer hot-reloads
bun run start    # production build, then Electron
bun run dist     # unsigned .dmg in apps/desktop/release
```

macOS asks for Screen Recording, Camera and Microphone access the first time. In development, the access is granted to "Electron".

> If your shell sets `ELECTRON_RUN_AS_NODE=1` (T3 Code's terminal does), unset it first: `env -u ELECTRON_RUN_AS_NODE bun run dev`.

## How it is built

The layout follows [T3 Code](https://github.com/pingdotgg/t3code): an Electron shell, one React renderer, and a shared contracts package.

```
packages/contracts   Types + IPC channel names shared by main, preload and renderer
apps/desktop         Electron main process
  studio.ts            Recording lifecycle and every recording window (single source of state)
  windows.ts           Window factories: library, launcher, bubble, toolbar, countdown, recorder
  library.ts           Recordings on disk (<id>.mp4 + <id>.jpg + <id>.json)
  mediaProtocol.ts     glimpse-media:// with byte ranges, so <video> can seek
  preload.ts           window.glimpse bridge
apps/web             React 19 + Vite + Tailwind 4 renderer, one bundle for every window (#/surface)
  surfaces/            Library, Launcher, Bubble, Controls, Countdown, Recorder (hidden)
  components/ui/       T3 Code's Base UI kit
```

How a take works:

1. The launcher saves settings in main. Main owns `RecorderState` and broadcasts every change to all windows.
2. **Start** opens a hidden recorder window. It captures the chosen source with Chromium's desktop capture and the microphone, then reports ready.
3. Main runs the countdown, then tells the recorder to begin. `MediaRecorder` sends one chunk per second to main, which appends it to a file.
4. **Stop** flushes the recorder. Main saves the video, thumbnail and metadata, then opens the take in the library.

Windows that must not appear in the video (toolbar, countdown, launcher) use `setContentProtection(true)`. The camera bubble does not, so it is recorded.

`docs/loom-teardown.md` records what we learned from Loom's desktop app with [REA](https://github.com/morluto/rea).

## Not built yet

Cloud upload and share links, system audio, trimming, drawing on screen, a region selector, auto-update and code signing.
