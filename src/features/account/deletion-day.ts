import { cache } from "react";
import { getTimeZone, getTodayDate } from "@/features/day/server";
import { formatDayIn } from "@/features/today/format";
import { getDeletionRequest } from "@/lib/account";
import { toLocalDate } from "@/lib/dates";
import { deletionDue } from "./commands";

/** Server only. The day the signed-in account is due for deletion, "Friday 6 November", or null. Once per request. */
export const getDeletionDay = cache(async (): Promise<string | null> => {
  const requested = await getDeletionRequest();
  if (!requested) return null;
  return formatDayIn(toLocalDate(deletionDue(requested), await getTimeZone()), await getTodayDate());
});
