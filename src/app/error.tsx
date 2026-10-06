"use client";

import Link from "next/link";
import { Fault } from "@/components/public/fault";
import { primaryAction, quietAction } from "@/components/public/site-chrome";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Fault
      title="This page did not load."
      actions={
        <>
          <button type="button" onClick={() => retry()} className={`${primaryAction} cursor-pointer`}>
            Try again
          </button>
          <Link href="/" className={quietAction}>
            Back to Axiis
          </Link>
        </>
      }
    >
      <p>Something went wrong on our side. Trying again usually sorts it out.</p>
    </Fault>
  );
}
