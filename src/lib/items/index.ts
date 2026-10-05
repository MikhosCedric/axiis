import { createClient } from "@/lib/supabase/server";
import type { ItemsRepo } from "./repo";
import { SupabaseItemsRepo } from "./supabase-repo";

export class NotAuthenticatedError extends Error {
  override name = "NotAuthenticatedError";
}

/** Server only. Returns the items repository for the signed-in user, or throws if there is no session. */
export async function getItemsRepo(): Promise<ItemsRepo> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new NotAuthenticatedError("getItemsRepo needs a signed-in user");
  return new SupabaseItemsRepo(supabase);
}
