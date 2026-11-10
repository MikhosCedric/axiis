"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { captureAction } from "@/features/today/actions";
import { enqueue, flush, purgeStale, readOutbox, remove, retitle, type Queued, type QueuedCapture } from "@/lib/outbox";
import { reach, UNREACHABLE } from "@/lib/reach";

/** Fired on the window whenever this tab changes the outbox, so every part showing it can read it again. */
const CHANGED = "axiis-outbox-changed";

const OwnerContext = createContext<string | null>(null);

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Wraps stored text as a read-only `Storage` holding just that, so `readOutbox` can parse it. */
function fromText(text: string): Storage {
  return { getItem: () => text || null } as unknown as Storage;
}

/** Who the outbox on this device belongs to, so one account never sends another's captures. Null turns the outbox off. */
export function OutboxProvider({ owner, children }: { owner: string | null; children: ReactNode }) {
  return <OwnerContext value={owner}>{children}</OwnerContext>;
}

/** Queues a capture on this device. Null from `useQueueCapture` means the outbox is off. */
export function useQueueCapture(): ((title: string) => Queued) | null {
  const owner = useContext(OwnerContext);
  if (!owner) return null;
  return (title) => {
    const queued = enqueue(storage(), owner, title, Date.now());
    window.dispatchEvent(new Event(CHANGED));
    return queued;
  };
}

/** Waiting captures: sends them when the app opens and whenever the connection comes back, and lists any the server refused. */
export function PendingCaptures() {
  const owner = useContext(OwnerContext);
  const router = useRouter();
  // The stored text is the snapshot (a string compares by value), so the list only redraws when it changes.
  const stored = useSyncExternalStore(
    subscribe,
    () => (owner ? (storage()?.getItem(`axiis-outbox:${owner}`) ?? "") : ""),
    () => "",
  );
  const entries = useMemo<QueuedCapture[]>(() => (owner ? readOutbox(fromText(stored), owner) : []), [owner, stored]);

  // One run at a time: the open and online events can both fire for a single reconnect, and a second run would post the same entry again.
  const running = useRef(false);

  const send = useCallback(async () => {
    if (!owner || !navigator.onLine || running.current) return;
    running.current = true;
    try {
      const { sent } = await flush(storage(), owner, async (title, entry) => {
        const answer = await reach(captureAction(title, entry));
        if (answer.ok) return { ok: true };
        return { ok: false, error: answer.error, unreachable: answer.error === UNREACHABLE };
      });
      window.dispatchEvent(new Event(CHANGED));
      if (sent > 0) router.refresh();
    } finally {
      running.current = false;
    }
  }, [owner, router]);

  useEffect(() => {
    purgeStale(storage(), Date.now());
    void send();
    const onOnline = () => void send();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [send]);

  if (!owner || entries.length === 0) return null;
  const refused = entries.filter((e) => e.error);
  const waiting = entries.length - refused.length;

  function change(then: () => void) {
    then();
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <section aria-label="Captures waiting" className="mx-auto max-w-[720px] px-5 pt-3 text-[13px] text-ink-2">
      {waiting > 0 && (
        <p role="status">
          {waiting === 1 ? "1 capture is saved on this device" : `${waiting} captures are saved on this device`} and will be sent when you are back online.
        </p>
      )}
      {refused.length > 0 && (
        <ul className="mt-1 space-y-1">
          {refused.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-ink">{e.title}</span>
              <span>{e.error}</span>
              <button type="button" className="underline underline-offset-2" onClick={() => {
                  change(() => retitle(storage(), owner, e.id, e.title));
                  void send();
                }}>
                Try again
              </button>
              <button type="button" className="underline underline-offset-2" onClick={() => change(() => remove(storage(), owner, e.id))}>
                Discard
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
