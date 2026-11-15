import type { Metadata } from "next";
import Link from "next/link";
import { Cap, InfoPage } from "@/components/public/info";
import { PLACES } from "@/components/shell/places";
import { CAPTURE_WORDS, KINDS, STATES, WORDS } from "@/features/palette/guide-content";
import { chordCaps, SHORTCUTS, type Chord } from "@/features/palette/shortcuts";

export const metadata: Metadata = {
  title: "Help",
  description: "How Axiis works: capture words, keys, views, working offline, the desktop app, and exporting or deleting your data.",
  alternates: { canonical: "/help" },
};

const CONTENTS = [
  { id: "capture", name: "Capture words" },
  { id: "views", name: "Views" },
  { id: "marks", name: "What you see" },
  { id: "keys", name: "Keys" },
  { id: "print", name: "Printing" },
  { id: "offline", name: "Offline" },
  { id: "desktop", name: "Desktop app" },
  { id: "install", name: "Install and share" },
  { id: "data", name: "Export and delete" },
];

const REPEATS: [string, string][] = [
  ["daily, weekdays, weekends", "at the start or end of a line: “daily 7am walk”"],
  ["every tuesday", "weekly on the days named: “every tuesday 7:30am to 9am gym”"],
];

function Chords({ chords, then }: { chords: Chord[]; then?: Chord }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {chords.map((chord, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-ink-3">or</span>}
          {chordCaps(chord, false).map((cap) => (
            <Cap key={cap}>{cap}</Cap>
          ))}
          {then && (
            <>
              <span className="text-ink-3">then</span>
              {chordCaps(then, false).map((cap) => (
                <Cap key={cap}>{cap}</Cap>
              ))}
            </>
          )}
        </span>
      ))}
    </span>
  );
}

const term = "text-[14px] font-medium text-ink";
const def = "mb-2 text-[14px] text-ink-2 min-[520px]:mb-0";
const grid = "mt-3 grid gap-x-5 gap-y-2 min-[520px]:grid-cols-[11rem_minmax(0,1fr)]";

