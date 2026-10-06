"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getAreasRepo } from "@/lib/areas";
import { endFakeSession, getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/today/commands";
import { addArea, deleteAccount, moveArea, removeArea, renameArea } from "./commands";

// The repo is bound to the signed-in user's session and RLS scopes every
// write, so a direct POST without a session cannot touch anyone's rows.

function refreshed(result: ActionResult): ActionResult {
  if (result.ok) refresh();
  return result;
}

export async function addAreaAction(name: string): Promise<ActionResult> {
  return refreshed(await addArea(await getAreasRepo(), name));
}

export async function renameAreaAction(id: string, name: string): Promise<ActionResult> {
  return refreshed(await renameArea(await getAreasRepo(), id, name));
}

export async function removeAreaAction(id: string): Promise<ActionResult> {
  return refreshed(await removeArea(await getAreasRepo(), id));
}

export async function moveAreaAction(id: string, direction: string): Promise<ActionResult> {
  return refreshed(await moveArea(await getAreasRepo(), id, direction));
}

/** Deletes the signed-in user's account and everything in it, then sends them to the sign-in page. */
export async function deleteAccountAction(phrase: string): Promise<ActionResult> {
  const fake = await getFakeAccount();
  if (fake) {
    const result = await deleteAccount({ deleteMyAccount: async () => fake.reset(), signOut: endFakeSession }, phrase);
    if (!result.ok) return result;
    redirect("/login?deleted=1");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "Your session has ended. Sign in again to delete your account." };

  const result = await deleteAccount(
    {
      async deleteMyAccount() {
        const { error } = await supabase.rpc("delete_my_account");
        if (error) throw new Error(`delete_my_account failed: ${error.message}`, { cause: error });
      },
      async signOut() {
        // The user and all their sessions are gone, so only the cookies on this device are left to clear.
        await supabase.auth.signOut({ scope: "local" });
      },
    },
    phrase,
  );
  if (!result.ok) return result;
  redirect("/login?deleted=1");
}
