import type { Metadata } from "next";
import Link from "next/link";
import { Fault } from "@/components/public/fault";
import { primaryAction } from "@/components/public/site-chrome";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <Fault
      title="There is nothing at this address."
      actions={
        <Link href="/" className={primaryAction}>
          Back to Axiis
        </Link>
      }
    >
      <p>The link may be old, or the address mistyped. Your items are where you left them.</p>
    </Fault>
  );
}