export default function HelpPage() {
  return (
    <InfoPage title="Help" lead="What Axiis does and how to ask it, in one page. The changelog lists what has changed.">
      <nav aria-label="On this page">
        <ul>
          {CONTENTS.map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`}>{c.name}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="capture">
        <h2 id="capture">Capture words</h2>
        <p>
          Press <Cap>C</Cap> on any page to write something down. Put a day, a time or tags at the start or end of the line,
          and Axiis files it where you meant: <code>dentist tomorrow 9:00 #health</code>. A preview under the field shows what
          it understood before you save. Nothing is saved until you press Enter.
        </p>
        <dl className={grid}>
          {CAPTURE_WORDS.map(([name, words]) => (
            <div key={name} className="contents">
              <dt className={term}>{name}</dt>
              <dd className={def}>{words}</dd>
            </div>
          ))}
          <div className="contents">
            <dt className={term}>Tags</dt>
            <dd className={def}>a word with a hash, such as #health or #errands</dd>
          </div>
          {REPEATS.map(([name, words]) => (
            <div key={name} className="contents">
              <dt className={term}>{name}</dt>
              <dd className={def}>{words}</dd>
            </div>
          ))}
        </dl>
        <p>With no day, an item goes to the Inbox, where nothing is late. Plan it for a day when you are ready.</p>
      </section>

      <section aria-labelledby="views">
        <h2 id="views">Views</h2>
        <p>
          One set of items, seen several ways. Today and any other day show the Score, the day drawn as a printed line, or a
          plain list. Pick an area or a tag and every view narrows to it.
        </p>
        <dl className={grid}>
          {PLACES.map((p) => (
            <div key={p.id} className="contents">
              <dt className={term}>{p.label}</dt>
              <dd className={def}>
                {p.hint}.{p.go && <> G then <Cap>{p.go.toUpperCase()}</Cap> goes there.</>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="marks">
        <h2 id="marks">What you see</h2>
        <p>State is shown by the form of a line, not by colour alone.</p>
        <dl className={grid}>
          {KINDS.map((k) => (
            <div key={k.type} className="contents">
              <dt className={term}>{k.term}</dt>
              <dd className={def}>{k.says}</dd>
            </div>
          ))}
          {STATES.map((s) => (
            <div key={s.state} className="contents">
              <dt className={term}>{s.term}</dt>
              <dd className={def}>{s.says}</dd>
            </div>
          ))}
          {WORDS.map(([name, says]) => (
            <div key={name} className="contents">
              <dt className={term}>{name}</dt>
              <dd className={def}>{says}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="keys">
        <h2 id="keys">Keys</h2>
        <p>
          The same list is in the app: press <Cap>?</Cap>. On a Mac, read Ctrl as <Cap>⌘</Cap>.
        </p>
        {SHORTCUTS.map((group, g) => (
          <div key={group.where} role="group" aria-labelledby={`keys-${g}`}>
            <h3 id={`keys-${g}`} className="mt-6 text-[13px] font-semibold text-ink-3">
              {group.where}
            </h3>
            <dl className={grid}>
              {group.shortcuts.map((s) => (
                <div key={`${s.handler}-${s.does}`} className="contents">
                  <dt className={term}>
                    <Chords chords={s.chords} then={s.then} />
                  </dt>
                  <dd className={def}>{s.does}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section aria-labelledby="print">
        <h2 id="print">Printing</h2>
        <p>
          Use your browser&rsquo;s Print on Today or any day, the Week, a list or a note. The page prints as ink on white,
          without the side bar or buttons, each day on its own page, with done items left hollow.
        </p>
      </section>

      <section aria-labelledby="offline">
        <h2 id="offline">Offline</h2>
        <ul>
          <li>
            <strong>Capture works with no connection.</strong> The line waits on your device, marked as saved there, and is
            sent when you are back online. It is read then, with the clock of the moment you typed it, so &ldquo;tomorrow&rdquo;
            means the day you meant. At most 200 lines wait, and ones older than 30 days are removed.
          </li>
          <li>
            <strong>Pages you looked at lately stay readable.</strong> Today, Week, Month, Due, Done, Inbox, lists, notes and
            tags open from a saved copy for up to seven days, marked as saved. Other changes need a connection, and Axiis says
            so rather than losing them.
          </li>
          <li>
            <strong>Signing out clears the saved pages</strong> from the device. Captures still waiting stay for you, and are
            sent when you sign in again.
          </li>
        </ul>
      </section>

      <section aria-labelledby="desktop">
        <h2 id="desktop">Desktop app</h2>
        <p>
          Axiis also runs as a Windows app. It shows the same Axiis in its own window, keeps a list for today in the tray,
          reminds you before each timed item while it runs there, and opens an item in a window of its own. Get it from the{" "}
          <a href="https://github.com/MikhosCedric/axiis/releases/latest">releases page</a>. The installer is not signed yet, so
          Windows may ask you to confirm before it runs.
        </p>
      </section>

      <section aria-labelledby="install">
        <h2 id="install">Install and share</h2>
        <p>
          In a browser that offers it, install Axiis from the address bar or the share menu and it opens like an app. Once
          installed, its icon offers Capture, Today and Inbox directly, and Axiis appears in the share menu: share a page or
          some text to it and the capture field opens with that text filled in. It is never saved until you press Enter.
        </p>
      </section>

      <section aria-labelledby="data">
        <h2 id="data">Export and delete</h2>
        <ul>
          <li>
            <strong>Export.</strong> Settings, under Your data, downloads one JSON file with every item, note, checklist, area,
            tag and link, deleted ones included. Times are in UTC.
          </li>
          <li>
            <strong>Recently deleted.</strong> A deleted item waits there for 30 days and can be restored. After that it is
            removed for good.
          </li>
          <li>
            <strong>Delete your account.</strong> Settings asks you to type a phrase, then waits 14 days before deleting
            anything. Until then you can sign in as usual and undo it.
          </li>
        </ul>
        <p>
          More in the <Link href="/privacy">privacy page</Link>. To go back to your day, <Link href="/today">open Today</Link>.
        </p>
      </section>
    </InfoPage>
  );
}
