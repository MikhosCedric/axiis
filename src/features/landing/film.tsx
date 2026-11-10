"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./film.module.css";

/**
 * A nine second loop of the product, muted, framed like the Score's sheet. It plays only while it is on screen and
 * only when the visitor has not asked for less motion; with reduced motion it stays on its poster and the button
 * starts it. A button always pauses it. The loop shows the product's own screens and carries no sound, so the
 * words beside it say what it shows (read aloud, not printed).
 */
export function Film() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const wanted = useRef(true);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    wanted.current = !reduced;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && wanted.current) void el.play().catch(() => {});
      else el.pause();
    });
    io.observe(el);
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    el.addEventListener("play", on);
    el.addEventListener("pause", off);
    return () => {
      io.disconnect();
      el.removeEventListener("play", on);
      el.removeEventListener("pause", off);
    };
  }, []);

  const toggle = () => {
    const el = video.current;
    if (!el) return;
    wanted.current = el.paused;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  return (
    <figure className={styles.film}>
      <video
        ref={video}
        className={styles.video}
        src="/film/axiis-loop.webm"
        poster="/film/axiis-poster.jpg"
        muted
        loop
        playsInline
        preload="auto"
        aria-describedby="film-caption"
      />
      <button type="button" className={styles.toggle} onClick={toggle} aria-pressed={playing}>
        {playing ? "Pause the loop" : "Play the loop"}
      </button>
      <span id="film-caption" className="sr-only">
        A line is typed, dropped on the day, reached by the line for now, and finished. No sound.
      </span>
    </figure>
  );
}
