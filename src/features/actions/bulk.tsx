"use client";

import { useRef, useState, type FormEvent, type MouseEvent, type Ref } from "react";
import { AreaMark } from "@/components/area-mark";
import { Floating } from "@/components/floating";
import { dayWords, planDate, quickPlans, type PlanFor } from "@/features/inbox/model";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";
import { useQuick, type Patch, type Quick, type RowEntry } from "./context";
import type { Box } from "@/lib/placement";
import { bulkWords, canDo, chosenWords, deleteKind, type QuickItem } from "./model";
import { QuickIcon } from "./icons";
import type { QuickIconName } from "./icon-sprite";

type Open = "plan" | "area" | "tag" | null;

const tool =
  "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink hover:bg-hover active:bg-press [&:active>svg]:translate-y-px pointer-coarse:h-11";
const choice =
  "rounded-md border border-rule px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-hover active:bg-press pointer-coarse:min-h-11";

/** Runs one call per item and counts how many saved. */
async function each(items: QuickItem[], call: (item: QuickItem) => Promise<ActionResult>) {
  const results = await Promise.all(items.map((item) => reach(call(item))));
  return { saved: items.filter((_, i) => results[i].ok), failed: results.filter((r) => !r.ok).length };
}

/**
 * The bar for a change to many: how many rows are chosen, then Done, Plan, Area, Tag and Delete for all of
 * them at once, and a way to let them go (Escape does too). It floats over the page's foot, above the undo
 * note, and every change says what it did there, with Undo where it moves things out of sight.
 */
export default function Bulk() {
  const quick = useQuick();
  const [open, setOpen] = useState<Open>(null);
  // Kept as it was when opened, so a render of the bar does not move or reopen the popover.
  const [anchor, setAnchor] = useState<Box | null>(null);
  const plan = useRef<HTMLButtonElement>(null);
  const area = useRef<HTMLButtonElement>(null);
  const tag = useRef<HTMLButtonElement>(null);
  if (!quick) return null;
  const entries = [...quick.picked.values()];
  const items = entries.map((e) => e.item);
  const count = items.length;

  function show(which: Open, button: HTMLButtonElement | null) {
    const r = button?.getBoundingClientRect();
    setAnchor(r ? { left: r.left, top: r.top - 8, width: r.width, height: 0 } : null);
    setOpen(which);
  }

  function shut(refocus: boolean) {
    const back = open === "plan" ? plan : open === "area" ? area : tag;
    setOpen(null);
    if (refocus) back.current?.focus();
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 rail:bottom-20 rail:left-[216px]">
      <div
        role="toolbar"
        aria-label={count === 0 ? "Choose rows" : chosenWords(count)}
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-rule bg-sheet p-1 text-ink shadow-float motion-safe:animate-pop-in"
      >
        <p role="status" className="px-2.5 text-[13px] font-medium tabular">
          {count === 0 ? "Tap rows to choose them" : chosenWords(count)}
        </p>
        {count > 0 && (
          <>
            <Tool icon="done" label={items.every((i) => i.done) ? "Open again" : "Done"} onClick={() => done(quick, entries)} />
            <Tool ref={plan} icon="plan" label="Plan" expanded={open === "plan"} onClick={(e) => show("plan", e.currentTarget)} />
            <Tool ref={area} icon="labels" label="Area" expanded={open === "area"} onClick={(e) => show("area", e.currentTarget)} />
            <Tool ref={tag} icon="labels" label="Tag" expanded={open === "tag"} onClick={(e) => show("tag", e.currentTarget)} />
            <Tool icon="delete" label="Delete" onClick={() => remove(quick, entries)} />
          </>
        )}
        <span className="mx-0.5 h-5 border-l border-rule-soft" aria-hidden="true" />
        <button type="button" className={tool} aria-keyshortcuts="Escape" onClick={quick.clearPicked}>
          {count === 0 ? "Stop choosing" : "Clear"}
        </button>
      </div>
      {open && anchor && (
        <Floating
          at={anchor}
          label={open === "plan" ? `Plan ${bulkWords(count)}` : open === "area" ? `Area for ${bulkWords(count)}` : `Tag ${bulkWords(count)}`}
          onClosed={shut}
          className="w-[min(320px,calc(100vw-32px))] p-3"
        >
          {open === "plan" && (
            <div data-roving className="flex flex-wrap gap-2">
              {quickPlans(quick.today).map((q) => (
                <button key={q.key} type="button" className={choice} onClick={() => (shut(true), planAll(quick, entries, q.when))}>
                  {q.label}
                </button>
              ))}
            </div>
          )}
          {open === "area" && (
            <div data-roving className="flex flex-wrap gap-1.5">
              {[{ id: null, name: "None", color: null }, ...quick.areas].map((a) => (
                <button
                  key={a.id ?? "none"}
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rule px-2.5 text-[13px] font-medium text-ink hover:bg-hover active:bg-press pointer-coarse:h-11"
                  onClick={() => (shut(true), areaAll(quick, entries, a.id, a.name))}
                >
                  {a.id !== null && <AreaMark color={a.color} />}
                  {a.name}
                </button>
              ))}
            </div>
          )}
          {open === "tag" && <TagForm onTag={(name) => (shut(true), tagAll(quick, entries, name))} />}
        </Floating>
      )}
    </div>
  );
}

