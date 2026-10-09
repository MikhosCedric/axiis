import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

/** The install icons the web app manifest names. Anything but a listed size is a 404. */
export async function GET(_request: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const wanted = (await params).size;
  const size = SIZES.find((s) => String(s) === wanted);
  if (!size) return new Response("Not found", { status: 404 });
  return new ImageResponse(<BrandMark size={size} />, { width: size, height: size });
}
