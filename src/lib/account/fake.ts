import type { DeletionPort } from "@/features/account/commands";

/** An in-memory deletion request, for the browser-test account and the Settings harness. */
export function memoryDeletionPort(now: () => Date = () => new Date()): DeletionPort {
  let requestedAt: Date | null = null;
  return {
    async requestedAt() {
      return requestedAt;
    },
    async request() {
      requestedAt ??= now();
    },
    async withdraw() {
      requestedAt = null;
    },
  };
}
