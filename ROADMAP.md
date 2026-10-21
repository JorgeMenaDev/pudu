# Roadmap

Pudu stays small: record your screen with your face in a bubble, keep the MP4 on your Mac, send it anywhere. No account, no server, no analytics. Every item below has to fit that.

Items are grouped by when we plan to build them, not promised dates. Effort is a rough size: **S** a day or less, **M** a few days, **L** a week or more, **XL** a project of its own.

Several ideas come from [Cap](https://github.com/capsoftware/cap), an open-source recorder. Most of Cap is AGPL-licensed and Pudu is MIT, so Pudu takes ideas from Cap and writes its own code. Only Cap's MIT crates (`cap-camera*`, `scap-*`) could be reused as they are.

## Now

### Settings: recording defaults and shortcuts · M

The Settings window ships with General, Permissions and a read-only Shortcuts list. Still to add:

- **Recording:** default screen, camera and microphone; quality (see below).
- **Shortcuts:** make the four global shortcuts editable, with a warning when one clashes.

### In-app updates · M

Check GitHub Releases for a new version and offer to install it. A **Beta updates** switch in Settings opts into pre-releases. Never interrupt a recording or an export to update.

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
