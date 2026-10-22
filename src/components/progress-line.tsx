/**
 * Progress in line form: the part still to do is dashed, like anything
 * planned, and the part done is solid. Decorative, since the words beside it
 * say the same. Width and colour come from the caller.
 */
export function ProgressLine({ share, className = "w-20" }: { share: number; className?: string }) {
  return (
    <span aria-hidden="true" data-progress={Math.round(share * 100)} className={`relative block h-0.5 flex-none ${className}`}>
      <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-current opacity-60" />
      <span className="absolute inset-y-0 left-0 rounded-full bg-current" style={{ width: `${share * 100}%` }} />
    </span>
  );
}
