import type { CSSProperties, ReactNode } from "react";

/** One placeholder stroke, in the press tint, so it reads on paper and at night alike. */
export function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`rounded-[3px] bg-press ${className}`} style={style} />;
}

/** The page frame every skeleton shares: the same padding as the page, a heading and its summary line. */
export function SkeletonFrame({ title = "w-40", children }: { title?: string; children: ReactNode }) {
  return (
    <div role="status" className="px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="animate-breathe">
        <Bone className={`h-9 ${title} max-w-full`} />
        <Bone className="mt-3.5 h-3.5 w-64 max-w-full" />
        {children}
      </div>
    </div>
  );
}

/** Where a page opens on the capture field: a field-sized outline, so the field lands where it was drawn. */
export function CaptureBone() {
  return <div className="mt-6 h-[42px] max-w-[440px] rounded-lg border border-rule-soft" />;
}

/** Shown while a list-shaped page loads: a heading, a summary line and ruled rows, with no staves, so it promises no day. */
export function PageSkeleton({ capture = false }: { capture?: boolean }) {
  return (
    <SkeletonFrame>
      {capture && <CaptureBone />}
      <div className={`${capture ? "mt-9" : "mt-8"} max-w-[760px] border-t border-rule`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-12 items-center gap-3 border-b border-rule-soft">
            <Bone className="h-2.5 w-8" />
            <Bone className="h-2.5" style={{ width: `${58 - i * 7}%` }} />
          </div>
        ))}
      </div>
    </SkeletonFrame>
  );
}
