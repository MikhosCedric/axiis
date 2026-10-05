import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth/next-path";
import { signInWithGoogle } from "./actions";
import { EmailForm } from "./email-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Ask for a new one below.",
  google: "Google sign-in did not go through. Try again, or use your email.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const error = ERRORS[first(params.error) ?? ""];

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-paper px-6 py-16 font-sans">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl text-ink">Sign in to Axiis</h1>
          <p className="text-ink-2">Use your email or your Google account. There is no password to remember.</p>
        </header>

        {error && (
          <p role="alert" className="rounded-md border border-rule bg-paper-2 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}

        <EmailForm next={next} />

        <div className="flex items-center gap-3 text-sm text-ink-3" aria-hidden="true">
          <span className="h-px flex-1 bg-rule" />
          or
          <span className="h-px flex-1 bg-rule" />
        </div>

        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="w-full rounded-md border border-rule bg-sheet px-4 py-2 text-ink">
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
