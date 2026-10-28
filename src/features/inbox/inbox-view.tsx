"use client";

import { MotionList } from "@/components/motion-list";
import {
  useEffect,
  useId,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AreaLabel } from "@/components/area-mark";
import { UndoToast, type UndoNote } from "@/components/undo-toast";
import { isTypingTarget } from "@/features/day/nav";
import { unplanAction } from "@/features/detail/actions";
import type { Area, Item, LocalDate } from "@/domain/item";
import { DetailAside } from "@/features/detail/detail-aside";
import { useItemSelection } from "@/features/detail/use-item-selection";
import { captureAction, setDoneAction } from "@/features/today/actions";
import { GuideButton, type GuideTopic } from "@/features/palette/guide";
import { CaptureField } from "@/features/today/capture-field";
import type { ActionResult } from "@/features/today/commands";
import { DoneToggle } from "@/features/today/done-toggle";
import { place } from "@/components/shell/places";
import { RowTags } from "@/features/tags/row-tags";
import { FilterChips } from "@/features/filter/filter-chip";
import { NO_FILTER, scopePrefix, type ViewFilter } from "@/features/filter/model";
import { LAST_DATE } from "@/lib/dates";
import { planAction } from "./actions";
import { dayWords, inboxRows, inboxSummary, PICK_KEY, planDate, quickPlans, rowKey, type InboxData, type PlanFor } from "./model";
import { reach } from "@/lib/reach";
import { quickItem } from "@/features/actions/quick-item";
import { renameKey, useQuick } from "@/features/actions/context";
import { RenameField, RowActions, rowProps } from "@/features/actions/row-actions";

/** The writes the inbox makes. Defaults to the server actions; the dev harness passes in-memory ones. */
export type InboxActions = {
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  plan: (id: string, when: PlanFor) => Promise<ActionResult>;
  /** Takes a plan back: the item has no day again. */
  unplan: (id: string) => Promise<ActionResult>;
  capture: (title: string) => Promise<ActionResult>;
};

const serverActions: InboxActions = { setDone: setDoneAction, plan: planAction, unplan: unplanAction, capture: captureAction };
const INBOX_GUIDE: GuideTopic[] = ["capture"];

/** Optimistic changes while a save is in flight: a planned item leaves, a reopened one reads as open. */
type Change = { kind: "hide" | "reopen"; id: string };

const choice =
  "rounded-md border border-rule px-3 py-1.5 font-medium text-ink hover:bg-hover active:bg-press disabled:cursor-default disabled:opacity-60";

