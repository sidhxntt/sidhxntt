import { ConvexError } from "convex/values";

/** The message to show for a failed mutation or action. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : "That didn't work. Try again.";
  }
  return "Something went wrong. Check your connection and try again.";
}
