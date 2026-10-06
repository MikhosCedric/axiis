import { cookies } from "next/headers";
import { TZ_COOKIE } from "@/components/shell/cookies";
import { collectExport, EXPORT_TABLES, exportFilename, type PageReader } from "@/features/account/export";
import { resolveTimeZone, toLocalDate } from "@/lib/dates";
import { getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";

const plain = (status: number, text: string) =>
  new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/** Downloads everything the signed-in user owns as one JSON file. Row Level Security limits every read to their rows. */
async function signedInSource(): Promise<{ userId: string; read: PageReader } | null> {
  const fake = await getFakeAccount();
  if (fake) return { userId: fake.userId, read: fake.readExport };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const read: PageReader = async (table, from, to) => {
    const { columns, orderBy } = EXPORT_TABLES[table];
    let query = supabase.from(table).select(columns);
    for (const column of orderBy) query = query.order(column);
    const { data: rows, error } = await query.range(from, to);
    if (error) throw new Error(`export of ${table} failed: ${error.message}`, { cause: error });
    return rows;
  };
  return { userId, read };
}

export async function GET() {
  const source = await signedInSource();
  if (!source) return plain(401, "Sign in to export your data.");
  const { userId, read } = source;

  const now = new Date();
  let body: string;
  try {
    body = JSON.stringify(await collectExport(read, { userId, exportedAt: now }), null, 2);
  } catch (error) {
    console.error(error);
    return plain(500, "The export did not finish. Nothing was changed. Try again in a moment.");
  }

  const date = toLocalDate(now, resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value));
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(date)}"`,
      "Cache-Control": "no-store",
    },
  });
}
