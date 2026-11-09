"use client";

import { useEffect, useState } from "react";

export type SettingsPart = { id: string; name: string };

/**
 * The page's sections as links. On a phone and a tablet a quiet row under the heading; from 1180px a list that
 * stays beside the page and marks the section being read. The mark follows scrolling, so it is a plain
 * `aria-current`, never focus; a link click still moves focus to the section with the browser's own jump.
 */
export function SectionIndex({ parts }: { parts: readonly SettingsPart[] }) {
  const [current, setCurrent] = useState<string | null>(null);
  const ids = parts.map((p) => p.id).join(" ");

  useEffect(() => {
    const sections = ids
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        // The first section whose top part is on screen is the one being read.
        const first = sections.find((s) => visible.get(s.id));
        if (first) setCurrent(first.id);
      },
      // A band across the upper part of the window: a section counts once it reaches it.
      { rootMargin: "-10% 0px -55% 0px" },
    );
    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav
      aria-label="Settings sections"
      className="mt-6 min-[1180px]:sticky min-[1180px]:top-8 min-[1180px]:mt-10 min-[1180px]:self-start"
    >
      <ul className="-mx-2 flex flex-wrap gap-x-1 border-y border-rule-soft py-1 min-[1180px]:mx-0 min-[1180px]:block min-[1180px]:border-b-0 min-[1180px]:border-t-rule min-[1180px]:py-0">
        {parts.map((part) => {
          const here = current === part.id;
          return (
            <li key={part.id} className="min-[1180px]:border-b min-[1180px]:border-rule-soft">
              <a
                href={`#${part.id}`}
                aria-current={here ? "true" : undefined}
                className={`relative block rounded-md px-2 py-1.5 text-[14px] no-underline hover:bg-hover hover:text-ink active:bg-press pointer-coarse:min-h-11 pointer-coarse:py-2.5 min-[1180px]:py-2 min-[1180px]:text-[15px] ${
                  here ? "font-medium text-ink min-[1180px]:before:absolute min-[1180px]:before:inset-y-2 min-[1180px]:before:-left-3 min-[1180px]:before:w-px min-[1180px]:before:bg-ink" : "text-ink-2"
                }`}
              >
                {part.name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
