import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { path: "/", priority: 1 },
    { path: "/help", priority: 0.5 },
    { path: "/changelog", priority: 0.3 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ].map(({ path, priority }) => ({ url: new URL(path, siteUrl).href, changeFrequency: "monthly", priority }));
}
