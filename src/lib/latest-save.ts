import { useEffect, useRef, useState } from "react";
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

/**
 * `latestSave` for a component. The save is made once and kept: a server component hands its client children
 * a fresh `actions` object on every refresh, and a new `latestSave` would forget the run in flight, so the
 * next key press would send beside it and the server could keep an older colour.
 */
export function useLatestSave<K, V>(save: (key: K, value: V) => Promise<ActionResult>): (key: K, value: V) => Promise<ActionResult> {
  const current = useRef(save);
  useEffect(() => {
    current.current = save;
  });
  // The ref is read when a save is made, in an event handler, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [send] = useState(() => latestSave<K, V>((key, value) => current.current(key, value)));
  return send;
}
