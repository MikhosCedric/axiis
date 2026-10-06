import Link from "next/link";

/** Tells a tray that its items are the Inbox's, so the two places read as one pile. */
export function SameInInbox() {
  return (
    <>
      The same items are in the{" "}
      <Link href="/inbox" className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
        Inbox
      </Link>
      .
    </>
  );
}
