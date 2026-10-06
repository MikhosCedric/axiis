"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useOptimistic, useRef, useState, useTransition, type FormEvent, type ReactNode, type RefObject } from "react";
import type { Item, LocalDate } from "@/domain/item";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { CaptureField } from "@/features/today/capture-field";
import type { ActionResult } from "@/features/today/commands";
import { Glyph } from "@/features/today/glyph";
import { planAction } from "./actions";
import { dayWords, inboxRows, inboxSummary, planDate, type InboxData, type PlanFor } from "./model";

/** The writes the inbox makes. Defaults to the server actions; the dev harness passes in-memory ones. */
export type InboxActions = {
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  plan: (id: string, when: PlanFor) => Promise<ActionResult>;
  capture: (title: string) => Promise<ActionResult>;
};

const serverActions: InboxActions = { setDone: setDoneAction, plan: planAction, capture: captureAction };

/** Optimistic changes while a save is in flight: a planned item leaves, a reopened one reads as open. */
type Change = { kind: "hide" | "reopen"; id: string };

const choice =
  "rounded-md border border-rule px-3 py-1.5 font-medium text-ink hover:bg-accent-wash disabled:cursor-default disabled:opacity-60";

export function InboxView({
  data,
  detail,
  actions = serverActions,
}: {
  data: InboxData;
  detail?: ReactNode;
  actions?: InboxActions;
}) {
  const { today, areas, childCounts } = data;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedParam = params.get(SELECTED_ITEM_PARAM);
  const [selectedId, setSelectedId] = useOptimistic(selectedParam);
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [doneHere, setDoneHere] = useState<Item[]>([]);
  const [planning, setPlanning] = useState<string | null>(null);
  const refocus = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const rows = useMemo(() => inboxRows(data.items, doneHere), [data.items, doneHere]);
  const [shown, change] = useOptimistic(rows, (current: Item[], c: Change) =>
    c.kind === "hide" ? current.filter((i) => i.id !== c.id) : current.map((i) => (i.id === c.id ? { ...i, status: "open" } : i)),
  );
  const areaName = new Map<string, string>(areas.map((a) => [a.id, a.name]));

  useEffect(() => {
    const target = refocus.current;
    if (target === null) return;
    // A row coming back from a failed save may render a beat after the status line does.
    const el = target ? document.querySelector<HTMLElement>(target) : heading.current;
    if (!el) return;
    refocus.current = null;
    el.focus();
  });

  function select(id: string | null) {
    startTransition(() => {
      setSelectedId(id);
      const next = new URLSearchParams(params.toString());
      if (id === null) next.delete(SELECTED_ITEM_PARAM);
      else next.set(SELECTED_ITEM_PARAM, id);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function toggleDone(item: Item) {
    const done = item.status !== "done";
    setStatus(null);
    setJustDone(done ? item.id : null);
    if (planning === item.id) setPlanning(null);
    startTransition(async () => {
      if (done) setDoneHere((list) => [...list, { ...item, status: "done", completedAt: new Date() }]);
      else change({ kind: "reopen", id: item.id });
      const result = await actions.setDone(item.id, done);
      if (!result.ok) {
        if (done) setDoneHere((list) => list.filter((i) => i.id !== item.id));
        setStatus({ text: result.error, error: true });
        return;
      }
      if (!done) setDoneHere((list) => list.filter((i) => i.id !== item.id));
      setStatus({ text: done ? `${item.title} is done.` : `${item.title} is open again.`, error: false });
    });
  }

  function plan(item: Item, when: PlanFor) {
    const at = shown.findIndex((i) => i.id === item.id);
    const next = shown[at + 1] ?? shown[at - 1];
    setStatus(null);
    setPlanning(null);
    refocus.current = next ? `[data-open="${next.id}"]` : "";
    startTransition(async () => {
      change({ kind: "hide", id: item.id });
      const result = await actions.plan(item.id, when);
      if (!result.ok) refocus.current = `[data-plan="${item.id}"]`;
      setStatus(
        result.ok
          ? { text: `${item.title} is planned for ${dayWords(planDate(when, today), today)}.`, error: false }
          : { text: result.error, error: true },
      );
    });
  }

  return (
    <div className={selectedParam ? "min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_328px]" : ""}>
      <div className="min-w-0 px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
        <header>
          <h1
            ref={heading}
            tabIndex={-1}
            className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em] outline-none"
          >
            Inbox
          </h1>
          <p className="mt-2.5 text-[15px] text-ink-2">{inboxSummary(shown)}</p>
        </header>

        <div className="mt-6 max-w-[440px]">
          <CaptureField captureAction={actions.capture} />
        </div>

        <p role="status" className={`mb-2 min-h-5 text-[13px] ${status?.error ? "font-medium text-ink" : "text-ink-2"}`}>
          {status?.text}
        </p>

        <section aria-labelledby="inbox-list-h">
          <h2 id="inbox-list-h" className="font-serif text-lg font-medium">
            Waiting for a day
          </h2>
          <p className="mt-1 border-b border-rule pb-2.5 text-[13px] text-ink-2">
            Everything you captured without a day. Plan each one when you are ready.
          </p>
          {shown.length ? (
            <ul>
              {shown.map((item) => (
                <InboxRow
                  key={item.id}
                  item={item}
                  today={today}
                  area={item.areaId ? (areaName.get(item.areaId) ?? null) : null}
                  count={childCounts[item.id]}
                  selected={selectedId === item.id}
                  justDone={justDone === item.id}
                  planning={planning === item.id}
                  onSelect={() => select(item.id)}
                  onToggleDone={() => toggleDone(item)}
                  onPlanning={(open) => setPlanning(open ? item.id : null)}
                  onPlan={(when) => plan(item, when)}
                />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-ink-2">
              Anything you capture without a day lands here, safe until you plan it.
            </p>
          )}
          {data.full && (
            <p className="mt-3 text-[13px] text-ink-3">Showing the newest {data.items.length}. Plan a few to see older ones.</p>
          )}
        </section>
      </div>

      {selectedParam && (
        <aside aria-label="Details" className="border-t border-rule bg-sheet min-[1180px]:border-t-0 min-[1180px]:border-l">
          <div className="px-4 py-6 rail:px-9 min-[1180px]:sticky min-[1180px]:top-0 min-[1180px]:max-h-dvh min-[1180px]:overflow-y-auto min-[1180px]:px-6 min-[1180px]:py-8">
            {detail}
          </div>
        </aside>
      )}
    </div>
  );
}

function InboxRow({
  item,
  today,
  area,
  count,
  selected,
  justDone,
  planning,
  onSelect,
  onToggleDone,
  onPlanning,
  onPlan,
}: {
  item: Item;
  today: LocalDate;
  area: string | null;
  count: { total: number; done: number } | undefined;
  selected: boolean;
  justDone: boolean;
  planning: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
  onPlanning: (open: boolean) => void;
  onPlan: (when: PlanFor) => void;
}) {
  const done = item.status === "done";
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (planning) first.current?.focus();
  }, [planning]);

  function close() {
    onPlanning(false);
    trigger.current?.focus();
  }

  return (
    <li
      className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-rule-soft py-2.5 rail:grid-cols-[48px_minmax(0,1fr)_auto_auto] ${
        selected ? "bg-accent-wash" : ""
      }`}
    >
      <label className="relative grid h-8 w-12 cursor-pointer place-items-center rounded-md hover:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        <input type="checkbox" className="sr-only" checked={done} onChange={onToggleDone} aria-label={`Done: ${item.title}`} />
        <Glyph type={item.type} state={done ? "done" : "planned"} justDone={justDone} />
      </label>
      <button
        type="button"
        data-open={item.id}
        aria-pressed={selected}
        onClick={onSelect}
        className={`min-w-0 cursor-pointer rounded text-left break-words hover:underline ${
          done ? "font-normal text-ink-3" : "font-medium text-ink"
        }`}
      >
        {item.title}
        {count && (
          <span className="ml-1.5 font-normal text-ink-2 tabular">
            <span aria-hidden="true">
              {count.done}/{count.total}
            </span>
            <span className="sr-only">
              , {count.done} of {count.total} subtasks done
            </span>
          </span>
        )}
      </button>
      <span className="text-[13px] text-ink-3 max-rail:hidden">{area ?? ""}</span>
      {done ? (
        <span className="pr-1 text-[13px] text-ink-3">Done</span>
      ) : (
        <button
          ref={trigger}
          type="button"
          data-plan={item.id}
          aria-label={`Plan for: ${item.title}`}
          aria-expanded={planning}
          aria-controls={panelId}
          onClick={() => onPlanning(!planning)}
          className="rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-ink-2 hover:bg-accent-wash"
        >
          Plan for
        </button>
      )}
      {planning && !done && (
        <PlanChoices
          id={panelId}
          title={item.title}
          today={today}
          first={first}
          onPlan={onPlan}
          onClose={close}
        />
      )}
    </li>
  );
}

function PlanChoices({
  id,
  title,
  today,
  first,
  onPlan,
  onClose,
}: {
  id: string;
  title: string;
  today: LocalDate;
  first: RefObject<HTMLButtonElement | null>;
  onPlan: (when: PlanFor) => void;
  onClose: () => void;
}) {
  const dateId = useId();
  const [picked, setPicked] = useState("");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("date") as HTMLInputElement;
    if (picked && input.validity.valid) onPlan(picked as LocalDate);
  }

  return (
    <div
      id={id}
      role="group"
      aria-label={`Plan ${title} for`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      className="col-span-full mt-2.5 flex flex-wrap items-center gap-2 pl-[60px] max-rail:pl-0"
    >
      <button ref={first} type="button" className={choice} onClick={() => onPlan("today")}>
        Today
      </button>
      <button type="button" className={choice} onClick={() => onPlan("tomorrow")}>
        Tomorrow
      </button>
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor={dateId} className="text-[13px] text-ink-2">
          Another day
        </label>
        <input
          id={dateId}
          name="date"
          type="date"
          required
          min={today}
          max="9999-12-31"
          value={picked}
          onChange={(e) => setPicked(e.currentTarget.value)}
          className="h-9 rounded-md border border-rule bg-sheet px-2.5 text-ink tabular"
        />
        <button type="submit" className={choice} disabled={!picked}>
          Plan
        </button>
      </form>
    </div>
  );
}
