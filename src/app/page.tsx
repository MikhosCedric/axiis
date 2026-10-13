import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader, primaryAction, quietAction, siteWrap } from "@/components/public/site-chrome";
import { Glyph } from "@/features/today/glyph";
import { SampleScore } from "@/features/landing/sample-score";
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

const NOW = [
  "Today and any other day, one step or one date away",
  "Drag a task onto a line to give it a time; drag its end to change how long",
  "The same moves from the keyboard",
  "Subtasks, counted on the beam they belong to",
  "Tasks that repeat daily, on weekdays, weekly, monthly or yearly",
  "An inbox of everything captured and not yet planned",
  "Checklists gathered in one place, each with how many lines are done",
  "Tags on any item, with a page for each tag",
  "A list view of the same day",
  "A week view, with items dragged from one day to another",
  "Notes that link to tasks, and search across both",
  "A command palette, on Ctrl or Cmd K, to find anything or go anywhere",
  "Export all your data, or delete your account, from settings",
  "Light and dark",
];

export default async function Home() {
  if (await getFakeAccount()) redirect("/today");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/today");

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section
          className={`${siteWrap} grid gap-x-16 pt-10 pb-14 sm:pt-16 sm:pb-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end`}
          aria-labelledby="hero-title"
        >
          <h1 id="hero-title" className={styles.display}>
            Your tasks and your time, on one page.
          </h1>
          <div>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2 sm:text-lg lg:mt-0">
              Axiis is one place for the things you have to do and the hours you have to do them in. Work, home and
              health each get a line. One hour axis runs across all of them, so the whole day reads at a glance.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className={primaryAction}>
                Start with today
              </Link>
              <a href="#how" className={quietAction}>
                How it works
              </a>
            </div>
            <p className="mt-3 text-[13px] text-ink-3">{TERMS}</p>
          </div>
        </section>

        <div className={siteWrap}>
          <SampleScore />
        </div>

        <section id="how" className={`${siteWrap} mt-24 scroll-mt-6 sm:mt-32`} aria-labelledby="how-title">
          <h2 id="how-title" className={styles.heading}>
            How it works
          </h2>
          <ol className={styles.measures}>
            <li className={styles.measure}>
              <h3 className={styles.measureTitle}>Capture</h3>
              <p className={styles.measureText}>
                Type a title and press Enter. That is all it asks. The item waits under the day until you decide
                when it happens.
              </p>
              <div className={styles.figure} aria-hidden="true">
                <span className={styles.miniChip}>
                  <Glyph type="task" state="planned" className={styles.chipGlyph} />
                  Renew passport
                </span>
              </div>
            </li>
            <li className={styles.measure}>
              <h3 className={styles.measureTitle}>Give it a time</h3>
              <p className={styles.measureText}>
                Drag it onto a line. Where you let go is when it starts; pull its end to say how long it takes. The
                rest of the day stays in view while you do it.
              </p>
              <div className={styles.figure} aria-hidden="true">
                <span className={styles.miniStaff}>
                  <span className={styles.ghost}>
                    <span className={`${styles.ghostTip} tabular`}>14:00 to 15:30</span>
                  </span>
                </span>
              </div>
            </li>
            <li className={styles.measure}>
              <h3 className={styles.measureTitle}>See how it connects</h3>
              <p className={styles.measureText}>
                Break a task into subtasks and its beam keeps count. Open any item to see what it carries, and the
                notes linked to it.
              </p>
              <div className={styles.figure} aria-hidden="true">
                <span className={styles.miniStaff}>
                  <span className={styles.miniBeam}>
                    <span className={styles.miniLabel}>
                      Plan next week <span className="font-normal text-ink-2 tabular">1/4</span>
                    </span>
                    <Glyph type="task" state="planned" className={styles.miniGlyph} />
                  </span>
                </span>
              </div>
            </li>
          </ol>
        </section>

        <section className={`${siteWrap} mt-24 sm:mt-32`} aria-labelledby="state-title">
          <h2 id="state-title" className={styles.heading}>
            What it does today
          </h2>
          <ul className={styles.ledger}>
            {NOW.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className={`${siteWrap} mt-24 sm:mt-32`} aria-labelledby="data-title">
          <div className={styles.close}>
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
              </Link>
              <p className="text-[13px] text-ink-3">{TERMS}</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
