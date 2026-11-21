import { Figures } from "./Figures";

// The lead piece of work: the clinical data platform built at Tredence for
// Banner Health. Client work has no public link or screenshot, so the
// pipeline itself is the picture: an ordered list of stages that reads left
// to right on wide screens and top to bottom on phones.

const STAGES = [
  { name: "4 EHR sources", note: "Cerner, Health Catalyst, McKesson, Teradata" },
  { name: "CDC + Kafka", note: "10M+ patient records a day, streamed in real time" },
  { name: "Bronze → Silver → Gold", note: "PySpark Medallion layers on Databricks, loaded by T-Ingestor from YAML" },
  { name: "Clinical measures", note: "100+ rate metrics by facility, provider and cohort" },
];

const TECH = ["Databricks", "PySpark", "Kafka", "AWS", "SQLGlot", "PyTest", "GitHub CI/CD"];

export function CaseStudy() {
  return (
    <article className="case" aria-labelledby="case-title">
      <div className="case__text">
        <h3 className="feature__name" id="case-title">
          A HIPAA-compliant clinical data platform
        </h3>
        <p className="feature__tagline">Built at Tredence for Banner Health, on Databricks and AWS.</p>
        <p className="feature__desc">
          <Figures text="Patient data from 4 hospital record systems is ingested, cleaned and rolled up into clinical quality metrics. Delivery got 40% faster, QA turnaround 35% faster, and test coverage rose 60%." />
        </p>
      </div>
      <ol className="flow" aria-label="How the data flows">
        {STAGES.map((s) => (
          <li key={s.name} className="flow__stage">
            <span className="flow__name">
              <Figures text={s.name} />
            </span>
            <span className="flow__note">
              <Figures text={s.note} />
            </span>
          </li>
        ))}
      </ol>
      <ul className="tech case__tech" aria-label="Platform tech stack">
        {TECH.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="case__private">Client work, so there&rsquo;s no public link or screenshot.</p>
    </article>
  );
}
