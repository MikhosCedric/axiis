/**
 * Where a debounced save stands. `saving.editedSince` records edits made while
 * a save is in flight, so its success cannot mark newer words as saved.
 * `failed` always holds unsaved work.
 */
export type AutosaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving"; editedSince: boolean }
  | { kind: "saved" }
  | { kind: "failed"; error: string };

export type AutosaveEvent =
  | { type: "edit" }
  | { type: "save-start" }
  | { type: "save-ok" }
  | { type: "save-fail"; error: string };

export function reduce(state: AutosaveState, event: AutosaveEvent): AutosaveState {
  switch (event.type) {
    case "edit":
      return state.kind === "saving" ? { kind: "saving", editedSince: true } : { kind: "dirty" };
    case "save-start":
      return state.kind === "dirty" || state.kind === "failed" ? { kind: "saving", editedSince: false } : state;
    case "save-ok":
      if (state.kind !== "saving") return state;
      return state.editedSince ? { kind: "dirty" } : { kind: "saved" };
    case "save-fail":
      return state.kind === "saving" ? { kind: "failed", error: event.error } : state;
  }
}

export const hasUnsaved = (s: AutosaveState) => s.kind === "dirty" || s.kind === "saving" || s.kind === "failed";

/** The status line under the editor. */
export function statusLabel(s: AutosaveState): string {
  switch (s.kind) {
    case "idle":
      return "";
    case "dirty":
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "failed":
      return s.error;
  }
}

export const AUTOSAVE_DELAY_MS = 700;
export const SAVE_FAILED = "That did not save. Try again.";

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Saves the latest value `delayMs` after the last edit, one save at a time.
 * `flush` saves now and resolves once nothing is left unsaved or a save failed.
 */
export function createAutosave<T>(options: {
  save: (value: T) => Promise<SaveResult>;
  onState: (state: AutosaveState) => void;
  delayMs?: number;
}) {
  const delay = options.delayMs ?? AUTOSAVE_DELAY_MS;
  let state: AutosaveState = { kind: "idle" };
  let latest: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: Promise<void> | null = null;

  const dispatch = (event: AutosaveEvent) => {
    state = reduce(state, event);
    options.onState(state);
  };
  const cancelTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const schedule = () => {
    cancelTimer();
    timer = setTimeout(() => void run(), delay);
  };

  function run(): Promise<void> {
    cancelTimer();
    if (inflight) return inflight;
    if (state.kind !== "dirty" && state.kind !== "failed") return Promise.resolve();
    const value = latest as T;
    dispatch({ type: "save-start" });
    inflight = options
      .save(value)
      .catch((): SaveResult => ({ ok: false, error: SAVE_FAILED }))
      .then((result) => {
        inflight = null;
        dispatch(result.ok ? { type: "save-ok" } : { type: "save-fail", error: result.error });
        if (state.kind === "dirty") schedule();
      });
    return inflight;
  }

  return {
    edit(value: T) {
      latest = value;
      dispatch({ type: "edit" });
      if (state.kind === "dirty") schedule();
    },
    async flush() {
      while (inflight || state.kind === "dirty") await run();
    },
    retry: () => run(),
    state: () => state,
    dispose: cancelTimer,
  };
}
