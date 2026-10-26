import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/icons";

/** The quiet full-page message behind not-found and error boundaries. Never shows error details. */
export function Fault({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh w-full flex-col px-(--gutter) py-6">
      <div className="flex items-center gap-2.5 text-ink">
        <BrandMark />
        <span className="font-serif text-[22px] leading-none font-semibold tracking-[-0.01em]">Axiis</span>
      </div>
      <div className="flex flex-1 flex-col justify-center py-16">
        <div className="max-w-[30rem] border-t border-rule pt-8">
          <h1 className="font-serif text-[clamp(2rem,1.5rem+2vw,2.75rem)] leading-[1.08] font-medium tracking-[-0.02em] text-balance">
            {title}
          </h1>
          <div className="mt-4 text-base leading-relaxed text-ink-2">{children}</div>
          <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
        </div>
      </div>
    </main>
  );
}
