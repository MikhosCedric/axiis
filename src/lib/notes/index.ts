import { cache } from "react";
import { NotAuthenticatedError } from "@/lib/items";
import { getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";
import type { NotesRepo } from "./repo";
import { SupabaseNotesRepo } from "./supabase-repo";

/** Server only. Returns the notes repository for the signed-in user, or throws if there is no session. Once per request. */
export const getNotesRepo = cache(async (): Promise<NotesRepo> => {
  const fake = await getFakeAccount();
  if (fake) return fake.notes;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new NotAuthenticatedError("getNotesRepo needs a signed-in user");
  return new SupabaseNotesRepo(supabase);
});
