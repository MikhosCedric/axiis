import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { PAPER_LIGHT } from "@/lib/theme-colors";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME}: tasks and time, on one page`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: PAPER_LIGHT,
    theme_color: PAPER_LIGHT,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
