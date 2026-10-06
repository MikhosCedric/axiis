/** How well a query matches a text: a prefix beats a substring, which beats a subsequence. Lower is better. */
export type MatchTier = 0 | 1 | 2;

export const fold = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function isSubsequence(query: string, text: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

/** The tier `query` matches `text` at, ignoring case and extra spaces, or null when it does not match. An empty query matches everything as a prefix. */
export function matchTier(query: string, text: string): MatchTier | null {
  const q = fold(query);
  const t = fold(text);
  if (t.startsWith(q)) return 0;
  if (t.includes(q)) return 1;
  if (isSubsequence(q.replace(/ /g, ""), t)) return 2;
  return null;
}

/** The entries that match, best tier first. Entries on the same tier keep their given order. */
export function rank<T>(entries: readonly T[], query: string, textsOf: (entry: T) => readonly string[]): T[] {
  const scored: { entry: T; tier: MatchTier }[] = [];
  for (const entry of entries) {
    const tiers = textsOf(entry)
      .map((t) => matchTier(query, t))
      .filter((t) => t !== null);
    if (tiers.length) scored.push({ entry, tier: Math.min(...tiers) as MatchTier });
  }
  return scored.sort((a, b) => a.tier - b.tier).map((s) => s.entry);
}
