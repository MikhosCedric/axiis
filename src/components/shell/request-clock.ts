import { cookies, headers } from "next/headers";
import { cache } from "react";
import { headerClock } from "@/lib/clock";
import { CLOCK_COOKIE, readClock } from "./cookies";

/**
 * The clock setting and the clock times are written in for this request. With
 * no clock cookie yet (a first visit), Auto guesses from the request's first
 * language, the one the browser will report, so the first page does not
 * switch from 24-hour to 12-hour once the browser has said. Once per request.
 */
export const getRequestClock = cache(async () =>
  readClock((await cookies()).get(CLOCK_COOKIE)?.value, headerClock((await headers()).get("accept-language"))),
);
