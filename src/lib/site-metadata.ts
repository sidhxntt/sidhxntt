import type { Metadata } from "next";
import { linkApps, profile } from "@/data/portfolio";

// Metadata shared by both root layouts: the site at / and the newsletter at
// /newsletter. Each layout spreads this and overrides the title, description
// and canonical URL for its own section.

const SITE_URL = "https://sidhxntt.dev";

export const SITE_DESCRIPTION =
  "Siddhant Gupta is a backend engineer in Bengaluru building SaaS and developer tooling with Python, Go, TypeScript and Next.js. Read about his work and his newsletter.";

export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  keywords: [
    "Siddhant Gupta",
    "software engineer",
    "backend engineer",
    "portfolio",
    "developer tooling",
    ...profile.skills,
    "Bengaluru",
  ],
  authors: [{ name: profile.name, url: SITE_URL }],
  creator: profile.name,
  publisher: profile.name,
  category: "technology",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

/** Open Graph + Twitter cards for a page with the given title and description. */
export function socialCards(title: string, description: string, path: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      url: path,
      siteName: `${profile.name} — Portfolio`,
      locale: "en_US",
      title,
      description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: `${profile.name} — ${profile.role}` }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@sidhxntt",
      creator: "@sidhxntt",
      title,
      description,
      images: ["/og.jpg"],
    },
  };
}

/** Person + WebSite structured data so search engines can tie the site to its profiles. */
export const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: profile.name,
      jobTitle: profile.role,
      description: profile.bio[1],
      email: `mailto:${profile.email}`,
      url: SITE_URL,
      image: `${SITE_URL}/avatar.jpg`,
      address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressCountry: "IN" },
      knowsAbout: profile.skills,
      sameAs: [...profile.socials.map((s) => s.url), ...linkApps.map((l) => l.url)],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: `${profile.name} — Portfolio`,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#person` },
      inLanguage: "en",
    },
  ],
};
