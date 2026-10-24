import { ImageResponse } from "next/og";
import { ACCENT, BrandMark, INK } from "@/lib/brand-mark";
import { PAPER_LIGHT } from "@/lib/theme-colors";

export const alt = "Axiis: your tasks and your time, on one page. Three ruled staves with beams on an hour axis and a line for now.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const QUIET = "#625e55";
const RULE = "rgba(28, 27, 34, 0.14)";
const BAR = "rgba(28, 27, 34, 0.28)";
const SHEET = "#f3eee1";

/** Where the score sits on the card, and where now falls on it (a share of its width). */
const SCORE = { left: 96, width: 1008, now: 0.47 };

type Beam = { from: number; to: number; form: "done" | "live" | "planned" };
const STAVES: { name: string; beams: Beam[] }[] = [
  { name: "Work", beams: [{ from: 0.04, to: 0.2, form: "done" }, { from: 0.4, to: 0.58, form: "live" }, { from: 0.7, to: 0.86, form: "planned" }] },
  { name: "Home", beams: [{ from: 0.12, to: 0.16, form: "done" }, { from: 0.62, to: 0.66, form: "planned" }] },
  { name: "Health", beams: [{ from: 0.26, to: 0.33, form: "done" }, { from: 0.76, to: 0.92, form: "planned" }] },
];

function BeamShape({ beam }: { beam: Beam }) {
  const left = beam.from * SCORE.width;
  const width = (beam.to - beam.from) * SCORE.width;
  const head = beam.form === "done" ? { border: `2.5px solid ${QUIET}`, background: SHEET } : { background: beam.form === "live" ? ACCENT : INK };
  return (
    <div style={{ position: "absolute", left, top: 6, width, height: 22, display: "flex", alignItems: "center" }}>
      {beam.form === "planned" ? (
        <div style={{ display: "flex", position: "absolute", left: 8, right: 0, top: 8, height: 7, gap: 6, overflow: "hidden" }}>
          {Array.from({ length: Math.ceil(width / 16) }, (_, i) => (
            <div key={i} style={{ width: 10, height: 7, background: INK, flex: "none" }} />
          ))}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            left: 8,
            right: 0,
            top: beam.form === "live" ? 5 : 7,
            height: beam.form === "live" ? 12 : 9,
            borderRadius: 5,
            ...(beam.form === "live" ? { background: ACCENT } : { border: `2.5px solid ${QUIET}` }),
          }}
        />
      )}
      <div style={{ position: "absolute", left: 0, top: 3, width: 16, height: 16, borderRadius: 8, ...head }} />
    </div>
  );
}

/** The card a shared link shows: the name and the line, over a strip of the Score with its line for now. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER_LIGHT, color: INK, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", margin: "64px 0 0 96px" }}>
          <BrandMark size={64} tile={false} />
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em", marginLeft: 20 }}>Axiis</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "40px 0 0 96px" }}>
          <div>Your tasks and your time,</div>
          <div>on one page.</div>
        </div>

        <div style={{ position: "absolute", left: SCORE.left, top: 400, width: SCORE.width, display: "flex", flexDirection: "column", borderTop: `2px solid ${BAR}` }}>
          {STAVES.map((staff) => (
            <div key={staff.name} style={{ position: "relative", height: 62, display: "flex", borderBottom: `2px solid ${BAR}` }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 24, height: 28, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} style={{ height: 1.5, background: RULE }} />
                ))}
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 22, height: 34, display: "flex" }}>
                {staff.beams.map((b) => (
                  <BeamShape key={b.from} beam={b} />
                ))}
              </div>
            </div>
          ))}
          {/* The final barline: a thin line, then a thick one. */}
          <div style={{ position: "absolute", right: 10, top: 0, bottom: 0, width: 2, background: BAR, display: "flex" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, background: INK, display: "flex" }} />
          <div style={{ position: "absolute", left: SCORE.width * SCORE.now, top: -18, bottom: 0, width: 4, background: ACCENT, display: "flex" }} />
        </div>
      </div>
    ),
    size,
  );
}
