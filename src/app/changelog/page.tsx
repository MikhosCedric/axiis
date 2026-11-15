import type { Metadata } from "next";
import { InfoPage } from "@/components/public/info";
import { CHANGELOG, changelogDate } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What has changed in Axiis, newest first.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return (
    <InfoPage title="Changelog" lead="What has changed in Axiis, newest first.">
      {CHANGELOG.map((entry) => (
        <section key={`${entry.date}-${entry.title}`} aria-labelledby={`c-${entry.date}-${CHANGELOG.indexOf(entry)}`}>
          <h2 id={`c-${entry.date}-${CHANGELOG.indexOf(entry)}`}>{entry.title}</h2>
          <p className="!mt-1 text-[14px] text-ink-3">
            <time dateTime={entry.date}>{changelogDate(entry.date)}</time>
          </p>
          <p>{entry.body}</p>
        </section>
      ))}
    </InfoPage>
  );
}
