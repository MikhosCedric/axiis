/** The words a websearch-style query looks for: quotes dropped, `-excluded` words and `or` ignored. */
export function queryTerms(query: string): string[] {
  return query
    .replace(/"/g, " ")
    .split(/\s+/)
    .filter((w) => w && !w.startsWith("-") && w.toLowerCase() !== "or")
    .map((w) => w.toLowerCase());
}

/**
 * A short stretch of `text` around the first place a query word appears, so a
 * result shows why it matched. Falls back to the start of the text when the
 * match was in the title.
 */
export function snippetFor(text: string, query: string, width = 160): string {
  const flat = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ");
  if (flat.length <= width) return flat;
  const lower = flat.toLowerCase();
  const hits = queryTerms(query)
    .map((t) => lower.indexOf(t))
    .filter((i) => i >= 0);
  const at = hits.length > 0 ? Math.min(...hits) : 0;

  let start = Math.max(0, at - Math.floor(width / 4));
  if (start > 0) {
    const space = flat.indexOf(" ", start);
    start = space >= 0 && space < at ? space + 1 : start;
  }
  let end = Math.min(flat.length, start + width);
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    end = space > Math.max(start, at) ? space : end;
  }
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}
