import { unstable_rethrow } from "next/navigation";
import { getFunctionName, type FunctionArgs, type FunctionReference, type FunctionReturnType } from "convex/server";
import { convexToJson, jsonToConvex, type Value } from "convex/values";
import { CONVEX_URL, convexConfigured } from "./config";

export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: "not-configured" | "unreachable" };

// How long a rendered page may be served before it's rebuilt with fresh data.
const REVALIDATE_SECONDS = 60;

/**
 * Run a public Convex query while rendering a page on the server.
 *
 * Calls Convex's HTTP query API with Next's fetch, so pages are cached and
 * refreshed every minute. (convex/nextjs's fetchQuery opts out of caching,
 * which would render every page on every request.)
 */
export async function load<Q extends FunctionReference<"query", "public">>(
  query: Q,
  args: FunctionArgs<Q>,
): Promise<Loaded<FunctionReturnType<Q>>> {
  if (!convexConfigured) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetch(`${CONVEX_URL.replace(/\/+$/, "")}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: getFunctionName(query),
        format: "convex_encoded_json",
        args: [convexToJson(args as Value)],
      }),
      next: { revalidate: REVALIDATE_SECONDS, tags: ["newsletter"] },
    });
    const body = (await res.json()) as { status: string; value?: unknown; errorMessage?: string };
    if (!res.ok || body.status !== "success") throw new Error(body.errorMessage ?? `HTTP ${res.status}`);
    return { ok: true, data: jsonToConvex(body.value as never) as FunctionReturnType<Q> };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[newsletter] Convex query failed:", error);
    return { ok: false, reason: "unreachable" };
  }
}
