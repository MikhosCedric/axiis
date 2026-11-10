"use client";

import { useContext } from "react";
import { GuideContext, Kbd } from "@/features/palette/guide";
import { chordCaps, CAPTURE_KEY, GO_KEY, GO_PLACES, HELP_KEY, PALETTE_KEY } from "@/features/palette/shortcuts";
import { useIsMac } from "@/features/palette/use-is-mac";

/** The keys that move around the app, at a glance, and the way into the Guide's full list. */
export function KeyboardSection() {
  const { open } = useContext(GuideContext);
  const mac = useIsMac();
  const anywhere = [
    { keys: chordCaps({ key: PALETTE_KEY, mod: true }, mac), does: "Search, go to a page or a date, or capture" },
    { keys: [CAPTURE_KEY.toUpperCase()], does: "Capture" },
    { keys: [HELP_KEY], does: "The Guide, with every shortcut" },
  ];

  return (
    <section aria-labelledby="keyboard-heading">
      <h2 id="keyboard-heading" className="font-display text-xl font-medium">
        Keyboard
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">
        Press {GO_KEY.toUpperCase()}, then a letter, to go to a page. Keys wait while you type in a field.
      </p>

      <div className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <dl className="border-t border-rule">
          {anywhere.map((row) => (
            <div key={row.does} className="flex items-baseline justify-between gap-3 border-b border-rule-soft py-2">
              <dt className="text-ink-2">{row.does}</dt>
              <dd className="flex flex-none gap-1">
                {row.keys.map((cap) => (
                  <Kbd key={cap}>{cap}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <dl aria-label="Go to a page" className="border-t border-rule">
          {GO_PLACES.map((p) => (
            <div key={p.key} className="flex items-baseline justify-between gap-3 border-b border-rule-soft py-2">
              <dt className="text-ink-2">{p.label}</dt>
              <dd className="flex flex-none items-center gap-1 text-[13px] text-ink-3">
                <Kbd>{GO_KEY.toUpperCase()}</Kbd>
                <span className="sr-only">then</span>
                <Kbd>{p.key.toUpperCase()}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="mt-4 inline-flex items-center rounded-lg border border-rule px-3.5 py-2 font-medium text-ink hover:bg-hover active:bg-press pointer-coarse:min-h-11"
      >
        Every shortcut
      </button>
    </section>
  );
}
