"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@nl-convex/_generated/api";
import { convexConfigured } from "../lib/config";
import { errorMessage } from "./errors";

export function SubscribeForm({ id = "subscribe-email" }: { id?: string }) {
  if (!convexConfigured) {
    return <p className="subscribe__note">Subscriptions open once the newsletter is connected.</p>;
  }
  return <Form id={id} />;
}

function Form({ id }: { id: string }) {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  if (me?.isAdmin) {
    return (
      <p className="subscribe__note subscribe__note--author">
        You write this newsletter, so you can&rsquo;t subscribe to it. Readers see the sign-up form here.
      </p>
    );
  }
  return <Fields id={id} />;
}

function Fields({ id }: { id: string }) {
  const subscribe = useMutation(api.subscribers.subscribe);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; text?: string }>({
    kind: "idle",
  });

  return (
    <div>
      <form
        className="subscribe"
        onSubmit={async (e) => {
          e.preventDefault();
          setState({ kind: "sending" });
          try {
            await subscribe({ email });
            setState({ kind: "done", text: "Check your inbox and confirm, and you're on the list." });
            setEmail("");
          } catch (error) {
            setState({ kind: "error", text: errorMessage(error) });
          }
        }}
      >
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn--solid" type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      <p
        className={`subscribe__note ${state.kind === "error" ? "subscribe__note--error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {state.text ?? ""}
      </p>
    </div>
  );
}
