"use client";

import { useState } from "react";
import { DENSITY_COOKIE, DENSITIES, THEMES, type Density, type Theme } from "@/components/shell/cookies";
import { applyTheme, useTheme } from "@/components/shell/theme-toggle";

const THEME_LABEL: Record<Theme, { name: string; says: string }> = {
  system: { name: "System", says: "Light or dark, as this device is set." },
  light: { name: "Light", says: "Warm paper, whatever the device says." },
  dark: { name: "Dark", says: "Night ink, whatever the device says." },
};

const DENSITY_LABEL: Record<Density, { name: string; says: string }> = {
  spacious: { name: "Spacious", says: "Room around every row." },
  compact: { name: "Compact", says: "Rows sit closer, so more of a long list fits on screen." },
};

function saveDensity(next: Density) {
  document.documentElement.dataset.density = next;
  document.cookie = `${DENSITY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

function Choice<T extends string>({
  label,
  options,
  names,
  value,
  onChoose,
}: {
  label: string;
  options: readonly T[];
  names: Record<T, { name: string; says: string }>;
  value: T;
  onChoose: (next: T) => void;
}) {
  return (
    <>
      <div role="group" aria-label={label} className="mt-2 inline-flex overflow-hidden rounded-lg border border-rule">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChoose(option)}
            className={`px-3.5 py-2 font-medium pointer-coarse:py-3 ${value === option ? "bg-ink text-paper" : "text-ink-2 hover:bg-hover active:bg-press"}`}
          >
            {names[option].name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-3">{names[value].says}</p>
    </>
  );
}

/**
 * Theme and row spacing, both kept for this device in cookies, so the first paint already has them.
 * The rail's toggle changes the same theme; this section follows it.
 */
export function DisplaySection({ theme, density }: { theme: Theme; density: Density }) {
  const shownTheme = useTheme(theme);
  const [shownDensity, setDensity] = useState(density);

  return (
    <section aria-labelledby="display-heading">
      <h2 id="display-heading" className="font-serif text-xl font-medium">
        Display
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">How Axiis looks on this device.</p>

      <h3 className="mt-5 font-medium text-ink">Theme</h3>
      <Choice label="Theme" options={THEMES} names={THEME_LABEL} value={shownTheme} onChoose={applyTheme} />

      <h3 className="mt-6 font-medium text-ink">Density</h3>
      <p className="mt-1 max-w-[60ch] text-ink-2">
        How close the rows of a list sit. Compact tightens list rows only; the Score&rsquo;s staves and the Week stay as
        they are.
      </p>
      <Choice
        label="Density"
        options={DENSITIES}
        names={DENSITY_LABEL}
        value={shownDensity}
        onChoose={(next) => {
          setDensity(next);
          saveDensity(next);
        }}
      />
    </section>
  );
}
