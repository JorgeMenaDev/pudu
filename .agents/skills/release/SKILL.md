---
name: release
description: Ship Pudu as GitHub Releases with a DMG. Use when a change merges to main, someone asks for a beta, pre-release, release or DMG, wants a beta promoted to stable, or the Release workflow failed.
mutating: true
writes_to: ["git tags v*", "GitHub Releases"]
---

# Release

Every Pudu build people install comes from `.github/workflows/release.yml`, attached to a GitHub Release as `Pudu-<version>-arm64.dmg`. Two channels:

| Channel | Tag | How it ships | Marked |
| --- | --- | --- | --- |
| Beta | `v0.1.1-beta.42` | Automatically, for every push to `main` that touches the app (`apps/`, `packages/`, root `package.json`, `bun.lock`) | Pre-release |
| Stable | `v0.1.1` | You push the tag on the commit of a published beta; the workflow rebuilds that commit | Latest |

The number after `beta.` is the workflow run number. A beta takes the version in `apps/desktop/package.json`, or the patch after the latest stable once that version has shipped (`scripts/release-version.ts`). To aim betas at a new minor or major, set that version in the PR (`0.2.0`). The workflow writes the release version into the build only; nothing commits it back.

Published tags and DMGs are permanent. A mistake ships as a new beta.

## Ship a change as a beta

1. Merge the PR into `main`.
2. Find and watch the run:
   ```bash
   gh run list --workflow Release --limit 3
   gh run watch <run-id> --exit-status
   ```
3. Done when the run is green and `gh release view <tag>` lists the DMG. Report the release URL and whether it is signed (an unsigned build carries a warning on its Package step and an install note in its release notes).

A merge that touches only docs or other files outside those paths ships nothing; that is expected.

## Promote a beta to stable

1. Pick the beta the maintainer tested: `gh release list --limit 10`.
2. Pick the version: next patch for fixes, next minor for features. It must sort above every existing tag.
3. Tag the beta's commit and push the tag:
   ```bash
   git fetch --tags origin
   git tag v0.2.0 'v0.1.1-beta.42^{commit}'
   git push origin v0.2.0
   ```
4. Watch the run as above. It fails on purpose when the tag is not on a published beta's commit.
5. Done when the release is marked Latest with the DMG attached. The README's Download link now serves it.

## When a run fails

Read the failing step first: `gh run view <run-id> --log-failed`.

- **Runner, network or notarization timeout:** `gh run rerun <run-id> --failed`. A rerun keeps the run number, so the beta keeps its tag.
- **Code or config bug:** fix it in a PR. Merging ships a new beta.
- **Stable tag rejected or failed before publishing:** check `gh release view <tag>` reports no release, then delete the tag (`git push origin :refs/tags/<tag>`), fix, and tag again.

## Signing

Signed builds need five repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `CSC_LINK` | Developer ID Application certificate with its private key, exported as `.p12`, base64 |
| `CSC_KEY_PASSWORD` | The `.p12` export password |
| `APPLE_API_KEY` | App Store Connect API key, the `.p8` file's contents |
| `APPLE_API_KEY_ID` | That key's ID |
| `APPLE_API_ISSUER` | The team's issuer ID |

With `CSC_LINK` set, electron-builder signs with Developer ID and notarizes, and the Verify step requires Gatekeeper to accept the app. Without it the build is ad-hoc signed: macOS makes users approve the first launch (README → Install) and asks for Screen Recording, Camera and Microphone again after each update.

## Check a published DMG by hand

```bash
dir=$(mktemp -d) && gh release download <tag> --pattern '*.dmg' --dir "$dir"
hdiutil attach "$dir"/*.dmg -readonly -nobrowse -mountpoint "$dir/mnt"
codesign -dv --verbose=2 "$dir/mnt/Pudu.app"   # Authority=Developer ID Application… when signed
spctl --assess --type execute --verbose=2 "$dir/mnt/Pudu.app"   # accepted once notarized
hdiutil detach "$dir/mnt"
```
