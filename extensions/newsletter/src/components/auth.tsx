"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { api } from "@nl-convex/_generated/api";
import { BASE, convexConfigured } from "../lib/config";
import { Avatar } from "./Avatar";

/** Start Google sign-in and come back to this page afterwards. */
export function useGoogleSignIn() {
  const { signIn } = useAuthActions();
  return () => signIn("google", { redirectTo: window.location.pathname + window.location.search });
}

export function SignInButton({ label = "Sign in", className = "btn" }: { label?: string; className?: string }) {
  const signIn = useGoogleSignIn();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn().catch(() => setBusy(false));
      }}
    >
      <GoogleMark />
      {busy ? "Opening Google…" : label}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
    </svg>
  );
}

/** The header's Subscribe button; the author never sees it. */
export function SubscribeLink() {
  const link = (
    <Link className="btn btn--solid" href={`${BASE}#subscribe`}>
      Subscribe
    </Link>
  );
  if (!convexConfigured) return link;
  return <SubscribeLinkFor>{link}</SubscribeLinkFor>;
}

function SubscribeLinkFor({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  return me?.isAdmin ? null : children;
}

/** The header's sign-in button, or the signed-in reader's menu. */
export function AccountButton() {
  if (!convexConfigured) return null;
  return <Account />;
}

function Account() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();
  const menu = useMenuDismiss();

  if (isLoading || (isAuthenticated && me === undefined)) {
    return <span className="avatar skel" style={{ width: 44, height: 44 }} aria-hidden="true" />;
  }
  if (!isAuthenticated || !me) return <SignInButton />;

  return (
    <>
      {me.isAdmin && (
        <Link className="btn btn--primary" href={`${BASE}/admin`}>
          Admin
        </Link>
      )}
      <details className="nl-user" ref={menu}>
        <summary aria-label={`Account: ${me.name}`}>
          <Avatar name={me.name} image={me.image} size={44} />
        </summary>
        <div className="nl-user__menu">
          <div className="nl-user__who">
            Signed in as <strong>{me.name}</strong>
            {me.email && <div>{me.email}</div>}
          </div>
          <Link href={`${BASE}/profile`}>Saved posts</Link>
          {me.isAdmin && <Link href={`${BASE}/admin`}>Write and manage</Link>}
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </details>
    </>
  );
}

// A <details> menu that closes like a menu should: on a click outside, on
// Escape (handing focus back to its button) and when the page changes.
function useMenuDismiss() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key === "Escape" && el?.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return ref;
}
