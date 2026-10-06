"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useId, useOptimistic, useState } from "react";
import type { AreaId, ItemType } from "@/domain/item";
import type { ActionResult } from "@/features/today/commands";
import { ConfirmDelete } from "./confirm-delete";
import { GlyphCheckbox } from "./glyph-checkbox";
import { BackIcon, CloseIcon, LiftIcon, SkipIcon, StopIcon } from "./icons";
import type { ConnectedRow } from "@/features/notes/model";
import { RepeatMark } from "@/features/today/repeat-mark";
import { InlineTitle } from "./inline-title";
import { LinkedNotes } from "./linked-notes";
import { useItemHref } from "./item-href";
import { clockOf, type DetailActions, type DetailView, type Scope } from "./model";
import { RepeatRows } from "./repeat-control";
import { Subtasks } from "./subtasks";
import { FirstDayRow, TimeRow } from "./time-row";
import { formatDayHeading } from "@/features/today/format";
import { TagField } from "@/features/tags/tag-field";

const TYPE_WORD: Record<ItemType, string> = { task: "Task", event: "Event", note: "Note", checklist: "Checklist" };

const iconButton = "grid size-8 place-items-center rounded-md text-ink-2 hover:bg-accent-wash hover:text-ink";
const textButton = "-ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-accent-wash hover:text-ink";

/** Shown when the URL names an item that was deleted or never existed. */
export function MissingItem() {
  const itemHref = useItemHref();
  return (
    <aside aria-label="Details" className="flex items-center gap-3 text-ink-2">
      <p>That item is not here any more.</p>
      <Link href={itemHref(null)} aria-label="Close details" title="Close" className={`ml-auto ${iconButton}`}>
        <CloseIcon />
      </Link>
    </aside>
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
  const { item, nesting, repeat } = view;
  const itemHref = useItemHref();
  const router = useRouter();
  const [done, setDone] = useOptimistic(item.done);
  const [areaId, setAreaId] = useOptimistic(item.areaId);
  const [justDone, setJustDone] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [promoted, setPromoted] = useState(false);
  // Only an occurrence offers a choice; anything else is always its own target.
  const [scope, setScope] = useState<Scope>("one");
  const headingId = useId();
  const areaFieldId = useId();

  function write(save: () => Promise<ActionResult>, after?: () => void) {
    setStatus(null);
    startTransition(async () => {
      const result = await save();
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

  const close = () => router.replace(itemHref(null), { scroll: false });
  const subtaskCount = nesting.kind === "holds-subtasks" ? nesting.subtasks.length : 0;
  const word = TYPE_WORD[item.type].toLowerCase();
  const isSeries = repeat.kind === "series";
  const isOccurrence = repeat.kind === "occurrence";

  return (
    <aside aria-labelledby={headingId} className="grid gap-5">
      <h2 id={headingId} className="sr-only">
        Details
      </h2>

      <div className="flex min-h-8 items-center gap-2">
        {nesting.kind === "is-subtask" &&
          (nesting.parent ? (
            <Link
              href={itemHref(nesting.parent.id)}
              className="-ml-1.5 inline-flex min-w-0 items-center gap-1 rounded-md py-1 pr-2 pl-1 text-[13px] text-ink-2 hover:bg-accent-wash hover:text-ink"
            >
              <BackIcon />
              <span className="truncate">Part of {nesting.parent.title}</span>
            </Link>
          ) : (
            <span className="text-[13px] text-ink-3">Part of an item that is gone</span>
          ))}
        <Link href={itemHref(null)} aria-label="Close details" title="Close" className={`ml-auto ${iconButton}`}>
          <CloseIcon />
        </Link>
      </div>

      <div className="flex items-start gap-1.5">
        {item.type !== "note" && !isSeries && (
          <span className="pt-1.5">
            <GlyphCheckbox
              type={item.type}
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

      {isOccurrence && (
        <div className="grid gap-2.5">
          <p className="flex items-center gap-2 text-[13px] text-ink-2">
            <RepeatMark className="text-ink-3" />
            Repeats. This is the one for {repeat.on}.
          </p>
          <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <legend className="float-left mr-1 text-[13px] text-ink-3">Changes apply to</legend>
            <span className="inline-flex rounded-md border border-rule p-0.5">
              {(["one", "all"] as const).map((s) => (
                <label
                  key={s}
                  className="cursor-pointer rounded px-2.5 py-1 text-[13px] text-ink-2 has-checked:bg-accent-wash has-checked:font-medium has-checked:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
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
          <dt className="text-[13px] text-ink-3">Type</dt>
          <dd>{TYPE_WORD[item.type]}</dd>

          {view.when !== null && (
            <>
              <dt className="text-[13px] text-ink-3">{isSeries ? "Starts" : "When"}</dt>
              <dd>
                <span className="tabular">{view.when}</span>
                {view.due && <span className="block text-ink-2 tabular">{view.due}</span>}
              </dd>
            </>
          )}

          {isOccurrence && (
            <TimeRow
              time={view.time}
              save={(time) =>
                write(
                  () => actions.setTime(item.id, time, scope),
                  scope === "all" ? () => setStatus(`All of them are at ${clockOf(time.start)} now.`) : undefined,
                )
              }
              clear={() =>
                write(
                  () => actions.clearTime(item.id, scope),
                  scope === "all" ? () => setStatus("All of them are at any time of day now.") : undefined,
                )
              }
            />
          )}

          {isOccurrence && scope === "all" && (
            <FirstDayRow
              firstOn={repeat.firstOn}
              save={(on) =>
                write(
                  () => actions.setFirstDay(item.id, on),
                  () => setStatus(`It starts on ${formatDayHeading(on)} now.`),
                )
              }
            />
          )}

          <dt className="text-[13px] text-ink-3">
            <label htmlFor={areaFieldId}>Area</label>
          </dt>
          <dd>
            <select
              id={areaFieldId}
              value={areaId ?? ""}
              onChange={(e) => changeArea(e.target.value)}
              className="-ml-2 max-w-full rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink hover:border-rule-soft focus:border-field focus:bg-sheet"
            >
              <option value="">None</option>
              {view.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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
                write(() => {
                  show();
                  return actions.setRepeat(item.id, choice);
                })
              }
            />
          )}
        </dl>
        <p role="status" className="mt-2 min-h-5 text-[13px] text-ink-2">
          {status}
        </p>
      </div>

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
                  setStatus("Now a task of its own, waiting for a time.");
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
        series={isSeries || isOccurrence}
        add={actions.addTag}
        remove={actions.removeTag}
      />

      {item.type === "note" ? (
        <Link
          href={`/notes/${item.id}`}
          className="-ml-2 inline-flex items-center gap-2 justify-self-start rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-accent-wash hover:text-ink"
        >
          Open the note
        </Link>
      ) : (
        <LinkedNotes itemId={view.notesFor} notes={linkedNotes} actions={actions} />
      )}

      <div className="grid justify-items-start gap-1 border-t border-rule pt-4">
        {isOccurrence ? (
          <>
            {scope === "one" ? (
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
    </aside>
  );
}
