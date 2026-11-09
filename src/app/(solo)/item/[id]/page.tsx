import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailPanel } from "@/features/detail/detail-panel";
import { parseItemKey } from "@/domain/item-key";

export const metadata: Metadata = { title: "Item" };

/** One item on its own: what the desktop app opens in a second window. The key is a uuid or `<uuid>~<date>`, both URL-safe. */
export default async function ItemPage({ params }: PageProps<"/item/[id]">) {
  const { id } = await params;
  if (!parseItemKey(id)) notFound();
  return (
    <main id="main" className="ground min-h-dvh">
      <div className="mx-auto max-w-[560px] px-5 py-8">
        <DetailPanel itemId={id} />
      </div>
    </main>
  );
}
