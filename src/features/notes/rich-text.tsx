"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./editor.module.css";
import {
  BoldIcon,
  BulletListIcon,
  CodeIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  NumberedListIcon,
  OpenIcon,
  QuoteIcon,
  SubheadingIcon,
} from "./icons";
import { safeHref } from "./safe-href";

export const LINK_REL = "noopener noreferrer nofollow";
const PLACEHOLDER = "Write what is worth keeping. Headings, lists and links are in the bar above.";

const isAllowed = (url: string) => safeHref(url) !== null;

const tool =
  "grid size-8 flex-none place-items-center rounded-md text-ink-2 hover:bg-accent-wash hover:text-ink aria-pressed:bg-ink aria-pressed:text-paper";

function Tool({ label, keys, pressed, onClick, children }: { label: string; keys?: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={keys}
      title={keys ? `${label} (${keys.replace("Control", "Ctrl")})` : label}
      // Keeps the editor's selection while the pointer is down on the button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={tool}
    >
      {children}
    </button>
  );
}

function useMarks(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      h3: e?.isActive("heading", { level: 3 }) ?? false,
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      quote: e?.isActive("blockquote") ?? false,
      code: e?.isActive("codeBlock") ?? false,
      href: (e?.getAttributes("link").href as string | undefined) ?? null,
    }),
  });
}

/** Inline field for adding, changing or removing the link on the selection. */
function LinkField({ editor, initial, onClose }: { editor: Editor; initial: string; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  function apply() {
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!value.trim()) {
      chain.unsetLink().run();
      onClose();
      return;
    }
    const href = safeHref(value);
    if (!href) {
      setError("Links can start with http, https or mailto.");
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: value.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    onClose();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1">
      <label htmlFor={id} className="text-[13px] text-ink-3">
        Link
      </label>
      <input
        id={id}
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            editor.commands.focus();
            onClose();
          }
        }}
        type="url"
        inputMode="url"
        placeholder="https://"
        aria-invalid={error !== null}
        aria-describedby={`${id}-hint`}
        className="min-w-0 flex-1 basis-48 rounded-md border border-field bg-sheet px-2 py-1 text-ink"
      />
      <button type="button" onClick={apply} className="rounded-md px-2 py-1 font-medium text-ink hover:bg-accent-wash">
        {value.trim() ? "Apply" : "Remove link"}
      </button>
      <p id={`${id}-hint`} className="w-full text-[13px] text-ink-2">
        {error ?? "Enter to apply, Escape to go back to writing."}
      </p>
    </div>
  );
}

/**
 * The note body. Only the initial content is read: after that the editor owns
 * its document and reports each change through `onChange`.
 */
export function RichText({
  initial,
  labelledBy,
  onChange,
  onBlur,
}: {
  initial: unknown | null;
  labelledBy: string;
  onChange: (doc: unknown) => void;
  onBlur: () => void;
}) {
  const [linking, setLinking] = useState(false);
  const openLink = useRef(() => setLinking(true));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: isAllowed,
          shouldAutoLink: isAllowed,
          HTMLAttributes: { rel: LINK_REL, target: null },
        },
      }),
      Placeholder.configure({ placeholder: PLACEHOLDER }),
    ],
    content: (initial as object | null) ?? undefined,
    editorProps: {
      attributes: { class: styles.prose, "aria-labelledby": labelledBy, "aria-multiline": "true", role: "textbox" },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          openLink.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    onBlur: () => onBlur(),
  });
  const marks = useMarks(editor);

  const run = (command: (e: Editor) => void) => () => {
    if (editor) command(editor);
  };
  const chain = (e: Editor) => e.chain().focus();

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 border-b border-rule-soft bg-paper px-1 py-1">
        {linking && editor ? (
          <LinkField editor={editor} initial={marks?.href ?? ""} onClose={() => setLinking(false)} />
        ) : (
          <div role="group" aria-label="Formatting" className="flex items-center gap-0.5 overflow-x-auto">
            <Tool label="Heading" pressed={!!marks?.h2} onClick={run((e) => chain(e).toggleHeading({ level: 2 }).run())}>
              <HeadingIcon />
            </Tool>
            <Tool label="Subheading" pressed={!!marks?.h3} onClick={run((e) => chain(e).toggleHeading({ level: 3 }).run())}>
              <SubheadingIcon />
            </Tool>
            <span aria-hidden="true" className="mx-1 h-4 w-px flex-none bg-rule-soft" />
            <Tool label="Bold" keys="Control+B" pressed={!!marks?.bold} onClick={run((e) => chain(e).toggleBold().run())}>
              <BoldIcon />
            </Tool>
            <Tool label="Italic" keys="Control+I" pressed={!!marks?.italic} onClick={run((e) => chain(e).toggleItalic().run())}>
              <ItalicIcon />
            </Tool>
            <Tool label="Link" keys="Control+K" pressed={!!marks?.href} onClick={() => setLinking(true)}>
              <LinkIcon />
            </Tool>
            <span aria-hidden="true" className="mx-1 h-4 w-px flex-none bg-rule-soft" />
            <Tool label="Bulleted list" pressed={!!marks?.bullet} onClick={run((e) => chain(e).toggleBulletList().run())}>
              <BulletListIcon />
            </Tool>
            <Tool label="Numbered list" pressed={!!marks?.ordered} onClick={run((e) => chain(e).toggleOrderedList().run())}>
              <NumberedListIcon />
            </Tool>
            <Tool label="Quote" pressed={!!marks?.quote} onClick={run((e) => chain(e).toggleBlockquote().run())}>
              <QuoteIcon />
            </Tool>
            <Tool label="Code" pressed={!!marks?.code} onClick={run((e) => chain(e).toggleCodeBlock().run())}>
              <CodeIcon />
            </Tool>
            {marks?.href && safeHref(marks.href) && (
              <a
                href={safeHref(marks.href) ?? undefined}
                target="_blank"
                rel={LINK_REL}
                className="ml-1 inline-flex min-w-0 flex-none items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-ink-2 hover:bg-accent-wash hover:text-ink"
              >
                <OpenIcon />
                Open link
              </a>
            )}
          </div>
        )}
      </div>
      <EditorContent editor={editor} className="pt-4" />
    </div>
  );
}
