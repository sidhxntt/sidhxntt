// The seed notes the Notes app opens with — one per section of the old
// portfolio (github.com/sidhxntt/sidhxntt/docs/index.html). Bodies are markdown
// and render formatted in the app; the raw syntax is never shown.
//
// No body starts with an h1: the note's title already renders above it, so a
// heading that repeats it reads as a duplicate. Sections are h2, subsections h3.
//
// Anything that also lives in profile (stats, experience, expertise, skills) is
// composed from it here, so those facts have exactly one home: input/02-profile.json.

import { profile } from "./portfolio";

export type SeedNote = {
  id: string;
  title: string;
  body: string;
  /** how many days back the note is stamped, so the list groups like real notes */
  daysAgo: number;
};

const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

export const seedNotes: SeedNote[] = [
  {
    id: "about-me",
    title: "About Me",
    daysAgo: 0,
    body: `## ${profile.headline}

*${profile.tagline}*

${profile.bio.join("\n\n")}

### By the numbers

${table(
  ["Metric", "Number"],
  profile.stats.map((s) => [s.label, `**${s.value}**`]),
)}

> ${profile.quote}

---

Reach me at [${profile.email}](mailto:${profile.email}) — or __book a call__.`,
  },
  {
    id: "skills",
    title: "Skills",
    daysAgo: 1,
    body: `## Experienced with these tools

As a developer, I use far too many tools and technologies to bring ideas to life, but these are my favourites — the ones I have *real* experience with.

### Daily drivers

${profile.skills
  .slice(0, 5)
  .map((s) => `- **${s}**`)
  .join("\n")}

### The rest of the belt

${table(
  ["Area", "Tools"],
  [
    ["__Languages__", "Python, Golang, TypeScript, SQL, Bash"],
    ["__Frameworks__", "Next.js, Node.js, Express.js, FastAPI, Django, Prisma"],
    ["__Data__", "PostgreSQL, MongoDB, Supabase, Redis, Kafka, Spark, Airflow, Databricks"],
    ["__Infra__", "Docker, Kubernetes, AWS, Nginx, CI/CD"],
    ["__Observability__", "Prometheus, Grafana, Sentry, ELK Stack"],
  ],
)}`,
  },
  {
    id: "work-experience",
    title: "Work Experience",
    daysAgo: 2,
    body: `## Career Timeline

${profile.experience
  .map(
    (job) =>
      `### ${job.company}

**${job.role}**

*${job.start} – ${job.end} · ${job.location}*

${job.summary}`,
  )
  .join("\n\n---\n\n")}`,
  },
  {
    id: "process-workflow",
    title: "Process Workflow",
    daysAgo: 3,
    body: `I take a **user-centric** approach to engineering, focusing on deeply understanding problems and rapidly prototyping solutions based on feedback. I emphasise clean, scalable code and intuitive design to build products that are both effective and easy to evolve.

![Process workflow](/notes/process.png)

## How a build actually goes

1. **Understand** — sit with the problem before touching an editor
2. **Prototype** — ship something rough and real, fast
3. **Listen** — feedback beats opinion, every time
4. **Harden** — tests, observability, and the boring parts that keep it alive
5. **Iterate** — repeat, with what you learned

> Good software is cultivated, not assembled.`,
  },
  {
    id: "testimonials",
    title: "Testimonials",
    daysAgo: 5,
    body: `## What Users Are Saying.

![Support for Praxis](/notes/support.jpeg)

### Shreya

*Product Hunt · ★★★★★*

> I just started learning development and found Praxis way too helpful to save time setting up the initial folder structure and infra. Also, I am using it as a reference in my own learning journey.

### Andy Henr

*Reddit · ★★★★★*

> You nailed it. These locked-in tech stacks are pure tech debt. It's a reason why so many larger enterprises use these larger frameworks as backend — dot net, java etc — and enterprise level scaling. But so many in the SaaS space just focus on getting to very low MRR, so often they never run into scaling issues, as they never scale up. But I fully agree: if someone wants to scale, they must have a tech stack that actually holds up!

### Peerlist

**Top 100 builders** — and everyone's support on Praxis.

![Peerlist Top 100 builders](/notes/top.png)`,
  },
  {
    id: "domain-expertise",
    title: "Domain Expertise",
    daysAgo: 6,
    body: `The three domains I'd claim on a call.

${profile.expertise.map((e) => `## ${e.area}\n\n${e.detail}`).join("\n\n")}`,
  },
  {
    id: "methodology",
    title: "Methodology & Principles",
    daysAgo: 7,
    body: `## Browse my Styles.

A crisp list of the software development methodologies and principles I follow — the industry standards, widely used and accepted by the community.

${table(
  ["Principle", "What it buys"],
  [
    ["**DRY**", "one source of truth, one place to change it"],
    ["**OOP**", "state and behaviour that travel together"],
    ["**SOLID**", "five rules that keep code maintainable"],
    ["**Agile**", "iterate, ship, get feedback"],
    ["**CI/CD**", "an automated path to production"],
  ],
)}`,
  },
  {
    id: "meetups",
    title: "Tech Meetups",
    daysAgo: 8,
    body: `My top three favourite meetups — I'm always excited to attend and meet new, like-minded people.

${table(
  ["Event", "Role", "Where", "When"],
  [
    ["**KubeCon + CloudNativeCon**", "Attendee", "New Delhi, India", "11 Dec 2024"],
    ["**Open Source Connect**", "Attendee", "JFrog, Bengaluru", "6 Mar 2025"],
    ["**Git Together**", "Participant", "Microsoft, Bengaluru", "Monthly"],
  ],
)}

## KubeCon + CloudNativeCon

An advanced, developer-focused event on Kubernetes for **GenAI, Service Mesh, GitOps and Platform Engineering** — packed with deep technical insights for seasoned professionals.

## Open Source Connect

Technical advancements in the open source community, and how developers can contribute to open source.

## Git Together

*Showcase your best work within the event.*`,
  },
];
