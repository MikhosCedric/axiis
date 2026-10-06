import type { Metadata } from "next";
import {
  addAreaAction,
  deleteAccountAction,
  moveAreaAction,
  removeAreaAction,
  renameAreaAction,
} from "@/features/account/actions";
import { SettingsView } from "@/features/account/settings-view";
import { deleteTagAction, renameTagAction } from "@/features/tags/actions";
import { loadTagIndex } from "@/features/tags/commands";
import { getAreasRepo } from "@/lib/areas";
import { getItemsRepo } from "@/lib/items";
import { getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

async function signedInEmail(): Promise<string | null> {
  const fake = await getFakeAccount();
  if (fake) return fake.email;
  const { data } = await (await createClient()).auth.getClaims();
  const email = data?.claims?.email;
  return typeof email === "string" && email ? email : null;
}

export default async function SettingsPage() {
  const [email, areas, tags] = await Promise.all([
    signedInEmail(),
    getAreasRepo().then((repo) => repo.list()),
    getItemsRepo().then(loadTagIndex),
  ]);

  return (
    <SettingsView
      email={email}
      areas={areas}
      areaActions={{ add: addAreaAction, rename: renameAreaAction, remove: removeAreaAction, move: moveAreaAction }}
      tags={tags}
      tagActions={{ rename: renameTagAction, remove: deleteTagAction }}
      deleteAccount={deleteAccountAction}
    />
  );
}
