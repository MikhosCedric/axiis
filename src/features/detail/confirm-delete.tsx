"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DeleteIcon } from "./icons";

const quiet = "rounded-md px-2 py-1 font-medium hover:bg-accent-wash";

/** Delete with one inline "Yes / No" step. Focus lands on No so a stray Enter keeps the item. */
export function ConfirmDelete({
  label,
  prompt,
  onConfirm,
  compact = false,
  icon = <DeleteIcon />,
}: {
  label: string;
  prompt: string;
  onConfirm: () => void;
  compact?: boolean;
  icon?: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const no = useRef<HTMLButtonElement>(null);
  const backToTrigger = useRef(false);

  useEffect(() => {
    if (asking) no.current?.focus();
    else if (backToTrigger.current) {
      backToTrigger.current = false;
      trigger.current?.focus();
    }
  }, [asking]);

  function keep() {
    backToTrigger.current = true;
    setAsking(false);
  }

  if (asking) {
    return (
      <span
        role="group"
        aria-label={prompt}
        className={`flex flex-wrap items-center gap-x-1 text-[13px] ${compact ? "justify-end" : "-ml-1"}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            keep();
          }
        }}
      >
        <span className="px-1 text-ink-2">{prompt}</span>
        <button
          type="button"
          className={`${quiet} text-ink underline decoration-rule underline-offset-3`}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          Yes
        </button>
        <button ref={no} type="button" className={`${quiet} text-ink-2`} onClick={keep}>
          No
        </button>
      </span>
    );
  }

  return (
    <button
      ref={trigger}
      type="button"
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      onClick={() => setAsking(true)}
      className={
        compact
          ? "grid size-8 pointer-coarse:size-11 place-items-center rounded-md text-ink-3 hover:bg-accent-wash hover:text-ink"
          : `${quiet} -ml-2 inline-flex items-center gap-2 text-ink-2 hover:text-ink`
      }
    >
      {icon}
      {!compact && label}
    </button>
  );
}
