"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@nl-convex/_generated/api";
import type { Id } from "@nl-convex/_generated/dataModel";
import { convexConfigured } from "../lib/config";

// Counts a view when the post opens and a read when the reader reaches its
// end after spending a fair share of its reading time on the page. Sits right
// after the post's text, which is the "end" it watches for.

const KEY = "nl-visitor";

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked: don't count rather than count twice
  }
}

export function ReadTracker(props: { postId: Id<"posts">; minutes: number | null }) {
  if (!convexConfigured) return null;
  return <Tracker {...props} />;
}

function Tracker({ postId, minutes }: { postId: Id<"posts">; minutes: number | null }) {
  const end = useRef<HTMLSpanElement>(null);
  const recordView = useMutation(api.analytics.recordView);
  const recordRead = useMutation(api.analytics.recordRead);

  useEffect(() => {
    const visitor = visitorId();
    if (!visitor) return;
    recordView({ postId, visitor }).catch(() => {});

    // a quarter of the reading time, at least 10 seconds and at most 2 minutes
    const needed = Math.min(120, Math.max(10, (minutes ?? 1) * 60 * 0.25)) * 1000;
    const opened = Date.now();
    let seenEnd = false;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryRead = () => {
      if (done || !seenEnd || Date.now() - opened < needed) return;
      done = true;
      recordRead({ postId, visitor }).catch(() => {});
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        seenEnd = true;
        tryRead();
        if (!done) timer = setTimeout(tryRead, needed - (Date.now() - opened));
      }
    });
    if (end.current) observer.observe(end.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [postId, minutes, recordView, recordRead]);

  return <span ref={end} className="read-end" aria-hidden="true" />;
}
