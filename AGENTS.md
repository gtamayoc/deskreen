# AGENTS.md — Deskreen CE

Electron 37 + React 19 + Vite 7 + electron-vite 4 + TypeScript 5.9. Node `>=22.6`, npm `>=10` (`packageManager: npm@10.9.0`).

## Setup & commands (two package roots)

```bash
npm install && cd src/client-viewer && npm install && cd ../..  # both installs required (CI runs `npm ci` in both)
npm run dev          # concurrent: electron-vite dev + client-viewer Vite on :5174 (predev builds viewer first)
npm run build        # typecheck -> buildClientViewer -> electron-vite build. Never run `electron-vite build` alone for prod
npm run typecheck    # all targets; or :client-viewer / :node / :web individually
npm test             # node native runner: `node --experimental-strip-types --test tests/*.test.ts` (no vitest/jest)
npm run lint         # biome check only; `npm run format` writes (tabs, single quotes)
```

Packaging: `build:win`, `build:mac`, `build:linux` (+ arch variants). Only CI is `release.yml` on `v*` tags — no PR checks.

## Architecture

- `src/main/index.ts` — Electron main entry (window mgmt, CLI `--ip`, WGC-disable switches are intentional, see below).
- `src/preload/index.ts` — single preload, two build entries (`index`, `helperRenderer` share the file).
- `src/renderer/` — host UI. Aliases: `@renderer/*` → `src/renderer/src/*`, `@common/*` → `src/common/*`.
- `src/server/` (Koa 3 + socket.io 4) — signaling + serves viewer bundle via `getClientViewerDistPath()` multi-candidate lookup.
- `src/features/` — 4 services only: `ConnectedDevicesService`, `DesktopCapturerSourcesService`, `PeerConnectionHelperRendererService`, `SharingSessionService`.
- `src/common/` — shared config, `IpcEvents.enum.ts`, electron-store, locales.
- `src/client-viewer/` — **separate Vite app** with own `package.json` (`tsc -b && vite build`). Output `src/client-viewer/dist` is copied to `out/client-viewer` by custom plugin in `electron.vite.config.ts`. Must build it before packaging.
- Hidden second window: `peerConnectionHelperRendererWindowIndex.html` + `PeerConnectionHelperRendererService` does WebRTC work off-screen. Don't merge/remove.

## Gotchas

- Build order matters: `buildClientViewer` before `electron-vite build`; `build:*` per-OS scripts skip `typecheck` (only `build` runs it) — run `npm run typecheck` manually before packaging.
- Tests use `node:test` + `assert/strict`, no mocks framework; `tests/` is gitignored but runs locally.
- Biome: `noExplicitAny`, `noCommonJs` (except `scripts/**/*.js`), `organizeImports` on. Respect tabs/single quotes.
- `src/client-viewer/.env` (`VITE_CLIENT_VIEWER_GA_TAG`) is gitignored, release-only for analytics — never required for dev/build.
- `main/index.ts` disables WGC capturers on Win32 to avoid `ProcessFrame E_FAIL` — keep, don't "fix".
- `.gitignore` hides `tests/`, `tasks/`, `.agents/`, `.codebase-memory/`, `out/`, `dist/` — they exist locally, don't recreate or commit them.
- RemoteInput PowerShell worker (`-Command -`): never pipe multiline scriptblocks to stdin; interactive prompt deadlocks waiting for block close. Keep statements single-line.
- Stepper CSS variables (`--color-stepper-step-bg`, `--color-stepper-step-icon`, `--color-stepper-connector`) are checked by contract in `tests/` — preserve them on `ColorlibStepIcon`/`ColorlibConnector`.

## Self-maintenance of this file

- At the end of an iteration that changed code, update this file **only if** you found a durable, repo-specific gotcha (wrong command, build order, hidden coupling). One bullet max per lesson.
- Keep it short (<80 lines). Edit in place, never rewrite blindly; delete stale lines when code changes.
- Human reviews via `git diff` — this file is tracked, so keep each change reviewable and factual (executable config > prose).
