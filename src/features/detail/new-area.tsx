"use client";

import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/features/today/commands";
import { reach } from "@/lib/reach";

/**
 * The name field "New area" in the Area menu opens in the chip's place: type a
 * name, press Enter, and the area is in the menu to pick. Escape or leaving the
 * field empty puts the chip back.
 */
export function NewAreaField({
  add,
  onClose,
  onMessage,
}: {
  add: (name: string) => Promise<ActionResult>;
  onClose: () => void;
  onMessage: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  // Enter saves and the field then loses focus as it closes; that blur must not save a second time.
  const saving = useRef(false);

  function save() {
    const text = name.trim();
    if (saving.current) return;
    if (!text) return onClose();
    saving.current = true;
    start(async () => {
      const result = await reach(add(text));
      if (result.ok) {
        onMessage(`${text} added. Pick it under Area.`);
        onClose();
      } else onMessage(result.error);
      saving.current = false;
    });
  }

  return (
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
          saving.current = true;
          setName("");
          onClose();
        }
      }}
      className="h-8 min-w-0 max-w-full flex-1 rounded-full border border-field bg-sheet px-3 text-[13px] text-ink pointer-coarse:h-11"
    />
  );
}
