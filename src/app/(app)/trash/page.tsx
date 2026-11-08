import type { Metadata } from "next";
import { restoreItemsAction } from "@/features/actions/actions";
import { TrashView, type TrashRow } from "@/features/trash/trash-view";
import { getNow } from "@/features/day/server";
import { displayTitle, TYPE_WORD } from "@/features/notes/model";
import { getItemsRepo } from "@/lib/items";

export const metadata: Metadata = { title: "Recently deleted" };

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function TrashPage() {
  const deleted = await (await getItemsRepo()).listDeleted();
  const now = getNow().getTime();
  const rows: TrashRow[] = deleted.map(({ item, deletedAt }) => ({
    id: item.id,
    title: displayTitle(item),
    kind: TYPE_WORD[item.type],
    daysAgo: Math.max(0, Math.floor((now - deletedAt.getTime()) / DAY_MS)),
  }));
  return <TrashView rows={rows} restore={restoreItemsAction} />;
}
