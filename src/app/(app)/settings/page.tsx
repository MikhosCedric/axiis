import type { Metadata } from "next";
import {
  addAreaAction,
  deleteAccountAction,
  moveAreaAction,
  removeAreaAction,
  renameAreaAction,
} from "@/features/account/actions";
import { SettingsView } from "@/features/account/settings-view";
import { getAreasRepo } from "@/lib/areas";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data }, areas] = await Promise.all([supabase.auth.getClaims(), getAreasRepo().then((repo) => repo.list())]);
  const email = data?.claims?.email;

  return (
    <SettingsView
      email={typeof email === "string" && email ? email : null}
      areas={areas}
      areaActions={{ add: addAreaAction, rename: renameAreaAction, remove: removeAreaAction, move: moveAreaAction }}
      deleteAccount={deleteAccountAction}
    />
  );
}
