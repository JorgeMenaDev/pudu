# Pudu

Loom-like screen + camera recorder for macOS. Bun workspaces: `packages/contracts`, `apps/desktop` (Electron main), `apps/web` (React renderer). Read `README.md` for the architecture.

- Checks: `bun run typecheck` and `bun test`. Build: `bun run build`.
- Main owns all recording state (`apps/desktop/src/studio.ts`). Renderers send intents through `window.pudu` and render the broadcast state. Add a capability in this order: contracts type + channel, preload, main handler, renderer.
- Every window loads the same bundle; `#/<surface>` picks the screen (`apps/web/src/main.tsx`).
- `apps/web/src/components/ui` and the theme tokens in `index.css` are ported from T3 Code. Keep them close to upstream; put Pudu styles in the bottom section of `index.css`.
- Electron won't start if `ELECTRON_RUN_AS_NODE=1` is set (T3 Code terminals set it). Prefix commands with `env -u ELECTRON_RUN_AS_NODE`.
- Bun's bundler bakes `__dirname` in at build time. Resolve app files from `app.getAppPath()`.
- Signed builds use the hardened runtime: `apps/desktop/build/entitlements.mac.plist` must keep the camera and audio-input entitlements, or macOS silently blocks both with no prompt.
