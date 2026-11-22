import type { Metadata, Viewport } from "next";
import "@fontsource/silkscreen/400.css";
import "@fontsource/reenie-beanie/400.css";
import "@fontsource-variable/inter-tight/wght.css";
import { profile } from "@/data/portfolio";
import { JSON_LD, SITE_DESCRIPTION, baseMetadata, socialCards } from "@/lib/site-metadata";
import "@/styles/notebook.css";
import "./landing.css";

// Root layout for the site at /: the notebook (src/styles/notebook.css),
// which is light only, like paper. Separate from the newsletter's root
// layout, so the two never share styles or scroll behaviour.

const TITLE = `${profile.name} — ${profile.role}`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f2ee",
};

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: TITLE, template: `%s — ${profile.name}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  ...socialCards(TITLE, SITE_DESCRIPTION, "/"),
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="site nb-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {children}
      </body>
    </html>
  );
}
