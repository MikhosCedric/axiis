/** Cloudflare Turnstile, the CAPTCHA Supabase Auth verifies on email sign-in. Off unless a site key is set. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const TURNSTILE_SCRIPT = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
/** The hidden field the widget adds to its form. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/** The site key, or null when CAPTCHA is off. Read by its full literal name so Next inlines it. */
export function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}
