import { createClient } from "@/lib/supabase/server";
import { NotAuthenticatedError } from "@/lib/items";
import type { AreasRepo } from "./repo";
import { SupabaseAreasRepo } from "./supabase-repo";

/** Server only. Returns the areas repository for the signed-in user, or throws if there is no session. */
export async function getAreasRepo(): Promise<AreasRepo> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new NotAuthenticatedError("getAreasRepo needs a signed-in user");
  return new SupabaseAreasRepo(supabase);
}
