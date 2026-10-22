"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useOptimistic, useRef, useState } from "react";
import type { AreaId } from "@/domain/item";
import { ConfirmDelete } from "@/features/detail/confirm-delete";
import { BackIcon } from "@/features/detail/icons";
import { createAutosave, hasUnsaved, SAVE_FAILED, statusLabel, type AutosaveState } from "./autosave";
import { Connected } from "./connected";
import { NOTE_TITLE_MAX } from "./doc";
import type { NotesActions, NoteView } from "./model";
import { RichText } from "./rich-text";
import { reach } from "@/lib/reach";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

type Content = { title: string; body: unknown };

function SaveStatus({ state, onRetry }: { state: AutosaveState; onRetry: () => void }) {
  return (
    <p role="status" className="min-h-5 text-[13px] text-ink-2">
      {state.kind === "failed" && state.error === SAVE_FAILED ? (
        <>
          That did not save.{" "}
          <button type="button" onClick={onRetry} className="rounded font-medium text-ink underline decoration-accent underline-offset-3">
            Try again.
          </button>
        </>
      ) : (
        statusLabel(state)
      )}
    </p>
  );
}

/** The note screen. Title and body autosave together; area, links and delete save on their own. */
export function NoteEditor({ view, actions, basePath = "/notes" }: { view: NoteView; actions: NotesActions; basePath?: string }) {
  const { note } = view;
  const router = useRouter();
  const [saveState, setSaveState] = useState<AutosaveState>({ kind: "idle" });
  const [autosave] = useState(() =>
    createAutosave<Content>({ save: (content) => actions.save(note.id, content), onState: setSaveState }),
  );
  const content = useRef<Content>({ title: note.title, body: note.body ?? EMPTY_DOC });
  const deleted = useRef(false);
  const [title, setTitle] = useState(note.title);
  const [areaId, setAreaId] = useOptimistic(note.areaId);
  const [status, setStatus] = useState<string | null>(null);
  const titleId = useId();
  const areaFieldId = useId();
  const titleField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!note.title && note.body === null) titleField.current?.focus();
  }, [note.title, note.body]);

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsaved(autosave.state())) return;
      void autosave.flush();
      e.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      autosave.dispose();
      // Leaving inside the app unmounts the editor; whatever is pending still goes out.
      if (!deleted.current) void autosave.flush();
    };
  }, [autosave]);

  function edit(next: Partial<Content>) {
    content.current = { ...content.current, ...next };
    autosave.edit(content.current);
  }

  function changeArea(value: string) {
    const next = value === "" ? null : (value as AreaId);
    setStatus(null);
    startTransition(async () => {
      setAreaId(next);
      const result = await reach(actions.setArea(note.id, next));
      if (!result.ok) setStatus(result.error);
    });
  }

  function remove() {
    deleted.current = true;
    autosave.dispose();
    setStatus(null);
    startTransition(async () => {
      const result = await reach(actions.remove(note.id));
      if (result.ok) router.push(basePath);
      else {
        deleted.current = false;
        setStatus(result.error);
      }
    });
  }

  return (
    <article
      aria-labelledby={titleId}
      className="grid max-w-[1120px] gap-x-12 gap-y-8 px-4 pt-5 pb-16 rail:px-9 rail:pt-8 min-[1100px]:grid-cols-[minmax(0,1fr)_280px]"
    >
      <div className="min-w-0">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <Link
            href={basePath}
            onClick={(e) => {
              if (!hasUnsaved(autosave.state()) || e.metaKey || e.ctrlKey || e.shiftKey) return;
              // The list is rendered from saved notes, so the last words go out before it loads.
              e.preventDefault();
              void autosave.flush().then(() => {
                if (autosave.state().kind !== "failed") router.push(basePath);
              });
            }}
            className="-ml-1.5 inline-flex items-center gap-1 rounded-md py-1 pr-2 pl-1 text-[13px] text-ink-2 hover:bg-hover active:bg-press hover:text-ink"
          >
            <BackIcon />
            Notes
          </Link>
          <SaveStatus state={saveState} onRetry={() => void autosave.retry()} />
        </div>

        <h1 id={titleId} className="sr-only">
          {title.trim() || "Untitled note"}
        </h1>
        <textarea
          ref={titleField}
          rows={1}
          value={title}
          aria-label="Title"
          placeholder="Untitled note"
          maxLength={NOTE_TITLE_MAX}
          onChange={(e) => {
            const next = e.target.value.replace(/\s*\n\s*/g, " ");
            setTitle(next);
            edit({ title: next });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.closest("article")?.querySelector<HTMLElement>("[contenteditable=true]")?.focus();
            }
          }}
          onBlur={() => void autosave.flush()}
          className="mt-4 block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-0 py-1 font-serif text-[clamp(28px,3.2vw,40px)] leading-[1.15] font-medium tracking-[-0.015em] text-ink [field-sizing:content] placeholder:text-ink-3 focus:border-transparent"
        />
        <p className="mt-1 text-[13px] text-ink-3 tabular">{view.edited}</p>

        <div className="mt-6">
          <RichText
            initial={note.body}
            labelledBy={titleId}
            onChange={(body) => edit({ body })}
            onBlur={() => void autosave.flush()}
          />
        </div>
      </div>

      <aside aria-label="About this note" className="grid content-start gap-8 border-t border-rule pt-6 min-[1100px]:border-t-0 min-[1100px]:pt-14">
        <div className="grid gap-1.5">
          <label htmlFor={areaFieldId} className="text-[13px] text-ink-3">
            Area
          </label>
          <select
            id={areaFieldId}
            value={areaId ?? ""}
            onChange={(e) => changeArea(e.target.value)}
            className="-ml-2 max-w-full justify-self-start rounded-md border border-transparent bg-transparent py-1 pr-1 pl-1.5 text-ink hover:border-rule-soft focus:border-field focus:bg-sheet"
          >
            <option value="">None</option>
            {view.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p role="status" className="min-h-5 text-[13px] text-ink-2">
            {status}
          </p>
        </div>

        <Connected noteId={note.id} rows={view.connected} actions={actions} />

        <div className="border-t border-rule pt-4">
          <ConfirmDelete label="Delete this note" prompt="Delete this note?" onConfirm={remove} />
        </div>
      </aside>
    </article>
  );
}
