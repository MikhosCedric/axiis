import { z } from "zod";

export const SITE_NAME = "Axiis";
export const SITE_DESCRIPTION =
  "One place for your tasks and your time. Each part of your life gets a line, one hour axis runs across them, and the whole day fits on one page.";

const FALLBACK_ORIGIN = "http://localhost:3000";

const siteUrlSchema = z.url({ protocol: /^https?$/ });

/** The public origin used for absolute links in metadata, robots and the sitemap. A blank value means local development. */
export function parseSiteUrl(raw: string | undefined): URL {
  const value = raw?.trim() || FALLBACK_ORIGIN;
  const result = siteUrlSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be an http or https URL such as https://axiis.app, got "${value}".`);
  }
  return new URL(new URL(result.data).origin);
}

export const siteUrl = parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
