"use client";

import { useEffect, useState } from "react";
import { NavRail } from "@/components/shell/nav-rail";
import type { LocalDate } from "@/domain/item";
import { isTypingTarget, shortcutAction } from "@/features/day/nav";
import { PaletteProvider, type PaletteActions } from "@/features/palette/palette";
import { CaptureField } from "@/features/today/capture-field";
import { captureTask } from "@/features/today/commands";
import { actions as notesActions, AREAS, settings, store } from "../notes/store";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const actions: PaletteActions = {
  async capture(title) {
    await pause(450);
    if (settings.failing) return { ok: false, error: "That did not save. Your words are still here, so try again." };
    return captureTask(store.items, title);
  },
  async search(query) {
    await pause(300);
    if (settings.failing) throw new Error("harness: search is set to fail");
    return notesActions.search(query);
  },
};

/** Records what the day nav would do with each key, so a dialog that swallows them can be seen to. */
function KeyLog() {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action = shortcutAction({
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        isComposing: e.isComposing,
        defaultPrevented: e.defaultPrevented,
        typing: isTypingTarget(e.target as HTMLElement | null),
      });
      if (action) setLog((l) => [...l.slice(-4), action]);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <p className="text-[13px] text-ink-2" data-testid="key-log">
      Day nav would have done: {log.length ? log.join(", ") : "nothing yet"}
    </p>
  );
}

function Bar() {
  const [failing, setFailing] = useState(settings.failing);
  return (
    <label className="flex items-center gap-1.5 text-[13px] text-ink-2">
      <input
        type="checkbox"
        checked={failing}
        onChange={(e) => {
          settings.failing = e.target.checked;
          setFailing(e.target.checked);
        }}
      />
      Make capture and search fail
    </label>
  );
}

export function PaletteHarness({ today, nav }: { today: LocalDate; nav: boolean }) {
  return (
    <PaletteProvider today={today} actions={actions}>
      <div className="min-h-dvh rail:grid rail:grid-cols-[216px_minmax(0,1fr)]">
        {nav && <NavRail today={today} areas={AREAS.map((a, i) => ({ id: a.id, name: a.name, open: i + 1 }))} />}
        <main className="min-w-0 px-4 py-6 rail:px-9">
          <h1 className="mb-2 font-serif text-2xl font-semibold">Palette harness</h1>
          <p className="mb-4 max-w-prose text-ink-2">
            Ctrl or Cmd K opens search and commands. A question mark opens the shortcuts. Search runs over the notes harness
            fixtures, so try “bulbs”, “lisbon” or “garden”. A capture goes into the same store, so it can be found straight after.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <Bar />
            <KeyLog />
          </div>
          <CaptureField captureAction={actions.capture} />
          {Array.from({ length: 30 }, (_, i) => (
            <p key={i} className="max-w-prose py-2 text-ink-2">
              Filler line {i + 1}, so the page is long enough to scroll behind a dialog.
            </p>
          ))}
        </main>
      </div>
    </PaletteProvider>
  );
}
