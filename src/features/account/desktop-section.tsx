"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REMINDERS_COOKIE } from "@/components/shell/cookies";

function saveReminders(on: boolean) {
  document.cookie = `${REMINDERS_COOKIE}=${on ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Shown only in the desktop app. Reminders are on unless turned off here: the page then hands the app no
 * reminders to speak, so the shell needs no setting of its own. The lead time is the app's, ten minutes.
 */
export function DesktopSection({ reminders }: { reminders: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(reminders);
  const [said, setSaid] = useState<string | null>(null);

  function choose(next: boolean) {
    setOn(next);
    saveReminders(next);
    setSaid(next ? "Reminders are on." : "Reminders are off.");
    // The reminders ride on the page the app reads, so it is drawn again with or without them.
    router.refresh();
  }

  return (
    <section aria-labelledby="desktop-heading">
      <h2 id="desktop-heading" className="font-display text-xl font-medium">
        Desktop app
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">
        While Axiis runs in the tray, it tells you ten minutes before a timed item starts.
      </p>
      <div role="group" aria-label="Reminders" className="mt-4 inline-flex overflow-hidden rounded-lg border border-rule">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={on === value}
            onClick={() => choose(value)}
            className={`px-3.5 py-2 font-medium pointer-coarse:py-3 ${on === value ? "bg-ink text-paper" : "text-ink-2 hover:bg-hover active:bg-press"}`}
          >
            {value ? "Reminders on" : "Off"}
          </button>
        ))}
      </div>
      <p role="status" className="mt-2 min-h-5 text-[13px] text-ink-3">
        {said}
      </p>
    </section>
  );
}
