import { PAPER_LIGHT } from "@/lib/theme-colors";

export const INK = "#1c1b22";
export const ACCENT = "#0a675a";

/**
 * The crossing-axes mark as an image-generation element (the same drawing as `src/app/icon.svg`, with
 * the colours as attributes because the image renderer does not read a stylesheet). `tile` paints the paper square behind it.
 */
export function BrandMark({ size, tile = true }: { size: number; tile?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {tile && <rect width="32" height="32" fill={PAPER_LIGHT} />}
      <g stroke={INK} strokeLinecap="round">
        <path d="M5 20.5h22M12 5v22" strokeWidth="2.75" />
        <path d="M19.5 16v9M24.5 16v9" strokeWidth="2.25" />
      </g>
      <circle cx="12" cy="20.5" r="3.75" fill={ACCENT} />
    </svg>
  );
}
