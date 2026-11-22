import type { MetadataRoute } from "next";
import { api } from "@nl-convex/_generated/api";
import { href } from "@nl/lib/config";
import { load } from "@nl/lib/server";

const SITE = "https://sidhxntt.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  // every published newsletter entry (skipped if the newsletter isn't connected)
  const posts = await load(api.posts.published, {});
  return [
    { url: SITE, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/interactive`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/game`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/newsletter`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...(posts.ok
      ? posts.data.map((p) => ({
          url: `${SITE}${href(p.path)}`,
          lastModified: p.publishedAt ? new Date(p.publishedAt) : lastModified,
          changeFrequency: "monthly" as const,
          priority: p.kind === "post" ? 0.7 : 0.6,
        }))
      : []),
  ];
}
