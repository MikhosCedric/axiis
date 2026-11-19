"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CLOCK_COOKIE,
  CLOCK_SETTINGS,
  clockCookieValue,
  DENSITY_COOKIE,
  DENSITIES,
  START_PAGE_COOKIE,
  START_PAGES,
  THEMES,
  WEEK_START_COOKIE,
  WEEK_STARTS,
  weekStartSetting,
  type StartPage,
  type WeekStartSetting,
  type ClockSetting,
  type Density,
  type Theme,
} from "@/components/shell/cookies";
import { applyTheme, useTheme } from "@/components/shell/theme-toggle";
import { deviceClock, type Clock } from "@/lib/clock";
import type { WeekStart } from "@/features/week/week-of";

const WEEK_START_LABEL: Record<WeekStartSetting, { name: string }> = {
  monday: { name: "Monday" },
  sunday: { name: "Sunday" },
};

const START_PAGE_LABEL: Record<StartPage, { name: string }> = {
  today: { name: "Today" },
  week: { name: "Week" },
  month: { name: "Month" },
  inbox: { name: "Inbox" },
  due: { name: "Due" },
};

const YEAR = "path=/; max-age=31536000; samesite=lax";

const THEME_LABEL: Record<Theme, { name: string }> = {
  system: { name: "System" },
  light: { name: "Light" },
  dark: { name: "Dark" },
};

const DENSITY_LABEL: Record<Density, { name: string }> = {
  spacious: { name: "Spacious" },
  compact: { name: "Compact" },
};

const CLOCK_LABEL: Record<ClockSetting, { name: string }> = {
  auto: { name: "Auto" },
  "12": { name: "12-hour" },
  "24": { name: "24-hour" },
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
  names: Record<T, { name: string }>;
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
  weekStart = 1,
  startPage = "today",
}: {
  theme: Theme;
  density: Density;
  clock: { setting: ClockSetting; clock: Clock };
  weekStart?: WeekStart;
  startPage?: StartPage;
}) {
  const router = useRouter();
  const shownTheme = useTheme(theme);
  const [shownDensity, setDensity] = useState(density);
  const [shownClock, setClock] = useState(clock);
  const [shownWeekStart, setWeekStart] = useState(weekStartSetting(weekStart));
  const [shownStartPage, setStartPage] = useState(startPage);
  // Each choice saves at once; this says so, and where it is kept.
  const [saved, setSaved] = useState<string | null>(null);

  /** Times the server wrote, such as the Month's marks, need the new cookie, so the page is drawn again. */
  function chooseClock(setting: ClockSetting) {
    const device = deviceClock();
    setClock({ setting, clock: setting === "auto" ? device : setting });
    document.cookie = `${CLOCK_COOKIE}=${clockCookieValue(setting, device)}; path=/; max-age=31536000; samesite=lax`;
    setSaved("Time format saved on this device.");
    router.refresh();
  }

  /** The Week and the Month are drawn on the server from the cookie, so the page is drawn again with it. */
  function chooseWeekStart(next: WeekStartSetting) {
    setWeekStart(next);
    document.cookie = `${WEEK_START_COOKIE}=${next}; ${YEAR}`;
    setSaved("First day of the week saved on this device.");
    router.refresh();
  }

  function chooseStartPage(next: StartPage) {
    setStartPage(next);
    document.cookie = `${START_PAGE_COOKIE}=${next}; ${YEAR}`;
    setSaved("Start page saved on this device.");
  }

  return (
    <section aria-labelledby="display-heading">
      <h2 id="display-heading" className="font-display text-xl font-medium">
        Display
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">Kept on this device.</p>

      <h3 className="mt-5 font-medium text-ink">Theme</h3>
      <Choice label="Theme" options={THEMES} names={THEME_LABEL} value={shownTheme} onChoose={(next) => {
          applyTheme(next);
          setSaved("Theme saved on this device.");
        }}
      />

      <h3 className="mt-6 font-medium text-ink">Density</h3>
      <p className="mt-1 max-w-[60ch] text-ink-2">Compact tightens list rows only, not the time grid.</p>
      <Choice
        label="Density"
        options={DENSITIES}
        names={DENSITY_LABEL}
        value={shownDensity}
        onChoose={(next) => {
          setDensity(next);
          saveDensity(next);
          setSaved("Density saved on this device.");
        }}
      />

      <h3 className="mt-6 font-medium text-ink">Time format</h3>
      <p className="mt-1 max-w-[60ch] text-ink-2">How times are written. Either way can be typed.</p>
      <Choice label="Time format" options={CLOCK_SETTINGS} names={CLOCK_LABEL} value={shownClock.setting} onChoose={chooseClock} />

      <h3 className="mt-6 font-medium text-ink">Week starts on</h3>
      <p className="mt-1 max-w-[60ch] text-ink-2">First column of the Week and the Month.</p>
      <Choice label="Week starts on" options={WEEK_STARTS} names={WEEK_START_LABEL} value={shownWeekStart} onChoose={chooseWeekStart} />

      <h3 className="mt-6 font-medium text-ink">Start page</h3>
      <p className="mt-1 max-w-[60ch] text-ink-2">Where Axiis opens.</p>
      {/* Five pages are too many for one row of buttons on a phone, so this one is a list. */}
      <select
        aria-label="Start page"
        value={shownStartPage}
        onChange={(e) => chooseStartPage(e.target.value as StartPage)}
        className="mt-2 rounded-lg border border-field bg-sheet px-3 py-2 font-medium text-ink pointer-coarse:min-h-11"
      >
        {START_PAGES.map((page) => (
          <option key={page} value={page}>
            {START_PAGE_LABEL[page].name}
          </option>
        ))}
      </select>
      <p role="status" className="mt-3 min-h-5 text-[13px] text-ink-2">
        {saved}
      </p>
    </section>
  );
}
