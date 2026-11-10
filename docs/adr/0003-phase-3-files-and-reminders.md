# 0003. Phase 3: files and reminders

Status: reminders accepted 2026-11-10 (the owner said to start on them, taking the defaults below: works while the app runs in the tray, 10 minute lead); files still proposed and waiting on question 2. Builds on ADR-0001 and ADR-0002.

Update 2026-11-10: reminders open their item on a click (while the toast is on screen; Windows reports nothing for a click from the Action Center). Export is built as a Save dialog driven from Rust (`save_export`, see below and `docs/desktop-plan.md`); import is not built and still waits on question 2.

## Context

Phase 3 of `docs/desktop-plan.md` adds what the web could not do. Multi-window (`/item/<id>` as its own window) and the tray Today list are built. Two features are left that were planned as "needs the local store from Phase 2": reminders, and files (export and import). The local store (stage 2c) is not built and waits on a client-rendered UI, so reminders should not wait for it if there is a cheaper way.

## Decision

### Reminders without the local store

The shell stays running in the tray when its window is closed, and a hidden window keeps its page alive. So:

- The page that is loaded already knows today's timed items (the tray list reads the same day). The layout adds the next few start times as epoch milliseconds in a second shell attribute, only for the desktop cookie, and the badge script passes them to one more Rust command, `set_reminders`. It is the same one-way pattern as `set_badge`: the page may tell the shell, the shell never runs what the page says.
- Rust keeps a sorted list and fires a native notification a fixed lead time before each start (default 10 minutes), once per item and start time. It adds `tauri-plugin-notification` and its capability, owned by Rust only; the page gets no notification API.
- A hidden window does not reload on its own, so the shell asks the page to refresh itself on a timer (`location.reload()` through the same eval path the capture hotkey uses, every 15 minutes while hidden). That picks up changes made on another device.

What this does not cover, and says so: an app that was quit (not just closed to the tray) sends nothing; a change made on a phone shows up at the next refresh, not at once; recurring items count only for the day the page loaded. Real push while quit needs a server and accounts (Phase 4).

Rejected: waiting for 2c (weeks of work for the same notification), and a Windows scheduled task (hidden state outside the app that is hard to keep in step with edits).

### Files

- **Export** stays the existing route (`/settings/export`, one JSON file, `version: 1`). What is unverified is how WebView2 treats the download. The shell should handle it itself with Tauri's download hook: save into the Downloads folder under the suggested name and tell the user where, instead of relying on WebView2's default.
  - Built differently (2026-11-10): a system Save dialog instead of a silent save to Downloads, so the user picks the place. A shell script in the main window fetches the route on the link's click and passes the text to one command, `save_export`; Rust checks the window and origin, caps the size at 128 MB, cleans the name, shows the dialog (`tauri-plugin-dialog`, Rust only) and writes the file. The page gets no file or dialog API and never sees the path.
- **Import** is new and takes only our own export. A Server Action reads the file, checks it with a strict schema (version 1, size cap, row caps per table), maps every id to a new one, and inserts through the same repo and Row Level Security as any write. It never overwrites or deletes; running it twice duplicates, so it shows a preview count first and asks to confirm. Items from other apps (CSV) are out of scope here.

## Consequences

- Reminders arrive for what the hidden app knew at its last refresh, which is good enough for a day's timed items and honest about the rest.
- One new Rust plugin and one new command widen the shell's surface; both are narrow and tested like `set_badge`.
- Import is the first bulk write; it needs its own limits and tests before it ships.

## Questions for the owner

1. Reminders: is "works while the app is running in the tray, not when quit" enough for a first version, with a 10 minute lead time?
2. Import: should it exist at all before launch, and if so is "our own export only, duplicates on a second run, with a confirm step" the right shape?
