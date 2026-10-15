"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useOptimistic, useRef, useState, useTransition, type FormEvent, type ReactNode, type RefObject } from "react";
import type { Item, LocalDate } from "@/domain/item";
import { SELECTED_ITEM_PARAM } from "@/features/day/types";
import { DetailAside } from "@/features/detail/detail-aside";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { GuideButton, type GuideTopic } from "@/features/palette/guide";
import { CaptureField } from "@/features/today/capture-field";
import type { ActionResult } from "@/features/today/commands";
import { DoneToggle } from "@/features/today/done-toggle";
import { WAITING } from "@/features/today/model";
import { RowTags } from "@/features/tags/row-tags";
import { LAST_DATE } from "@/lib/dates";
import { planAction } from "./actions";
import { dayWords, inboxRows, inboxSummary, planDate, type InboxData, type PlanFor } from "./model";

/** The writes the inbox makes. Defaults to the server actions; the dev harness passes in-memory ones. */
export type InboxActions = {
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  plan: (id: string, when: PlanFor) => Promise<ActionResult>;
  capture: (title: string) => Promise<ActionResult>;
};

const serverActions: InboxActions = { setDone: setDoneAction, plan: planAction, capture: captureAction };
const INBOX_GUIDE: GuideTopic[] = ["capture"];

/** Optimistic changes while a save is in flight: a planned item leaves, a reopened one reads as open. */
type Change = { kind: "hide" | "reopen"; id: string };

const choice =
  "rounded-md border border-rule px-3 py-1.5 font-medium text-ink hover:bg-hover active:bg-press disabled:cursor-default disabled:opacity-60";

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
            className="headline outline-none"
          >
            Inbox
          </h1>
          <p className="page-summary">{inboxSummary(shown)}</p>
        </header>

        <div className="mt-6 mb-3 flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="min-w-0 flex-[1_1_280px] rail:max-w-[440px]">
            <CaptureField
              captureAction={actions.capture}
              screenStatus={
                <p role="status" className={status?.error ? "font-medium text-ink" : "text-ink-2"}>
                  {status?.text}
                </p>
              }
            />
          </div>
          <GuideButton topics={INBOX_GUIDE} className="ml-auto" />
        </div>

        <section aria-labelledby="inbox-list-h">
          <h2 id="inbox-list-h" className="font-serif text-lg font-medium">
            {WAITING}
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
                  tags={data.tags[item.id]}
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

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
    </div>
  );
}

function InboxRow({
  item,
  today,
  area,
  count,
  tags,
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
  tags: readonly string[] | undefined;
  selected: boolean;
  justDone: boolean;
  planning: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
  onPlanning: (open: boolean) => void;
  onPlan: (when: PlanFor) => void;
}) {
  const done = item.status === "done";
  // The quietest ink is too faint to read on the accent wash of a selected row.
  const quiet = selected ? "text-ink-2" : "text-ink-3";
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
      className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-rule-soft py-(--row-y) rail:grid-cols-[48px_minmax(0,1fr)_auto_auto] ${
        selected ? "bg-accent-wash" : ""
      }`}
    >
      <DoneToggle type={item.type} title={item.title} done={done} justDone={justDone} onToggle={onToggleDone} />
      <button
        type="button"
        data-open={item.id}
        aria-pressed={selected}
        onClick={onSelect}
        className={`min-w-0 cursor-pointer rounded text-left tap-y break-words hover:underline ${
          done ? `font-normal ${quiet}` : "font-medium text-ink"
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
        <RowTags tags={tags} selected={selected} />
      </button>
      <span className={`text-[13px] max-rail:hidden ${quiet}`}>{area ?? ""}</span>
      {done ? (
        <span className={`pr-1 text-[13px] ${quiet}`}>Done</span>
      ) : (
        <button
          ref={trigger}
          type="button"
          data-plan={item.id}
          aria-label={`Plan for: ${item.title}`}
          aria-expanded={planning}
          aria-controls={panelId}
          onClick={() => onPlanning(!planning)}
          className="rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-ink-2 hover:bg-hover hover:text-ink active:bg-press pointer-coarse:min-h-11"
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
          max={LAST_DATE}
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
