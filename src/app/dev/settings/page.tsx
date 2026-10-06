import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsHarness } from "./harness";

export const metadata: Metadata = { title: "Settings harness" };

/** Dev only: the settings page with in-memory areas and a fake account delete, for checking it without a session. */
export default function SettingsHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SettingsHarness />;
}
