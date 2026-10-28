import type { ActionResult } from "@/features/today/commands";

/**
 * Saves a value per key one at a time and keeps only the newest asked for: a call made while another is
 * in flight for the same key does not send, it leaves its value to go out when the one in flight lands, so
 * a run of quick choices (arrow keys through a palette) ends on the last one however the server orders them.
 * The call that sends answers for the whole run; the ones that left their value answer `ok` at once.
 */
export function latestSave<K, V>(save: (key: K, value: V) => Promise<ActionResult>): (key: K, value: V) => Promise<ActionResult> {
  const inflight = new Map<K, { want: V }>();
  return async (key, value) => {
    const run = inflight.get(key);
    if (run) {
      run.want = value;
      return { ok: true };
    }
    const mine = { want: value };
    inflight.set(key, mine);
    try {
      let sent = value;
      let result = await save(key, sent);
      while (result.ok && mine.want !== sent) {
        sent = mine.want;
        result = await save(key, sent);
      }
      return result;
    } finally {
      inflight.delete(key);
    }
  };
}
