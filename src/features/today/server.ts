import { cookies } from "next/headers";
import { cache } from "react";
import { TZ_COOKIE } from "@/components/shell/cookies";
import { getItemsRepo } from "@/lib/items";
import { resolveTimeZone } from "@/lib/dates";
import { loadToday } from "./commands";

/** One load per request, shared by the shell's nav and the Today page. */
export const getToday = cache(async () => {
  const timeZone = resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value);
  return loadToday(await getItemsRepo(), new Date(), timeZone);
});
