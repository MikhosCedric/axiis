# Axiis desktop app: plan

Status: decided 2026-11-07, Phase 1a built. Decisions are recorded in section 7.

The web app stays. The desktop app is the same code in a native shell, then grows native features and an offline data layer. Mobile follows from the same shell.

## 1. Goal and constraints

- One codebase for web, desktop and later mobile. No fork of the UI.
- Windows first (WebView2 is Chromium, so the CSS we use renders as tested), then macOS, then Linux.
- Keep what makes Axiis fast to use: capture in under two seconds, the same steps everywhere.
- Security: Supabase RLS stays the real boundary (ADR-0001). The shell adds no new trust in the client.
- Efficiency: small installer, low idle memory, no always-on polling.

## 2. Shell choice: Tauri 2 (recommended) vs Electron

| | Tauri 2 | Electron |
|---|---|---|
| Installer / idle memory | about 5-10 MB / low (system webview) | about 90-150 MB / high (bundled Chromium) |
| Rendering consistency | WebView2 on Windows is Chromium; macOS WKWebView and Linux WebKitGTK differ | Identical everywhere |
| Security model | Capabilities allow-list per window, Rust core, no Node in the page | Large surface; needs careful contextIsolation and IPC hygiene |
| Mobile later | Tauri 2 targets iOS and Android from the same project | Needs a second tool (Capacitor) |
| Cost to us | Rust toolchain and a small amount of Rust | None; all JS |

Risk to check early: the UI uses the popover API, container queries, `light-dark()` and view transitions. These are fine in WebView2 and recent WKWebView, so the macOS matrix needs an OS-version floor (decide in Phase 3). If that floor is unacceptable, Electron is the fallback for macOS only.

## 3. The hard problem: Next.js cannot be bundled as static files

Pages are server-rendered and writes are Server Actions, so the app needs a server. This shapes the phases:

- **Phase 1 loads the hosted app** in the shell (fast to ship, always current).
- **Phase 2 adds an offline data layer** behind the existing `ItemsRepo` interface (`src/lib/items/repo.ts`), which already has a Supabase adapter and an in-memory fake. A local adapter is a third adapter at a real seam.
- **Phase 3 can move the UI to a client-rendered build** if we want the shell to run without the server at all (this is the large step; decide after Phase 2).

## 4. Phases

### Phase 0: web readiness (about 2-3 days)
- Installable PWA: manifest, icons, a service worker that caches the app shell only (no data yet).
- Move all auth redirects to a config of allowed origins, so a desktop origin can be added without code edits.
- A `AXIIS_PLATFORM` flag exposed to the UI (web | desktop) so desktop-only controls hide on web.
- Done when: Lighthouse PWA checks pass; sign-in works from a second allowed origin.

### Phase 1: Tauri shell around the hosted app (about 1 week)
- `src-tauri/` in this repo. One main window pointing at the production origin; navigation locked to that origin, everything else opens in the system browser.
- Sign in through the system browser with PKCE and a deep link back (`axiis://auth/callback`). Google does not allow OAuth inside an embedded webview, so this also removes that class of sign-in problem. Tokens stored in the OS keychain, not in page storage.
- Native features that need no data layer: global quick-capture hotkey (opens a tiny capture window, posts to the same Server Action), tray icon with open/capture/quit, launch at login (off by default), single-instance lock, taskbar badge from the existing Inbox and Due counts, native Ctrl+K without browser conflicts.
- Signed auto-update from GitHub Releases (Tauri updater, minisign key).
- Security: strict CSP, capabilities file granting only the plugins above, no shell/fs plugin, deep-link inputs validated.
- Done when: a signed Windows installer installs, signs in, captures via hotkey while another app has focus, and updates itself.

### Phase 2: offline-first data (about 3-4 weeks)
- New ADR amending ADR-0001: Supabase stays the source of truth; each device keeps a local copy and syncs.
- `LocalItemsRepo`: SQLite through the Tauri SQL plugin (desktop) or IndexedDB (web/PWA), same interface as `SupabaseItemsRepo`.
- Writes go to the local store first and into an outbox; the UI reads local. A sync worker pushes the outbox and pulls changes by `updated_at` cursor. Deletes already soft-delete, so tombstones sync.
- Conflicts: last write wins per field using the server timestamp; the only merge that needs care is note bodies (Tiptap JSON). Start with last-write-wins plus keeping the losing body as a version, then revisit.
- Realtime from Supabase for live updates while online; none while the window is closed.
- Done when: capture, plan, tick and edit all work with the network off and converge after reconnect; a property test replays random edits on two devices and checks they end equal.

