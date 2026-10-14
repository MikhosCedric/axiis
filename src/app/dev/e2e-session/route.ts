import { devHarnessEnabled } from "@/lib/dev-harness";
import { getFakeAccount } from "@/lib/supabase/fake-session";

/** Browser-test build only: puts the in-memory account back to its starting items. Answers 404 anywhere else, and to any request without the fake session. */
export async function POST() {
  if (!devHarnessEnabled()) return new Response("Not found", { status: 404 });
  const fake = await getFakeAccount();
  if (!fake) return new Response("Not found", { status: 404 });
  fake.reset();
  return new Response(null, { status: 204 });
}
