import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ActionBeam,
  DownArrow,
  PageTurn,
  SectionLetters,
  SiteFooter,
  SiteHeader,
  drawnLink,
  primaryAction,
  quietAction,
  siteWrap,
} from "@/components/public/site-chrome";
import { CLOCK_COOKIE, readClock, readStartPage, START_PAGE_COOKIE, startPath } from "@/components/shell/cookies";
import { AREA_COLORS } from "@/domain/area-color";
import { DELETION_GRACE_DAYS } from "@/features/account/commands";
import { CaptureDemo } from "@/features/landing/capture-demo";
import { DayRun } from "@/features/landing/day-run";
import { DoneDemo } from "@/features/landing/done-demo";
import { DragDemo } from "@/features/landing/drag-demo";
import { HeroDrift, Seam } from "@/features/landing/drift";
import { FocusDemo } from "@/features/landing/focus-demo";
import { HeroFloaters } from "@/features/landing/floaters";
import { LiveScore } from "@/features/landing/live-score";
import { MonthDemo } from "@/features/landing/month-demo";
import { SECTIONS, type Section } from "@/features/landing/sections";
import { Tally } from "@/features/landing/tally";
import { formatMonthHeading, monthGrid, monthOf } from "@/features/month/model";
import { toLocalDate } from "@/lib/dates";
import { getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";
import { SITE_DESCRIPTION } from "@/lib/site";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "Axiis · Tasks and time, on one page" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/** Said under every call to start, so nobody has to sign in to learn what signing in costs. */
const TERMS = "Free. Email link or Google. No password.";

/** Bubbles that drift up behind the hero: left, size, rise time, start offset, sway. */
const BUBBLES: Record<string, string>[] = [
  { "--x": "6%", "--s": "46px", "--t": "19s", "--d": "-3s", "--w": "14px" },
  { "--x": "17%", "--s": "18px", "--t": "14s", "--d": "-9s", "--w": "-10px" },
  { "--x": "31%", "--s": "30px", "--t": "22s", "--d": "-14s", "--w": "12px" },
  { "--x": "52%", "--s": "14px", "--t": "16s", "--d": "-6s", "--w": "-8px" },
  { "--x": "66%", "--s": "58px", "--t": "26s", "--d": "-18s", "--w": "16px" },
  { "--x": "79%", "--s": "22px", "--t": "15s", "--d": "-1s", "--w": "-12px" },
  { "--x": "91%", "--s": "36px", "--t": "21s", "--d": "-11s", "--w": "10px" },
];

/** Everything here ships today, each in a few words. Nothing is promised that is not built. */
const NOW = [
  "Capture in plain English",
  "The Score and its line for now",
  "Drag to plan, or use the keys",
  "List, Week and Month views",
  "An Inbox for what is unplanned",
  "Due dates, kept apart",
  "Open items from earlier days",
  "Focus and Next up",
  "Subtasks",
  "Repeating tasks",
  "Checklists in Lists",
  "Notes linked to tasks, and search",
  "Tags with a page each",
  "Twelve muted colours for areas and tags",
  "A command palette on Ctrl or Cmd K",
  "G then a letter to jump",
  "12-hour or 24-hour clock",
  "Light and dark, compact density",
  "Installs from the browser as an app",
  "Export it all, or delete with 14 days to change your mind",
];

/**
 * Numbers the page can stand behind: each is read from the code that makes it true, and a tile draws
 * what it counts where it can (the colours themselves, a ruler of the days).
 */
const TALLIES = [
  { value: NOW.length, words: "things it does today, each one named here", draw: "tally" },
  { value: AREA_COLORS.length, words: "muted colours for areas and tags", draw: "colours" },
  { value: DELETION_GRACE_DAYS, words: "days to change your mind after deleting", draw: "days" },
  { value: 0, words: "ads, analytics or trackers", draw: "none" },
] as const;

/** What each movement's demo answers to. */
const KEYS: Record<Section["id"], readonly (readonly [keys: readonly string[], does: string])[]> = {
  capture: [[["Enter"], "says where the line lands"]],
  drag: [
    [["←", "→"], "a quarter hour"],
    [["Shift", "← →"], "moves its end"],
    [["Esc"], "lets go of a drag"],
  ],
  done: [[["Space"], "ticks it done, or back"]],
  focus: [[["Enter"], "folds the day, or opens the fold"]],
  month: [
    [["←", "→", "↑", "↓"], "a day or a week"],
    [["Home", "End"], "the week's ends"],
  ],
};

const vars = (v: Record<string, number | string>) => v as CSSProperties;

export default async function Home() {
  // A signed-in visit, and the end of sign-in, which lands here, opens the start page chosen in Settings.
  const saved = await cookies();
  const start = startPath(readStartPage(saved.get(START_PAGE_COOKIE)?.value));
  if (await getFakeAccount()) redirect(start);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(start);

  const month = monthOf(toLocalDate(new Date(), "UTC"));
  const { clock } = readClock(saved.get(CLOCK_COOKIE)?.value);
  const [capture, drag, done, focus, wide] = SECTIONS;

  return (
    <PageTurn>
      <SiteHeader contents={SECTIONS} />
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.depth} data-loop="" aria-hidden="true">
            <span className={styles.farStaff} />
            <span className={styles.nearStaff} />
            {BUBBLES.map((b, i) => (
              <span key={i} className={styles.bubble} style={vars(b)} />
            ))}
          </div>
          <div className={`${siteWrap} ${styles.heroText}`}>
            <HeroDrift />
            <h1 id="hero-title" className={styles.display}>
              <span className={styles.firstLine}>Your tasks and your time,</span>{" "}
              <span className={styles.ruled}>
                on one page.
                <span className={styles.staffUnder} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </h1>
            <div className={styles.heroFoot}>
              <p className={styles.lead}>
                Every part of your life on one hour axis. The whole day, at a glance.
              </p>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/login" className={primaryAction}>
                    Start with today
                    <ActionBeam />
                  </Link>
                  <a href="#how" className={quietAction}>
                    See it work
                    <DownArrow />
                  </a>
                </div>
                <p className={styles.terms}>{TERMS}</p>
              </div>
            </div>
          </div>
          <div className={siteWrap}>
            <div className={styles.stack} data-loop="">
              <span className={styles.under} data-parallax="-14" aria-hidden="true" />
              <div className={styles.top} data-parallax="7">
                <LiveScore />
              </div>
              <HeroFloaters />
            </div>
          </div>
        </section>

        <section id="how" className={styles.how} aria-labelledby="how-title" data-anchor="">
          <div className={siteWrap}>
            <div className={styles.storyHead}>
              <Rise as="h2" id="how-title" className={styles.heading} text="How it works" />
              <p className={`${styles.storyLead} ${styles.reveal}`} data-reveal="">
                Five moves, each working on this page. Nothing here is saved.
              </p>
            </div>
            <DayRun clock={clock} titleClassName={styles.runTitle} />
          </div>

          <div className={styles.band}>
            <Seam
              beams={[
                { x: "18%", w: 120, state: "done", rate: 1 },
                { x: "52%", w: 200, state: "planned", rate: -0.6 },
                { x: "81%", w: 80, state: "planned", rate: 1.6 },
              ]}
            />
            <div className={styles.bandGrid}>
              <div className={styles.rail}>
                <p className={styles.railHead} aria-hidden="true">
                  Contents
                </p>
                <SectionLetters contents={SECTIONS} label="Contents" className={styles.railLetters} linkClassName={styles.railLink} nameClassName={styles.railName} />
              </div>
              <div className={`${siteWrap} ${styles.movements}`}>
                <Movement section={capture} title="Write it the way you would say it." demo={<CaptureDemo />}>
                  A day, a time, a length and <span className="font-medium text-ink">#tags</span> are read from your
                  words. Leave the day out and it waits in the Inbox.
                </Movement>

                <Movement section={drag} title="Drag it onto a line." demo={<DragDemo />}>
                  Where you let go is when it starts. Pull the right end for how long.
                </Movement>

                <Movement section={done} title="Done is a hollow line." demo={<DoneDemo />}>
                  Dashed is planned, solid is now, hollow is done. Nothing turns red when a day runs late.
                </Movement>

                <Movement section={focus} title="Fold the day to what is next." demo={<FocusDemo />}>
                  Focus keeps what is happening and the next three, and folds the rest behind one line.
                </Movement>

                <Movement
                  section={wide}
                  title="Step back to the month."
                  demo={<MonthDemo days={monthGrid(month)} month={month} title={formatMonthHeading(month)} />}
                >
                  The Week and the Month show the same items further out.
                </Movement>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.night} aria-labelledby="state-title" data-scheme="night">
          <div className={siteWrap}>
            <div className={styles.stateGrid}>
              <div className={styles.stateHead}>
                <Rise as="h2" id="state-title" className={styles.heading} text="What it does today" />
                <p className={`${styles.storyLead} ${styles.reveal}`} data-reveal="">
                  Only what ships, in a few words each.
                </p>
              </div>
              <dl className={styles.tallies}>
                {TALLIES.map((t, i) => (
                  <div key={t.words} className={`${styles.tile} ${styles.reveal}`} data-reveal="" style={vars({ "--i": i })}>
                    <dt className={styles.tally}>
                      <Tally value={t.value} />
                    </dt>
                    <dd className={styles.tallyWords}>{t.words}</dd>
                    {t.draw === "colours" && (
                      <dd className={styles.swatches} aria-hidden="true">
                        {AREA_COLORS.map((c) => (
                          <span key={c} style={{ background: `var(--area-${c})` }} />
                        ))}
                      </dd>
                    )}
                    {t.draw === "days" && <dd className={styles.days} aria-hidden="true" />}
                    {t.draw === "tally" && (
                      <dd className={styles.strokes} aria-hidden="true">
                        {Array.from({ length: Math.ceil(t.value / 5) }, (_, g) => (
                          <span key={g} data-gate={t.value - g * 5 >= 5 ? "" : undefined}>
                            {Array.from({ length: Math.min(4, t.value - g * 5) }, (_, s) => (
                              <i key={s} />
                            ))}
                          </span>
                        ))}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>
            <ul className={styles.cloud}>
              {NOW.map((line, i) => (
                <li
                  key={line}
                  className={`${styles.chip} ${styles.reveal}`}
                  data-reveal=""
                  style={vars({ "--i": i % 5, "--bob": `${6 + (i % 4)}s`, "--lag": `${-1.3 * i}s` })}
                >
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={siteWrap} aria-labelledby="data-title">
          <div className={styles.close} data-glow="">
            <span className={styles.lamp} aria-hidden="true">
              <span data-glow-spot="" />
            </span>
            <div className="max-w-[36rem]">
              <Rise as="h2" id="data-title" className={styles.heading} text="Yours, and only yours" />
              <p className={`${styles.closeBody} ${styles.reveal}`} data-reveal="">
                Stored with Supabase, readable only by your account. No ads, no analytics, no trackers. The{" "}
                <Link href="/privacy" className={`text-ink underline decoration-(--rule) underline-offset-4 ${drawnLink}`}>
                  privacy page
                </Link>{" "}
                says the rest.
              </p>
            </div>
            <div className={`flex flex-col items-start gap-3 ${styles.reveal}`} data-reveal="" style={vars({ "--i": 1 })}>
              <Link href="/login" className={primaryAction}>
                Start with today
                <ActionBeam />
              </Link>
              <p className={styles.terms}>{TERMS}</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </PageTurn>
  );
}

/**
 * A heading whose words rise one after another out of their own line, as it scrolls into view or as an
 * in-page link arrives at it, over a short staff that is ruled in under it. The words are the heading's
 * text, so it reads as one line. It takes focus when a link brings the reader to it.
 */
function Rise({ as: Tag, id, className, text }: { as: "h2" | "h3"; id: string; className: string; text: string }) {
  const words = text.split(" ");
  return (
    <Tag id={id} className={`${className} ${styles.rise}`} data-reveal="" tabIndex={-1}>
      {words.map((word, w) => (
        <span key={w}>
          <span className={styles.word}>
            <span style={vars({ "--w": w })}>{word}</span>
          </span>
          {w < words.length - 1 && " "}
        </span>
      ))}
      <span className={styles.headStaff} aria-hidden="true" />
    </Tag>
  );
}

/**
 * One part of the story, as a spread: a rehearsal mark and its tempo, a title, a few sentences and the
 * keys it answers to, laid on an under sheet, with the thing itself working on a sheet lifted over it.
 */
function Movement({ section, title, demo, children }: { section: Section; title: string; demo: ReactNode; children: ReactNode }) {
  const headId = `movement-${section.letter}`;
  return (
    <article
      id={section.id}
      className={`${styles.movement} ${styles[section.id] ?? ""}`}
      aria-labelledby={headId}
      data-section=""
      data-anchor=""
    >
      <span className={styles.underSheet} aria-hidden="true" />
      <div className={`${styles.movementText} ${styles.reveal}`} data-reveal="">
        <p className={styles.markRow} aria-hidden="true">
          <span className={styles.mark}>{section.letter}</span>
          <span className={styles.tempo}>{section.tempo}</span>
        </p>
        <Rise as="h3" id={headId} className={styles.movementTitle} text={title} />
        <p className={styles.movementBody}>{children}</p>
        <dl className={styles.keys}>
          {KEYS[section.id].slice(0, 1).map(([keys, does]) => (
            <div key={does}>
              <dt>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{does}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={`${styles.movementDemo} ${styles.reveal}`} data-reveal="" data-glow="" data-loop="" style={vars({ "--i": 1 })}>
        <span className={styles.sheetShadow} data-glow-shadow="" aria-hidden="true" />
        <span className={styles.lamp} aria-hidden="true">
          <span data-glow-spot="" />
        </span>
        {demo}
      </div>
    </article>
  );
}
