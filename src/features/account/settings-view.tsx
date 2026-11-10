import Link from "next/link";
import { BackLink } from "@/components/back-link";
import type { Area } from "@/domain/item";
import type { ClockSetting, Density, Theme } from "@/components/shell/cookies";
import type { Clock } from "@/lib/clock";
import type { TagSummary } from "@/domain/tag";
import { TagsSection, type TagActions } from "@/features/tags/tags-section";
import { AreasSection, type AreaActions } from "./areas-section";
import { DeleteAccountSection, type DeletionActions } from "./delete-account-section";
import { DesktopSection } from "./desktop-section";
import { DisplaySection } from "./display-section";
import { KeyboardSection } from "./keyboard-section";
import { SectionIndex, type SettingsPart } from "./section-index";

export const EXPORT_PATH = "/settings/export";

/** The page's parts, in order. A row of links under the heading; from 1180px a sticky index beside the page. */
function partsOf(desktop: boolean): SettingsPart[] {
  return [
    { id: "areas", name: "Areas" },
    { id: "tags", name: "Tags" },
    { id: "display", name: "Display" },
    { id: "keyboard", name: "Keyboard" },
    ...(desktop ? [{ id: "desktop", name: "Desktop app" }] : []),
    { id: "your-data", name: "Your data" },
  ];
}

const plainButton =
  "mt-4 inline-flex items-center rounded-lg border border-rule px-3.5 py-2 font-medium text-ink no-underline hover:bg-hover active:bg-press pointer-coarse:min-h-11";

/** How many items wait in Recently deleted, in words. */
function deletedWords(n: number): string {
  if (n === 0) return "Nothing is there now.";
  return n === 1 ? "One item is there now." : `${n} items are there now.`;
}

export function SettingsView({
  email,
  areas,
  areaActions,
  tags,
  tagActions,
  tagHref,
  deletion,
  deletesOn = null,
  theme = "system",
  density = "spacious",
  clock = { setting: "auto", clock: "24" },
  colorHint = true,
  deletedCount = null,
  desktop = null,
}: {
  email: string | null;
  areas: Area[];
  areaActions: AreaActions;
  tags: TagSummary[];
  tagActions: TagActions;
  tagHref?: (name: string) => string;
  deletion: DeletionActions;
  /** The day a scheduled deletion falls due, or null when none is scheduled. */
  deletesOn?: string | null;
  /** The theme and density saved on this device. */
  theme?: Theme;
  density?: Density;
  /** The time format chosen on this device, and the clock it comes to. */
  clock?: { setting: ClockSetting; clock: Clock };
  /** The suggestion to colour areas has not been dismissed on this device. */
  colorHint?: boolean;
  /** How many items are in Recently deleted, or null when not counted. */
  deletedCount?: number | null;
  /** In the desktop app, its settings as saved on this device; null on the web, where the section is not shown. */
  desktop?: { reminders: boolean } | null;
}) {
  const parts = partsOf(desktop !== null);
  return (
    <div
      className="max-w-[640px] px-4 pt-6 pb-16 rail:px-9 rail:pt-8 min-[1180px]:grid min-[1180px]:mx-auto min-[1180px]:max-w-[968px] min-[1180px]:grid-cols-[10rem_minmax(0,1fr)] min-[1180px]:gap-x-12"
    >
      <header className="min-[1180px]:col-span-2">
        <BackLink />
        <h1 className="mt-2 headline">Settings</h1>
        <p className="page-summary break-words">
          {email ? (
            <>
              Signed in as <span className="text-ink">{email}</span>
            </>
          ) : (
            "Signed in"
          )}
        </p>
      </header>

      <SectionIndex parts={parts} />

      <div className="mt-10 min-w-0 space-y-12 [&>*]:scroll-mt-8 max-rail:[&>*]:scroll-mt-24">
        <div id="areas">
          <AreasSection areas={areas} actions={areaActions} colorHint={colorHint} />
        </div>

        <div id="tags">
          <TagsSection tags={tags} actions={tagActions} hrefFor={tagHref} />
        </div>

        <div id="display">
          <DisplaySection theme={theme} density={density} clock={clock} />
        </div>

        <div id="keyboard">
          <KeyboardSection />
        </div>

        {desktop && (
          <div id="desktop">
            <DesktopSection reminders={desktop.reminders} />
          </div>
        )}

        <div id="your-data" className="space-y-12">
          <section aria-labelledby="trash-heading">
            <h2 id="trash-heading" className="font-display text-xl font-medium">
              Recently deleted
            </h2>
            <p className="mt-1.5 max-w-[60ch] text-ink-2">
              Items you delete wait here for 30 days, and each can be restored.
              {deletedCount !== null && <> {deletedWords(deletedCount)}</>}
            </p>
            <Link href="/trash" className={plainButton}>
              Open recently deleted
            </Link>
          </section>

          <section aria-labelledby="export-heading">
            <h2 id="export-heading" className="font-display text-xl font-medium">
              Export your data
            </h2>
            <p className="mt-1.5 max-w-[60ch] text-ink-2">
              One JSON file with every item, note, checklist, area, tag and link in your account, including items and
              areas you have deleted. Times are in UTC. Nothing changes in your account when you export.
            </p>
            <a href={EXPORT_PATH} download className={plainButton}>
              Download export
            </a>
          </section>

          <div className="border-t border-rule pt-10">
            <DeleteAccountSection actions={deletion} deletesOn={deletesOn} />
          </div>
        </div>
      </div>
    </div>
  );
}
