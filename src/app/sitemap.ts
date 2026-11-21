import type { MetadataRoute } from "next";

const SITE = "https://sidhxntt.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/interactive`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/game`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
