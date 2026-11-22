import type { Metadata, Viewport } from "next";
import "@fontsource/silkscreen/400.css";
import "@fontsource/reenie-beanie/400.css";
import "@fontsource-variable/inter-tight/wght.css";
import "@/styles/notebook.css";
import { baseMetadata, socialCards } from "@/lib/site-metadata";
import { Providers } from "../components/Providers";
import { DESCRIPTION, IMAGE, TITLE } from "../lib/meta";
import "./newsletter.css";

// Root layout for the newsletter at /newsletter: the site's notebook look
// (src/styles/notebook.css, light only), plus Convex (live data and Google
// sign-in).


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f1f2ee",
};

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: TITLE, template: `%s — ${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: "/newsletter" },
  ...socialCards(TITLE, DESCRIPTION, "/newsletter", IMAGE),
};

export default function NewsletterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="nl nb-page">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
