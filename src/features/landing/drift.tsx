import type { CSSProperties } from "react";
import { Glyph } from "@/features/today/glyph";
import styles from "./drift.module.css";

/**
 * Loose pieces of a score floating behind the page: line forms, staff and ledger fragments, barlines, and
 * one verdigris tick for now. Each sits on one of three depths, and depth sets everything that moves it:
 * how far it travels as the page scrolls, how far it parts from the pointer, and how strongly it is drawn.
 */
type Form = "planned" | "done" | "staff" | "ledger" | "barline" | "final" | "head" | "now";

/**
 * `y` is measured in the headline's own size (the field is set in it), from the top of the headline's
 * box, so a piece keeps to the same gap in the type at every width: 1em down is the second line.
 */
type Piece = { form: Form; x: string; y: string; w?: string };

type Depth = { pieces: Piece[]; reach: number };

const vars = (v: Record<string, number | string>) => v as CSSProperties;

/**
 * Far to near. `reach` is how many pixels a layer parts from a fine pointer. Most of them gather in the
 * open stretch right of "on one page.", as a loose fragment of the Score: a staff, a beam, now.
 */
const HERO: Depth[] = [
  {
    reach: 10,
    pieces: [
      { form: "staff", x: "58%", y: "1.42em", w: "3.4em" },
      { form: "barline", x: "91%", y: "1.42em" },
      { form: "staff", x: "-3%", y: "calc(100% - 0.2em)", w: "2em" },
      { form: "head", x: "44%", y: "-0.28em" },
    ],
  },
  {
    reach: 22,
    pieces: [
      { form: "planned", x: "73%", y: "1.4em", w: "1.3em" },
      { form: "done", x: "60%", y: "1.86em", w: "0.8em" },
      { form: "ledger", x: "0.4%", y: "1.08em" },
      { form: "final", x: "97%", y: "1.42em" },
    ],
  },
  {
    reach: 38,
    pieces: [
      { form: "now", x: "67%", y: "1.18em" },
      { form: "done", x: "84%", y: "1.75em", w: "0.6em" },
    ],
  },
];

/** Behind the headline and the way in, from 900px; on a phone the type fills the width and there is no room. */
export function HeroDrift() {
  return (
    <div className={styles.field} aria-hidden="true" data-loop="">
      {HERO.map((depth, d) => (
        <div key={d} className={styles.depth} data-parallax={depth.reach} style={vars({ "--d": d })}>
          {depth.pieces.map((p, i) => (
            <Piece key={i} piece={p} order={d * 4 + i} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Piece({ piece, order }: { piece: Piece; order: number }) {
  const style = vars({ "--x": piece.x, "--y": piece.y, "--w": piece.w ?? "0px", "--o": order });
  const className = `${styles.piece} ${styles[piece.form]}`;
  if (piece.form === "planned" || piece.form === "done") {
    return (
      <span className={className} style={style}>
        <Glyph type="task" state={piece.form} className={styles.glyph} />
      </span>
    );
  }
  return <span className={className} style={style} />;
}

/**
 * Between two sections, a staff that runs the width of the window: its lines are ruled in as it arrives,
 * and the beams on it slide along at their own rates while it crosses the screen, so one section's
 * lines carry on into the next.
 */
export function Seam({ beams }: { beams: { x: string; w: number; state: "planned" | "done"; rate: number }[] }) {
  return (
    <div className={styles.seam} aria-hidden="true">
      <span className={styles.seamLines} />
      {beams.map((b, i) => (
        <span key={i} className={styles.seamBeam} style={vars({ "--x": b.x, "--w": `${b.w}px`, "--rate": b.rate })}>
          <Glyph type="task" state={b.state} className={styles.glyph} />
        </span>
      ))}
      <span className={styles.seamBar} />
    </div>
  );
}
