"use client";

import Link from "next/link";
import { startTransition, useEffect, useId, useOptimistic, useRef, useState } from "react";
import { AreaMark } from "@/components/area-mark";
import type { AreaId, ItemType } from "@/domain/item";
import type { ActionResult } from "@/features/today/commands";
import { ConfirmDelete } from "./confirm-delete";
import { GlyphCheckbox } from "./glyph-checkbox";
import { BackIcon, CloseIcon, LiftIcon, RestoreIcon, SkipIcon, StopIcon } from "./icons";
import type { ConnectedRow } from "@/features/notes/model";
import { RepeatMark } from "@/features/today/repeat-mark";
import { InlineTitle } from "./inline-title";
import { LinkedNotes } from "./linked-notes";
import { useItemHref } from "./item-href";
import { useItemSelection } from "./use-item-selection";
import { planOptions, TYPE_CHOICES, type TypeChoice, type DetailActions, type DetailView, type Scope, type SkippedDate } from "./model";
import { PlanRow } from "./plan-row";
import { startsRepeating } from "./repeat";
import { dayWords, planDate } from "@/features/inbox/model";
import { RepeatRows } from "./repeat-control";
import { SkippedDates } from "./skipped-dates";
import { Subtasks } from "./subtasks";
import { DateRow, TimeRow } from "./time-row";
import { formatDayHeading } from "@/features/today/format";
import { useClock } from "@/components/shell/clock-context";
import { formatMinutes } from "@/lib/clock";
import { TagField } from "@/features/tags/tag-field";
import { reach } from "@/lib/reach";

const TYPE_WORD: Record<ItemType, string> = { task: "Task", event: "Event", note: "Note", checklist: "Checklist" };
const EVENT_NEEDS_TIME = "An event needs a time. Add one under Time.";
const EVENT_NEEDS_DAY = "An event needs a day and a time. Plan it under When.";

const field =
  "-ml-2 max-w-full rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink hover:border-rule-soft focus:border-field focus:bg-sheet";
const iconButton = "grid size-8 pointer-coarse:size-11 place-items-center rounded-md text-ink-2 hover:bg-hover active:bg-press hover:text-ink";
const textButton = "-ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-hover active:bg-press hover:text-ink";

/** A link to this page with no item, so it opens in a new tab too; a plain click closes the panel through history. */
function CloseDetails() {
  const itemHref = useItemHref();
  const { select } = useItemSelection();
  return (
    <Link
      href={itemHref(null)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        select(null);
      }}
      aria-label="Close details"
      title="Close (Esc)"
      aria-keyshortcuts="Escape"
      className={`ml-auto ${iconButton}`}
    >
      <CloseIcon />
    </Link>
  );
}

/** Shown when the URL names an item that was deleted or never existed. */
export function MissingItem() {
  return (
    <div className="flex items-center gap-3 text-ink-2">
      <p>That item is not here any more.</p>
      <CloseDetails />
    </div>
  );
}

