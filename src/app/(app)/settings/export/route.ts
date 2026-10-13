import { cookies } from "next/headers";
import { TZ_COOKIE } from "@/components/shell/cookies";
import { EXPORT_TABLES, exportChunks, exportFilename, type ExportUser, type PageReader } from "@/features/account/export";
import { resolveTimeZone, toLocalDate } from "@/lib/dates";
import { getFakeAccount } from "@/lib/supabase/fake-session";
import { createClient } from "@/lib/supabase/server";

const plain = (status: number, text: string) =>
  new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

const FAILED = "The export did not finish. Nothing was changed. Try again in a moment.";

/** Downloads everything the signed-in user owns as one JSON file. Row Level Security limits every read to their rows. */
async function signedInSource(): Promise<{ user: ExportUser; read: PageReader } | null> {
  const fake = await getFakeAccount();
  if (fake) return { user: { id: fake.userId, email: fake.email, createdAt: null }, read: fake.readExport };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const email = typeof data.claims.email === "string" && data.claims.email ? data.claims.email : null;
  // The token carries no sign-up time. The auth server answers for the user's own session, no service key.
  const createdAt = (await supabase.auth.getUser().catch(() => null))?.data.user?.created_at ?? null;

  const read: PageReader = async (table, from, to) => {
    const { columns, orderBy } = EXPORT_TABLES[table];
    let query = supabase.from(table).select(columns);
    for (const column of orderBy) query = query.order(column);
    const { data: rows, error } = await query.range(from, to);
    if (error) throw new Error(`export of ${table} failed: ${error.message}`, { cause: error });
    return rows;
  };
  return { user: { id: userId, email, createdAt: createdAt && new Date(createdAt).toISOString() }, read };
}

/**
 * Streams the document a page at a time, so a large account neither builds the whole file in memory
 * nor waits on one response body. A failure before the first rows answers 500; a later one aborts
 * the download, which leaves an unfinished file the browser reports as failed.
 */
export async function GET() {
  const source = await signedInSource();
  if (!source) return plain(401, "Sign in to export your data.");

  const now = new Date();
  const chunks = exportChunks(source.read, { user: source.user, exportedAt: now });
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    console.error(error);
    return plain(500, FAILED);
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (first.done) controller.close();
      else controller.enqueue(encoder.encode(first.value));
    },
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        console.error(error);
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });

  const date = toLocalDate(now, resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value));
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(date)}"`,
      "Cache-Control": "no-store",
    },
  });
}
