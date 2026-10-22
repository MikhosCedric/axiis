import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { DeletionPort } from "@/features/account/commands";

const requestRow = z.object({ requested_at: z.string() }).nullable();

/** `account_deletions` (migration 0010). Row Level Security keeps every query to the signed-in user's one row. */
export function supabaseDeletionPort(db: SupabaseClient, userId: string): DeletionPort {
  const fail = (operation: string, error: { message: string }) =>
    new Error(`account_deletions.${operation} failed: ${error.message}`, { cause: error });
  return {
    async requestedAt() {
      const { data, error } = await db.from("account_deletions").select("requested_at").eq("user_id", userId).maybeSingle();
      if (error) throw fail("select", error);
      const row = requestRow.parse(data);
      return row ? new Date(row.requested_at) : null;
    },
    async request() {
      // Ignoring the duplicate keeps the first request's time, so asking twice never pushes the date out.
      const { error } = await db
        .from("account_deletions")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw fail("insert", error);
    },
    async withdraw() {
      const { error } = await db.from("account_deletions").delete().eq("user_id", userId);
      if (error) throw fail("delete", error);
    },
  };
}
