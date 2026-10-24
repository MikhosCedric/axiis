"use client";

import { useEffect, useRef, useState } from "react";

export const COUNT_MS = 1400;

/** The number shown `ms` into the count: easing out, whole numbers only, never past `value`. */
export function countAt(value: number, ms: number): number {
  const t = Math.min(1, Math.max(0, ms / COUNT_MS));
  return Math.round(value * (1 - (1 - t) ** 3));
}

/**
 * A number counted up from nought the first time it scrolls into view. The server draws the real number,
 * so without script, with reduced motion, or already on screen, it is simply there; screen readers are
 * given the number once, never the count.
 */
export function Tally({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight) return;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        setShown(countAt(value, now - start));
        if (now - start < COUNT_MS) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
    setShown(0);
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={box} className={className}>
      <span aria-hidden="true" className="tabular inline-block text-right" style={{ minWidth: `${String(value).length}ch` }}>
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
