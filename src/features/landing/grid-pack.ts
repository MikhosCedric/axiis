import type { ShownItem } from "@/domain/item";
import { packDay, type Block, type Scale } from "@/features/calendar/grid-layout";

/** A made-up item on a day, in minutes on the grid's own axis (it may run past 24 hours: the demos are laid around now). */
export type SampleBlock = { id: string; title: string; start: number; end: number };

export type Packed<T extends SampleBlock> = T & { top: number; height: number; column: number; columns: number; span: number };

/**
 * Where each block sits among the others on one day: the real grid's own packing (`packDay`), so overlapping
 * items share the column the way the app draws them. The demos carry no `ShownItem`; the packer reads only
 * an id and a title from one, so those two are all it is given.
 */
export function packSample<T extends SampleBlock>(blocks: readonly T[], scale: Scale): Packed<T>[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const packed = packDay(
    blocks.map((b) => ({ start: b.start, end: b.end, before: false, after: false, item: { id: b.id, title: b.title } as ShownItem })),
    scale,
  );
  return packed.map((p: Block) => ({ ...byId.get(p.item.id)!, top: p.top, height: p.height, column: p.column, columns: p.columns, span: p.span }));
}
