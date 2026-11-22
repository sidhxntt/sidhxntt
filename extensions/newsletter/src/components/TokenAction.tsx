"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@nl-convex/_generated/api";
import { BASE, convexConfigured } from "../lib/config";
import { errorMessage } from "./errors";

// The confirm and unsubscribe links from emails. Both wait for a click, so
// mail scanners that open every link can't act on someone's behalf.
export function TokenAction({ token, action }: { token: string; action: "confirm" | "unsubscribe" }) {
  if (!convexConfigured || !token) {
    return (
      <div className="notice">
        <h1>That link is incomplete</h1>
        <p>Open the link from your email again, or subscribe from the newsletter&rsquo;s home page.</p>
        <Link className="btn" href={BASE}>
          Go to the newsletter
        </Link>
      </div>
    );
  }
  return <Inner token={token} action={action} />;
}

function Inner({ token, action }: { token: string; action: "confirm" | "unsubscribe" }) {
  const confirm = useMutation(api.subscribers.confirm);
  const unsubscribe = useMutation(api.subscribers.unsubscribe);
  const [state, setState] = useState<"ready" | "busy" | "done" | "invalid" | "error">("ready");
  const [message, setMessage] = useState("");

  const run = async () => {
    setState("busy");
    try {
      const res = await (action === "confirm" ? confirm({ token }) : unsubscribe({ token }));
      setState(res.status === "invalid" ? "invalid" : "done");
    } catch (e) {
      setMessage(errorMessage(e));
      setState("error");
    }
  };

  if (state === "done") {
    return action === "confirm" ? (
      <div className="notice">
        <h1>You&rsquo;re subscribed</h1>
        <p>New posts will arrive in your inbox. Every email has a link to unsubscribe.</p>
        <Link className="btn btn--primary" href={BASE}>
          Read the newsletter
        </Link>
      </div>
    ) : (
      <div className="notice">
        <h1>You&rsquo;re unsubscribed</h1>
        <p>You won&rsquo;t get any more emails. Changed your mind? Subscribe again from the home page.</p>
        <Link className="btn" href={BASE}>
          Go to the newsletter
        </Link>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="notice">
        <h1>That link has expired</h1>
        <p>
          {action === "confirm"
            ? "Subscribe again from the home page and use the newest email."
            : "This address may already be unsubscribed."}
        </p>
        <Link className="btn" href={BASE}>
          Go to the newsletter
        </Link>
      </div>
    );
  }

  return (
    <div className="notice">
      <h1>{action === "confirm" ? "Confirm your subscription" : "Unsubscribe from the newsletter"}</h1>
      <p>
        {action === "confirm"
          ? "One click and new posts will arrive by email."
          : "You'll stop getting emails about new posts."}
      </p>
      <button
        type="button"
        className={`btn ${action === "confirm" ? "btn--primary" : "btn--danger"}`}
        disabled={state === "busy"}
        onClick={() => void run()}
      >
        {state === "busy" ? "One moment…" : action === "confirm" ? "Confirm subscription" : "Unsubscribe"}
      </button>
      {state === "error" && <p className="error-text">{message}</p>}
    </div>
  );
}
