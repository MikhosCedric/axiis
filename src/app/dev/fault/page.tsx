import { notFound } from "next/navigation";
import { devHarnessEnabled } from "@/lib/dev-harness";

/** Dev only: a page that always fails, so the browser tests can see the error boundary. */
export default async function FaultHarnessPage() {
  if (!devHarnessEnabled()) notFound();
  throw new Error("harness fault: secret-detail-4417 must never reach the page");
}
