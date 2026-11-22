import type { Metadata } from "next";
import { linkApps, profile } from "@/data/portfolio";

// Metadata shared by both root layouts: the site at / and the newsletter at
// /newsletter. Each layout spreads this and overrides the title, description
// and canonical URL for its own section.

const SITE_URL = "https://sidhxntt.dev";

export const SITE_DESCRIPTION =
  "Siddhant (Sid) Gupta, a backend engineer in Bengaluru. I build data platforms and dev tools that are easy to trace, and write about how software gets built.";

/** A 1200×630 link-preview card in the notebook look, from public/og. */
export type SocialImage = { url: string; alt: string };

export const SITE_IMAGE: SocialImage = {
  url: "/og/site.jpg",
  alt: "SID in pixel letters on lined notebook paper: I build data platforms and dev tools that are easy to trace.",
};

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
export function socialCards(
  title: string,
  description: string,
  path: string,
  image: SocialImage = SITE_IMAGE,
): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      url: path,
      siteName: "sidhxntt.dev",
      locale: "en_US",
      title,
      description,
      images: [{ ...image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@sidhxntt",
      creator: "@sidhxntt",
      title,
      description,
      images: [image],
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
