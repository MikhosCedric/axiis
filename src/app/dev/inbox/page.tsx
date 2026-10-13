import { devHarnessEnabled } from "@/lib/dev-harness";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadInbox } from "@/features/inbox/commands";
import { fakeRepo, tagByTitle } from "@/features/today/test-support";
import { resolveTimeZone } from "@/lib/dates";
import { INBOX_TAGS, seedInbox } from "./fixture";
import { InboxHarness } from "./harness";

export const metadata: Metadata = { title: "Inbox harness" };

/** Dev-only page that renders the inbox from fixture data. `?empty` starts with nothing waiting, `?tz=` picks the zone. */
export default async function InboxHarnessPage({ searchParams }: PageProps<"/dev/inbox">) {
  if (!devHarnessEnabled()) notFound();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const timeZone = resolveTimeZone(one(params.tz));
  const now = new Date();
  const { items, areas } = params.empty === undefined ? seedInbox(now, timeZone) : { items: [], areas: [] };
  const initial = await loadInbox(tagByTitle(fakeRepo(structuredClone(items), areas), INBOX_TAGS).repo, now, timeZone);
  return <InboxHarness items={items} areas={areas} initial={initial} />;
}
