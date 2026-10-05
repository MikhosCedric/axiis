import type { Schedule } from "@/domain/item";
import { CaptureField } from "./capture-field";
import type { Today } from "./commands";
import { formatClock, formatDayHeading } from "./format";
import { ItemRow } from "./item-row";
import { summaryLine, type TodayEntry } from "./model";

function When({ schedule, timeZone }: { schedule: Schedule; timeZone: string }) {
  if (schedule.kind !== "timed") return <span className="text-ink-3">Any time</span>;
  return (
    <>
      <time dateTime={schedule.start.toISOString()}>{formatClock(schedule.start, timeZone)}</time>
      <span className="max-[480px]:hidden">
        {" to "}
        <time dateTime={schedule.end.toISOString()}>{formatClock(schedule.end, timeZone)}</time>
      </span>
    </>
  );
}

export function TodayView({ today }: { today: Today }) {
  const { view, timeZone, date, areas } = today;
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const row = ({ item, state }: TodayEntry, timed: boolean) => (
    <ItemRow
      key={item.id}
      id={item.id}
      title={item.title}
      type={item.type}
      state={state}
      area={item.areaId ? (areaName.get(item.areaId) ?? null) : null}
      time={timed ? <When schedule={item.schedule} timeZone={timeZone} /> : undefined}
    />
  );
  const empty = view.scheduled.length === 0 && view.waiting.length === 0;

  return (
    <div className="max-w-[760px] px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
      <header>
        <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em] text-balance">
          <time dateTime={date}>{formatDayHeading(date)}</time>
        </h1>
        <p className="mt-2.5 text-[15px] text-ink-2">{summaryLine(view)}</p>
      </header>

      <div className="mt-6">
        <CaptureField />
      </div>

      {empty ? (
        <section aria-labelledby="empty-h" className="mt-8 border-t border-rule pt-6">
          <h2 id="empty-h" className="font-serif text-lg font-medium">
            A clear day
          </h2>
          <p className="mt-1 max-w-[46ch] text-ink-2">
            Nothing is planned and nothing is waiting. Anything you capture lands in this list first, and you can give
            it a time whenever you like.
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="planned-h" className="mt-8">
            <h2 id="planned-h" className="border-b border-rule pb-2.5 font-serif text-lg font-medium">
              Planned
            </h2>
            {view.scheduled.length ? (
              <ul>{view.scheduled.map((e) => row(e, true))}</ul>
            ) : (
              <p className="py-3 text-ink-2">Nothing has a time today yet.</p>
            )}
          </section>

          <section aria-labelledby="waiting-h" className="mt-10">
            <h2 id="waiting-h" className="font-serif text-lg font-medium">
              Waiting for a time
            </h2>
            <p className="mt-1 border-b border-rule pb-2.5 text-[13px] text-ink-2">
              Captured and safe. Give these a time when you are ready.
            </p>
            {view.waiting.length ? (
              <ul>{view.waiting.map((e) => row(e, false))}</ul>
            ) : (
              <p className="py-3 text-ink-2">Everything has a time. Capture something new above.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
