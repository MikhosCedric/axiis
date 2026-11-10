import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { TAGS_PATH } from "@/features/tags/model";

/**
 * A tag's page when no tag has that name: deleted, renamed, or an old link. Drawn inside the app, with the rail.
 * `data-not-found` tells the palette not to keep this address in Recent.
 */
export default function TagNotFound() {
  return (
    <div data-not-found className="mx-auto max-w-[760px] px-4 pt-6 pb-14 rail:px-9 rail:pt-8">
      <BackLink fallback={TAGS_PATH} />
      <h1 className="mt-2 headline">No such tag</h1>
      <p className="page-summary">It may have been renamed or deleted. Its items are still where they were.</p>
      <Link
        href={TAGS_PATH}
        className="mt-6 inline-flex items-center rounded-lg border border-rule px-3.5 py-2 font-medium text-ink no-underline hover:bg-hover active:bg-press pointer-coarse:min-h-11"
      >
        All tags
      </Link>
    </div>
  );
}
