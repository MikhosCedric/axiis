import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon iOS asks for. It rounds the corners itself, so the tile is square. */
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} />, size);
}
