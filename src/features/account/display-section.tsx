"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CLOCK_COOKIE,
  CLOCK_SETTINGS,
  clockCookieValue,
  DENSITY_COOKIE,
  DENSITIES,
  THEMES,
  type ClockSetting,
  type Density,
  type Theme,
} from "@/components/shell/cookies";
import { applyTheme, useTheme } from "@/components/shell/theme-toggle";
import { deviceClock, formatMinutes, type Clock } from "@/lib/clock";

const THEME_LABEL: Record<Theme, { name: string; says: string }> = {
  system: { name: "System", says: "Light or dark, as this device is set." },
  light: { name: "Light", says: "Warm paper, whatever the device says." },
  dark: { name: "Dark", says: "Night ink, whatever the device says." },
};

const DENSITY_LABEL: Record<Density, { name: string; says: string }> = {
  spacious: { name: "Spacious", says: "Room around every row." },
  compact: { name: "Compact", says: "Rows sit closer, so more of a long list fits on screen." },
};

/** Two times that show which clock a choice writes: "9:30 AM and 2:15 PM". */
const sample = (clock: Clock) => `${formatMinutes(570, clock)} and ${formatMinutes(855, clock)}`;

function clockNames(clock: Clock): Record<ClockSetting, { name: string; says: string }> {
  return {
    auto: { name: "Auto", says: `As this device’s language and region write times, so ${sample(clock)}.` },
    "12": { name: "12-hour", says: `Like ${sample("12")}.` },
    "24": { name: "24-hour", says: `Like ${sample("24")}.` },
  };
}

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
 * Theme, row spacing and time format, each kept for this device in a cookie, so the first paint already has them.
 * The rail's toggle changes the same theme; this section follows it.
 */
export function DisplaySection({
  theme,
  density,
  clock,
}: {
  theme: Theme;
  density: Density;
  clock: { setting: ClockSetting; clock: Clock };
}) {
  const router = useRouter();
  const shownTheme = useTheme(theme);
  const [shownDensity, setDensity] = useState(density);
  const [shownClock, setClock] = useState(clock);

  /** Times the server wrote, such as the Month's marks, need the new cookie, so the page is drawn again. */
  function chooseClock(setting: ClockSetting) {
    const device = deviceClock();
    setClock({ setting, clock: setting === "auto" ? device : setting });
    document.cookie = `${CLOCK_COOKIE}=${clockCookieValue(setting, device)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

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

      <h3 className="mt-6 font-medium text-ink">Time format</h3>
      <p className="mt-1 max-w-[60ch] text-ink-2">How every time in Axiis is written. A time can be typed either way.</p>
      <Choice label="Time format" options={CLOCK_SETTINGS} names={clockNames(shownClock.clock)} value={shownClock.setting} onChoose={chooseClock} />
    </section>
  );
}
