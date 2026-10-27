"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";

export type Segment = { key: string; label: string; href?: string };

/** How long the thumb takes to slide, and how long a link waits for it before the page turns. */
const SLIDE_MS = 220;
const TURN_MS = 140;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A segmented control: segments on a recessed track, the chosen one under an Ink thumb that slides to a
 * new choice (DESIGN.md, Segmented controls). Segments with an `href` are links (Day, Week, Month): the
 * thumb slides first and the page turns as it lands. Without, they are toggle buttons (Score, List) that
 * call `onChoose`. The thumb lives in the chosen segment, so the server draws it in place; a change is
 * animated from where it was (FLIP), and not at all under reduced motion.
 */
export function Segmented({
  label,
  segments,
  chosen,
  onChoose,
  className = "",
}: {
  label: string;
  segments: readonly Segment[];
  chosen: string;
  onChoose?: (key: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(chosen);
  const [was, setWas] = useState(chosen);
  if (chosen !== was) {
    setWas(chosen);
    setShown(chosen);
  }
  const track = useRef<HTMLDivElement>(null);
  const last = useRef<DOMRect | null>(null);

  useLayoutEffect(() => {
    const thumb = track.current?.querySelector<HTMLElement>(".segment-thumb");
    if (!thumb) return;
    const now = thumb.getBoundingClientRect();
    const before = last.current;
    last.current = now;
    if (!before || before.left === now.left || reduced()) return;
    thumb.animate(
      [
        { transform: `translateX(${before.left - now.left}px) scaleX(${before.width / now.width})`, transformOrigin: "left" },
        { transform: "none", transformOrigin: "left" },
      ],
      { duration: SLIDE_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [shown]);

  function go(e: MouseEvent<HTMLAnchorElement>, segment: Segment) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || segment.key === shown) return;
    e.preventDefault();
    setShown(segment.key);
    const href = segment.href!;
    if (reduced()) router.push(href);
    else window.setTimeout(() => router.push(href), TURN_MS);
  }

  return (
    <div ref={track} role="group" aria-label={label} className={`segmented ${className}`}>
      {segments.map((s) => {
        const on = s.key === shown;
        const inside = (
          <>
            {on && <span aria-hidden="true" className="segment-thumb" />}
            {s.label}
          </>
        );
        return s.href ? (
          <Link key={s.key} href={s.href} aria-current={s.key === chosen ? "page" : undefined} data-on={on || undefined} onClick={(e) => go(e, s)} className="segment press">
            {inside}
          </Link>
        ) : (
          <button
            key={s.key}
            type="button"
            aria-pressed={on}
            data-on={on || undefined}
            onClick={() => {
              setShown(s.key);
              onChoose?.(s.key);
            }}
            className="segment press"
          >
            {inside}
          </button>
        );
      })}
    </div>
  );
}
