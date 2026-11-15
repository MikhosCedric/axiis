import type { ReactNode } from "react";
import { PageTurn, SiteFooter, SiteHeader, siteWrap } from "./site-chrome";
import styles from "./legal.module.css";

/** A public page of plain information: the site chrome, a title and a prose column. Same measure as the legal pages, with no draft note. */
export function InfoPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <PageTurn>
      <SiteHeader />
      <main id="main" className={`${siteWrap} pt-8 sm:pt-14`}>
        <article className={styles.article}>
          <header className={styles.head}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.meta}>{lead}</p>
          </header>
          <div className={styles.prose}>{children}</div>
        </article>
      </main>
      <SiteFooter />
    </PageTurn>
  );
}

/** A key as it is drawn on a keycap. */
export function Cap({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-rule px-1.5 font-sans text-xs font-semibold text-ink-2">{children}</kbd>;
}
