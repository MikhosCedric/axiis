"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import { AreaMark } from "@/components/area-mark";
import type { AreaId, ItemType } from "@/domain/item";
import type { ActionResult } from "@/features/today/commands";
import { ChipSelect } from "./chip-select";
import { ConfirmDelete } from "./confirm-delete";
import { GlyphCheckbox } from "./glyph-checkbox";
import { BackIcon, CloseIcon, DueIcon, LiftIcon, RepeatIcon, RestoreIcon, SkipIcon, StopIcon } from "./icons";
import type { ConnectedRow } from "@/features/notes/model";
import { RepeatMark } from "@/features/today/repeat-mark";
import { InlineTitle } from "./inline-title";
import { LinkedNotes } from "./linked-notes";
import { NewAreaField } from "./new-area";
import { useItemHref } from "./item-href";
import { useItemSelection } from "./use-item-selection";
import { planOptions, TYPE_CHOICES, type TypeChoice, type DetailActions, type DetailView, type Scope, type SkippedDate } from "./model";
import { PlanRow } from "./plan-row";
import { startsRepeating } from "./repeat";
import { dayWords, planDate } from "@/features/inbox/model";
import { RepeatRows } from "./repeat-control";
import { addDays } from "@/lib/dates";
import { Row, rowButton } from "./rows";
import { SkippedDates } from "./skipped-dates";
import { Subtasks } from "./subtasks";
import { DateRow, TimeRow } from "./time-row";
import { formatDayHeading, formatDayShort } from "@/features/today/format";
import { useClock } from "@/components/shell/clock-context";
import { formatMinutes } from "@/lib/clock";
import { TagField } from "@/features/tags/tag-field";
import { reach } from "@/lib/reach";

const TYPE_WORD: Record<ItemType, string> = { task: "Task", event: "Event", note: "Note", checklist: "Checklist" };
const EVENT_NEEDS_TIME = "An event needs a time. Add one under Time.";
const EVENT_NEEDS_DAY = "An event needs a day and a time. Plan it under When.";
/** Values of the Area menu that are not areas. */
const NEW_AREA = "~new";
const MANAGE_AREAS = "~manage";

const iconButton = "grid size-8 pointer-coarse:size-11 place-items-center rounded-md text-ink-2 hover:bg-hover active:bg-press hover:text-ink";
const textButton = "-ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-hover active:bg-press hover:text-ink";
/** A group of lines, set off from the one above by a hairline. */
const group = "border-t border-rule-soft pt-2";

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

/** The item on its own page, which a link with target="_blank" opens in a new tab, and the desktop app in a second window. */
function OpenInWindow({ id }: { id: string }) {
  return (
    <a href={`/item/${id}`} target="_blank" rel="noopener" aria-label="Open in a new window" title="Open in a new window" className={iconButton}>
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
      </svg>
    </a>
  );
}

