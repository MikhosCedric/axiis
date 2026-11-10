import { sameTag } from "@/domain/tag";
import { forget, moveVisit, type Visit } from "@/features/palette/recent";
import { changeVisits, forgetSavedPage } from "@/features/palette/recent-store";
import { tagFromSegment, tagHref, TAGS_PATH } from "./model";

/** Whether a path is the page of the tag `name`, however its name was cased or encoded in the address. */
export function isTagPage(path: string, name: string): boolean {
  const prefix = `${TAGS_PATH}/`;
  if (!path.startsWith(prefix)) return false;
  const segment = path.slice(prefix.length);
  return !segment.includes("/") && sameTag(tagFromSegment(segment), name);
}

/** The palette's Recent after a tag is deleted: its page is gone, so it is not offered again. */
export function visitsAfterDelete(list: readonly Visit[], name: string): Visit[] {
  return forget(list, (path) => isTagPage(path, name));
}

/** The palette's Recent after a tag is renamed: a visit to its page now leads to the page under its new name. */
export function visitsAfterRename(list: readonly Visit[], from: string, to: string): Visit[] {
  return moveVisit(list, (path) => isTagPage(path, from), { href: tagHref(to), title: `#${to}` });
}

// Browser only: what this browser keeps about a tag's page outside the server, corrected after a change.

export function tagDeleted(name: string): void {
  changeVisits((list) => visitsAfterDelete(list, name));
  forgetSavedPage(tagHref(name));
}

/** After `from` is merged into `to`: a visit to `from`'s page leads to `to`'s, and both saved copies are stale. */
export function tagMerged(from: string, to: string): void {
  changeVisits((list) => visitsAfterRename(list, from, to));
  forgetSavedPage(tagHref(from));
  forgetSavedPage(tagHref(to));
}

export function tagRenamed(from: string, to: string): void {
  changeVisits((list) => visitsAfterRename(list, from, to));
  forgetSavedPage(tagHref(from));
}
