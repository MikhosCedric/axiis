/** SQLSTATE program_limit_exceeded, raised by the per-account caps in migration 0006_quotas. */
const QUOTA_EXCEEDED = "54000";

export const QUOTA_MESSAGE = "This account has reached its size limit, so this was not saved. Write to support and we can help.";

/** Whether a repo error, or any error it wraps, is a quota refusal from the database. */
export function isQuotaError(error: unknown): boolean {
  for (let e = error, depth = 0; e && typeof e === "object" && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    if ((e as { code?: unknown }).code === QUOTA_EXCEEDED) return true;
  }
  return false;
}

/** The sentence to show for a failed save: the quota's own when that is why, the caller's otherwise. */
export const saveFailure = (error: unknown, fallback: string): string => (isQuotaError(error) ? QUOTA_MESSAGE : fallback);
