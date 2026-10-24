"use client";

import { useEffect } from "react";

/**
 * Lets the landing's sections rise into place as they scroll into view. Only what starts below the
 * fold is held back, and only once this has run, so nothing already on screen (the headline, the
 * Score) waits for script, and without script or with reduced motion everything is simply there.
 * Elements opt in with `data-reveal`; CSS in landing.module.css does the moving.
 */
export function Reveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const below = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter(
      (el) => el.getBoundingClientRect().top > innerHeight,
    );
    for (const el of below) el.dataset.reveal = "wait";
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    for (const el of below) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
