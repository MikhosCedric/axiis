import { TITLE_MAX } from "./model";

/*
 * Words handed to the capture field from outside: the home-screen shortcut and the share menu (the manifest's
 * `share_target`). They arrive in the address, so they are treated as untrusted: plain text only, one line,
 * capped, and put in the field for a person to read and save. Nothing here saves anything.
 */

/** The query parameter that carries them to the page with the field. Present and empty: only focus the field. */
export const CAPTURE_PARAM = "capture";

/** Most characters taken from each shared part, so one long page title cannot crowd out the link. */
const PART_MAX = 300;

type Raw = string | string[] | undefined;
const first = (v: Raw) => (Array.isArray(v) ? v[0] : v) ?? "";

/** One line of plain text: control and format characters (newlines included) become spaces, runs of space collapse, then cut to `max` characters. */
export function plainLine(raw: string, max: number): string {
  const line = raw.replace(/[\p{C}\p{Zl}\p{Zp}]+/gu, " ").replace(/\s+/g, " ").trim();
  // By code point, so a cut never splits an emoji in two.
  return Array.from(line).slice(0, max).join("").trim();
}

/** The link as written when it is an http or https address, otherwise nothing. */
function webLink(raw: string): string {
  try {
    const url = new URL(plainLine(raw, 2048));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * What a share becomes in the capture field: its title, its text and its link, each once, on one line.
 * Browsers often repeat the link inside the text, so a part already said is left out.
 */
export function sharedCapture(query: { title?: Raw; text?: Raw; url?: Raw }): string {
  const parts: string[] = [];
  for (const part of [plainLine(first(query.title), PART_MAX), plainLine(first(query.text), PART_MAX), webLink(first(query.url))]) {
    if (part && !parts.some((p) => p.includes(part))) parts.push(part);
  }
  return plainLine(parts.join(" "), TITLE_MAX);
}

/** What the page puts in the field for `?capture=`, checked again on the client: plain, one line, within the title limit. */
export function readPrefill(raw: Raw): string | null {
  if (raw === undefined) return null;
  return plainLine(first(raw), TITLE_MAX);
}
