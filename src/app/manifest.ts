import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { PAPER_LIGHT } from "@/lib/theme-colors";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME}: tasks and time, on one page`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/?app=1",
    scope: "/",
    display: "standalone",
    background_color: PAPER_LIGHT,
    theme_color: PAPER_LIGHT,
    shortcuts: [
      { name: "Capture", url: "/capture", description: "Write something down" },
      { name: "Today", url: "/today", description: "Your day, hour by hour" },
      { name: "Inbox", url: "/inbox", description: "Captured, with no day yet" },
    ],
    // Sharing text or a link to Axiis opens the capture field with it filled in. It is never saved until Enter.
    share_target: { action: "/capture", method: "GET", params: { title: "title", text: "text", url: "url" } },
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
