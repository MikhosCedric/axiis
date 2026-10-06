import { getFakeAccount } from "@/lib/supabase/fake-session";

/** Dev only: puts the browser-test account back to its fixtures. Answers 404 to any request without the fake session. */
export async function POST() {
  const fake = await getFakeAccount();
  if (!fake) return new Response("Not found", { status: 404 });
  fake.reset();
  return new Response(null, { status: 204 });
}
