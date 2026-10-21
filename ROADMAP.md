# Roadmap

Pudu stays small: record your screen with your face in a bubble, keep the MP4 on your Mac, send it anywhere. No account, no server, no analytics. Every item below has to fit that.

Items are grouped by when we plan to build them, not promised dates. Effort is a rough size: **S** a day or less, **M** a few days, **L** a week or more, **XL** a project of its own.

Several ideas come from [Cap](https://github.com/capsoftware/cap), an open-source recorder. Most of Cap is AGPL-licensed and Pudu is MIT, so Pudu takes ideas from Cap and writes its own code. Only Cap's MIT crates (`cap-camera*`, `scap-*`) could be reused as they are.

## Now

### Menu bar home · M

Pudu lives in the menu bar, so the menu bar should show its state and its settings.

- Menu: **New recording**, **Open library**, the last three recordings, **Fix permissions…** (only when one is missing), **Settings…**, **Open at login**, **Quit Pudu**.
- When a permission the current setup needs is missing, the icon gets a small warning mark and the tooltip says which one. A screen-only recording does not need the camera or microphone.
- While recording, the menu keeps today's controls and timer.

### Settings window · M

One small window, opened from the menu bar or a gear in the launcher.

- **General:** open at login, countdown on or off, recordings folder.
- **Recording:** default screen, camera and microphone; quality (see below).
- **Permissions:** Screen Recording, Camera and Microphone, each with its status and a button that asks or opens the right System Settings pane. After a Screen Recording grant, offer **Restart Pudu**, because macOS only applies it after a relaunch. Check again whenever the window gets focus.
- **Shortcuts:** the four global shortcuts, editable, with a warning when one clashes.

### One Export panel · M

Today **Compress**, **Copy video** and **Share** are three separate controls, and a compressed copy appears as a new recording, so it is hard to find. One **Export…** button replaces all three:

```text
Export recording

Size
  ● Original    48.2 MB
  ○ 1080p       ≈ 21 MB
  ○ 720p        ≈ 12 MB
  ○ 540p        ≈ 7 MB

Preparing 720p… 42%

Ready · 720p · 11.8 MB
[Copy to clipboard]  [Save to…]
[Share…]             [Show in Finder]

Copied. Paste with ⌘V.
```

- Original is ready at once. A smaller size is prepared first, then the same four actions appear.
- A smaller copy stays attached to its recording (`<id>.720p.mp4` next to the original). It does not create a new library card, it is reused the next time, and it is deleted with the original.
- Show the real size when the copy is ready; the estimates before it are approximate.

### Signed, notarized builds · S

Sign releases with a Developer ID certificate and notarize them, so the DMG opens without the System Settings detour and macOS keeps your permissions across updates. The release workflow already does this once its signing secrets exist.

### In-app updates · M

Check GitHub Releases for a new version and offer to install it. A **Beta updates** switch in Settings opts into pre-releases. Never interrupt a recording or an export to update. Needs signed builds first.

### Recording quality · S

Recordings are fixed at 30 fps and 10 Mbit/s today. Offer a few presets (for example Standard 30 fps, Smooth 60 fps, Small file) so files start smaller and fast scrolling looks better.

## Next

| Feature | Why | Effort |
| --- | --- | --- |
| System audio | Record the sound of a video or app you are showing. Electron 41 supports it on macOS 14.2 and later; it needs a new usage description. | M |
| Trim the start and end | Cut the setup and the "stop recording" moment. | M |
| Cut out the middle | Remove a mistake without recording again. | L |
| Record a region | Record only the part of the screen that matters. | M–L |
| Draw on screen while recording | Point at things while you talk. | M–L |
| Camera options | Camera-only recordings, bubble shapes, background blur. | M–L |
| GIF export | Short silent clips for bug reports and pull requests. | M |
| Crash-safe recordings | Recover a take after a crash or power loss. | L |
| Better multi-display support | Pick the display for the bubble and toolbar; handle displays plugged in mid-session. | M |
| Intel Macs | A universal build that also runs on Intel. | S |

## Later

| Feature | Why | Effort |
| --- | --- | --- |
| Editor: zoom | Zoom into code or small text after recording. | L |
| Editor: backgrounds and padding | Make a recording look polished for a launch or a post. | L |
| Cursor highlight and keystroke overlay | Show what you clicked and typed. | L |
| Local captions | On-device transcription, so videos can be watched without sound. Nothing leaves the Mac. | L |
| Share links to your own storage | Upload to your own S3 or R2 bucket and copy a link. Optional, off by default. | L |
| Screenshots with annotations | The same quick flow for a still image. | M–L |
| Automation links | `pudu://record` and similar links for Shortcuts and scripts. | M |
| Native capture helper | A small ScreenCaptureKit helper, only if Electron's capture limits quality or reliability. | L |

Issues and pull requests are welcome. Open an issue first for anything sized L or bigger.
