import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers({ origin: "https://axiis.test" }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithOtp } }) }));

const { signInWithEmail } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const send = (fields: Record<string, string>) => signInWithEmail({ status: "idle" }, form({ next: "/today", ...fields }));

beforeEach(() => {
  signInWithOtp.mockReset();
  signInWithOtp.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signInWithEmail with no Turnstile site key", () => {
  it("sends the link without a captcha token, even when the form carries one", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(await send({ email: "ana@example.com", "cf-turnstile-response": "stray" })).toEqual({
      status: "sent",
      email: "ana@example.com",
    });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ana@example.com",
      options: { emailRedirectTo: "https://axiis.test/auth/callback?next=%2Ftoday" },
    });
  });
});

describe("signInWithEmail with a Turnstile site key", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "0x4AAAAAAAtestkey"));

  it("passes the widget's token to Supabase as captchaToken", async () => {
    expect((await send({ email: "ana@example.com", "cf-turnstile-response": "tok-1" })).status).toBe("sent");
    expect(signInWithOtp.mock.calls[0][0].options.captchaToken).toBe("tok-1");
  });

  it("asks the person to wait, and calls nobody, when the check has not finished", async () => {
    const state = await send({ email: "ana@example.com" });
    expect(state).toMatchObject({ status: "error", email: "ana@example.com" });
    expect(state.status === "error" && state.message).toMatch(/has not finished/);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("says plainly that the check failed or expired when Supabase refuses the token", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 400, code: "captcha_failed", message: "captcha protection: request disallowed" } });
    const state = await send({ email: "ana@example.com", "cf-turnstile-response": "old" });
    expect(state.status === "error" && state.message).toBe("The check that you are a person did not pass or has expired. Try again.");
  });
});
