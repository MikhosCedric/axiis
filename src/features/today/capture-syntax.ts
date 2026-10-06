import type { CaptureResult } from "./commands";

type Captured = Extract<CaptureResult, { ok: true }>;

/** What the capture field's status line says once a capture has saved. */
export function capturedLine(result: Captured): string {
  if (result.type === "checklist") return "Captured. It is open, ready for its lines.";
  return "Captured. It is waiting for a time, below.";
}
