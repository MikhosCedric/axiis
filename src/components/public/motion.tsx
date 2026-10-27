"use client";

import { useEffect } from "react";
import { currentSection } from "@/features/landing/sections";

/**
 * The public pages' script-driven motion, in one listener set, so each page pays for it once. CSS does all
 * the moving; this only says when. With reduced motion it does nothing, and the page is already drawn.
 *
 * - `data-reveal`: held back once seen to be below the fold, then let rise as it scrolls into view.
 * - `data-loop`: an ambient loop, marked `data-offscreen` while out of view so its CSS can pause it.
 * - `data-parallax="<px>"`: shifted up to that many pixels against a fine pointer, so layers part as it moves.
 * - `data-glow`: a sheet whose lamp (`data-glow-spot`) follows the pointer across it, and whose shadow
 *   (`data-glow-shadow`) falls away from it.
 *
 * With any motion setting:
 * - `data-sections`: a nav of letters; the one for the `data-section` being read is marked `aria-current`.
 * - `data-anchor`: a place an in-page link goes to. The link scrolls there, puts the address in the bar
 *   without a jump, moves focus to its heading and, with motion, plays its arrival (`data-arrive`).
 */
export function PublicMotion() {
  useEffect(() => {
    const stops = [sections(), anchors()];
    if (!matchMedia(REDUCED).matches) {
      stops.push(reveal(), loops());
      if (matchMedia("(pointer: fine)").matches) stops.push(parallax(), glow());
    }
    return () => stops.forEach((stop) => stop());
  }, []);
  return null;
}

const REDUCED = "(prefers-reduced-motion: reduce)";

/** How far down the window the reader's eye is taken to be when choosing the section being read. */
const PROBE = 0.35;

function sections() {
  const navs = [...document.querySelectorAll<HTMLElement>("[data-sections]")];
  const targets = [...document.querySelectorAll<HTMLElement>("[data-section]")];
  if (navs.length === 0 || targets.length === 0) return () => {};
  let at = -2;
  const mark = () => {
    const next = currentSection(
      targets.map((t) => t.getBoundingClientRect()),
      innerHeight * PROBE,
    );
    if (next === at) return;
    at = next;
    for (const nav of navs) {
      if (next >= 0) nav.style.setProperty("--at", String(next));
      nav.toggleAttribute("data-none", next < 0);
      nav.querySelectorAll("a").forEach((a, i) => a.toggleAttribute("aria-current", i === next));
    }
  };
  // Crossing the probe line is the only time the answer can change, so only then are the boxes read.
  const io = new IntersectionObserver(mark, { rootMargin: `-${PROBE * 100}% 0px -${99 - PROBE * 100}% 0px` });
  for (const t of targets) io.observe(t);
  return () => io.disconnect();
}

function anchors() {
  const click = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target?.hasAttribute("data-anchor")) return;
    e.preventDefault();
    const reduced = matchMedia(REDUCED).matches;
    target.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    if (location.hash !== link.hash) history.pushState(history.state, "", link.hash);
    target.querySelector<HTMLElement>("h2, h3")?.focus({ preventScroll: true });
    if (reduced) return;
    target.removeAttribute("data-arrive");
    requestAnimationFrame(() => target.setAttribute("data-arrive", ""));
  };
  const settled = (e: AnimationEvent) => {
    if (e.animationName.includes("arrive-done")) (e.target as Element).closest("[data-arrive]")?.removeAttribute("data-arrive");
  };
  document.addEventListener("click", click);
  document.addEventListener("animationend", settled);
  return () => {
    document.removeEventListener("click", click);
    document.removeEventListener("animationend", settled);
  };
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
