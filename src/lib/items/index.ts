import { cache } from "react";
import { getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";
import type { ItemsRepo } from "./repo";
import { SupabaseItemsRepo } from "./supabase-repo";

export class NotAuthenticatedError extends Error {
  override name = "NotAuthenticatedError";
}

/**
 * Server only. Returns the items repository for the signed-in user, or throws if there is no session.
 * Once per request: the session check can be a round trip to Supabase Auth, and a page asks for the repo several times.
 */
export const getItemsRepo = cache(async (): Promise<ItemsRepo> => {
  const fake = await getFakeAccount();
  if (fake) return fake.items;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new NotAuthenticatedError("getItemsRepo needs a signed-in user");
  return new SupabaseItemsRepo(supabase);
});
