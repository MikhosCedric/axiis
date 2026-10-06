/** Shown while a day loads: the shape of the day heading and the staves, drawn in hairlines, so nothing jumps when the real page lands. */
export default function Loading() {
  return (
    <div role="status" className="px-4 py-6 rail:px-8 rail:py-8">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="h-9 w-56 rounded bg-paper-2" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-paper-2" />
        <div className="mt-8 border-y border-rule">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-[88px] border-b border-rule-soft last:border-b-0">
              <div className="w-[120px] flex-none border-r border-rule-soft" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
