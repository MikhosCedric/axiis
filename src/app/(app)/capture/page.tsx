import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CAPTURE_PARAM, sharedCapture } from "@/features/today/capture-prefill";

export const metadata: Metadata = { title: "Capture" };

/**
 * Where the home-screen Capture shortcut and the share menu land (the manifest's `shortcuts` and `share_target`).
 * It sends the words, cleaned, to Today's capture field and saves nothing: a person reads them and presses Enter.
 */
export default async function CapturePage({ searchParams }: PageProps<"/capture">) {
  const { title, text, url } = await searchParams;
  redirect(`/today?${CAPTURE_PARAM}=${encodeURIComponent(sharedCapture({ title, text, url }))}`);
}
