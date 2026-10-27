import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import { BrandMark } from "@/components/shell/icons";
import { DayNight } from "./day-night";
import { PublicMotion } from "./motion";
import styles from "./site-chrome.module.css";

export const primaryAction = styles.primary;

export const quietAction = styles.quiet;

/** A text link whose underline is drawn in under the pointer or focus. */
export const drawnLink = styles.drawn;

/** The public column: between the gutters (`--gutter`), up to `--content-max`, centred. */
export const siteWrap = styles.wrap;

/** The beam inside the primary action: dashed at rest, solid under the pointer, as a planned item turns live. */
export function ActionBeam() {
  return <span className={styles.actionBeam} aria-hidden="true" />;
}

/** The arrow after a quiet in-page link, pointing down the page to where it goes. */
export function DownArrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      ↓
    </span>
  );
}

/**
 * The mark and the name, as a link home. One element across the public pages and sign in, so a change
 * of page moves it from where it was to where it is (a named view transition) instead of redrawing it.
 */
export function BrandHome({ className = "" }: { className?: string }) {
  return (
    <ViewTransition name="brand-mark" share="brand" default="none">
      <Link href="/" className={`flex w-fit items-center gap-2.5 rounded-sm text-ink no-underline ${className}`}>
        <BrandMark />
        <span className="font-serif text-[22px] leading-none font-semibold tracking-[-0.01em]">Axiis</span>
      </Link>
    </ViewTransition>
  );
}

/** A public page's body: it turns like a page when the address changes. */
export function PageTurn({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="public-in" exit="public-out" default="none">
      <div className={styles.page}>
        <PublicMotion />
        {children}
      </div>
    </ViewTransition>
  );
}

/** A part of the page the header can jump to: its address, its letter, and the name said with the letter. */
export type Contents = readonly { id: string; letter: string; name: string }[];

/**
 * The movements' letters as links. Script marks the one being read (`aria-current`) and sets `--at`, which
 * slides the ink tab under it; with no movement on screen the tab is put away (`data-none`).
 */
export function SectionLetters({
  contents,
  label,
  className = styles.letters,
  linkClassName = styles.letter,
  nameClassName = "sr-only",
}: {
  contents: Contents;
  label: string;
  className?: string;
  linkClassName?: string;
  nameClassName?: string;
}) {
  return (
    <nav aria-label={label} className={className} data-sections="" data-none="">
      <span className={styles.indicator} aria-hidden="true" />
      {contents.map((c) => (
        <a key={c.id} href={`#${c.id}`} className={linkClassName} title={c.name}>
          {c.letter}
          <span className={nameClassName}> {c.name}</span>
        </a>
      ))}
    </nav>
  );
}

export function SiteHeader({ contents }: { contents?: Contents }) {
  return (
    <header className={styles.bar}>
      <div className={`${siteWrap} ${styles.barRow}`}>
        <span className={styles.pill} aria-hidden="true" />
        <BrandHome />
        {contents && <SectionLetters contents={contents} label="Movements" />}
        <div className={styles.ends}>
          <DayNight />
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium text-ink">
            <span className={styles.drawn}>Sign in</span>
          </Link>
        </div>
        <span className={styles.progress} aria-hidden="true" />
      </div>
    </header>
  );
}

const FOOTER_LINKS = [
  {
    head: "Axiis",
    links: [
      { href: "/", label: "Home" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    head: "The fine print",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

/** The last bar of the page: a closing double barline over the name, what it is, and where else to go. */
export function SiteFooter() {
  return (
    <footer className={`${styles.footer} mt-auto`} data-loop="">
      <span className={styles.sweep} aria-hidden="true" />
      <div className={styles.finalBar} aria-hidden="true" />
      <div className={siteWrap}>
        <div className="grid gap-x-16 gap-y-8 py-10 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-[30rem]">
            <span className="font-serif text-[22px] font-semibold tracking-[-0.01em] text-ink">Axiis</span>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Tasks and time, on one page. Free, with no ads, no analytics and no trackers. Export everything, or
              delete your account, from Settings.
            </p>
          </div>
          <nav aria-label="Site" className="flex gap-12">
            {FOOTER_LINKS.map((group) => (
              <div key={group.head}>
                <p id={`footer-${group.links[0].label}`} className="text-[12px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                  {group.head}
                </p>
                <ul className="mt-2" aria-labelledby={`footer-${group.links[0].label}`}>
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className={styles.footerLink}>
                        <span className={styles.drawn}>{l.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
