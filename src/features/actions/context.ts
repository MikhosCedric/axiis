"use client";

import { createContext, useContext, type KeyboardEvent, type MouseEvent } from "react";
import type { AreaColor } from "@/domain/area-color";
import type { LocalDate } from "@/domain/item";
import type { DeleteResult } from "@/features/detail/commands";
import type { TimeOfDay, TypeChoice } from "@/features/detail/model";
import type { PlanFor } from "@/features/inbox/model";
import type { ActionResult } from "@/features/today/commands";
import type { DuplicateResult, TagChoices } from "./commands";
import type { Box, QuickAction, QuickItem } from "./model";

// The quick actions' shape and context, apart from the provider, so the views that draw rows
// load only this, and the provider's code is loaded once, with the layout.

/** The writes behind the quick actions. The app passes server actions; a dev harness passes in-memory ones. */
export type QuickActions = {
  setDone: (key: string, done: boolean) => Promise<ActionResult>;
  rename: (key: string, title: string) => Promise<ActionResult>;
  plan: (key: string, when: PlanFor) => Promise<ActionResult>;
  unplan: (key: string) => Promise<ActionResult>;
  setTime: (key: string, time: TimeOfDay) => Promise<ActionResult>;
  clearTime: (key: string) => Promise<ActionResult>;
  setArea: (key: string, areaId: string | null) => Promise<ActionResult>;
  addTag: (key: string, name: string) => Promise<ActionResult>;
  removeTag: (key: string, name: string) => Promise<ActionResult>;
  remove: (key: string, scope?: "one" | "all") => Promise<DeleteResult>;
  restore: (ids: string[]) => Promise<ActionResult>;
  /** Brings back a skipped occurrence, by its occurrence key. */
  unskip: (key: string) => Promise<ActionResult>;
  duplicate: (key: string) => Promise<DuplicateResult>;
  setType: (key: string, type: TypeChoice) => Promise<ActionResult>;
  /** The item's tags and every tag, or null when the item is gone. */
  tagChoices: (key: string) => Promise<TagChoices | null>;
};


export type QuickArea = { id: string; name: string; color: AreaColor | null };

/** What a view tells the actions about one row: how to open it, and its own done box when it has one. */
export type RowHooks = {
  onOpen: () => void;
  /** The view's own tick, which keeps its optimistic state and news. Without one, the actions tick it. */
  onToggleDone?: () => void;
  /** The row draws its own done box, so the cluster leaves Done out. */
  doneBox?: boolean;
  /**
   * Where the row is ("list", "next-up"), when its title can turn into a field in place, so a title
   * drawn twice on one page changes only where it was asked. Beams, chips and marks rename in a popover instead.
   */
  inlineRename?: string;
  /** False where Delete and Backspace already mean "back to the Inbox" (the Score and the Week). */
  deleteKeys?: boolean;
  /** A row of the lists, which swipes on a touch screen (never the Score, whose axis scrolls sideways). */
  swipe?: boolean;
};

export type LayerKind = "more" | "context" | "plan" | "labels" | "delete" | "delete-all" | "rename";

/** A row as the actions know it: what it shows and how its view answers. */
export type RowEntry = { item: QuickItem; hooks: RowHooks };

/**
 * Each drawn row's entry, by its element, kept by `rowProps` as rows mount, so code that starts from the
 * page (a swipe, a click with Shift) can find what a row is.
 */
export const rowEntries = new WeakMap<Element, RowEntry>();

/** What is open over the page: a menu or a popover, for one item, placed at `at`. */
export type OpenLayer = { kind: LayerKind; item: QuickItem; hooks: RowHooks; at: Box; row: HTMLElement | null };

export type Patch = { hidden?: boolean; title?: string; done?: boolean };

export type Quick = {
  areas: readonly QuickArea[];
  today: LocalDate;
  actions: QuickActions;
  /** The change in flight for an item, drawn before the save answers and dropped if it fails. */
  patched: (key: string) => Patch | undefined;
  /** Which row's title is a field now, as `renameKey` names it. */
  renaming: string | null;
  /** What is open over the page for this item, if anything, so its trigger can say it is expanded. */
  openFor: (key: string) => LayerKind | null;
  /** Runs a row action: a button in the cluster, a key, or an entry in a menu. */
  run: (action: QuickAction, item: QuickItem, hooks: RowHooks, from: HTMLElement) => void;
  open: (kind: LayerKind, item: QuickItem, hooks: RowHooks, at: Box, row: HTMLElement | null) => void;
  close: (refocus?: boolean) => void;
  /** The keys on a row in focus. Returns whether it used the key. */
  keyDown: (e: KeyboardEvent<HTMLElement>, item: QuickItem, hooks: RowHooks) => boolean;
  contextMenu: (e: MouseEvent<HTMLElement>, item: QuickItem, hooks: RowHooks) => void;
  commitRename: (item: QuickItem, title: string, row: HTMLElement | null) => void;
  stopRenaming: (row: HTMLElement | null) => void;
  /** Saves with the change drawn at once, says how it went, and offers `undo` when given. */
  save: (item: QuickItem, patch: Patch, call: () => Promise<ActionResult>, news?: string | null, undo?: () => void) => void;
  remove: (item: QuickItem, scope: "one" | "all", row: HTMLElement | null) => void;
  tell: (text: string, undo?: () => void) => void;
  prefetch: () => void;
  /** The rows chosen for one change to many, by key, in the order chosen. */
  picked: ReadonlyMap<string, RowEntry>;
  /** Adds a row to the chosen ones or takes it out; "range" also takes every row drawn between it and the last one chosen. */
  pick: (row: HTMLElement, how: "toggle" | "range") => void;
  clearPicked: () => void;
  /** Taps choose rows instead of opening them: Select mode, on a touch screen. */
  selecting: boolean;
  setSelecting: (on: boolean) => void;
  /** Saves several changes as one: each key's patch drawn at once, then one note with `news` from `work`, and Undo when given. */
  batch: (patches: [string, Patch][], work: () => Promise<{ news: string; undo?: () => void }>) => void;
};

export const QuickContext = createContext<Quick | null>(null);

/** The quick actions, or null on a page drawn without them (a dev harness that does not wrap its view). */
export function useQuick(): Quick | null {
  return useContext(QuickContext);
}

/** Names a row whose title is being renamed in place: where it is, and what it shows. */
export function renameKey(place: string, key: string): string {
  return `${place}|${key}`;
}

/** The element a row is reached by from the keyboard: the row itself when it takes focus, else its first control. */
export function focusTarget(row: HTMLElement): HTMLElement | null {
  if (row.matches("[tabindex], button, a[href]")) return row;
  return row.querySelector<HTMLElement>("[data-quick-focus]") ?? row.querySelector<HTMLElement>("button, a[href], [tabindex='0']");
}
