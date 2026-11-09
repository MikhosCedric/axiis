import type { CSSProperties, ReactNode } from "react";
import { Glyph } from "@/features/today/glyph";
import styles from "./floaters.module.css";

/**
 * Loose pieces of the product floating around the hero's sheet: a capture chip typing a line, a Next up card, a
 * finished item. Decoration only (`aria-hidden`, nothing focusable) with sample lines, shown from 1100px where
 * there is room beside the sheet. The shared public script parts each layer from a fine pointer (`data-parallax`).
 */
const vars = (v: Record<string, number | string>) => v as CSSProperties;

export function HeroFloaters() {
  return (
    <div className={styles.field} aria-hidden="true" data-loop="">
      <Floater className={styles.capture} reach={30} order={0} bob={7}>
        <span className={styles.typed}>Call the vet from the train</span>
        <kbd className={styles.key}>C</kbd>
      </Floater>

      <Floater className={styles.next} reach={20} order={1} bob={9}>
        <span className={styles.nextTitle}>Next up</span>
        <span className={styles.row}>
          <Glyph type="task" state="live" className={styles.glyph} />
          <span>Review pull requests</span>
        </span>
        <span className={styles.row}>
          <Glyph type="event" state="planned" className={styles.glyph} />
          <span>Quick check-in</span>
        </span>
      </Floater>

      <Floater className={styles.done} reach={26} order={2} bob={6}>
        <span className={styles.row}>
          <Glyph type="task" state="done" className={styles.glyph} />
          <span>Pay the electricity bill</span>
        </span>
      </Floater>
    </div>
  );
}

/**
 * Three nested layers keep the three movements apart: the outer is parted from the pointer by script
 * (`translate`), the next arrives on a spring (`transform`), the inner bobs for as long as the page is open.
 */
function Floater({ className, reach, order, bob, children }: { className: string; reach: number; order: number; bob: number; children: ReactNode }) {
  return (
    <div className={`${styles.floater} ${className}`} data-parallax={reach} style={vars({ "--n": order, "--bob": `${bob}s` })}>
      <span className={styles.arrive}>
        <span className={styles.bob}>
          <span className={styles.chip}>{children}</span>
        </span>
      </span>
    </div>
  );
}
