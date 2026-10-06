import type { ReactNode } from "react";
import { SiteFooter, SiteHeader, siteWrap } from "./site-chrome";
import styles from "./legal.module.css";

/** A fact only the owner can supply. Drawn so it cannot be missed in review. */
export function Blank({ children }: { children: string }) {
  return <mark className={styles.blank}>[{children}]</mark>;
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className={`${siteWrap} pt-8 sm:pt-14`}>
        <article className={styles.article}>
          <div role="note" className={styles.draft}>
            <strong className="font-semibold text-ink">Draft.</strong> This page has not been reviewed by the owner or a
            lawyer, and must be before Axiis opens to the public. Bracketed, highlighted items are blanks to fill in.
          </div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.meta}>
            Effective <Blank>Effective date</Blank>
          </p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
