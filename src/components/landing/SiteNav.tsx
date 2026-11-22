"use client";

import { useEffect, useRef, useState } from "react";

// The pixel bar from the hero, kept on screen once the hero has scrolled
// away: the section you're reading is the yellow tab. On phones the tabs fold
// into a menu.

type Link = { label: string; href: string };

export function SiteNav({
  links,
  newsletter,
  resume,
  heroId = "top",
}: {
  links: Link[];
  newsletter: Link;
  resume: Link;
  heroId?: string;
}) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // in view once the hero is mostly gone
  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShown(e.intersectionRatio < 0.12), {
      threshold: [0, 0.12, 0.5],
    });
    io.observe(hero);
    return () => io.disconnect();
  }, [heroId]);

  // the section in the middle of the screen is the current one
  useEffect(() => {
    const sections = links
      .map((l) => (l.href.startsWith("#") ? document.getElementById(l.href.slice(1)) : null))
      .filter((s): s is HTMLElement => !!s);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(`#${e.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [links]);

  // the phone menu closes on a pick, Escape or a tap outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!shown) setOpen(false);
  }, [shown]);

  return (
    <header className="snav" data-shown={shown} inert={!shown}>
      <div className="snav__bar" ref={menu}>
        <a className="snav__home" href={`#${heroId}`} aria-label="Back to the top">
          <i aria-hidden />
          <span>SID</span>
        </a>
        <nav className="snav__tabs" aria-label="Sections">
          <ul>
            {links.map((l, i) => (
              <li key={l.href} data-on={active === l.href}>
                <a href={l.href} aria-current={active === l.href ? "location" : undefined}>
                  <span className="snav__ico" data-i={i % 4} aria-hidden />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="snav__end">
          <a className="snav__resume" href={resume.href} target="_blank" rel="noopener">
            {resume.label}
          </a>
          <a className="snav__news" href={newsletter.href}>
            <i aria-hidden />
            {newsletter.label}
          </a>
          <button
            type="button"
            className="snav__menu"
            aria-expanded={open}
            aria-controls="snav-sheet"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
        <div id="snav-sheet" className="snav__sheet" hidden={!open}>
          <ul>
            {[...links, resume].map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} {...(l === resume ? { target: "_blank", rel: "noopener" } : {})}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}
