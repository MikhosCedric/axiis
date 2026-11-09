import type { Metadata } from "next";
import { headers } from "next/headers";
import { BrandHome, PageTurn, quietAction } from "@/components/public/site-chrome";
import { safeNextPath } from "@/lib/auth/next-path";
import { turnstileSiteKey } from "@/lib/turnstile";
import { signInWithGoogle } from "./actions";
import { EmailForm } from "./email-form";
import { loginError } from "./errors";
import styles from "./login.module.css";
import { SignInStage, SignInStrip } from "./stage";

export const metadata: Metadata = { title: "Sign in" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const error = loginError(first(params.error));
  const deleted = first(params.deleted) === "1";
  const siteKey = turnstileSiteKey();
  const captcha = siteKey ? { siteKey, nonce: (await headers()).get("x-nonce") ?? undefined } : null;

  return (
    <PageTurn>
    <main id="main" className={styles.page}>
      <SignInStage />
      <div className={styles.column}>
      <div className={styles.strip}>
        <SignInStrip />
      </div>
      <div className={`surface ${styles.sheet}`}>
        <header className={`${styles.header} ${styles.rise}`} style={{ "--i": 0 } as React.CSSProperties}>
          <BrandHome className="mb-8" />
          <h1 className="font-display text-3xl text-ink">Sign in to Axiis</h1>
          <p className="text-ink-2">Use your email or your Google account. There is no password to remember.</p>
          <p className="text-ink-2">New here? The same link makes your account.</p>
        </header>
        <span className={styles.barline} aria-hidden="true" />

        {deleted && (
          <p role="status" className="rounded-md border border-rule bg-paper-2 px-3 py-2 text-sm text-ink">
            Your account and its data are gone.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-rule bg-paper-2 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}

        <div className={styles.rise} style={{ "--i": 2 } as React.CSSProperties}>
          <EmailForm next={next} captcha={captcha} />
        </div>

        <div className={`flex items-center gap-3 text-sm text-ink-3 ${styles.rise}`} style={{ "--i": 3 } as React.CSSProperties} aria-hidden="true">
          <span className="h-px flex-1 bg-rule" />
          or
          <span className="h-px flex-1 bg-rule" />
        </div>

        <form action={signInWithGoogle} className={styles.rise} style={{ "--i": 4 } as React.CSSProperties}>
          <input type="hidden" name="next" value={next} />
          <button type="submit" className={`${quietAction} w-full`}>
            Continue with Google
          </button>
        </form>
      </div>
      </div>
    </main>
    </PageTurn>
  );
}
