import Link from "next/link";
import { BrandMark } from "@/components/shell/icons";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export const primaryAction =
  "inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition-[background-color] duration-150 hover:bg-[color-mix(in_oklab,var(--accent)_86%,var(--ink))]";

export const quietAction =
  "inline-flex items-center justify-center rounded-md border border-rule px-5 py-3 text-[15px] font-medium text-ink transition-[border-color] duration-150 hover:border-field";

export const siteWrap = "mx-auto w-full max-w-[1180px] px-4 sm:px-8";

export function SiteHeader() {
  return (
    <header className={`${siteWrap} flex items-center justify-between gap-4 py-5`}>
      <Link href="/" className="flex items-center gap-2.5 rounded-sm text-ink no-underline">
        <BrandMark />
        <span className="font-serif text-[22px] leading-none font-semibold tracking-[-0.01em]">Axiis</span>
      </Link>
      <div className="flex items-center gap-1.5">
        <ThemeToggle className="flex items-center gap-2 rounded-md px-2.5 py-2 text-ink-2 hover:bg-paper-2 hover:text-ink [&>span]:sr-only" />
        <Link href="/login" className="rounded-md px-3 py-2 font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className={`${siteWrap} flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-8 text-[13px] text-ink-3`}>
        <span className="flex items-center gap-2">
          <span className="font-serif text-[15px] font-semibold text-ink-2">Axiis</span>
          <span>Tasks and time, on one page.</span>
        </span>
        <nav aria-label="Site" className="flex gap-5">
          <Link href="/privacy" className="hover:text-ink hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink hover:underline">
            Terms
          </Link>
          <Link href="/login" className="hover:text-ink hover:underline">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
