"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AreaMark } from "@/components/area-mark";
import { useClock } from "@/components/shell/clock-context";
import type { TagColors, TagName } from "@/domain/tag";
import { dayWords, planDate, quickPlans, type PlanFor } from "@/features/inbox/model";
import { DEFAULT_MINUTES } from "@/features/score/drop";
import { TagField } from "@/features/tags/tag-field";
import { TITLE_MAX } from "@/features/today/model";
import { formatMinutes, parseClock } from "@/lib/clock";
import { FIRST_DATE, LAST_DATE, parseLocalDate } from "@/lib/dates";
import { QuickIcon } from "./icons";
import type { QuickIconName } from "./icon-sprite";
import { canDo, CLUSTER_ORDER, deleteKind, menuStep, moreEntries, placeNear, type Box, type MoreEntry, type QuickAction, type QuickItem } from "./model";
import { useQuick, type OpenLayer, type Quick } from "./context";
import { ACTION_KEY, ACTION_LABEL } from "./cluster";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), [tabindex='0'], [role='menuitem'], [role='menuitemradio']";

/**
 * A native popover placed at `at`: Escape and a click outside close it (the
 * browser's light dismiss), and closing hands focus back through `onClosed`.
 * The first control, or the one marked `data-autofocus`, takes focus as it opens.
 */
function Floating({
  at,
  label,
  role = "dialog",
  className = "",
  onClosed,
  children,
}: {
  at: Box;
  label: string;
  role?: "dialog" | "menu";
  className?: string;
  onClosed: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const closed = useRef(onClosed);
  useEffect(() => {
    closed.current = onClosed;
  });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.showPopover();
    const { width, height } = el.getBoundingClientRect();
    const { left, top } = placeNear(at, { width, height }, { width: window.innerWidth, height: window.innerHeight });
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    (el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const away = () => el.hidePopover();
    // The page moving under it would leave it pointing at nothing, so it closes, as a native menu does.
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
      if (el.matches(":popover-open")) el.hidePopover();
    };
  }, [at]);

  return (
    <div
      ref={box}
      popover="auto"
      role={role}
      aria-label={label}
      onToggle={(e) => {
        if (e.newState === "closed") closed.current();
      }}
      onKeyDown={(e) => {
        // Escape belongs to this layer: the browser closes it, and nothing behind it should also act.
        if (e.key === "Escape") e.stopPropagation();
      }}
      className={`fixed inset-auto m-0 rounded-lg border border-rule bg-sheet text-ink shadow-float [--ground:var(--sheet)] motion-safe:animate-pop-in ${className}`}
    >
      {children}
    </div>
  );
}

export default function Layer({ layer }: { layer: OpenLayer }) {
  const quick = useQuick();
  if (!quick) return null;
  const onClosed = () => quick.close(true);
  switch (layer.kind) {
    case "more":
    case "context":
      return <ActionMenu quick={quick} layer={layer} onClosed={onClosed} />;
    case "plan":
      return <PlanPanel quick={quick} layer={layer} onClosed={onClosed} />;
    case "labels":
      return <LabelsPanel quick={quick} layer={layer} onClosed={onClosed} />;
    case "delete":
    case "delete-all":
      return <DeleteAsk quick={quick} layer={layer} onClosed={onClosed} />;
    case "rename":
      return <RenamePanel quick={quick} layer={layer} onClosed={onClosed} />;
  }
}

type PanelProps = { quick: Quick; layer: OpenLayer; onClosed: () => void };

const MORE_LABEL: Record<MoreEntry, string> = {
  duplicate: "Duplicate",
  "make-event": "Make it an event",
  "make-task": "Make it a task",
  inbox: "Move to the Inbox",
  "delete-all": "Delete every time",
  open: "Open details",
};

const MORE_ICON: Record<MoreEntry, QuickIconName> = {
  duplicate: "duplicate",
  "make-event": "event",
  "make-task": "task",
  inbox: "inbox",
  "delete-all": "delete",
  open: "open",
};

type Entry = { id: string; label: string; key?: string; icon: QuickIconName; run: () => void; rule?: boolean };

