import { ImageResponse } from "next/og";
import { BrandMark, INK } from "@/lib/brand-mark";
import { PAPER_LIGHT } from "@/lib/theme-colors";

export const alt = "Axiis: your tasks and your time, on one page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card a shared link shows: the mark, the name and the one-line pitch, on paper. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: PAPER_LIGHT, color: INK, padding: "0 96px" }}>
        <BrandMark size={220} tile={false} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72 }}>
          <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>Axiis</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 44, marginTop: 28, lineHeight: 1.25 }}>
            <div>Your tasks and your time,</div>
            <div>on one page.</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
