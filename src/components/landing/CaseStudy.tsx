import type { CSSProperties } from "react";
import { Figures } from "./Figures";

// The lead piece of work: the clinical data platform built at Tredence for
// Banner Health, as an index card. Client work has no public link or
// screenshot, so the pipeline itself is the picture: four sticky notes joined
// by drawn arrows, left to right on wide screens and top to bottom on phones.

const STAGES = [
  { name: "4 EHR sources", note: "Cerner, Health Catalyst, McKesson, Teradata", tone: "var(--nb-note-blue)" },
  { name: "CDC + Kafka", note: "10M+ patient records a day, streamed in real time", tone: "var(--nb-note-yellow)" },
  { name: "Bronze → Silver → Gold", note: "PySpark Medallion layers on Databricks, loaded by T-Ingestor from YAML", tone: "var(--nb-note-green)" },
  { name: "Clinical measures", note: "100+ rate metrics by facility, provider and cohort", tone: "#f8c9dc" },
];

const TECH = ["Databricks", "PySpark", "Kafka", "AWS", "SQLGlot", "PyTest", "GitHub CI/CD"];
const TILT = ["-1.6deg", "1.2deg", "-0.8deg", "1.6deg"];

export function CaseStudy() {
  return (
    <article className="case nb-sheet nb-sheet--taped" aria-labelledby="case-title">
      <div className="case__head">
        <p className="case__kicker nb-pixel">At work, Tredence for Banner Health</p>
        <h3 className="case__title" id="case-title">
          A HIPAA-compliant clinical data platform
        </h3>
        <p className="case__desc">
          <Figures text="Patient data from 4 hospital record systems is ingested, cleaned and rolled up into clinical quality metrics on Databricks and AWS. Delivery got 40% faster, QA turnaround 35% faster, and test coverage rose 60%." />
        </p>
      </div>
      <ol className="flow" aria-label="How the data flows">
        {STAGES.map((s, i) => (
          <li key={s.name} className="flow__stage">
            <div className="nb-note" style={{ "--c": s.tone, "--r": TILT[i] } as CSSProperties}>
              <span className="flow__name">
                <Figures text={s.name} />
              </span>
              <span className="flow__note">
                <Figures text={s.note} />
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div className="case__foot">
        <ul className="nb-chips" aria-label="Platform tech stack">
          {TECH.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="case__private nb-hand">client work, so no public link or screenshot</p>
      </div>
    </article>
  );
}
