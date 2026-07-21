import type { Metadata, Viewport } from "next";
import { linkApps, profile } from "@/data/portfolio";
import "./globals.css";

const SITE_URL = "https://sidhxntt.dev";
const TITLE = "Siddhant Gupta — Software Engineer | Interactive macOS Portfolio";
const DESCRIPTION =
  "Siddhant Gupta is a software engineer in Bengaluru building SaaS and developer tooling with Python, Go, TypeScript and Next.js. Explore his work through a fully interactive macOS-style portfolio — working apps, games, and an AI-powered Siri.";

// App-shell viewport: without maximumScale, iOS Safari auto-zooms the page
// whenever an input under 16px gets focus (Vault composer, Notes link dialog,
// Spotlight…), breaking the full-screen desktop/iOS illusion. Pinch zoom
// still works — Safari ignores the cap for user gestures.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Siddhant Gupta",
  },
  description: DESCRIPTION,
  keywords: [
    "Siddhant Gupta",
    "software engineer",
    "backend engineer",
    "portfolio",
    "interactive portfolio",
    "macOS portfolio",
    "web OS",
    "developer tooling",
    ...profile.skills,
    "Bengaluru",
  ],
  authors: [{ name: profile.name, url: SITE_URL }],
  creator: profile.name,
  publisher: profile.name,
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Siddhant Gupta — Portfolio OS",
    locale: "en_US",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Siddhant Gupta — Software Engineer. An interactive macOS-style portfolio.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@sidhxntt",
    creator: "@sidhxntt",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
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

// Person + WebSite structured data so search engines can build a knowledge
// panel and tie the site to its social profiles.
const JSON_LD = {
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
      name: "Siddhant Gupta — Portfolio OS",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#person` },
      inLanguage: "en",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden bg-black">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
