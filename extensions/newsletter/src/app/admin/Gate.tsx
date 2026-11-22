"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@nl-convex/_generated/api";
import { SignInButton } from "../../components/auth";
import { BASE, convexConfigured } from "../../lib/config";

// Only the newsletter's author gets past this. It's a convenience: every
// admin query and mutation checks the same thing on the server.
export function AdminGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  if (!convexConfigured) {
    return (
      <div className="notice">
        <h1>Not connected yet</h1>
        <p>Set NEXT_PUBLIC_CONVEX_URL for this site (see the newsletter&rsquo;s README), then come back.</p>
      </div>
    );
  }
  return <Gate fallback={fallback}>{children}</Gate>;
}

function Gate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const { signOut } = useAuthActions();

  if (isLoading || (isAuthenticated && me === undefined)) {
    return (
      fallback ?? (
        <div className="notice">
          <p>Checking who you are…</p>
        </div>
      )
    );
  }
  if (!isAuthenticated || !me) {
    return (
      <div className="notice">
        <h1>Write and manage</h1>
        <p>Sign in with the newsletter author&rsquo;s Google account.</p>
        <SignInButton label="Sign in with Google" className="btn btn--primary" />
      </div>
    );
  }
  if (!me.isAdmin) {
    return (
      <div className="notice">
        <h1>This area is for the author</h1>
        <p>
          You&rsquo;re signed in as {me.email ?? me.name}. Readers can like and comment on any post from the{" "}
          <Link href={BASE}>newsletter</Link>.
        </p>
        <button type="button" className="btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
