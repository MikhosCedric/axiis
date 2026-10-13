import type { Area } from "@/domain/item";
import type { Density, Theme } from "@/components/shell/cookies";
import type { TagSummary } from "@/domain/tag";
import { TagsSection, type TagActions } from "@/features/tags/tags-section";
import { AreasSection, type AreaActions } from "./areas-section";
import { DeleteAccountSection, type DeleteAccountAction } from "./delete-account-section";
import { DisplaySection } from "./display-section";

export const EXPORT_PATH = "/settings/export";

/** The page's parts, in order. From 1180px they are listed in a sticky index beside the page. */
const PARTS = [
  { id: "areas", name: "Areas" },
  { id: "tags", name: "Tags" },
  { id: "display", name: "Display" },
  { id: "your-data", name: "Your data" },
] as const;

export function SettingsView({
  email,
  areas,
  areaActions,
  tags,
  tagActions,
  tagHref,
  deleteAccount,
  theme = "system",
  density = "spacious",
}: {
  email: string | null;
  areas: Area[];
  areaActions: AreaActions;
  tags: TagSummary[];
  tagActions: TagActions;
  tagHref?: (name: string) => string;
  deleteAccount: DeleteAccountAction;
  /** The theme and density saved on this device. */
  theme?: Theme;
  density?: Density;
}) {
  return (
    <div
      className="max-w-[640px] px-4 pt-6 pb-16 rail:px-9 rail:pt-8 min-[1180px]:grid min-[1180px]:max-w-[968px] min-[1180px]:grid-cols-[11rem_minmax(0,1fr)] min-[1180px]:gap-x-12"
    >
      <header className="min-[1180px]:col-span-2">
        <h1 className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em]">Settings</h1>
        <p className="mt-2.5 text-[15px] break-words text-ink-2">
          {email ? (
            <>
              Signed in as <span className="text-ink">{email}</span>
            </>
          ) : (
            "Signed in"
          )}
        </p>
      </header>

      <nav aria-label="Settings sections" className="hidden min-[1180px]:sticky min-[1180px]:top-8 min-[1180px]:mt-10 min-[1180px]:block min-[1180px]:self-start">
        <ul className="border-t border-rule">
          {PARTS.map((part) => (
            <li key={part.id} className="border-b border-rule-soft">
              <a href={`#${part.id}`} className="block rounded-md px-2 py-2 font-medium text-ink-2 no-underline hover:bg-hover active:bg-press hover:text-ink">
                {part.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 min-w-0 space-y-12 [&>*]:scroll-mt-8">
        <div id="areas">
          <AreasSection areas={areas} actions={areaActions} />
        </div>

        <div id="tags">
          <TagsSection tags={tags} actions={tagActions} hrefFor={tagHref} />
        </div>

        <div id="display">
          <DisplaySection theme={theme} density={density} />
        </div>

        <div id="your-data" className="space-y-12">
          <section aria-labelledby="export-heading">
            <h2 id="export-heading" className="font-serif text-xl font-medium">
              Export your data
            </h2>
            <p className="mt-1.5 max-w-[60ch] text-ink-2">
              One JSON file with every item, note, checklist, area, tag and link in your account, including items and
              areas you have deleted. Times are in UTC. Nothing changes in your account when you export.
            </p>
            <a
              href={EXPORT_PATH}
              download
              className="mt-4 inline-flex items-center rounded-lg border border-rule px-3.5 py-2 font-medium text-ink no-underline hover:bg-hover active:bg-press pointer-coarse:min-h-11"
            >
              Download export
            </a>
          </section>

          <div className="border-t border-rule pt-10">
            <DeleteAccountSection action={deleteAccount} />
          </div>
        </div>
      </div>
    </div>
  );
}
