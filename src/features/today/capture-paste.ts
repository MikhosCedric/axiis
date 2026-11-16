/** The most lines one paste is offered as separate items, or as a checklist and its lines. */
export const PASTE_MAX = 30;

/** A list marker a pasted line may open with: "- ", "* ", "• ", "1. ", "2) ", "[ ] ", "- [x] ". */
const MARKER = /^(?:[-*•–]\s+)?(?:\[[ xX]?\]\s+|\d{1,3}[.)]\s+)?/;

/**
 * The lines of a pasted block, each trimmed and without its list marker, blank
 * ones dropped. Null when the paste is one line, or more than `PASTE_MAX`: it
 * is then pasted as it always was.
 */
export function pastedLines(text: string): string[] | null {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim().replace(MARKER, "").trim())
    .filter((line) => line !== "");
  return lines.length >= 2 && lines.length <= PASTE_MAX ? lines : null;
}

/** A pasted block as the one line a plain paste makes of it. */
export function oneLine(text: string): string {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join(" ");
}

/** A name short enough to sit on a button, cut on a word where it can be. */
export function shortName(name: string, max = 28): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
