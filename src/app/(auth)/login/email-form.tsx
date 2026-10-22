"use client";

import { useActionState, useState } from "react";
import { signInWithEmail, type EmailSignInState } from "./actions";
import { TurnstileWidget } from "./turnstile-widget";

const initialState: EmailSignInState = { status: "idle" };

/** Set when the sign-in CAPTCHA is on: the Turnstile site key and this request's nonce for its script. */
export type Captcha = { siteKey: string; nonce?: string };

export function EmailForm({ next, captcha }: { next: string; captcha: Captcha | null }) {
  const [attempt, setAttempt] = useState(0);
  return <EmailFormAttempt key={attempt} next={next} captcha={captcha} onRestart={() => setAttempt((n) => n + 1)} />;
}

function EmailFormAttempt({ next, captcha, onRestart }: { next: string; captcha: Captcha | null; onRestart: () => void }) {
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState);

  if (state.status === "sent") {
    return (
      <div role="status" className="space-y-3">
        <h2 className="font-serif text-xl text-ink">Check your email</h2>
        <p className="text-ink-2">
          We sent a sign-in link to <span className="text-ink">{state.email}</span>. Open it in this browser. It works
          once and expires after a while.
        </p>
        <button type="button" onClick={onRestart} className="text-accent underline underline-offset-4">
          Use a different email
        </button>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : null;
  const email = state.status === "error" ? state.email : "";
  return (
    <form action={formAction} noValidate className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="block text-sm text-ink-2">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={email}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "email-error" : undefined}
        className="w-full rounded-md border border-rule bg-sheet px-3 py-2 text-ink"
      />
      {captcha && <TurnstileWidget siteKey={captcha.siteKey} nonce={captcha.nonce} attempt={state} />}
      {error && (
        <p id="email-error" role="alert" className="text-sm text-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 text-on-accent disabled:opacity-60"
      >
        {pending ? "Sending link" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
