// ── Single source of truth for all portfolio content ──
// Sourced from the fill-in sheets in /input.

export const profile = {
  name: "Siddhant Gupta",
  role: "Software Engineer",
  avatar: "/avatar.jpg",
  bio: [
    "I convert coffee into code",
    "I'm a backend engineer who builds data platforms and developer tools. I build SaaS tooling that improves developer experience, and productivity tools that help teams move faster without losing reliability. I care about APIs with clear owners, infrastructure that behaves predictably, and failures that are easy to trace. I ship early, learn from feedback and iterate.",
  ],
  tagline: "Currently Building Invytt",
  skills: [
    "Python",
    "Golang",
    "TypeScript",
    "Node.js",
    "Next.js",
    "Express.js",
    "FastAPI",
    "Django",
    "Prisma",
    "PostgreSQL",
    "MongoDB",
    "Supabase",
    "Redis",
    "Kafka",
    "Apache Spark",
    "Apache Airflow",
    "Databricks",
    "Docker",
    "Kubernetes",
    "AWS",
    "Prometheus",
    "Grafana",
    "Sentry",
    "ELK Stack",
    "Nginx",
    "REST APIs",
    "CI/CD",
    "SQL",
    "Bash",
    "Git",
  ],
  experience: [
    {
      role: "Data Engineer",
      company: "Tredence Inc.",
      location: "Bengaluru, India",
      start: "October 2024",
      end: "Present",
      summary:
        "Built a HIPAA-compliant data platform on Databricks and AWS for Banner Health, cutting delivery time by 40% and QA turnaround by 35%. A PySpark Medallion pipeline ingests 10M+ patient records a day from 4 EHR sources (Cerner, Health Catalyst, McKesson, Teradata) through CDC/SCD and real-time Kafka streaming. T-Ingestor, a metadata-driven YAML ingestion accelerator, uses LLM-assisted SQLGlot transpilation to migrate Spark SQL at scale with zero migration risk. A config-driven clinical measure engine computes 100+ rate metrics (ICU/BIPAP LOS, intubation rate) by facility, provider and cohort. A PyTest framework runs 100+ pipeline validations in GitHub CI/CD across dev, QA and prod, raising test coverage by 60%.",
    },
    {
      role: "Data Analyst Intern, Supply Chain Program",
      company: "Mondelez International",
      location: "Mumbai, India",
      start: "September 2023",
      end: "April 2024",
      summary:
        "Built 10+ Power BI dashboards with advanced DAX, boosting KPI visibility by 25% across 1,200+ distribution points. Automated 15+ warehouse simulation reports using SQL and Python, reducing manual effort by 40% and speeding reporting by 30%. Analyzed 2TB+ MongoDB data via Grafana to uncover operational bottlenecks. Led PAN-India supply chain analytics for Oreo, improving demand forecasting by 20% across 29 states.",
    },
  ],
  expertise: [
    {
      area: "Backend & Systems",
      detail:
        "Distributed systems, microservices, REST & GraphQL APIs. Proficient in Python, Go and Node.js with deep database expertise.",
    },
    {
      area: "Data Engineering",
      detail:
        "ETL pipelines (HIPAA compliant), data warehousing and real-time analytics. Experience with Spark, Kafka, Airflow and cloud data platforms to build scalable data infrastructure.",
    },
    {
      area: "Cloud & DevOps",
      detail:
        "AWS, Kubernetes, Docker and CI/CD pipelines. Infrastructure as code, observability and zero-downtime deployments at scale.",
    },
  ],
  email: "siddhantg2002@gmail.com",
  resumeUrl: "/resume.pdf",
  socials: [
    { label: "GitHub", url: "https://github.com/sidhxntt" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/sidhxntt" },
    { label: "Twitter / X", url: "https://x.com/sidhxntt" },
    { label: "ProductHunt", url: "https://www.producthunt.com/@sidhxntt" },
    { label: "Peerlist", url: "https://peerlist.io/sidhxntt" },
    { label: "Substack", url: "https://substack.com/@sidhxntt" },
    { label: "Buy Me a Coffee", url: "https://buymeacoffee.com/sidhxntt" },
    { label: "Book a call", url: "https://cal.com/sidhxntt" },
  ],
};

// Writing elsewhere, linked from the landing page.
export const linkApps = [
  { id: "medium", name: "Medium", url: "https://medium.com/@sidhxntt" },
  {
    id: "notion",
    name: "Notion",
    url: "https://sidhxntt.notion.site/32f479a1085e80b09884dcbc2c2ad6d1?v=333479a1085e8069b431000c2e9c9bbe",
  },
] as const;

export type Project = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  tech: string[];
  link?: string;
  repo?: string;
  images: [string, ...string[]]; // ordered screenshots in /public/projects/<project-id>
};

