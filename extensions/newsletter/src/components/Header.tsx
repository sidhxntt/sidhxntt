import Link from "next/link";
import { BASE } from "../lib/config";
import { AccountButton, SubscribeLink } from "./auth";

export function Header({ current }: { current?: "home" | "admin" }) {
  return (
    <header className="nl-header">
      <div className="wrap nl-header__inner">
        <Link className="nl-brand" href={BASE}>
          <span className="nl-brand__mark" aria-hidden="true" />
          <span className="nl-brand__name">
            SID&rsquo;s <span className="nl-brand__hand">newsletter</span>
          </span>
          <span className="sr-only">Newsletter home</span>
        </Link>
        <nav className="nl-nav" aria-label="Newsletter">
          <Link href={BASE} aria-current={current === "home" ? "page" : undefined}>
            Home
          </Link>
          <Link href={`${BASE}#series`}>Series</Link>
          <Link href={`${BASE}#posts`}>Posts</Link>
          <Link href={`${BASE}#topics`}>Topics</Link>
          <a href="/">Website</a>
        </nav>
        <div className="nl-header__end">
          <AccountButton />
          <SubscribeLink />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="nl-footer">
      <div className="wrap nl-footer__inner">
        <p>Written by Siddhant Gupta</p>
        <p>
          More of my work at <a href="/">sidhxntt.dev</a>
        </p>
      </div>
    </footer>
  );
}
