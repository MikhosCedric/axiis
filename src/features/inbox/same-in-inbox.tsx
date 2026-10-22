import Link from "next/link";

/** Ends a tray's line with the way to the Inbox page, where the same items can be planned for any day. */
export function SameInInbox() {
  return (
    <Link href="/inbox" className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
      Open the Inbox
    </Link>
  );
}
