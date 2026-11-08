"use client";

import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";

/** "New area" beside the Area field: type a name, press Enter, and the area is in the list to pick. */
export function NewArea({ add, onOpen }: { add: (name: string) => Promise<ActionResult>; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Enter saves and the field then loses focus as it closes; that blur must not save a second time.
  const saving = useRef(false);

  function save() {
    const text = name.trim();
    if (saving.current) return;
    if (!text) return setOpen(false);
    saving.current = true;
    start(async () => {
      const result = await reach(add(text));
      if (result.ok) {
        setMessage(`${text} added. Pick it above.`);
        setName("");
        setOpen(false);
      } else setMessage(result.error);
      saving.current = false;
    });
  }

  return (
    <div className="col-span-2 grid gap-1">
      {open ? (
        <input
          autoFocus
          value={name}
          disabled={pending}
          maxLength={40}
          aria-label="New area name"
          placeholder="New area name"
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setName("");
              setOpen(false);
            }
          }}
          className="w-full rounded-md border border-field bg-sheet px-2.5 py-1.5 text-ink"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            // Keeps the Area row on the panel once the new area exists, even though the item has none picked yet.
            onOpen?.();
            setOpen(true);
          }}
          className="-ml-1.5 justify-self-start rounded-md px-1.5 py-1 text-[13px] text-ink-3 hover:bg-hover active:bg-press hover:text-ink"
        >
          New area
        </button>
      )}
      {message && (
        <p role="status" className="text-[13px] text-ink-2">
          {message}
        </p>
      )}
    </div>
  );
}
