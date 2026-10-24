import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionBeam, PageTurn, SiteFooter, SiteHeader, primaryAction, quietAction, siteWrap } from "@/components/public/site-chrome";
import { CaptureDemo } from "@/features/landing/capture-demo";
import { DoneDemo } from "@/features/landing/done-demo";
import { DragDemo } from "@/features/landing/drag-demo";
import { FocusDemo } from "@/features/landing/focus-demo";
import { LiveScore } from "@/features/landing/live-score";
import { MonthDemo } from "@/features/landing/month-demo";
import { Reveal } from "@/features/landing/reveal";
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

/** Everything here ships today. Nothing is promised that is not built. */
const NOW = [
  "Capture that reads a day, a time, a length and tags typed in plain English, as in “dentist tomorrow 9am #health”",
  "The Score: each part of your life a line, one hour axis across them all, and a line for now",
  "Drag a task onto a line to give it a time, or pull its end to change how long; the same moves from the keyboard",
  "A list view of the same day",
  "A week view, with items dragged from one day to another",
  "A month view, with marks dragged from one day to another",
  "An inbox of everything captured and not yet planned",
  "Due dates, kept apart from the day you plan to do the thing, listed soonest first",
  "Anything still open from an earlier day, named on Today with a way to bring it over",
  "Focus and Next up: the day folded to what is happening and what comes next",
  "Subtasks, counted on the beam they belong to",
  "Tasks that repeat daily, on weekdays, weekly, monthly or yearly",
  "Lists: checklists gathered in one place, each with how many lines are done",
  "Notes that link to tasks, and search across both",
  "Tags on any item, with a page for each tag",
  "Twelve muted colours for areas and tags, and a filter that shows only one",
  "A command palette on Ctrl or Cmd K, and G then a letter to jump to a page",
  "A 12-hour or 24-hour clock, light and dark, and a compact density for long lists",
  "Installs from the browser as an app, on a phone or a computer",
  "Export all your data, or delete your account with 14 days to change your mind",
];

const vars = (v: Record<string, number | string>) => v as CSSProperties;

export default async function Home() {
  if (await getFakeAccount()) redirect("/today");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/today");

  const month = monthOf(toLocalDate(new Date(), "UTC"));

  return (
    <PageTurn>
      <Reveal />
      <SiteHeader />
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.depth} aria-hidden="true">
            <span className={styles.farStaff} />
            <span className={styles.nearStaff} />
          </div>
          <div className={`${siteWrap} pt-8 pb-12 sm:pt-14 sm:pb-14`}>
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
                One place for the things you have to do and the hours you have to do them in. Each part of your life
                gets a line, one hour axis runs across them all, and the whole day reads at a glance.
              </p>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/login" className={primaryAction}>
                    Start with today
                    <ActionBeam />
                  </Link>
                  <a href="#how" className={quietAction}>
                    See it work
                  </a>
                </div>
                <p className="mt-3 text-[13px] text-ink-3">{TERMS}</p>
              </div>
            </div>
          </div>
          <div className={siteWrap}>
            <LiveScore />
          </div>
        </section>

        <section id="how" className={`${siteWrap} ${styles.story}`} aria-labelledby="how-title">
          <div className={`${styles.storyHead} ${styles.reveal}`} data-reveal="">
            <h2 id="how-title" className={styles.heading}>
              How it works
            </h2>
            <p className={styles.storyLead}>Five things it does, each one working here. Nothing you do on this page is saved.</p>
          </div>

          <Movement mark="A" title="Write it the way you would say it." demo={<CaptureDemo />}>
            Type a line and press Enter. A day, a time, a length and <span className="font-medium text-ink">#tags</span> are
            read from the words you use, and the rest is the title. Leave the day out and it waits in the Inbox until you
            decide. This field runs the same reader the app does.
          </Movement>

          <Movement mark="B" title="Drag it onto a line." demo={<DragDemo />}>
            Where you let go is when it starts. Pull its right end to say how long it takes. Every move on the Score works
            from the keyboard too.
          </Movement>

          <Movement mark="C" title="Done is a hollow line." demo={<DoneDemo />}>
            Dashed is planned, solid is happening now, hollow is done. A tick turns the beam over, and nothing turns red
            when a day runs late.
          </Movement>

          <Movement mark="D" title="Fold the day to what is next." demo={<FocusDemo />}>
            When a day is full, Focus keeps what is happening and the next three in view, and folds the rest behind one
            line that counts it. Next up sits at the top of Today either way.
          </Movement>

          <Movement
            mark="E"
            title="Step back to the month."
            wide
            demo={<MonthDemo days={monthGrid(month)} month={month} title={formatMonthHeading(month)} />}
          >
            The Week and the Month show the same items further out. Rest on a day, or walk the grid with the arrow keys,
            and its items are listed beside it.
          </Movement>
        </section>

        <section className={`${siteWrap} ${styles.section}`} aria-labelledby="state-title">
          <h2 id="state-title" className={`${styles.heading} ${styles.reveal}`} data-reveal="">
            What it does today
          </h2>
          <ul className={styles.ledger}>
            {NOW.map((line, i) => (
              <li key={line} className={styles.reveal} data-reveal="" style={vars({ "--i": i % 2 })}>
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className={`${siteWrap} ${styles.section}`} aria-labelledby="data-title">
          <div className={`${styles.close} ${styles.reveal}`} data-reveal="">
            <div className="max-w-[36rem]">
              <h2 id="data-title" className={styles.heading}>
                Yours, and only yours
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                Your email and the items you make are stored with Supabase, where each row can be read only by your
                account. No ads, no analytics, no trackers. The{" "}
                <Link href="/privacy" className="text-ink underline">
                  privacy page
                </Link>{" "}
                says the rest in plain words.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3">
              <Link href="/login" className={primaryAction}>
                Start with today
                <ActionBeam />
              </Link>
              <p className="text-[13px] text-ink-3">{TERMS}</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </PageTurn>
  );
}

/** One part of the story: a rehearsal mark, a title, a few sentences, and the thing itself, working. */
function Movement({
  mark,
  title,
  demo,
  wide = false,
  children,
}: {
  mark: string;
  title: string;
  demo: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const id = `movement-${mark}`;
  return (
    <article className={`${styles.movement} ${wide ? styles.wide : ""}`} aria-labelledby={id}>
      <div className={`${styles.movementText} ${styles.reveal}`} data-reveal="">
        <span className={styles.mark} aria-hidden="true">
          {mark}
        </span>
        <h3 id={id} className={styles.movementTitle}>
          {title}
        </h3>
        <p className={styles.movementBody}>{children}</p>
      </div>
      <div className={`${styles.movementDemo} ${styles.reveal}`} data-reveal="" style={vars({ "--i": 1 })}>
        {demo}
      </div>
    </article>
  );
}
