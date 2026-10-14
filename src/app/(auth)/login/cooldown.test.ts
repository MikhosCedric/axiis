import { describe, expect, it } from "vitest";
import { EMAIL_WAIT_SECONDS, secondsToWait, startWait, waitMessage } from "./cooldown";

const NOW = new Date("2026-10-14T09:00:00Z");
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe("the wait between sign-in emails", () => {
  it("starts with a cookie only the server reads, that expires when the wait does", () => {
    const cookie = startWait(NOW);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: EMAIL_WAIT_SECONDS });
    expect(secondsToWait(cookie.value, NOW)).toBe(EMAIL_WAIT_SECONDS);
  });

  it("counts down in whole seconds and ends", () => {
    const { value } = startWait(NOW);
    expect(secondsToWait(value, later(0.5))).toBe(EMAIL_WAIT_SECONDS);
    expect(secondsToWait(value, later(EMAIL_WAIT_SECONDS - 1))).toBe(1);
    expect(secondsToWait(value, later(EMAIL_WAIT_SECONDS))).toBe(0);
    expect(secondsToWait(value, later(3600))).toBe(0);
  });

  it("does not wait on a missing or malformed cookie, and never longer than the wait", () => {
    for (const bad of [undefined, "", "soon", "1e400", "12.5", "NaN"]) expect(secondsToWait(bad, NOW)).toBe(0);
    expect(secondsToWait(String(later(86400).getTime()), NOW)).toBe(EMAIL_WAIT_SECONDS);
  });

  it("says how long to wait", () => {
    expect(waitMessage(1)).toBe("We just sent a sign-in link. Check your inbox, or wait 1 second to send another.");
    expect(waitMessage(12)).toMatch(/wait 12 seconds/);
  });
});
