"use client";

import { lazy, Suspense, type ComponentProps, type KeyboardEvent, type MouseEvent } from "react";
import type { QuickItem } from "./model";
import type { Quick, RowHooks } from "./context";

const Cluster = lazy(() => import("./cluster").then((m) => ({ default: m.Cluster })));
const TitleField = lazy(() => import("./cluster").then((m) => ({ default: m.TitleField })));

/**
 * The props a row's own element takes so its keys and its right-click reach
 * the actions: `data-quick` names it, so focus can find it again. Spread on
 * the element that holds the row (an `li`, or a beam, chip or mark itself).
 */
export function rowProps(quick: Quick | null, item: QuickItem, hooks: RowHooks) {
  if (!quick) return {};
  return {
    "data-quick": item.key,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void quick.keyDown(e, item, hooks),
    onContextMenu: (e: MouseEvent<HTMLElement>) => quick.contextMenu(e, item, hooks),
  };
}

/**
 * The quick actions at the end of a row (`cluster.tsx`). Its code loads beside the page rather than with it,
 * since nothing on the first paint needs it; the row's keys and right-click work without it.
 */
export function RowActions(props: ComponentProps<typeof Cluster>) {
  return (
    <Suspense fallback={null}>
      <Cluster {...props} />
    </Suspense>
  );
}

/** The title as a field, in place, while it is being renamed (`cluster.tsx`). */
export function RenameField(props: ComponentProps<typeof TitleField>) {
  return (
    <Suspense fallback={null}>
      <TitleField {...props} />
    </Suspense>
  );
}