export const projects: Project[] = [
  {
    id: "rudder",
    name: "Rudder",
    tagline: "A self-hosted control plane from Git commit to healthy release",
    description:
      "Rudder is a single-operator deployment control plane with a Railway-style topology canvas and CLI for taking services from GitHub source to immutable, health-gated releases. It combines GitHub OAuth, a GitHub App, signed webhooks, preview environments, rollback, logs and metrics with Docker, Kind and a cost-aware single-cluster GKE reference path. The controlled beta is intentionally honest about its current boundary: production multi-tenancy is planned, not claimed.",
    tech: [
      "Python",
      "FastAPI",
      "PostgreSQL",
      "Next.js",
      "TypeScript",
      "Docker",
      "Kubernetes",
      "GKE",
      "Terraform",
      "Cloud Build",
      "Artifact Registry",
      "Traefik",
      "GitHub Apps",
    ],
    repo: "https://github.com/sidhxntt/rudder",
    images: [
      "/projects/hots/rudder/01.png",
      "/projects/hots/rudder/02.png",
      "/projects/hots/rudder/03.png",
      "/projects/hots/rudder/04.png",
      "/projects/hots/rudder/05.png",
      "/projects/hots/rudder/06.png",
    ],
  },
  {
    id: "praxis",
    name: "Praxis",
    tagline: "Develop your SaaS in days not months",
    description:
      "Praxis CLI is a scaffolding tool that speeds up project setup with pre-configured, best-practice templates and automated workflows. It supports flexible frontend choices and a fully independent, production-ready backend with built-in features like authentication, caching, and monitoring. Designed for scalability and modularity, it enables efficient full-stack development without tight coupling between frontend and backend to elevate developer's experience and productivity.",
    tech: [
      "Node.js",
      "Next.js",
      "Vite.js",
      "MongoDB",
      "PostgreSQL",
      "Prisma",
      "Redis",
      "BullMQ",
      "JWT",
      "LemonSqueezy",
      "Prometheus",
      "Grafana",
      "Docker",
    ],
    link: "https://praxis-alpha.vercel.app/",
    repo: "https://github.com/sidhxntt/Praxis",
    images: ["/projects/hots/praxis/01.png"],
  },
  {
    id: "praxis-pro",
    name: "Praxis Pro",
    tagline: "Elevate your SaaS backend with Django",
    description:
      "Praxis Pro is an advanced backend-focused evolution of PRAXIS, built on Django to provide a production-grade foundation with powerful built-in features like ORM, authentication, and admin tools. It automates setup, integrates modern tooling (ELK, Kubernetes, Sentry), and delivers a scalable, best-practice backend architecture. Designed as a workflow accelerator, it helps developers build complex backend systems more efficiently.",
    tech: [
      "Python",
      "Django",
      "Django REST Framework",
      "PostgreSQL",
      "Supabase",
      "JWT",
      "Celery",
      "Redis",
      "Elasticsearch",
      "ELK Stack",
      "Prometheus",
      "Grafana",
      "Sentry",
      "AWS S3",
      "Nginx",
      "Gunicorn",
      "Docker",
      "Kubernetes",
    ],
    link: "https://praxis-alpha.vercel.app/pro",
    repo: "https://github.com/sidhxntt/Praxis/tree/pro",
    images: ["/projects/praxis-pro/01.png"],
  },
  {
    id: "gitbundle",
    name: "GitBundle",
    tagline: "Enhance your GitHub workflow with three independent tools",
    description:
      "GitBundle combines three independent tools to enhance your GitHub workflow: a smart CLI for automated commits (no AI, save your tokens), an AI-powered repo analysis app, and a visual 'year in review' generator. You can use each tool separately or together to streamline development, gain insights, and showcase activity.",
    tech: [
      "Vite.js",
      "React.js",
      "TypeScript",
      "TailwindCSS",
      "Node.js",
      "Express.js",
      "Supabase",
      "Google Gemini API",
      "GitHub API",
      "Zod",
      "TanStack Query",
    ],
    link: "https://sidhxntt.github.io/Git-Bundle/",
    repo: "https://github.com/sidhxntt/Git-Bundle",
    images: ["/projects/gitbundle/01.png"],
  },
  {
    id: "dev-tools",
    name: "Dev-Tools",
    tagline: "A collection of useful development tools",
    description:
      "A developer toolkit featuring an AI-powered README generator, Prisma-to-Express API scaffolder, and SEO meta. It automates documentation, scans codebases intelligently, and generates full CRUD APIs with validation and structure. Built for speed and clarity, it streamlines setup while producing production-ready outputs.",
    tech: [
      "Vite.js",
      "React.js",
      "TypeScript",
      "TailwindCSS",
      "Bash",
      "Node.js",
      "Express.js",
      "Prisma",
      "PostgreSQL",
      "Anthropic Claude API",
      "Commander",
    ],
    link: "https://sidhxntt.github.io/Dev-Tools/",
    repo: "https://github.com/sidhxntt/Dev-Tools",
    images: ["/projects/dev-tools/01.png"],
  },
  {
    id: "devxp",
    name: "DevXp",
    tagline: "A technical blog to level up your developer experience",
    description:
      "DevXp is a technical blog platform focused on improving developer experience through in-depth articles and practical guides. Built with a modern TypeScript stack, it delivers fast page loads, clean typography, and a distraction-free reading experience.",
    tech: [
      "Vite.js",
      "React.js",
      "TypeScript",
      "TailwindCSS",
      "Contentful CMS",
      "Three.js",
      "Framer Motion",
      "Recoil",
      "Material UI",
    ],
    link: "https://devxp.in",
    repo: "https://github.com/sidhxntt/DevXp",
    images: ["/projects/devxp/01.png"],
  },
  {
    id: "vibe-coding-bundle",
    name: "Vibe Coding Bundle",
    tagline: "Prompt engineering tools for better LLM results",
    description:
      "A collection of AI prompt engineering tools that lint, optimize, and compress prompts for better LLM interactions. It helps developers cut token waste, catch ambiguous phrasing, and ship consistent prompts across projects.",
    tech: ["JavaScript", "Node.js", "Anthropic Claude API"],
    link: "https://sidhxntt.github.io/Vibe-Coding-Bundle/",
    repo: "https://github.com/sidhxntt/Vibe-Coding-Bundle",
    images: ["/projects/vibe-coding-bundle/01.png"],
  },
  {
    id: "mock-me",
    name: "Mock-Me",
    tagline: "No-code instant FastAPI mock servers",
    description:
      "Mock-Me spins up FastAPI mock servers instantly with zero code, letting frontend teams develop against realistic APIs before the backend exists. Define endpoints and payloads declaratively and get a running server with validation out of the box.",
    tech: ["Python", "FastAPI", "Pydantic", "Uvicorn", "Faker", "Pytest", "PDM"],
    link: "https://sidhxntt.github.io/mock-me/",
    repo: "https://github.com/sidhxntt/mock-me",
    images: ["/projects/mock-me/01.png"],
  },
  {
    id: "optimac",
    name: "OptiMac",
    tagline: "Your Mac maintenance tool",
    description:
      "OptiMac is a maintenance tool for macOS that automates cleanup, monitors system health, and keeps your machine running fast. It bundles common upkeep tasks — cache purging, storage analysis, and process checks — into one simple interface.",
    tech: ["TypeScript", "Node.js", "Commander", "Execa", "Bash"],
    link: "https://sidhxntt.github.io/OptiMac/",
    repo: "https://github.com/sidhxntt/OptiMac",
    images: ["/projects/optimac/01.png"],
  },
  {
    id: "media-automations",
    name: "media automations",
    tagline: "A macOS CLI for oversized, wrong-format files",
    description:
      "media automations is an interactive macOS CLI, published on npm and launched with a single auto command, that converts images, documents and data, strips backgrounds, and compresses video — 24 image formats including HEIC and camera RAW, 21 video containers, and nothing ever leaves the machine. The expensive work is done by macOS's own frameworks rather than heavy dependencies: two small Swift helpers call Vision for subject masking and WebKit for PDF rendering, so there is no 170 MB background-removal model and no bundled Chromium, and because they ship as source and compile on first use the 56 KB package stays architecture-independent. Compression runs at three levels — on a mixed folder of a 4 MB phone photo, a UI screenshot and a 5-second 4K clip, normal saves 60%, super 86% and ultra 95%. Needs macOS 14 or newer and the Xcode Command Line Tools.",
    tech: ["TypeScript", "Node.js", "Swift", "Vision framework", "WebKit", "Sharp", "FFmpeg", "Clack"],
    link: "https://sidhxntt.github.io/media_automations/",
    repo: "https://github.com/sidhxntt/media_automations",
    images: ["/projects/media-automations/01.png"],
  },
];
