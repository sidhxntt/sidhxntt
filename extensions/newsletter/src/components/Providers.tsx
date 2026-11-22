"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { CONVEX_URL, convexConfigured } from "../lib/config";

const client = convexConfigured ? new ConvexReactClient(CONVEX_URL) : null;

// Live queries, and Google sign-in (Convex Auth keeps the session in the
// browser and finishes the OAuth redirect when the page loads with ?code=).
export function Providers({ children }: { children: ReactNode }) {
  if (!client) return <>{children}</>;
  return <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider>;
}
