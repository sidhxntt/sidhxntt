import type { Metadata } from "next";
import "@fontsource/silkscreen/400.css";
import "@fontsource/reenie-beanie/400.css";
import "@fontsource-variable/inter-tight/wght.css";
import { PixelWord } from "@/components/landing/Juno";
import "@/styles/notebook.css";
import "./(site)/landing.css";

// The app has two root layouts (the site and the newsletter), so
// unmatched URLs need this standalone 404 page: the notebook, with 404 in the
// hero's selection frame.

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="site nb-page">
        <main className="nb-wrap not-found">
          <h1 className="not-found__frame">
            <span className="nb-sr">404: page not found</span>
            <i aria-hidden />
            <i aria-hidden />
            <i aria-hidden />
            <i aria-hidden />
            <PixelWord word="404" className="nb-word" />
          </h1>
          <p className="not-found__say nb-hand">this page isn&rsquo;t in the notebook.</p>
          <p className="not-found__more">The link may be old, or the address may have a typo.</p>
          <div className="not-found__actions">
            <a className="nb-btn" href="/">
              Go to the homepage
            </a>
            <a className="nb-btn nb-btn--light" href="/newsletter">
              Read the newsletter
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
