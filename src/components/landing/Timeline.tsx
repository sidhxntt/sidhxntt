"use client";

import { useEffect, useRef } from "react";
import { Figures } from "./Figures";

type Job = {
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  summary: string;
};

// Experience timeline that follows the scroll: a cobalt line fills the track
// as the reader moves through it, each dot lights up when the line reaches it,
// and each role fades in as it enters the viewport.
//
// Progressive enhancement: without JavaScript (or with reduced motion) the
// timeline renders fully drawn. The hidden starting state only applies once
// the effect below adds `is-live`.

/** Where on screen the line's tip sits, as a fraction of viewport height. */
const ANCHOR = 0.6;

/** First sentence of a summary leads; the rest become points beneath it. */
function splitSummary(summary: string) {
  const [lead, ...points] = summary.split(/(?<=\.)\s+(?=[A-Z0-9])/);
  return { lead, points };
}

export function Timeline({ jobs }: { jobs: Job[] }) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(list.querySelectorAll<HTMLElement>(".timeline__item"));
    list.classList.add("is-live");

    let frame = 0;
    const update = () => {
      frame = 0;
      const box = list.getBoundingClientRect();
      const tip = window.innerHeight * ANCHOR;
      const progress = Math.min(1, Math.max(0, (tip - box.top) / box.height));
      list.style.setProperty("--progress", progress.toFixed(4));
      for (const item of items) {
        // dots sit at the top of each item; light one once the tip passes it
        const reached = item.getBoundingClientRect().top + 12 <= tip;
        item.classList.toggle("is-reached", reached);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // reveal each role once, as it scrolls into view
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            reveal.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    items.forEach((item) => reveal.observe(item));

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      reveal.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      list.classList.remove("is-live");
    };
  }, []);

  return (
    <ol className="timeline" ref={listRef}>
      {jobs.map((job) => {
        const { lead, points } = splitSummary(job.summary);
        return (
          <li key={`${job.company}-${job.start}`} className="timeline__item">
            <p className="timeline__when">
              {job.start} – {job.end}
            </p>
            <h3 className="timeline__role">
              {job.role}, <span className="timeline__company">{job.company}</span>
            </h3>
            <p className="timeline__where">{job.location}</p>
            <p className="timeline__summary">
              <Figures text={lead} />
            </p>
            {points.length > 0 && (
              <ul className="timeline__points">
                {points.map((point) => (
                  <li key={point}>
                    <Figures text={point} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