/** The More menu, or on a right-click every action then More's entries. */
function ActionMenu({ quick, layer, onClosed }: PanelProps) {
  const { item, hooks, row } = layer;
  const done = quick.patched(item.key)?.done ?? item.done;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const swap = (kind: OpenLayer["kind"]) => quick.open(kind, item, hooks, layer.at, row);
  const act = (action: QuickAction) => {
    if (action === "plan" || action === "labels") return swap(action);
    if (action === "delete" && deleteKind(item) !== "now") return swap("delete");
    quick.close(true);
    if (row) quick.run(action, item, hooks, row);
  };
  const more = (entry: MoreEntry) => {
    if (entry === "delete-all") return swap("delete-all");
    quick.close(true);
    runMore(quick, item, entry, hooks.onOpen);
  };

  const first: Entry[] =
    layer.kind === "context"
      ? CLUSTER_ORDER.filter((a) => a !== "more" && canDo(item, a)).map((a) => ({
          id: a,
          label: a === "done" && done ? "Open again" : a === "plan" || a === "labels" ? `${ACTION_LABEL[a]}…` : ACTION_LABEL[a],
          key: ACTION_KEY[a],
          icon: a,
          run: () => act(a),
        }))
      : [];
  const rest: Entry[] = moreEntries(item).map((m, i) => ({
    id: m,
    label: m === "delete-all" ? `${MORE_LABEL[m]}…` : MORE_LABEL[m],
    icon: MORE_ICON[m],
    run: () => more(m),
    rule: i === 0 && first.length > 0,
  }));
  const entries = [...first, ...rest];

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      quick.close(true);
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const to = menuStep(e.key, active, entries.map((x) => x.label));
    if (to === null) return;
    e.preventDefault();
    setActive(to);
    refs.current[to]?.focus();
  }

  return (
    <Floating at={layer.at} label={`Actions for ${item.title}`} role="menu" onClosed={onClosed} className="w-max min-w-[200px] max-w-[280px] p-1">
      <div onKeyDown={onKeyDown}>
        {entries.map((entry, i) => (
          <div key={entry.id}>
            {entry.rule && <div role="separator" className="mx-1 my-1 border-t border-rule-soft" />}
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              onFocus={() => setActive(i)}
              onClick={entry.run}
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] font-medium text-ink hover:bg-hover focus-visible:bg-hover active:bg-press pointer-coarse:h-11"
            >
              <span className="text-ink-2">
                <QuickIcon name={entry.icon} />
              </span>
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
              {entry.key && (
                <kbd aria-hidden="true" className="ml-4 font-sans text-xs text-ink-3 pointer-coarse:hidden">
                  {entry.key}
                </kbd>
              )}
            </button>
          </div>
        ))}
      </div>
    </Floating>
  );
}

function runMore(quick: Quick, item: QuickItem, entry: MoreEntry, onOpen: () => void) {
  const { actions } = quick;
  switch (entry) {
    case "duplicate":
      return quick.save(item, {}, () => actions.duplicate(item.key), `${item.title} is copied.`);
    case "make-event":
      return quick.save(item, {}, () => actions.setType(item.key, "event"), `${item.title} is an event now.`);
    case "make-task":
      return quick.save(item, {}, () => actions.setType(item.key, "task"), `${item.title} is a task now.`);
    case "inbox": {
      const day = item.day;
      return quick.save(
        item,
        {},
        () => actions.unplan(item.key),
        `${item.title} is in the Inbox.`,
        day ? () => quick.save(item, {}, () => actions.plan(item.key, day), `${item.title} is back on its day.`) : undefined,
      );
    }
    case "open":
      return onOpen();
  }
}

const choice =
  "rounded-md border border-rule px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-hover active:bg-press aria-pressed:bg-accent-wash disabled:cursor-default disabled:opacity-60 pointer-coarse:min-h-11";
const head = "text-xs font-medium text-ink-3";

