/*
 * Where the palette, which sits above the quick actions, sends news of a change to their
 * note, so Undo is the one the rows use. The quick actions listen while they are mounted.
 */
type Listener = (text: string, undo?: () => void) => void;

let listener: Listener | null = null;

/** Listens for news; returns the way to stop. The latest listener is the one that hears. */
export function listenForNews(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

/** Sends news to the quick actions' note. False when none are listening (a page drawn without them). */
export function tellNews(text: string, undo?: () => void): boolean {
  if (!listener) return false;
  listener(text, undo);
  return true;
}