/** The panel body: everything is drawn from `view`, and every write goes through `actions`. */
export function DetailSheet({
  view,
  actions,
  linkedNotes = [],
}: {
  view: DetailView;
  actions: DetailActions;
  /** Notes linked to this item either way. Not shown for a note, which opens in its own editor. */
  linkedNotes?: ConnectedRow[];
}) {
  const clock = useClock();
  const { item, nesting, repeat } = view;
  const itemHref = useItemHref();
  const { select } = useItemSelection();
  const [done, setDone] = useOptimistic(item.done);
  const [areaId, setAreaId] = useOptimistic(item.areaId);
  const [type, setType] = useOptimistic(item.type);
  const [justDone, setJustDone] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Set once a change to Event lands, and cleared by the next write. What it
  // asks for is read from the view as it is now, since a plan saved alongside
  // may have given it a day since, and it outranks that plan's own message.
  const [needsTime, setNeedsTime] = useState(false);
  const [promoted, setPromoted] = useState(false);
  // Only an occurrence offers a choice; anything else is always its own target.
  const [scope, setScope] = useState<Scope>("one");
  const planTrigger = useRef<HTMLButtonElement>(null);
  const timeStart = useRef<HTMLInputElement>(null);
  const areaFieldId = useId();
  const typeFieldId = useId();

  function write(save: () => Promise<ActionResult>, after?: () => void) {
    setStatus(null);
    setNeedsTime(false);
    startTransition(async () => {
      const result = await reach(save());
      if (result.ok) after?.();
      else setStatus(result.error);
    });
  }

  function markDone(next: boolean) {
    setJustDone(next);
    write(() => {
      setDone(next);
      return actions.setDone(item.id, next);
    });
  }

  function changeArea(value: string) {
    const next = value === "" ? null : (value as AreaId);
    write(() => {
      setAreaId(next);
      return actions.setArea(item.id, next, scope);
    });
  }

  function changeType(next: TypeChoice) {
    write(
      () => {
        setType(next);
        return actions.setType(item.id, next);
      },
      () => setNeedsTime(next === "event"),
    );
  }

  function restore(date: SkippedDate) {
    write(
      () => actions.restore(date.key),
      () => setStatus(`${date.on} is back.`),
    );
  }

  const close = () => select(null);
  const subtaskCount = nesting.kind === "holds-subtasks" ? nesting.subtasks.length : 0;
  const word = TYPE_WORD[item.type].toLowerCase();
  const isSeries = repeat.kind === "series";
  const isOccurrence = repeat.kind === "occurrence";
  const skipped = isOccurrence ? repeat.skipped : null;
  // The series itself has no "This one": every change to it is to all of them.
  const seriesScope: Scope = isSeries ? "all" : scope;
  const plan = planOptions(view, scope);
  // An event is drawn by its time, so point at where one goes.
  const eventHint = !needsTime || view.time !== null ? null : plan.time ? EVENT_NEEDS_TIME : EVENT_NEEDS_DAY;

  useEffect(() => {
    if (eventHint === null) return;
    (eventHint === EVENT_NEEDS_TIME ? timeStart : planTrigger).current?.focus();
  }, [eventHint]);

  return (
    <div className="grid gap-5">
      <h2 className="sr-only">
        Details
      </h2>

      <div className="flex min-h-8 items-center gap-2">
        {nesting.kind === "is-subtask" &&
          (nesting.parent ? (
            <Link
              href={itemHref(nesting.parent.id)}
              className="-ml-1.5 inline-flex min-w-0 items-center gap-1 rounded-md py-1 pr-2 pl-1 text-[13px] text-ink-2 hover:bg-hover active:bg-press hover:text-ink"
            >
              <BackIcon />
              <span className="truncate">Part of {nesting.parent.title}</span>
            </Link>
          ) : (
            <span className="text-[13px] text-ink-3">Part of an item that is gone</span>
          ))}
        <CloseDetails />
      </div>

      <div className="flex items-start gap-1.5">
        {item.type !== "note" && !isSeries && (
          <span className="pt-1.5">
            <GlyphCheckbox
              type={type}
              done={done}
              justDone={justDone}
              label={`Done: ${item.title}`}
              onChange={markDone}
            />
          </span>
        )}
        <InlineTitle
          value={item.title}
          label="Title"
          onSave={(title) => actions.rename(item.id, title, scope)}
          onError={setStatus}
          className={`font-serif text-[clamp(22px,2.4vw,28px)] leading-[1.2] font-medium tracking-[-0.01em] ${
            done ? "text-ink-3" : "text-ink"
          }`}
        />
      </div>

      {isSeries && (
        <p className="-mt-2 flex items-center gap-2 text-[13px] text-ink-2">
          <RepeatMark className="text-ink-3" />
          Repeats. Each time is ticked done on its own day, on the Score or the week.
        </p>
      )}

      {isOccurrence && (
        <div className="grid gap-2.5">
          <p className="flex items-center gap-2 text-[13px] text-ink-2">
            <RepeatMark className="text-ink-3" />
            Repeats. This is the one for {repeat.on}{skipped && ", skipped"}.
          </p>
          <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <legend className="float-left mr-1 text-[13px] text-ink-3">Changes apply to</legend>
            <span className="inline-flex rounded-md border border-rule p-0.5">
              {(["one", "all"] as const).map((s) => (
                <label
                  key={s}
                  className="cursor-pointer rounded px-2.5 py-1 text-[13px] text-ink-2 has-checked:bg-ink has-checked:font-medium has-checked:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={s}
                    checked={scope === s}
                    onChange={() => setScope(s)}
                    className="sr-only"
                  />
                  {s === "one" ? "This one" : "All of them"}
                </label>
              ))}
            </span>
          </fieldset>
        </div>
      )}

      <div>
        <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-3">
          {view.retype ? (
            <>
              <dt className="text-[13px] text-ink-3">
                <label htmlFor={typeFieldId}>Type</label>
              </dt>
              <dd>
                <select
                  id={typeFieldId}
                  value={type}
                  onChange={(e) => changeType(e.target.value as TypeChoice)}
                  className={field}
                >
                  {TYPE_CHOICES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_WORD[t]}
                    </option>
                  ))}
                </select>
                {(isSeries || isOccurrence) && (
                  <span className="block text-[13px] text-ink-2">The type belongs to every time it repeats.</span>
                )}
              </dd>
            </>
          ) : (
            <>
              <dt className="text-[13px] text-ink-3">Type</dt>
              <dd>{TYPE_WORD[item.type]}</dd>
            </>
          )}

          {view.when !== null && (
            <PlanRow
              label={isSeries ? "Starts" : "When"}
              when={view.when}
              day={view.day}
              today={view.today}
              days={plan.days}
              unplan={plan.unplan}
              trigger={planTrigger}
              onPlan={(when) =>
                write(
                  () => actions.plan(item.id, when),
                  () => {
                    const on = dayWords(planDate(when, view.today), view.today);
                    setStatus(isOccurrence ? `This one moved to ${on}.` : `Planned for ${on}.`);
                  },
                )
              }
              onUnplan={() => write(() => actions.unplan(item.id), () => setStatus("It has no day now."))}
            />
          )}
          {plan.time && (
            <TimeRow
              time={view.time}
              startRef={timeStart}
              save={(time) =>
                write(
                  () => actions.setTime(item.id, time, seriesScope),
                  () =>
                    setStatus(
                      seriesScope === "all" ? `All of them are at ${formatMinutes(time.start, clock)} now.` : `At ${formatMinutes(time.start, clock)} now.`,
                    ),
                )
              }
              clear={() =>
                write(
                  () => actions.clearTime(item.id, seriesScope),
                  () =>
                    setStatus(seriesScope === "all" ? "All of them are at any time of day now." : "At any time of day now."),
                )
              }
            />
          )}

          {plan.firstDay && (repeat.kind === "series" || repeat.kind === "occurrence") && (
            <DateRow
              label="First day"
              on={repeat.firstOn}
              save={(on) =>
                write(
                  () => actions.setFirstDay(item.id, on),
                  () => setStatus(`It starts on ${formatDayHeading(on)} now.`),
                )
              }
            />
          )}

          {view.due.editable ? (
            <DateRow
              label="Due"
              on={view.due.on}
              save={(on) => write(() => actions.setDue(item.id, on), () => setStatus(`Due ${formatDayHeading(on)}.`))}
              clear={{
                label: "No due date",
                run: () => write(() => actions.setDue(item.id, null), () => setStatus("No due date now.")),
              }}
            />
          ) : (
            view.due.on && (
              <>
                <dt className="text-[13px] text-ink-3">Due</dt>
                <dd className="tabular">{formatDayHeading(view.due.on)}</dd>
              </>
            )
          )}

          <dt className="text-[13px] text-ink-3">
            <label htmlFor={areaFieldId}>Area</label>
          </dt>
          <dd className="flex items-center gap-1">
            <select id={areaFieldId} value={areaId ?? ""} onChange={(e) => changeArea(e.target.value)} className={field}>
              <option value="">None</option>
              {view.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <AreaMark color={view.areas.find((a) => a.id === areaId)?.color ?? null} />
          </dd>

          {repeat.kind === "unavailable" && (
            <>
              <dt className="text-[13px] text-ink-3">Repeat</dt>
              <dd className="text-ink-2">{repeat.reason}</dd>
            </>
          )}
          {(repeat.kind === "off" || isSeries || isOccurrence) && (
            <RepeatRows
              repeat={repeat}
              save={(choice, show) =>
                write(
                  () => {
                    show();
                    return actions.setRepeat(item.id, choice);
                  },
                  repeat.kind === "off" ? () => setStatus(startsRepeating(choice, view.day, view.today)) : undefined,
                )
              }
            />
          )}
        </dl>
        <p role="status" className="mt-2 min-h-5 text-[13px] text-ink-2">
          {eventHint ?? status}
        </p>
      </div>

      {isSeries && (
        <SkippedDates skipped={repeat.skipped} restore={restore} />
      )}

      {nesting.kind === "holds-subtasks" && (
        <Subtasks
          parentId={item.id}
          parentDone={done}
          subtasks={nesting.subtasks}
          actions={actions}
          onMarkParentDone={() => markDone(true)}
          focusAdd={promoted}
        />
      )}

      {nesting.kind === "is-subtask" && (
        <section className="grid justify-items-start gap-1.5 border-t border-rule pt-4">
          <p className="text-ink-2">Subtasks go one level deep, so this one cannot hold its own.</p>
          <button
            type="button"
            className={textButton}
            onClick={() =>
              write(
                () => actions.promote(item.id),
                () => {
                  setPromoted(true);
                  setStatus("Now a task of its own, in the Inbox.");
                },
              )
            }
          >
            <LiftIcon />
            Make it a task
          </button>
        </section>
      )}

      <TagField
        itemId={item.id}
        tags={view.tags.on}
        known={view.tags.known}
        colors={view.tags.colors}
        series={isSeries || isOccurrence}
        add={actions.addTag}
        remove={actions.removeTag}
      />

      {item.type === "note" ? (
        <Link
          href={`/notes/${item.id}`}
          className="-ml-2 inline-flex items-center gap-2 justify-self-start rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-hover active:bg-press hover:text-ink"
        >
          Open the note
        </Link>
      ) : (
        <LinkedNotes itemId={view.notesFor} notes={linkedNotes} actions={actions} />
      )}

      <div className="grid justify-items-start gap-1 border-t border-rule pt-4">
        {isOccurrence ? (
          <>
            {scope === "one" && skipped ? (
              <button type="button" className={textButton} onClick={() => restore(skipped)}>
                <RestoreIcon />
                Restore this one
              </button>
            ) : scope === "one" ? (
              <ConfirmDelete
                key="skip"
                label="Skip this one"
                prompt="Skip this one?"
                icon={<SkipIcon />}
                onConfirm={() => write(() => actions.remove(item.id, "one"), close)}
              />
            ) : (
              <ConfirmDelete
                key="all"
                label="Delete all of them"
                prompt="Delete every time it repeats?"
                onConfirm={() => write(() => actions.remove(item.id, "all"), close)}
              />
            )}
            <ConfirmDelete
              label="Stop repeating from here"
              prompt="Stop from this one on?"
              icon={<StopIcon />}
              onConfirm={() => write(() => actions.stopRepeating(item.id), close)}
            />
          </>
        ) : (
          <ConfirmDelete
            label={`Delete this ${word}`}
            prompt={
              isSeries
                ? "Delete it and every time it repeats?"
                : subtaskCount > 0
                  ? `Delete this and its ${subtaskCount === 1 ? "subtask" : `${subtaskCount} subtasks`}?`
                  : "Delete?"
            }
            onConfirm={() => write(() => actions.remove(item.id), close)}
          />
        )}
      </div>
    </div>
  );
}
