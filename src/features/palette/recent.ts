import { PLACES } from "@/components/shell/places";

/** A page this browser opened lately that is not one of the places: a day, a week, a month, a note or a tag. */
export type Visit = { href: string; title: string };

export const RECENT_MAX = 4;
/** Where the visits are kept, per browser. Only the palette reads them, and only once it is open, so nothing server-drawn depends on them. */
export const RECENT_KEY = "axiis-recent";

const SITE_SUFFIX = / · Axiis$/;
const NOT_REMEMBERED = /^\/(search|settings|dev)(\/|$)/;

/** Whether a path is worth offering again: a place is always in Go to already, and search or settings are not somewhere you were. */
export function worthRemembering(pathname: string): boolean {
  return !NOT_REMEMBERED.test(pathname) && !PLACES.some((p) => p.href === pathname);
}

/** The page's own title, without the site's name. */
export function visitTitle(documentTitle: string): string {
  return documentTitle.replace(SITE_SUFFIX, "").trim();
}

/** The list with `visit` first, any older visit to the same page dropped, at most RECENT_MAX long. */
export function remember(list: readonly Visit[], visit: Visit): Visit[] {
  return [visit, ...list.filter((v) => v.href !== visit.href)].slice(0, RECENT_MAX);
}

/** Reads what was stored, keeping only well-formed visits to paths in this app. Anything else reads as nothing. */
export function parseVisits(raw: string | null): Visit[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is Visit =>
          typeof v === "object" && v !== null && typeof v.href === "string" && v.href.startsWith("/") && !v.href.startsWith("//") && typeof v.title === "string" && v.title !== "",
      )
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}