### Phase 3: native features the web could not do
- **Reminders:** native notifications for timed items while the app is closed (needs the local store from Phase 2 plus a scheduler).
- **Multi-window:** open an item's detail in its own window.
- **Files:** export and import (the data-export launch requirement) as a file save dialog; drag a file onto an item as an attachment (later).
- **Calendar bridge (optional):** read-only system calendar events shown on the Score.
- **Menu bar / tray density:** a compact Today list in the tray.
- Decide the macOS version floor and Linux scope here.

### Phase 4: mobile
- Tauri 2 iOS and Android from the same frontend; the phone layout (bottom bar, sheets) already exists.
- Push for reminders needs APNs and FCM accounts (owner action, Apple developer fee).
- Share-sheet capture is the mobile equivalent of the hotkey.

## 5. Security checklist (applies from Phase 1)
- Remote content allowed only from our origin; capability-scoped IPC; no arbitrary command execution; CSP without `unsafe-inline` where Next allows.
- Auth: system browser, PKCE, keychain storage, short-lived access tokens, refresh handled by the Supabase client.
- Updates: signed artifacts, signature verified before install, update manifest only from our releases.
- Code signing: a Windows Authenticode certificate (owner purchase) so SmartScreen does not warn.
- No service-role keys anywhere in the client or the installer; supply chain: lockfiles pinned, `cargo audit` and `npm audit` in CI.
- Local data at rest: SQLite file in the user profile; offer optional encryption (SQLCipher) in Phase 2 if the owner wants it.

## 6. Efficiency, testing and CI
- Idle: no timers when the window is hidden; sync on focus, on network return and on a long interval; reminders through the OS scheduler, not a loop.
- Bundle: lazy-load the quick-capture window as its own tiny page.
- CI: keep `check` and the Playwright web e2e as they are; add a Windows build job that compiles the shell on every PR (no signing) and a release workflow that signs and publishes on tags. Shell smoke tests through `tauri-driver` (launch, sign-in stub, hotkey). Each phase ends with the existing 559 e2e tests green on the web build.
- Observability: crash and update-failure logs written locally, uploaded only with consent.

## 7. Decisions (owner, 2026-11-07: "your recommendations, but spend nothing for now")
1. Shell: **Tauri 2**.
2. **Phase 1 loads the hosted app** first.
3. **Windows first**, then macOS; no Linux for now.
4. **No spending yet.** So: unsigned Windows installers (SmartScreen will warn on first run), updates signed with a free minisign key, the existing Vercel origin (`axiis-lovat.vercel.app`) instead of a new domain, a reverse-DNS app id (`app.axiis.desktop`) that needs no domain, and no Apple account (so no macOS build or iOS until that changes).
5. **Offline: capture-only first** (ADR-0001's first step). Full offline-first stays Phase 2 and needs its own go-ahead.

## Status
- **Phase 0:** already in place on the web: manifest (`start_url /today`, standalone), 192 and 512 PNG icons, public icon routes. No service worker is needed to install; it arrives with Phase 2.
- **Phase 1a (built):** `src-tauri/` and `desktop/dist/`. A window on the hosted app, navigation locked to our origin (other links open in the system browser), our own offline page, single instance, tray with Open, Capture and Quit, closing hides to the tray, and the global hotkey Ctrl+Alt+A that brings Axiis forward with the capture field focused. The page gets no native API (empty capability file). Debug builds can point at a dev server with `AXIIS_URL`; release builds never read it. A Windows CI job (`.github/workflows/desktop.yml`) builds an unsigned installer when the shell changes.
- **Phase 1b (next):** system-browser sign-in with a deep link back (`axiis://auth`), then keychain token storage, the taskbar badge from the Inbox and Due counts, and signed auto-update through GitHub Releases. The sign-in step needs one Supabase setting only the owner can change: adding `axiis://auth/callback` to the allowed redirect URLs.

### Run it here
```bash
# once: Rust (rustup) and Visual Studio's C++ tools; WebView2 ships with Windows 11
npm install
cd src-tauri && cargo build            # debug build
AXIIS_URL=http://localhost:3000/login ./target/debug/axiis-desktop.exe   # against a local dev server
npx tauri build                        # unsigned NSIS installer in src-tauri/target/release/bundle/nsis/
```

## 8. Order of work
Finish Phase 1b (sign-in, badge, updates), then use the app for a while. Phase 2 starts only after that and after the owner confirms the offline scope.
