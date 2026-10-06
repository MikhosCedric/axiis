import type { Area } from "@/domain/item";
import type { TagSummary } from "@/domain/tag";
import { TagsSection, type TagActions } from "@/features/tags/tags-section";
import { AreasSection, type AreaActions } from "./areas-section";
import { DeleteAccountSection, type DeleteAccountAction } from "./delete-account-section";

export const EXPORT_PATH = "/settings/export";

export function SettingsView({
  email,
  areas,
  areaActions,
  tags,
  tagActions,
  tagHref,
  deleteAccount,
}: {
  email: string | null;
  areas: Area[];
  areaActions: AreaActions;
  tags: TagSummary[];
  tagActions: TagActions;
  tagHref?: (name: string) => string;
  deleteAccount: DeleteAccountAction;
}) {
  return (
    <div className="max-w-[640px] px-4 pt-6 pb-16 rail:px-9 rail:pt-8">
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

      <div className="mt-10 space-y-12">
        <AreasSection areas={areas} actions={areaActions} />

        <TagsSection tags={tags} actions={tagActions} hrefFor={tagHref} />

        <section aria-labelledby="export-heading">
          <h2 id="export-heading" className="font-serif text-xl font-medium">
            Export your data
          </h2>
          <p className="mt-1.5 max-w-[60ch] text-ink-2">
            One JSON file with every item, note, checklist, area, tag and link in your account, including items and areas
            you have deleted. Times are in UTC. Nothing changes in your account when you export.
          </p>
          <a
            href={EXPORT_PATH}
            download
            className="mt-4 inline-block rounded-lg border border-rule px-3.5 py-2 font-medium text-ink no-underline hover:bg-accent-wash"
          >
            Download export
          </a>
        </section>

        <div className="border-t border-rule pt-10">
          <DeleteAccountSection action={deleteAccount} />
        </div>
      </div>
    </div>
  );
}
