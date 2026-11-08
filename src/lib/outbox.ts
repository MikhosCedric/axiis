/**
 * The per-device outbox for captures typed with no connection (ADR-0002, stage 2a). Plain functions over a
 * `Storage`, so they test without a browser. Every read and write is guarded: private windows and blocked
 * site data make storage throw, and the app must work without it.
 */

/** Most captures one device keeps waiting. A full outbox refuses the next one rather than dropping the oldest. */
export const OUTBOX_MAX = 200;

export type QueuedCapture = {
  /** UUID made on the device; the server stores one item per id, however often it is sent. */
  id: string;
  title: string;
  /** When it was typed, ms since the epoch. */
  at: number;
  /** Why the server refused it, once it has. A refused entry waits for the user to edit or discard it. */
  error?: string;
};

const key = (owner: string) => `axiis-outbox:${owner}`;

function isEntry(value: unknown): value is QueuedCapture {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.title === "string" && typeof v.at === "number" && (v.error === undefined || typeof v.error === "string");
}

export function readOutbox(store: Storage | undefined, owner: string): QueuedCapture[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(key(owner)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, OUTBOX_MAX) : [];
  } catch {
    return [];
  }
}

function write(store: Storage | undefined, owner: string, entries: QueuedCapture[]): boolean {
  try {
    if (!store) return false;
    if (entries.length === 0) store.removeItem(key(owner));
    else store.setItem(key(owner), JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export type Queued = { ok: true; entry: QueuedCapture } | { ok: false; error: string };

export const OUTBOX_FULL = "Too many captures are waiting to be sent. Reconnect to send them, then try again.";
export const OUTBOX_UNAVAILABLE = "This browser can't keep captures while offline.";

/** Adds a capture at the end, oldest first. */
export function enqueue(store: Storage | undefined, owner: string, title: string, now: number, id: string = crypto.randomUUID()): Queued {
  const entries = readOutbox(store, owner);
  if (entries.length >= OUTBOX_MAX) return { ok: false, error: OUTBOX_FULL };
  const entry: QueuedCapture = { id, title, at: now };
  return write(store, owner, [...entries, entry]) ? { ok: true, entry } : { ok: false, error: OUTBOX_UNAVAILABLE };
}

/** Takes an entry out, once the server has answered for it (stored, or refused for good and discarded). */
export function remove(store: Storage | undefined, owner: string, id: string): void {
  write(store, owner, readOutbox(store, owner).filter((e) => e.id !== id));
}

/** Records why the server refused an entry; it stays listed. */
export function markRefused(store: Storage | undefined, owner: string, id: string, error: string): void {
  write(store, owner, readOutbox(store, owner).map((e) => (e.id === id ? { ...e, error } : e)));
}

/** Puts a refused entry back in line, with its text changed. */
export function retitle(store: Storage | undefined, owner: string, id: string, title: string): void {
  write(store, owner, readOutbox(store, owner).map((e) => (e.id === id ? { id: e.id, at: e.at, title } : e)));
}

export type Sender = (title: string, entry: { id: string; at: number }) => Promise<{ ok: true } | { ok: false; error: string; unreachable?: boolean }>;

/**
 * Sends the waiting captures, oldest first, one at a time. An entry leaves the outbox only after the server
 * answered for it. The server saying no marks that entry and moves on; no connection stops the run, and the
 * rest wait for the next. Entries already refused are not sent again until they are edited.
 */
export async function flush(store: Storage | undefined, owner: string, send: Sender): Promise<{ sent: number; waiting: number }> {
  let sent = 0;
  for (const entry of readOutbox(store, owner)) {
    if (entry.error) continue;
    const answer = await send(entry.title, { id: entry.id, at: entry.at });
    if (answer.ok) {
      remove(store, owner, entry.id);
      sent += 1;
    } else if (answer.unreachable) {
      break;
    } else {
      markRefused(store, owner, entry.id, answer.error);
    }
  }
  return { sent, waiting: readOutbox(store, owner).length };
}
