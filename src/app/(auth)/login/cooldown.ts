/**
 * A short wait between sign-in emails from one browser, so a held-down button or
 * a reload loop cannot keep Supabase sending. The cookie holds the time the wait
 * ends. It is not signed because it guards nothing: a script that drops it only
 * meets Supabase's own limits and the Vercel firewall (docs/launch-checklist.md).
 */
export const EMAIL_WAIT_COOKIE = "email-wait";
export const EMAIL_WAIT_SECONDS = 30;

/** Whole seconds left to wait, or 0 when the cookie is missing, malformed or past. */
export function secondsToWait(cookie: string | undefined, now: Date): number {
  const until = Number(cookie);
  if (!cookie || !Number.isSafeInteger(until)) return 0;
  const left = Math.ceil((until - now.getTime()) / 1000);
  return left > 0 ? Math.min(left, EMAIL_WAIT_SECONDS) : 0;
}

export const waitMessage = (seconds: number) =>
  `We just sent a sign-in link. Check your inbox, or wait ${seconds} ${seconds === 1 ? "second" : "seconds"} to send another.`;

/** The cookie that starts the wait after a link is sent. */
export function startWait(now: Date) {
  return {
    name: EMAIL_WAIT_COOKIE,
    value: String(now.getTime() + EMAIL_WAIT_SECONDS * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: EMAIL_WAIT_SECONDS,
  };
}
