"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, turnstileSiteKey } from "@/lib/turnstile";
import { EMAIL_WAIT_COOKIE, secondsToWait, startWait, waitMessage } from "./cooldown";

export type EmailSignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

const emailSchema = z.email();

const CHECK_NOT_DONE = "The check that you are a person has not finished. Wait a moment, then send the link again.";

function sendFailure(error: { status?: number; code?: string }): string {
  if (error.code === "captcha_failed") return "The check that you are a person did not pass or has expired. Try again.";
  if (error.status === 429) return "Too many sign-in emails in a short time. Wait a minute and try again.";
  return "We could not send the link just now. Try again in a moment.";
}

/** Next rejects Server Function calls whose Origin does not match the host, so this header is trustworthy here. */
async function callbackUrl(formData: FormData): Promise<string> {
  const origin = (await headers()).get("origin");
  if (!origin) throw new Error("Server Function request arrived without an Origin header");
  const next = safeNextPath(formData.get("next")?.toString());
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithEmail(_prev: EmailSignInState, formData: FormData): Promise<EmailSignInState> {
  const submitted = formData.get("email")?.toString().trim() ?? "";
  const parsed = emailSchema.safeParse(submitted);
  if (!parsed.success) return { status: "error", message: "Enter an email address like name@example.com.", email: submitted };

  const jar = await cookies();
  const wait = secondsToWait(jar.get(EMAIL_WAIT_COOKIE)?.value, new Date());
  if (wait > 0) return { status: "error", message: waitMessage(wait), email: parsed.data };

  // With a site key set, Supabase Auth refuses a sign-in without a Turnstile token, so a missing one stops here.
  const captchaToken = turnstileSiteKey() === null ? undefined : (formData.get(TURNSTILE_FIELD)?.toString() ?? "");
  if (captchaToken === "") return { status: "error", message: CHECK_NOT_DONE, email: parsed.data };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: await callbackUrl(formData), ...(captchaToken ? { captchaToken } : {}) },
  });
  if (error) return { status: "error", message: sendFailure(error), email: parsed.data };
  jar.set(startWait(new Date()));
  return { status: "sent", email: parsed.data };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(formData) },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}
