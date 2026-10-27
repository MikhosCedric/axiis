"use client";

import { useEffect, useRef, type ComponentType, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { TITLE_MAX } from "@/features/today/model";
import { canDo, CLUSTER_ORDER, type QuickAction, type QuickItem } from "./model";
import { useQuick, type Quick, type RowHooks } from "./provider";
import { DeleteIcon, DoneIcon, LabelsIcon, MoreIcon, PlanIcon, RenameIcon } from "./icons";

export const ACTION_LABEL: Record<QuickAction, string> = {
  done: "Done",
  rename: "Rename",
  plan: "Plan",
  labels: "Area and tags",
  delete: "Delete",
  more: "More",
};

export const ACTION_KEY: Partial<Record<QuickAction, string>> = { done: "D", rename: "E", plan: "P", delete: "Delete", more: "." };

const ICON: Record<QuickAction, ComponentType> = {
  done: DoneIcon,
  rename: RenameIcon,
  plan: PlanIcon,
  labels: LabelsIcon,
  delete: DeleteIcon,
  more: MoreIcon,
};

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
 * The quick actions at the end of a row: hidden at rest, shown while a fine
 * pointer rests on the row (`group/row`) or focus is inside it, in room the
 * row already has, so nothing moves. Under a coarse pointer only More is
 * drawn, 44px, so every action has a way in without hovering.
 */
export function RowActions({
  item,
  hooks,
  compact = false,
  reveal = "row",
  touch = true,
  className = "",
  style,
}: {
  item: QuickItem;
  hooks: RowHooks;
  /** Done and More only, for a Month mark. */
  compact?: boolean;
  /** "row" shows it while its `group/row` is hovered or holds focus; "self" leaves showing it to the view's own CSS. */
  reveal?: "row" | "self";
  /** False where a tap already opens the item and a lasting More button would crowd the drawing (the Score, the Week, the Month). */
  touch?: boolean;
  /** Placement, from the view: where the cluster sits over or beside its row. */
  className?: string;
  style?: CSSProperties;
}) {
  const quick = useQuick();
  if (!quick) return null;
  const shown = CLUSTER_ORDER.filter(
    (a) => canDo(item, a) && !(a === "done" && hooks.doneBox) && (!compact || a === "done" || a === "more"),
  );
  const done = quick.patched(item.key)?.done ?? item.done;
  return (
    <div
      data-quick-cluster
      onPointerEnter={quick.prefetch}
      onFocus={quick.prefetch}
      style={style}
      className={`z-[5] flex items-center gap-0.5 rounded-md ${
        reveal === "row"
          ? "transition-opacity duration-(--dur-quick) pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-hover/row:pointer-events-auto pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:pointer-events-auto pointer-fine:group-focus-within/row:opacity-100"
          : ""
      } ${touch ? "" : "pointer-coarse:hidden"} ${className}`}
    >
      {shown.map((action) => {
        const Icon = ICON[action];
        const label = action === "done" && done ? "Open again" : ACTION_LABEL[action];
        const key = ACTION_KEY[action];
        return (
          <button
            key={action}
            type="button"
            aria-label={`${label} ${item.title}`}
            title={key ? `${label} (${key})` : label}
            aria-haspopup={action === "more" ? "menu" : action === "plan" || action === "labels" ? "dialog" : undefined}
            onClick={(e) => quick.run(action, item, hooks, e.currentTarget)}
            className={`grid size-7 place-items-center rounded-md text-ink-2 hover:bg-hover hover:text-ink active:bg-press [&:active>svg]:translate-y-px pointer-coarse:size-11 ${
              action === "more" ? "" : "pointer-coarse:hidden"
            }`}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

/**
 * The title as a field, in place, while it is being renamed. Enter saves,
 * Escape puts the old title back, leaving the field saves what is typed, and
 * an empty title keeps the old one.
 */
export function RenameField({ item, className = "" }: { item: QuickItem; className?: string }) {
  const quick = useQuick();
  const field = useRef<HTMLInputElement>(null);
  const settled = useRef(false);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  if (!quick) return null;
  const row = () => field.current?.closest<HTMLElement>("[data-quick]") ?? null;
  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    quick.commitRename(item, field.current?.value ?? item.title, row());
  };

  return (
    <input
      ref={field}
      type="text"
      defaultValue={item.title}
      aria-label={`Rename ${item.title}`}
      maxLength={TITLE_MAX}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          settled.current = true;
          quick.stopRenaming(row());
        }
      }}
      onBlur={commit}
      className={`-my-px min-w-0 rounded-md border border-field bg-sheet px-1.5 font-[inherit] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    />
  );
}
