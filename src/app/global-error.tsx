"use client";

import { Fault } from "@/components/public/fault";
import { primaryAction, quietAction } from "@/components/public/site-chrome";
import "./globals.css";

/** Replaces the root layout when it fails, so it brings its own document and cannot rely on next/link. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <title>Axiis did not load</title>
        <Fault
          title="Axiis did not load."
          actions={
            <>
              <button type="button" onClick={() => retry()} className={`${primaryAction} cursor-pointer`}>
                Try again
              </button>
              {/* A full page load, since the app shell itself is what failed. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className={quietAction}>
                Back to Axiis
              </a>
            </>
          }
        >
          <p>Something went wrong on our side. Trying again usually sorts it out.</p>
        </Fault>
      </body>
    </html>
  );
}
