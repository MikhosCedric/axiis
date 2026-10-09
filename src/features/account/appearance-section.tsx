"use client";

import { useState } from "react";
import { DENSITY_COOKIE, DENSITIES, type Density } from "@/components/shell/cookies";

const LABEL: Record<Density, { name: string; says: string }> = {
  spacious: { name: "Spacious", says: "Room around every row." },
  compact: { name: "Compact", says: "Rows sit closer, so more of a long list fits on screen." },
};

function saveDensity(next: Density) {
  document.documentElement.dataset.density = next;
  document.cookie = `${DENSITY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

/** Row spacing for the lists: Inbox, Lists, Tags, the List view of a day. Saved in a cookie, so the first paint already has it. */
export function AppearanceSection({ initial }: { initial: Density }) {
  const [density, setDensity] = useState(initial);

  function choose(next: Density) {
    setDensity(next);
    saveDensity(next);
  }

  return (
    <section aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className="font-serif text-xl font-medium">
        Density
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">How close the rows of a list sit. This device only.</p>
      <div role="group" aria-label="Density" className="mt-4 inline-flex overflow-hidden rounded-lg border border-rule">
        {DENSITIES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={density === d}
            onClick={() => choose(d)}
            className={`px-3.5 py-2 font-medium pointer-coarse:py-3 ${density === d ? "bg-ink text-paper" : "text-ink-2 hover:bg-accent-wash"}`}
          >
            {LABEL[d].name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-3">{LABEL[density].says}</p>
    </section>
  );
}