function Tool({
  icon,
  label,
  expanded,
  onClick,
  ref,
}: {
  icon: QuickIconName;
  label: string;
  expanded?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" className={tool} aria-haspopup={expanded === undefined ? undefined : "dialog"} aria-expanded={expanded} onClick={onClick}>
      <span className="text-ink-2">
        <QuickIcon name={icon} />
      </span>
      {label}
    </button>
  );
}

function TagForm({ onTag }: { onTag: (name: string) => void }) {
  const [name, setName] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = name.trim().replace(/^#/, "");
    if (clean) onTag(clean);
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <label htmlFor="bulk-tag" className="text-[13px] text-ink-2">
        Tag
      </label>
      <input
        id="bulk-tag"
        type="text"
        autoComplete="off"
        placeholder="errands"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        className="h-9 min-w-0 flex-1 rounded-md border border-rule bg-sheet px-2 text-ink"
      />
      <button type="submit" className={choice} disabled={!name.trim()}>
        Add
      </button>
    </form>
  );
}

function sentence(saved: number, failed: number, did: string) {
  const fail = failed ? ` ${bulkWords(failed)} did not save. Try again.` : "";
  return saved ? `${bulkWords(saved, did)}.${fail}` : `That did not save. Try again.`;
}

function done(quick: Quick, entries: RowEntry[]) {
  const items = entries.map((e) => e.item).filter((i) => canDo(i, "done"));
  const to = !items.every((i) => i.done);
  quick.clearPicked();
  const patches: [string, Patch][] = items.map((i) => [i.key, { done: to }]);
  quick.batch(patches, async () => {
    const { saved, failed } = await each(items, (i) => quick.actions.setDone(i.key, to));
    return {
      news: sentence(saved.length, failed, to ? "done" : "open again"),
      undo: saved.length
        ? () => quick.batch(saved.map((i) => [i.key, { done: !to }]), async () => {
            await each(saved, (i) => quick.actions.setDone(i.key, !to));
            return { news: `${bulkWords(saved.length, "back as they were")}.` };
          })
        : undefined,
    };
  });
}

function planAll(quick: Quick, entries: RowEntry[], when: PlanFor) {
  const items = entries.map((e) => e.item).filter((i) => canDo(i, "plan"));
  quick.clearPicked();
  quick.batch([], async () => {
    const { saved, failed } = await each(items, (i) => quick.actions.plan(i.key, when));
    const backable = saved.filter((i) => i.series === "none");
    return {
      news: sentence(saved.length, failed, `planned for ${dayWords(planDate(when, quick.today), quick.today)}`),
      undo: backable.length
        ? () => quick.batch([], async () => {
            await each(backable, (i) => (i.day ? quick.actions.plan(i.key, i.day) : quick.actions.unplan(i.key)));
            return { news: `${bulkWords(backable.length, "back where they were")}.` };
          })
        : undefined,
    };
  });
}

function areaAll(quick: Quick, entries: RowEntry[], id: string | null, name: string) {
  const items = entries.map((e) => e.item);
  quick.clearPicked();
  quick.batch([], async () => {
    const { saved, failed } = await each(items, (i) => quick.actions.setArea(i.key, id));
    return { news: sentence(saved.length, failed, id === null ? "in no area now" : `in ${name} now`) };
  });
}

function tagAll(quick: Quick, entries: RowEntry[], name: string) {
  const items = entries.map((e) => e.item);
  quick.clearPicked();
  quick.batch([], async () => {
    const { saved, failed } = await each(items, (i) => quick.actions.addTag(i.key, name));
    return { news: sentence(saved.length, failed, `tagged #${name}`) };
  });
}

/** One-offs are deleted and one time a series happens is skipped, all with one Undo; a series' own row is left, since deleting it takes every time it repeats. */
function remove(quick: Quick, entries: RowEntry[]) {
  const items = entries.map((e) => e.item);
  const kept = items.filter((i) => deleteKind(i) === "ask-series");
  const going = items.filter((i) => deleteKind(i) !== "ask-series");
  quick.clearPicked();
  quick.batch(
    going.map((i) => [i.key, { hidden: true }]),
    async () => {
      const results = await Promise.all(going.map((i) => reach(quick.actions.remove(i.key, "one"))));
      const ids = results.flatMap((r) => (r.ok ? r.deleted : []));
      const skipped = results.flatMap((r) => (r.ok && r.skipped ? [r.skipped] : []));
      const saved = results.filter((r) => r.ok).length;
      const left = kept.length ? ` ${kept.length === 1 ? "One that repeats is left, to delete from its own row" : `${kept.length} that repeat are left, to delete from their own rows`}.` : "";
      return {
        news: going.length ? `${sentence(saved, results.length - saved, "deleted")}${left}` : left.trim(),
        undo: saved
          ? () => quick.batch([], async () => {
              await Promise.all([...(ids.length ? [reach(quick.actions.restore(ids))] : []), ...skipped.map((k) => reach(quick.actions.unskip(k)))]);
              return { news: `${bulkWords(saved, "back")}.` };
            })
          : undefined,
    };
    },
  );
}