/** Today, Tomorrow, Next week or a date, and a time once it has a day. */
function PlanPanel({ quick, layer, onClosed }: PanelProps) {
  const { item } = layer;
  const clock = useClock();
  const dateId = useId();
  const timeId = useId();
  const [picked, setPicked] = useState("");
  const [time, setTime] = useState(item.time ? formatMinutes(item.time.start, clock) : "");
  const [error, setError] = useState<string | null>(null);
  const today = quick.today;

  function plan(when: PlanFor) {
    const on = planDate(when, today);
    quick.close(true);
    if (on === item.day) return;
    const back = item.day;
    quick.save(
      item,
      {},
      () => quick.actions.plan(item.key, when),
      `${item.title} is planned for ${dayWords(on, today)}.`,
      item.series === "none"
        ? () => quick.save(item, {}, () => (back ? quick.actions.plan(item.key, back) : quick.actions.unplan(item.key)), `${item.title} is back where it was.`)
        : undefined,
    );
  }

  function submitDate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const on = parseLocalDate(picked);
    if (on) plan(on);
  }

  function submitTime(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const start = parseClock(time);
    if (start === null) {
      setError("Try a time such as 9:30 or 2pm.");
      return;
    }
    quick.close(true);
    const length = item.time?.length ?? DEFAULT_MINUTES;
    quick.save(item, {}, () => quick.actions.setTime(item.key, { start, length }), `${item.title} is at ${formatMinutes(start, clock)} now.`);
  }

  return (
    <Floating at={layer.at} label={`Plan ${item.title}`} onClosed={onClosed} className="w-[min(320px,calc(100vw-32px))] p-3">
      <p className={head}>Plan for</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {quickPlans(today).map((q) => (
          <button key={q.key} type="button" className={choice} aria-pressed={planDate(q.when, today) === item.day} onClick={() => plan(q.when)}>
            {q.label}
          </button>
        ))}
      </div>
      <form onSubmit={submitDate} className="mt-3 flex items-center gap-2">
        <label htmlFor={dateId} className="text-[13px] text-ink-2">
          Another day
        </label>
        <input
          id={dateId}
          type="date"
          required
          min={FIRST_DATE}
          max={LAST_DATE}
          value={picked}
          onChange={(e) => setPicked(e.currentTarget.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-rule bg-sheet px-2 text-ink tabular"
        />
        <button type="submit" className={choice} disabled={!picked}>
          Plan
        </button>
      </form>
      {item.day !== null && (
        <form onSubmit={submitTime} className="mt-3 border-t border-rule-soft pt-3">
          <div className="flex items-center gap-2">
            <label htmlFor={timeId} className="text-[13px] text-ink-2">
              At
            </label>
            <input
              id={timeId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={formatMinutes(9 * 60, clock)}
              value={time}
              onChange={(e) => {
                setTime(e.currentTarget.value);
                setError(null);
              }}
              aria-invalid={error !== null}
              aria-describedby={error ? `${timeId}-error` : undefined}
              className="h-9 w-24 rounded-md border border-rule bg-sheet px-2 text-ink tabular"
            />
            <button type="submit" className={choice}>
              Set time
            </button>
            {item.time && (
              <button
                type="button"
                className={choice}
                onClick={() => {
                  quick.close(true);
                  quick.save(item, {}, () => quick.actions.clearTime(item.key), `${item.title} is at any time of day now.`);
                }}
              >
                Any time
              </button>
            )}
          </div>
          {error && (
            <p id={`${timeId}-error`} className="mt-1.5 text-[13px] text-ink">
              {error}
            </p>
          )}
        </form>
      )}
    </Floating>
  );
}

/** The area, as swatches, and the tags, as chips with a field, as in the detail panel. */
function LabelsPanel({ quick, layer, onClosed }: PanelProps) {
  const { item } = layer;
  const [area, setArea] = useState(item.areaId);
  const [tags, setTags] = useState<TagName[]>([]);
  const [choices, setChoices] = useState<{ known: TagName[]; colors: TagColors } | null>(null);
  const headId = useId();

  useEffect(() => {
    let live = true;
    quick.actions
      .tagChoices(item.key)
      .then((c) => {
        if (!live) return;
        setTags(c?.on ?? []);
        setChoices(c ?? { on: [], known: [], colors: {} });
      })
      .catch(() => live && setChoices({ known: [], colors: {} }));
    return () => {
      live = false;
    };
  }, [quick.actions, item.key]);

  function pickArea(id: string | null) {
    if (id === area) return;
    const was = area;
    setArea(id);
    const name = id === null ? "no area" : (quick.areas.find((a) => a.id === id)?.name ?? "that area");
    quick.save(item, {}, async () => {
      const result = await quick.actions.setArea(item.key, id);
      if (!result.ok) setArea(was);
      return result;
    }, id === null ? `${item.title} has no area now.` : `${item.title} is in ${name} now.`);
  }

  const options = [{ id: null, name: "None", color: null }, ...quick.areas];

  return (
    <Floating at={layer.at} label={`Area and tags for ${item.title}`} onClosed={onClosed} className="w-[min(320px,calc(100vw-32px))] p-3">
      <p id={headId} className={head}>
        Area
      </p>
      <div role="radiogroup" aria-labelledby={headId} className="mt-2 flex flex-wrap gap-1.5">
        {options.map((a, i) => (
          <button
            key={a.id ?? "none"}
            type="button"
            role="radio"
            aria-checked={area === a.id}
            data-autofocus={area === a.id ? "" : undefined}
            tabIndex={area === a.id || (area === null && i === 0) ? 0 : -1}
            onClick={() => pickArea(a.id)}
            onKeyDown={(e) => {
              const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              e.preventDefault();
              const next = options[(i + step + options.length) % options.length];
              pickArea(next.id);
              (e.currentTarget.parentElement?.children[(i + step + options.length) % options.length] as HTMLElement | undefined)?.focus();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rule px-2.5 text-[13px] font-medium text-ink hover:bg-hover active:bg-press aria-checked:border-ink aria-checked:ring-1 aria-checked:ring-ink pointer-coarse:h-11"
          >
            {a.id !== null && <AreaMark color={a.color} />}
            {a.name}
          </button>
        ))}
      </div>
      <div className="mt-3 border-t border-rule-soft pt-3">
        {choices ? (
          <TagField
            itemId={item.key}
            tags={tags}
            known={choices.known}
            colors={choices.colors}
            series={item.series !== "none"}
            add={async (id, name) => {
              const result = await quick.actions.addTag(id, name);
              if (result.ok) setTags((t) => (t.some((x) => x.toLowerCase() === name.toLowerCase()) ? t : [...t, name as TagName]));
              return result;
            }}
            remove={async (id, name) => {
              const result = await quick.actions.removeTag(id, name);
              if (result.ok) setTags((t) => t.filter((x) => x.toLowerCase() !== name.toLowerCase()));
              return result;
            }}
          />
        ) : (
          <p className="text-[13px] text-ink-3" role="status">
            Loading tags
          </p>
        )}
      </div>
    </Floating>
  );
}

/** Skip this day or delete every time, for an occurrence; delete every time, for a series' own row. */
function DeleteAsk({ quick, layer, onClosed }: PanelProps) {
  const { item, row } = layer;
  const [all, setAll] = useState(layer.kind === "delete-all" || deleteKind(item) === "ask-series");
  const prompt = deleteKind(item) === "ask-series" ? "Delete it and every time it repeats?" : "Delete every time it repeats?";

  function go(scope: "one" | "all") {
    quick.close(true);
    quick.remove(item, scope, row);
  }

  return (
    <Floating at={layer.at} label={all ? prompt : `Delete ${item.title}`} onClosed={onClosed} className="w-max max-w-[min(320px,calc(100vw-32px))] p-3">
      {all ? (
        <>
          <p className="text-[13px] text-ink-2">{prompt}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={`${choice} inline-flex items-center gap-2`} onClick={() => go("all")}>
              <QuickIcon name="delete" />
              Delete every time
            </button>
            <button type="button" data-autofocus="" className={choice} onClick={() => quick.close(true)}>
              Keep it
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink-2">It repeats.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={`${choice} inline-flex items-center gap-2`} onClick={() => go("one")}>
              <QuickIcon name="skip" />
              Skip this day
            </button>
            <button type="button" className={`${choice} inline-flex items-center gap-2`} onClick={() => setAll(true)}>
              <QuickIcon name="delete" />
              Delete every time…
            </button>
          </div>
        </>
      )}
    </Floating>
  );
}

/** A title field over a beam, chip or mark, which cannot hold a field of its own. */
function RenamePanel({ quick, layer, onClosed }: PanelProps) {
  const { item, row } = layer;
  const id = useId();
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => field.current?.select(), []);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = field.current?.value ?? "";
    quick.close(true);
    quick.commitRename(item, title, row);
  }

  return (
    <Floating at={layer.at} label={`Rename ${item.title}`} onClosed={onClosed} className="w-[min(360px,calc(100vw-32px))] p-3">
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Title
        </label>
        <input
          ref={field}
          id={id}
          type="text"
          defaultValue={item.title}
          maxLength={TITLE_MAX}
          className="h-9 min-w-0 flex-1 rounded-md border border-field bg-sheet px-2.5 text-ink"
        />
        <button type="submit" className={choice}>
          Save
        </button>
      </form>
    </Floating>
  );
}

