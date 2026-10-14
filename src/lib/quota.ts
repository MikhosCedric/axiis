export const QUOTA_MESSAGE = "This account has reached its size limit, so this was not saved. Write to support and we can help.";
export const RATE_MESSAGE = "You're going a little fast, so this was not saved. Try again in a moment.";

/**
 * The database's own refusals, by SQLSTATE: 54000 from the per-account caps in
 * migration 0006_quotas, 54R01 from the per-minute limits in 0007_rate_limits.
 */
const REFUSALS = new Map<unknown, string>([
  ["54000", QUOTA_MESSAGE],
  ["54R01", RATE_MESSAGE],
]);

function refusal(error: unknown): string | undefined {
  for (let e = error, depth = 0; e && typeof e === "object" && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const message = REFUSALS.get((e as { code?: unknown }).code);
    if (message) return message;
  }
  return undefined;
}

/** The sentence to show for a failed save: the database's own when it refused on purpose, the caller's otherwise. */
export const saveFailure = (error: unknown, fallback: string): string => refusal(error) ?? fallback;
