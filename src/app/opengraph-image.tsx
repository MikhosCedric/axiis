import { ImageResponse } from "next/og";
import { ACCENT, BrandMark, INK } from "@/lib/brand-mark";
import { PAPER_LIGHT } from "@/lib/theme-colors";

export const alt = "Axiis: your tasks and your time, on one page. A time grid with tinted blocks for three days and a line for now.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const QUIET = "#625e55";
const RULE = "rgba(28, 27, 34, 0.12)";
const BAR = "rgba(28, 27, 34, 0.28)";
const SHEET = "#fcfcf9";

/** Where the grid sits on the card, and where now falls on it (a share of its height). */
const GRID = { left: 96, top: 396, width: 1008, height: 190, gutter: 56, now: 0.46 };

/** The area colours as the light theme draws them: indigo, ochre, sage. */
const AREA = { work: "67, 88, 158", home: "157, 117, 47", health: "106, 129, 110" } as const;

type Block = { from: number; to: number; area: keyof typeof AREA; form: "done" | "live" | "planned"; lane?: [number, number] };
/** Three days; blocks as shares of the grid's height. */
const DAYS: Block[][] = [
  [
    { from: 0.04, to: 0.26, area: "health", form: "done" },
    { from: 0.3, to: 0.56, area: "work", form: "live" },
    { from: 0.64, to: 0.9, area: "home", form: "planned" },
  ],
  [
    { from: 0.12, to: 0.4, area: "work", form: "planned", lane: [0, 2] },
    { from: 0.24, to: 0.5, area: "home", form: "planned", lane: [1, 2] },
    { from: 0.62, to: 0.84, area: "health", form: "planned" },
  ],
  [
    { from: 0.06, to: 0.3, area: "home", form: "planned" },
    { from: 0.46, to: 0.76, area: "work", form: "planned" },
  ],
];

function Mark({ form, area }: { form: Block["form"]; area: keyof typeof AREA }) {
  const base = { position: "absolute" as const, left: 7, top: 8, width: 16, display: "flex" };
  if (form === "planned") {
    return (
      <div style={{ ...base, height: 3, gap: 3, overflow: "hidden" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 4, height: 3, background: `rgb(${AREA[area]})`, flex: "none" }} />
        ))}
      </div>
    );
  }
  if (form === "live") return <div style={{ ...base, height: 4, borderRadius: 2, background: ACCENT }} />;
  return <div style={{ ...base, top: 5, height: 10, borderRadius: 5, border: `2px solid ${QUIET}` }} />;
}

/** The card a shared link shows: the name and the line, over a strip of the time grid with its line for now. */
export default function OpenGraphImage() {
  const columnWidth = (GRID.width - GRID.gutter) / DAYS.length;
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

        <div
          style={{
            position: "absolute",
            left: GRID.left,
            top: GRID.top,
            width: GRID.width,
            height: GRID.height,
            display: "flex",
            background: SHEET,
            border: `2px solid ${BAR}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Hour rules across the whole grid. */}
          {[0.2, 0.4, 0.6, 0.8].map((at) => (
            <div key={at} style={{ position: "absolute", left: GRID.gutter, right: 0, top: GRID.height * at, height: 2, background: RULE, display: "flex" }} />
          ))}
          <div style={{ width: GRID.gutter, height: "100%", borderRight: `2px solid ${RULE}`, display: "flex" }} />
          {DAYS.map((blocks, d) => (
            <div key={d} style={{ position: "relative", width: columnWidth, height: "100%", borderLeft: d ? `2px solid ${RULE}` : "0px solid transparent", display: "flex" }}>
              {blocks.map((b) => {
                const lanes = b.lane?.[1] ?? 1;
                const lane = b.lane?.[0] ?? 0;
                const width = (columnWidth - 8) / lanes;
                return (
                  <div
                    key={b.from}
                    style={{
                      position: "absolute",
                      left: 4 + lane * width,
                      width: width - 3,
                      top: GRID.height * b.from,
                      height: GRID.height * (b.to - b.from),
                      borderRadius: 8,
                      background: `rgba(${AREA[b.area]}, ${b.form === "done" ? 0.1 : 0.2})`,
                      display: "flex",
                    }}
                  >
                    <Mark form={b.form} area={b.area} />
                  </div>
                );
              })}
            </div>
          ))}
          {/* The line for now, over today's column, with its dot. */}
          <div style={{ position: "absolute", left: GRID.gutter, width: columnWidth, top: GRID.height * GRID.now, height: 4, background: ACCENT, display: "flex" }} />
          <div style={{ position: "absolute", left: GRID.gutter - 6, top: GRID.height * GRID.now - 8, width: 20, height: 20, borderRadius: 10, background: ACCENT, display: "flex" }} />
        </div>
      </div>
    ),
    size,
  );
}