/** Shown when the URL names an item that was deleted or never existed. */
export function MissingItem() {
  const alone = usePathname().startsWith("/item/");
  return (
    <div className="flex items-center gap-3 text-ink-2">
      <p>
        That item is not here any more.
        {alone && (
          <>
            {" "}
            <Link href="/today" className="font-medium text-ink underline decoration-rule underline-offset-2 hover:decoration-ink">
              Back to Today
            </Link>
          </>
        )}
      </p>
      {!alone && <CloseDetails />}
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
  const router = useRouter();
  const { item, nesting, repeat } = view;
  const itemHref = useItemHref();
  const { select, selectedParam } = useItemSelection();
  // On its own page there is nothing to close and nowhere else to open it.
  const alone = usePathname().startsWith("/item/");
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
  // A due date row stays folded into "Add due date" until asked for; this is the item it was asked for on.
  const [dueFor, setDueFor] = useState<string | null>(null);
  const dueOpen = dueFor === item.id;
  const [naming, setNaming] = useState(false);

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
    if (value === NEW_AREA) return setNaming(true);
    if (value === MANAGE_AREAS) return router.push("/settings#areas");
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
  const area = view.areas.find((a) => a.id === areaId) ?? null;
  const showDue = view.due.editable ? view.due.on !== null || dueOpen : view.due.on !== null;
  // A series or an occurrence for all of them is moved by its First day, so the day is not shown twice.
  const showDay = view.when !== null && !plan.firstDay;
  const hasSchedule =
    showDay || plan.time || plan.firstDay || showDue || (view.due.editable && !showDue) || repeat.kind !== "hidden";

  useEffect(() => {
    if (eventHint === null) return;
    (eventHint === EVENT_NEEDS_TIME ? timeStart : planTrigger).current?.focus();
  }, [eventHint]);

  return (
    <div className="relative grid gap-3">
      <h2 className="sr-only">Details</h2>

      {(nesting.kind === "is-subtask" || !alone) && (
        <div className="-mt-1 flex min-h-8 items-center gap-2">
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
          {!alone && (
            <div className="ml-auto flex items-center">
              {selectedParam && <OpenInWindow id={selectedParam} />}
              <CloseDetails />
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-1">
        {item.type !== "note" && !isSeries && (
          <span className="-ml-2 pt-1">
            <GlyphCheckbox type={type} done={done} justDone={justDone} label={`Done: ${item.title}`} onChange={markDone} />
          </span>
        )}
        <InlineTitle
          value={item.title}
          label="Title"
          onSave={(title) => actions.rename(item.id, title, scope)}
          onError={setStatus}
          className={`font-display text-[clamp(22px,2.4vw,26px)] leading-[1.2] font-medium tracking-[-0.01em] ${done ? "text-ink-3" : "text-ink"}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {view.retype ? (
          <span title={isSeries || isOccurrence ? "The type belongs to every time it repeats." : undefined}>
            <ChipSelect label="Type" value={type} onChange={(v) => changeType(v as TypeChoice)}>
              {TYPE_CHOICES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_WORD[t]}
                </option>
              ))}
            </ChipSelect>
          </span>
        ) : (
          <span className="inline-flex h-8 items-center rounded-full border border-rule-soft px-3 text-[13px] font-medium text-ink-2">
            <span className="sr-only">Type: </span>
            {TYPE_WORD[item.type]}
          </span>
        )}
        {naming && actions.addArea ? (
          <NewAreaField add={actions.addArea} onClose={() => setNaming(false)} onMessage={setStatus} />
        ) : (
          <ChipSelect
            label="Area"
            value={areaId ?? ""}
            onChange={changeArea}
            mark={area ? <AreaMark color={area.color} /> : undefined}
          >
            <option value="">No area</option>
            {view.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {actions.addArea && <option value={NEW_AREA}>New area…</option>}
            <option value={MANAGE_AREAS}>Manage areas</option>
          </ChipSelect>
        )}
      </div>

      {isSeries && (
        <p className="flex items-center gap-2 text-[13px] text-ink-2">
          <RepeatMark className="text-ink-3" />
          Repeats. Each time is ticked done on its own day.
        </p>
      )}

      {isOccurrence && (
        <div className="grid gap-2">
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
                  <input type="radio" name="scope" value={s} checked={scope === s} onChange={() => setScope(s)} className="sr-only" />
                  {s === "one" ? "This one" : "All of them"}
                </label>
              ))}
            </span>
          </fieldset>
        </div>
      )}

      {hasSchedule && (
        <div role="group" aria-label="When" className={group}>
          {showDay && view.when !== null && (
            <PlanRow
              label="Planned for"
              short={view.day === null ? "No day" : formatDayShort(view.day, view.today)}
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
              needed={eventHint === EVENT_NEEDS_TIME}
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
                  () => setStatus(seriesScope === "all" ? "All of them are at any time of day now." : "At any time of day now."),
                )
              }
            />
          )}

          {plan.firstDay && (repeat.kind === "series" || repeat.kind === "occurrence") && (
            <DateRow
              label="First day"
              kind="day"
              on={repeat.firstOn}
              save={(on) =>
                write(
                  () => actions.setFirstDay(item.id, on),
                  () => setStatus(`It starts on ${formatDayHeading(on)} now.`),
                )
              }
            />
          )}

          {repeat.kind === "unavailable" && (
            <Row icon={<RepeatIcon />}>
              <span className="text-ink-2">{repeat.reason}</span>
            </Row>
          )}
          {(repeat.kind === "off" || isSeries || isOccurrence) && (
            <RepeatRows
              repeat={repeat}
              startOn={view.day ?? view.today}
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

          {view.due.editable ? (
            showDue ? (
              <DateRow
                label="Due by"
                kind="due"
                on={view.due.on}
                autoFocus={dueOpen && view.due.on === null}
                picks={[
                  { label: "Today", on: view.today },
                  { label: "Tomorrow", on: addDays(view.today, 1) },
                  { label: "Next week", on: addDays(view.today, 7) },
                ]}
                save={(on) => write(() => actions.setDue(item.id, on), () => setStatus(`Due ${formatDayHeading(on)}.`))}
                clear={{
                  label: "No due date",
                  run: () => write(() => actions.setDue(item.id, null), () => setStatus("No due date now.")),
                }}
              />
            ) : (
              <Row icon={<DueIcon />}>
                <button type="button" onClick={() => setDueFor(item.id)} className={`${rowButton} text-ink-3`}>
                  Add due date
                </button>
              </Row>
            )
          ) : (
            view.due.on && (
              <Row icon={<DueIcon />}>
                <span className="text-[13px] text-ink-2">Due by </span>
                <span className="tabular">{formatDayHeading(view.due.on)}</span>
              </Row>
            )
          )}
        </div>
      )}

      {!isSeries && view.day !== null && view.due.on !== null && view.day > view.due.on && (
        <p className="text-[13px] text-ink-2">Planned after it is due.</p>
      )}
      <p role="status" className="text-[13px] text-ink-2 empty:hidden">
        {eventHint ?? status}
      </p>

      {isSeries && <SkippedDates skipped={repeat.skipped} restore={restore} />}

      {nesting.kind === "holds-subtasks" && (
        <div className={group}>
          <Subtasks
            parentId={item.id}
            parentDone={done}
            subtasks={nesting.subtasks}
            actions={actions}
            onMarkParentDone={() => markDone(true)}
            focusAdd={promoted}
          />
        </div>
      )}

      {nesting.kind === "is-subtask" && (
        <section className={`grid justify-items-start gap-1.5 ${group}`}>
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

      <div className={group}>
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
          <Link href={`/notes/${item.id}`} className={`${textButton} mt-1`}>
            Open the note
          </Link>
        ) : (
          <LinkedNotes itemId={view.notesFor} notes={linkedNotes} actions={actions} />
        )}
      </div>

      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${group}`}>
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
            shown="Delete"
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
