import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import { BrandMark } from "@/components/shell/icons";
import { DayNight } from "./day-night";
import { PublicMotion } from "./motion";
import styles from "./site-chrome.module.css";

export const primaryAction = styles.primary;

export const quietAction = styles.quiet;

/** The public pages run the width of the window, inside a margin that grows with it (`--gutter`). */
export const siteWrap = "w-full px-(--gutter)";

/** The beam inside the primary action: dashed at rest, solid under the pointer, as a planned item turns live. */
export function ActionBeam() {
  return <span className={styles.actionBeam} aria-hidden="true" />;
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
      <div className="flex min-h-dvh flex-col">
        <PublicMotion />
        {children}
      </div>
    </ViewTransition>
  );
}

export function SiteHeader() {
  return (
    <header className={`${siteWrap} relative z-10 flex items-center justify-between gap-4 py-5`}>
      <BrandHome />
      <div className="flex items-center gap-1.5">
        <DayNight />
        <Link href="/login" className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
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
    <footer className={`${styles.footer} mt-auto`}>
      <div className={styles.finalBar} aria-hidden="true" data-loop="">
        <span className={styles.sweep} />
      </div>
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
                        {l.label}
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
