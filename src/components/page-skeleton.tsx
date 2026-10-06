/** Shown while a list-shaped page loads: a heading, a summary line and ruled rows, with no staves, so it promises no day. */
export function PageSkeleton() {
  return (
    <div role="status" className="px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="max-w-[760px] animate-pulse motion-reduce:animate-none">
        <div className="h-9 w-40 rounded bg-paper-2" />
        <div className="mt-3 h-4 w-64 max-w-full rounded bg-paper-2" />
        <div className="mt-8 border-t border-rule">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-12 items-center gap-3 border-b border-rule-soft">
              <div className="h-3 w-8 rounded bg-paper-2" />
              <div className="h-3 rounded bg-paper-2" style={{ width: `${60 - i * 7}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
