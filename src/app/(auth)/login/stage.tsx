import type { CSSProperties } from "react";
import { Glyph } from "@/features/today/glyph";
import styles from "./stage.module.css";

/**
 * What sits beside the sign-in sheet on a wide window: a sheet of the day as the app draws it, with loose pieces
 * of the score floating around it. It is decoration only (`aria-hidden`, no focusable parts) and carries sample
 * lines, nothing from anyone's account. Its motion is CSS; the shared public script parts the layers from the
 * pointer (`data-parallax`) and pauses the loops while the stage is out of view (`data-loop`).
 */
const vars = (v: Record<string, number | string>) => v as CSSProperties;

type Beam = { title: string; at: string; x: number; w: number; state: "planned" | "done" | "live"; type?: "task" | "event" | "checklist" };

/** Position and width are percentages of the hour axis, which runs 9 AM to 3 PM. */
const STAVES: { name: string; beams: Beam[] }[] = [
  {
    name: "Work",
    beams: [
      { title: "Standup", at: "9:30", x: 3, w: 9, state: "done", type: "event" },
      { title: "Write the launch brief", at: "10:15", x: 23, w: 28, state: "planned" },
      { title: "Design sync", at: "1:00", x: 63, w: 18, state: "planned", type: "event" },
    ],
  },
  {
    name: "Home",
    beams: [
      { title: "Call the landlord", at: "9:45", x: 10, w: 15, state: "done" },
      { title: "Packing list", at: "12:30", x: 52, w: 24, state: "planned", type: "checklist" },
    ],
  },
  {
    name: "Health",
    beams: [
      { title: "Stretch", at: "10:00", x: 16, w: 12, state: "done" },
      { title: "Walk to the park", at: "11:45", x: 39, w: 26, state: "live" },
      { title: "Run", at: "2:00", x: 78, w: 16, state: "planned" },
    ],
  },
];

const HOURS = ["9", "10", "11", "12", "1", "2"];

/** Loose fragments behind the sheet, far (0) to near (2): how far each layer parts from the pointer, and how plainly it is drawn. */
const DRIFT: { reach: number; pieces: { form: "staff" | "ledger" | "barline" | "head" | "final"; x: string; y: string; w?: string }[] }[] = [
  {
    reach: 8,
    pieces: [
      { form: "staff", x: "2%", y: "70%", w: "9rem" },
      { form: "barline", x: "94%", y: "30%" },
      { form: "head", x: "46%", y: "5%" },
    ],
  },
  {
    reach: 16,
    pieces: [
      { form: "ledger", x: "90%", y: "62%" },
      { form: "staff", x: "78%", y: "8%", w: "7rem" },
      { form: "final", x: "6%", y: "34%" },
    ],
  },
  {
    reach: 26,
    pieces: [
      { form: "head", x: "12%", y: "88%" },
      { form: "head", x: "88%", y: "90%" },
    ],
  },
];

export function SignInStage() {
  return (
    <div className={styles.stage} aria-hidden="true" data-loop="">
      {DRIFT.map((depth, d) => (
        <div key={d} className={styles.drift} data-parallax={depth.reach} style={vars({ "--d": d })}>
          {depth.pieces.map((p, i) => (
            <span key={i} className={`${styles.piece} ${styles[p.form]}`} style={vars({ "--x": p.x, "--y": p.y, "--w": p.w ?? "0px", "--o": d * 3 + i })} />
          ))}
        </div>
      ))}

      <div className={styles.layer} data-parallax="7">
        <div className={styles.sheet}>
          <div className={styles.axis}>
            <span className={styles.today}>Today</span>
            <span className={styles.hours}>
              {HOURS.map((h) => (
                <span key={h} className="tabular">
                  {h}
                </span>
              ))}
            </span>
          </div>

          <div className={styles.staves}>
            {STAVES.map((staff, s) => (
              <div key={staff.name} className={styles.stave} style={vars({ "--s": s })}>
                <span className={styles.name}>{staff.name}</span>
                <span className={styles.track}>
                  {staff.beams.map((b, i) => (
                    <span
                      key={b.title}
                      className={`${styles.beam} ${b.state === "live" ? styles.live : ""}`}
                      style={vars({ "--x": `${b.x}%`, "--w": `${b.w}%`, "--i": s * 3 + i })}
                    >
                      <span className={styles.label}>
                        {b.title} <span className="tabular">{b.at}</span>
                      </span>
                      <Glyph type={b.type ?? "task"} state={b.state} className={styles.glyph} />
                    </span>
                  ))}
                </span>
              </div>
            ))}
            <span className={styles.now}>
              <span className={`${styles.flag} tabular`}>11:52</span>
            </span>
          </div>
        </div>
      </div>

      <Floater className={styles.capture} reach={34} order={0} bob={7}>
        <span className={styles.typed}>Call the vet from the train</span>
        <kbd className={styles.key}>C</kbd>
      </Floater>

      <Floater className={styles.next} reach={22} order={1} bob={9}>
        <span className={styles.nextTitle}>Next up</span>
        <span className={styles.row}>
          <Glyph type="task" state="live" className={styles.chipGlyph} />
          <span>Review pull requests</span>
        </span>
        <span className={styles.row}>
          <Glyph type="event" state="planned" className={styles.chipGlyph} />
          <span>Quick check-in</span>
        </span>
      </Floater>

      <Floater className={styles.done} reach={30} order={2} bob={6}>
        <span className={styles.row}>
          <Glyph type="task" state="done" className={styles.chipGlyph} />
          <span>Pay the electricity bill</span>
        </span>
      </Floater>

      <Floater className={styles.plan} reach={18} order={3} bob={8}>
        <span className={styles.row}>
          <Glyph type="task" state="planned" className={styles.chipGlyph} />
          <span>Book flights to Lisbon</span>
        </span>
      </Floater>
    </div>
  );
}

/**
 * A chip floating off the sheet. Three nested layers keep the three movements apart: the outer one is parted from the
 * pointer by script (`translate`), the next arrives (`transform`), the inner one bobs for as long as the page is open.
 */
function Floater({ className, reach, order, bob, children }: { className: string; reach: number; order: number; bob: number; children: React.ReactNode }) {
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

/** One staff and three beams in a strip, for a window too narrow for the stage. */
export function SignInStrip() {
  return (
    <div className={styles.strip} aria-hidden="true">
      <span className={styles.stripLines} />
      <span className={styles.stripBeam} style={vars({ "--x": "6%", "--w": "26%", "--i": 0 })}>
        <Glyph type="task" state="done" className={styles.glyph} />
      </span>
      <span className={styles.stripBeam} style={vars({ "--x": "38%", "--w": "30%", "--i": 1 })}>
        <Glyph type="task" state="live" className={styles.glyph} />
      </span>
      <span className={styles.stripBeam} style={vars({ "--x": "72%", "--w": "20%", "--i": 2 })}>
        <Glyph type="task" state="planned" className={styles.glyph} />
      </span>
      <span className={styles.stripNow} />
    </div>
  );
}
