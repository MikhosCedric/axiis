"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

export type EmailSignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

const emailSchema = z.email();

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: await callbackUrl(formData) },
  });
  if (error) {
    return {
      status: "error",
      message:
        error.status === 429
          ? "Too many sign-in emails in a short time. Wait a minute and try again."
          : "We could not send the link just now. Try again in a moment.",
      email: parsed.data,
    };
  }
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
