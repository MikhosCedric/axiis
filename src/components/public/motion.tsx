"use client";

import { useEffect } from "react";

/**
 * The public pages' script-driven motion, in one listener set, so each page pays for it once. CSS does all
 * the moving; this only says when. With reduced motion it does nothing, and the page is already drawn.
 *
 * - `data-reveal`: held back once seen to be below the fold, then let rise as it scrolls into view.
 * - `data-loop`: an ambient loop, marked `data-offscreen` while out of view so its CSS can pause it.
 * - `data-parallax="<px>"`: shifted up to that many pixels against a fine pointer, so layers part as it moves.
 * - `data-glow`: a sheet whose lamp (`data-glow-spot`) follows the pointer across it, and whose shadow
 *   (`data-glow-shadow`) falls away from it.
 */
export function PublicMotion() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stops = [reveal(), loops()];
    if (matchMedia("(pointer: fine)").matches) stops.push(parallax(), glow());
    return () => stops.forEach((stop) => stop());
  }, []);
  return null;
}

function reveal() {
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
}

function loops() {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute("data-offscreen", !entry.isIntersecting);
  });
  for (const el of document.querySelectorAll("[data-loop]")) io.observe(el);
  return () => io.disconnect();
}

/** Calls `draw` at most once a frame with the latest pointer event. */
function onPointerFrame(target: EventTarget, draw: (e: PointerEvent) => void) {
  let last: PointerEvent | null = null;
  let frame = 0;
  const move = (e: Event) => {
    last = e as PointerEvent;
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      if (last) draw(last);
    });
  };
  target.addEventListener("pointermove", move, { passive: true });
  return () => {
    target.removeEventListener("pointermove", move);
    cancelAnimationFrame(frame);
  };
}

function parallax() {
  const layers = [...document.querySelectorAll<HTMLElement>("[data-parallax]")].map((el) => ({
    el,
    reach: Number(el.dataset.parallax),
  }));
  if (layers.length === 0) return () => {};
  return onPointerFrame(window, (e) => {
    if (scrollY > innerHeight * 1.5) return;
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    for (const { el, reach } of layers) el.style.translate = `${(x * reach).toFixed(1)}px ${(y * reach * 0.6).toFixed(1)}px`;
  });
}

function glow() {
  const stops = [...document.querySelectorAll<HTMLElement>("[data-glow]")].map((sheet) => {
    const spot = sheet.querySelector<HTMLElement>("[data-glow-spot]");
    const shadow = sheet.querySelector<HTMLElement>("[data-glow-shadow]");
    return onPointerFrame(sheet, (e) => {
      const box = sheet.getBoundingClientRect();
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      if (spot) spot.style.translate = `${x.toFixed(0)}px ${y.toFixed(0)}px`;
      if (shadow) {
        const dx = (0.5 - x / box.width) * 14;
        const dy = (0.5 - y / box.height) * 10;
        shadow.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      }
    });
  });
  return () => stops.forEach((stop) => stop());
}