export function InboxView({
  data,
  detail,
  filter = NO_FILTER,
  actions = serverActions,
}: {
  data: InboxData;
  detail?: ReactNode;
  /** What the page narrowed its data to; the data passed in is already narrowed. */
  filter?: ViewFilter;
  actions?: InboxActions;
}) {
  const { today, areas, childCounts } = data;
  const { selectedParam, selectedId, select } = useItemSelection();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [doneHere, setDoneHere] = useState<Item[]>([]);
  const [planning, setPlanning] = useState<string | null>(null);
  // The choices were opened with 4, so the date field takes focus instead of Today.
  const [pickDate, setPickDate] = useState(false);
  const [note, setNote] = useState<UndoNote | null>(null);
  const notes = useRef(0);
  const refocus = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Whether this visit began with something to plan, so an Inbox cleared here says so.
  const [startedFull] = useState(data.items.length > 0);

  const rows = useMemo(() => inboxRows(data.items, doneHere), [data.items, doneHere]);
  const [shown, change] = useOptimistic(rows, (current: Item[], c: Change) =>
    c.kind === "hide" ? current.filter((i) => i.id !== c.id) : current.map((i) => (i.id === c.id ? { ...i, status: "open" } : i)),
  );
  const areaOf = new Map(areas.map((a) => [a.id as string, a]));

  useEffect(() => {
    const target = refocus.current;
    if (target === null) return;
    // A row coming back from a failed save may render a beat after the status line does.
    const el = target ? document.querySelector<HTMLElement>(target) : heading.current;
    if (!el) return;
    refocus.current = null;
    el.focus();
  });

  function toggleDone(item: Item) {
    const done = item.status !== "done";
    setStatus(null);
    setJustDone(done ? item.id : null);
    if (planning === item.id) setPlanning(null);
    startTransition(async () => {
      if (done) setDoneHere((list) => [...list, { ...item, status: "done", completedAt: new Date() }]);
      else change({ kind: "reopen", id: item.id });
      const result = await reach(actions.setDone(item.id, done));
      if (!result.ok) {
        if (done) setDoneHere((list) => list.filter((i) => i.id !== item.id));
        setStatus({ text: result.error, error: true });
        return;
      }
      if (!done) setDoneHere((list) => list.filter((i) => i.id !== item.id));
      tell(
        done ? `${item.title} is done.` : `${item.title} is open again.`,
        done ? () => toggleDone({ ...item, status: "done" }) : undefined,
      );
    });
  }

  // One undo note for the whole app; a harness drawn without the quick actions keeps its own.
  const quick = useQuick();
  function tell(text: string, undo?: () => void) {
    if (quick) quick.tell(text, undo);
    else setNote({ id: ++notes.current, text, undo });
  }

  function unplan(item: Item) {
    setStatus(null);
    startTransition(async () => {
      const result = await reach(actions.unplan(item.id));
      if (!result.ok) {
        setStatus({ text: result.error, error: true });
        return;
      }
      refocus.current = `[data-open="${item.id}"]`;
      tell(`${item.title} is back in the Inbox.`);
    });
  }

  /** J and K or the arrows move between rows; 1 to 3 plan the row in focus, 4 opens its date field. */
  function rowKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    if (isTypingTarget(target)) return;
    const row = target.closest<HTMLElement>("[data-row]");
    const item = row && shown.find((i) => i.id === row.dataset.row);
    if (!item) return;
    const step = rowKey(e.key, today);
    if (!step) return;
    if ("move" in step) {
      const to = shown[shown.indexOf(item) + step.move];
      if (!to) return;
      e.preventDefault();
      document.querySelector<HTMLElement>(`[data-open="${to.id}"]`)?.focus();
      return;
    }
    if (item.status === "done") return;
    e.preventDefault();
    if ("plan" in step) plan(item, step.plan);
    else {
      setPickDate(true);
      setPlanning(item.id);
    }
  }

  function plan(item: Item, when: PlanFor) {
    const at = shown.findIndex((i) => i.id === item.id);
    const next = shown[at + 1] ?? shown[at - 1];
    setStatus(null);
    setPlanning(null);
    refocus.current = next ? `[data-open="${next.id}"]` : "";
    startTransition(async () => {
      change({ kind: "hide", id: item.id });
      const result = await reach(actions.plan(item.id, when));
      if (!result.ok) {
        refocus.current = `[data-plan="${item.id}"]`;
        setStatus({ text: result.error, error: true });
        return;
      }
      tell(`${item.title} is planned for ${dayWords(planDate(when, today), today)}.`, () => unplan(item));
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
          <p className="page-summary">
            {place("inbox").hint}. Plan each one when you are ready. {scopePrefix(filter)}
            {inboxSummary(shown)}
          </p>
          <FilterChips filter={filter} className="mt-2.5" />
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
          <h2 id="inbox-list-h" className="sr-only">
            Items with no day
          </h2>
          {shown.length ? (
            <MotionList className="surface overflow-hidden px-3 [&_li:last-child]:border-b-0 mt-4" onKeyDown={rowKeyDown} aria-describedby="inbox-keys">
              {shown.map((item) => (
                <InboxRow
                  key={item.id}
                  item={item}
                  today={today}
                  area={item.areaId ? (areaOf.get(item.areaId) ?? null) : null}
                  count={childCounts[item.id]}
                  tags={data.tags[item.id]}
                  timeZone={data.timeZone}
                  selected={selectedId === item.id}
                  justDone={justDone === item.id}
                  planning={planning === item.id}
                  pickDate={pickDate}
                  onSelect={() => select(item.id)}
                  onToggleDone={() => toggleDone(item)}
                  onPlanning={(open) => {
                    setPickDate(false);
                    setPlanning(open ? item.id : null);
                  }}
                  onPlan={(when) => plan(item, when)}
                />
              ))}
            </MotionList>
          ) : (
            <p className="py-3 text-ink-2">
              {startedFull && "All planned. "}Anything you capture without a day lands here, safe until you plan it.
            </p>
          )}
          {shown.length > 0 && (
            <p id="inbox-keys" className="mt-3 text-[13px] text-ink-3 pointer-coarse:hidden">
              J and K move between items. 1 plans the one in focus for today, 2 for tomorrow, 3 for next week, 4 for another day.
            </p>
          )}
          {data.full && (
            <p className="mt-3 text-[13px] text-ink-3">Showing the newest {data.items.length}. Plan a few to see older ones.</p>
          )}
        </section>
      </div>

      {selectedParam && <DetailAside pending={selectedId !== selectedParam}>{detail}</DetailAside>}
      {!quick && <UndoToast note={note} onDone={() => setNote(null)} />}
    </div>
  );
}

function InboxRow({
  item,
  today,
  area,
  count,
  tags,
  timeZone,
  selected,
  justDone,
  planning,
  pickDate,
  onSelect,
  onToggleDone,
  onPlanning,
  onPlan,
}: {
  item: Item;
  today: LocalDate;
  area: Area | null;
  count: { total: number; done: number } | undefined;
  tags: readonly string[] | undefined;
  timeZone: string;
  selected: boolean;
  justDone: boolean;
  planning: boolean;
  pickDate: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
  onPlanning: (open: boolean) => void;
  onPlan: (when: PlanFor) => void;
}) {
  const quick = useQuick();
  const patch = quick?.patched(item.id);
  const done = item.status === "done";
  const title = patch?.title ?? item.title;
  const qi = { ...quickItem(item, timeZone), title };
  const hooks = { onOpen: onSelect, onToggleDone, inlineRename: "inbox", doneBox: true, swipe: true };
  // The quietest ink is too faint to read on the accent wash of a selected row.
  const quiet = selected ? "text-ink-2" : "text-ink-3";
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const date = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (planning) (pickDate ? date : first).current?.focus();
  }, [planning, pickDate]);

  function close() {
    onPlanning(false);
    trigger.current?.focus();
  }

  if (patch?.hidden) return null;
  return (
    <li
      data-row={item.id}
      {...rowProps(quick, qi, hooks)}
      className={`group/row relative grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-rule-soft py-(--row-y) rail:grid-cols-[48px_minmax(0,1fr)_auto_auto] ${
        selected ? "row-selected" : ""
      }`}
    >
      <DoneToggle type={item.type} title={title} done={done} justDone={justDone} onToggle={onToggleDone} />
      {quick?.renaming === renameKey("inbox", item.id) ? (
        <RenameField item={qi} className={done ? "font-normal" : "font-medium"} />
      ) : (
      <button
        type="button"
        data-open={item.id}
        data-quick-focus
        aria-pressed={selected}
        onClick={onSelect}
        className={`min-w-0 cursor-pointer rounded text-left tap-y break-words hover:underline ${
          done ? `font-normal ${quiet}` : "font-medium text-ink"
        }`}
      >
        {title}
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
      )}
      <span className={`text-[13px] max-rail:hidden ${quiet}`}>{area && <AreaLabel name={area.name} color={area.color} />}</span>
      {/* The actions sit left of Plan for, over the row, so Plan for stays where the hand expects it. */}
      <div className="relative flex items-center justify-end gap-1">
      <RowActions item={qi} hooks={hooks} className="quick-over" style={{ right: "100%" }} />
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
      </div>
      {planning && !done && (
        <PlanChoices
          id={panelId}
          title={item.title}
          today={today}
          first={first}
          date={date}
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
  date,
  onPlan,
  onClose,
}: {
  id: string;
  title: string;
  today: LocalDate;
  first: RefObject<HTMLButtonElement | null>;
  date: RefObject<HTMLInputElement | null>;
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
      {quickPlans(today).map((q, i) => (
        <button key={q.key} ref={i === 0 ? first : undefined} type="button" aria-keyshortcuts={q.key} className={choice} onClick={() => onPlan(q.when)}>
          {q.label}
          <kbd aria-hidden="true" className="ml-2 font-sans text-xs text-ink-3 pointer-coarse:hidden">
            {q.key}
          </kbd>
        </button>
      ))}
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor={dateId} className="text-[13px] text-ink-2">
          Another day
          <kbd aria-hidden="true" className="ml-1.5 font-sans text-xs text-ink-3 pointer-coarse:hidden">
            {PICK_KEY}
          </kbd>
        </label>
        <input
          ref={date}
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
