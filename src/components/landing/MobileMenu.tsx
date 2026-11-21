"use client";

import { useEffect, useRef, useState } from "react";

type Link = { label: string; href: string; external?: boolean };

// Phone navigation: a menu button in the nav bar that opens a full-width
// panel of the section links. Closes on a link tap, Escape, or a tap
// outside, and hands focus back to the button. Hidden above 640px, where the
// links sit in the bar itself.

export function MobileMenu({ links }: { links: Link[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) buttonRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    // the menu is only for narrow screens; rotating to a wide one closes it
    const wide = window.matchMedia("(min-width: 641px)");
    const onWide = () => wide.matches && close(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    wide.addEventListener("change", onWide);
    document.documentElement.classList.add("menu-open");
    panelRef.current?.querySelector("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      wide.removeEventListener("change", onWide);
      document.documentElement.classList.remove("menu-open");
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="menu-button__bars" aria-hidden />
      </button>

      <div
        ref={panelRef}
        id="mobile-menu"
        className="mobile-menu"
        data-open={open || undefined}
        hidden={!open}
      >
        <nav aria-label="Sections">
          <ul className="mobile-menu__links">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
