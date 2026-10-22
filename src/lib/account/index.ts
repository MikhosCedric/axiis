import { cache } from "react";
import type { DeletionPort } from "@/features/account/commands";
import { NotAuthenticatedError } from "@/lib/items";
import { getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";
import { supabaseDeletionPort } from "./supabase";

/** Server only. The signed-in user's deletion request, or throws if there is no session. Once per request. */
export const getDeletionPort = cache(async (): Promise<DeletionPort> => {
  const fake = await getFakeAccount();
  if (fake) return fake.deletion;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (typeof sub !== "string") throw new NotAuthenticatedError("getDeletionPort needs a signed-in user");
  return supabaseDeletionPort(supabase, sub);
});

/**
 * Server only. When the signed-in user asked for deletion, or null. A failed read is null, so a page
 * still renders when the request cannot be read (before migration 0010, or a passing outage).
 */
export const getDeletionRequest = cache(async (): Promise<Date | null> => {
  try {
    return await (await getDeletionPort()).requestedAt();
  } catch {
    return null;
  }
});
