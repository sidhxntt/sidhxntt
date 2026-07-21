// ── Single source of truth for all portfolio content ──
// Sourced from the fill-in sheets in /input.

import type { LinkAppId } from "@/components/AppIcon";

export const profile = {
  name: "Siddhant Gupta",
  role: "Software Engineer",
  avatar: "/avatar.jpg",
  avatarInitials: "SG", // fallback when the avatar image fails to load
  location: "Bengaluru, India",
  bio: [
    "I convert coffee into code",
    "I'm a backend engineer who treats infrastructure as craft, not vibes. I build SaaS tooling that improves developer experience and productivity tools that help teams move faster without sacrificing reliability. My focus is on APIs with clear ownership, infra you can trust, and debugging that's actually transparent. I believe in shipping fast, learning from feedback, and iterating—on backends built to last.",
  ],
  headline: "Beautiful Interfaces, Powerful Backend.",
  tagline: "Currently Building Invytt",
  quote:
    "Good software is cultivated, not assembled — each layer of abstraction should feel as natural as the one beneath it.",
  // the first five are what the Messages bot calls the "daily drivers"
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
  stats: [
    { value: "2+", label: "Years of Experience" },
    { value: "20+", label: "Products Shipped" },
    { value: "12M+", label: "Active Users" },
    { value: "1PB+", label: "Data Processed" },
    { value: "5+", label: "Data Pipelines Built" },
    { value: "99.9%", label: "System Uptime" },
  ],
  experience: [
    {
      role: "Data Engineer",
      company: "Tredence Inc.",
      location: "Bengaluru, India",
      start: "October 2024",
      end: "Present",
      summary:
        "Architected and delivered an end-to-end HIPAA-compliant data platform on Databricks/AWS for Banner Health — spanning a PySpark-based Medallion pipeline ingesting 10M+ patient records/day from 4 EHR sources (Cerner, Health Catalyst, McKesson, Teradata) via CDC/SCD and real-time Kafka streaming; a metadata-driven YAML ingestion accelerator (T-Ingestor) with LLM-assisted SQLGlot transpilation for Spark SQL migration at scale; a config-driven clinical measure engine computing 100+ rate metrics (ICU/BIPAP LOS, Intubation Rate) across facility/provider/cohort dimensions; and a PyTest automation framework with 100+ pipeline validations wired into GitHub CI/CD across dev/QA/prod — reducing delivery time by 40%, migration risk to zero, test coverage by 60%, and QA turnaround by 35%.",
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
  resumeDriveUrl: "https://drive.google.com/file/d/1mGxRMS4c7ARRBDIcH-l_tqBo4_tHWChA/view?usp=sharing",
  socials: [
    { label: "GitHub", url: "https://github.com/sidhxntt" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/sidhxntt" },
    { label: "Twitter / X", url: "https://x.com/sidhxntt" },
    { label: "ProductHunt", url: "https://www.producthunt.com/@sidhxntt" },
    { label: "Peerlist", url: "https://peerlist.io/sidhxntt" },
    { label: "Substack", url: "https://substack.com/@sidhxntt" },
    { label: "Buymeacoffee", url: "https://buymeacoffee.com/sidhxntt" },
    { label: "Book a call", url: "https://cal.com/sidhxntt" },
  ],
};

// Link-only "apps": an icon in Applications and on the desktop that opens a
// real browser tab. No window, so they stay out of APP_META / the registry.
export const linkApps = [
  { id: "medium", name: "Medium", url: "https://medium.com/@sidhxntt" },
  {
    id: "notion",
    name: "Notion",
    url: "https://sidhxntt.notion.site/32f479a1085e80b09884dcbc2c2ad6d1?v=333479a1085e8069b431000c2e9c9bbe",
  },
] as const satisfies readonly { id: LinkAppId; name: string; url: string }[];

export type Project = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  tech: string[];
  link?: string;
  repo?: string;
  preview: string; // screenshot in /public/projects
};

export const projects: Project[] = [
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
    preview: "/projects/praxis.png",
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
    preview: "/projects/praxis_pro.png",
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
    preview: "/projects/gitbundle.png",
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
    preview: "/projects/devtools.png",
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
    preview: "/projects/devxp.png",
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
    preview: "/projects/vcb.png",
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
    preview: "/projects/mock-me.png",
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
    preview: "/projects/optimac.png",
  },
];

export type Picture = {
  id: string;
  src: string; // file in /public/library
  caption: string; // doubles as alt text
  kind: "photo" | "video";
  poster?: string; // videos only — first frame, so grids lazy-load a still
};

// Real media from /public/library. Captions double as alt text.
export const pictures: Picture[] = [
  { id: "p1", src: "/library/alpenglow.jpg", caption: "Alpenglow on a Himalayan peak", kind: "photo" },
  { id: "p2", src: "/library/himalayan-range.jpg", caption: "Himalayan range panorama", kind: "photo" },
  { id: "p3", src: "/library/snowy-peaks.jpg", caption: "Snowy peaks and prayer flags", kind: "photo" },
  { id: "p4", src: "/library/sunlit-peak.jpg", caption: "Sunlit peak framed by dark rock", kind: "photo" },
  { id: "p5", src: "/library/sunlit-peak-2.jpg", caption: "Last light on the peak", kind: "photo" },
  { id: "p6", src: "/library/dusk-ridge.jpg", caption: "On the ridge at dusk, snow peaks behind", kind: "photo" },
  { id: "p7", src: "/library/ridge-panorama.jpg", caption: "Hazy ridge panorama", kind: "photo" },
  { id: "p8", src: "/library/mountain-layers.jpg", caption: "Mountain layers fading into haze", kind: "photo" },
  { id: "p9", src: "/library/frozen-waterfall.jpg", caption: "Frozen waterfall on the trail", kind: "photo" },
  { id: "p10", src: "/library/misty-slope.jpg", caption: "Mist rolling over a snow slope", kind: "photo" },
  { id: "p11", src: "/library/sunset-clouds.jpg", caption: "Sunset clouds over dark mountains", kind: "photo" },
  { id: "p12", src: "/library/orange-sunset.jpg", caption: "Orange sunset over the horizon", kind: "photo" },
  { id: "p13", src: "/library/valley-clouds.jpg", caption: "Clouds drifting over the valley", kind: "photo" },
  { id: "p14", src: "/library/green-valley.jpg", caption: "Green valley from the porch", kind: "photo" },
  { id: "p15", src: "/library/hill-village.jpg", caption: "Hill village under low clouds", kind: "photo" },
  { id: "p16", src: "/library/cliff-sky.jpg", caption: "Cliff face against a bright sky", kind: "photo" },
  { id: "p17", src: "/library/forest-light.jpg", caption: "Evening light through the forest", kind: "photo" },
  { id: "p18", src: "/library/window-view.jpg", caption: "Mountains from the cafe window", kind: "photo" },
  { id: "p19", src: "/library/palm-beach.jpg", caption: "Palm-lined beach", kind: "photo" },
  { id: "p20", src: "/library/shore-boats.jpg", caption: "Boats pulled up on the shore", kind: "photo" },
  { id: "p21", src: "/library/palm-cafe.jpg", caption: "Rooftop cafe under the palms", kind: "photo" },
  { id: "p22", src: "/library/palm-cafe-2.jpg", caption: "Palms over the rooftop cafe", kind: "photo" },
  { id: "p23", src: "/library/heritage-house.jpg", caption: "Heritage house with a star lantern", kind: "photo" },
  { id: "p24", src: "/library/white-mansion.jpg", caption: "White mansion behind the old tree", kind: "photo" },
  { id: "p25", src: "/library/temple-street.jpg", caption: "Temple street scene", kind: "photo" },
  { id: "p26", src: "/library/pondicherry-mural.jpg", caption: "Pondicherry check-in mural", kind: "photo" },
  { id: "p27", src: "/library/route66-mural.jpg", caption: "Route 66 mural", kind: "photo" },
  { id: "p28", src: "/library/retro-diner.jpg", caption: "Retro diner wall art", kind: "photo" },
  { id: "p29", src: "/library/rooftop-dino.jpg", caption: "Rooftop dinosaur on the street", kind: "photo" },
  { id: "p30", src: "/library/cafe-sign.jpg", caption: "Caffeine Craft — cafe lantern sign", kind: "photo" },
  { id: "p31", src: "/library/cafe-burger.jpg", caption: "Burger stop at a roadside cafe", kind: "photo" },
  { id: "p32", src: "/library/brunch.jpg", caption: "Sunday brunch spread", kind: "photo" },
  { id: "p33", src: "/library/neon-alley.jpg", caption: "Pink neon alley", kind: "photo" },
  { id: "p34", src: "/library/neon-lights.jpg", caption: "Neon light trails", kind: "photo" },
  { id: "p35", src: "/library/arcade-neon.jpg", caption: "Neon-lit arcade at night", kind: "photo" },
  { id: "p36", src: "/library/bar-neon.jpg", caption: "Neon bar wall art", kind: "photo" },
  { id: "p37", src: "/library/wall-portraits.jpg", caption: "Portrait wall in low light", kind: "photo" },
  { id: "p38", src: "/library/night-bikes.jpg", caption: "Motorcycles parked for the night", kind: "photo" },
  { id: "v1", src: "/library/sunlit-forest.mp4", caption: "Sun rays through the forest", kind: "video", poster: "/library/posters/sunlit-forest.jpg" },
  { id: "v2", src: "/library/autumn-trail.mp4", caption: "Walking an autumn leaf trail", kind: "video", poster: "/library/posters/autumn-trail.jpg" },
  { id: "v3", src: "/library/forest-trail.mp4", caption: "Steps through the forest trail", kind: "video", poster: "/library/posters/forest-trail.jpg" },
  { id: "v4", src: "/library/valley-view.mp4", caption: "Valley view from the mountain road", kind: "video", poster: "/library/posters/valley-view.jpg" },
  { id: "v5", src: "/library/frozen-lake-dog.mp4", caption: "Dog on a frozen lake", kind: "video", poster: "/library/posters/frozen-lake-dog.jpg" },
  { id: "v6", src: "/library/ice-sheets.mp4", caption: "Ice sheets up close", kind: "video", poster: "/library/posters/ice-sheets.jpg" },
  { id: "v7", src: "/library/boat-ride.mp4", caption: "Boat ride on calm water", kind: "video", poster: "/library/posters/boat-ride.jpg" },
  { id: "v8", src: "/library/garden-piano.mp4", caption: "Piano tucked into a garden", kind: "video", poster: "/library/posters/garden-piano.jpg" },
  { id: "v9", src: "/library/sleepy-cats.mp4", caption: "Two cats sharing a chair", kind: "video", poster: "/library/posters/sleepy-cats.jpg" },
  { id: "v10", src: "/library/fluffy-cat.mp4", caption: "Fluffy cat lounging on a chair", kind: "video", poster: "/library/posters/fluffy-cat.jpg" },
  { id: "v11", src: "/library/door-cat.mp4", caption: "Cat climbing the door", kind: "video", poster: "/library/posters/door-cat.jpg" },
  { id: "v12", src: "/library/puppy.mp4", caption: "Puppy in hand", kind: "video", poster: "/library/posters/puppy.jpg" },
  { id: "v13", src: "/library/black-dog.mp4", caption: "Mountain dog taking a break", kind: "video", poster: "/library/posters/black-dog.jpg" },
  { id: "v14", src: "/library/concert.mp4", caption: "Concert crowd in red light", kind: "video", poster: "/library/posters/concert.jpg" },
  { id: "v15", src: "/library/dj-set.mp4", caption: "DJ set under the spotlight", kind: "video", poster: "/library/posters/dj-set.jpg" },
  { id: "v16", src: "/library/neon-bar.mp4", caption: "Neon bar walk-through", kind: "video", poster: "/library/posters/neon-bar.jpg" },
  { id: "v17", src: "/library/club-lights.mp4", caption: "Club lights in pink", kind: "video", poster: "/library/posters/club-lights.jpg" },
  { id: "v18", src: "/library/club-night.mp4", caption: "Late night on the dance floor", kind: "video", poster: "/library/posters/club-night.jpg" },
  { id: "v19", src: "/library/night-crowd.mp4", caption: "Night crowd under lanterns", kind: "video", poster: "/library/posters/night-crowd.jpg" },
];

export type Track = {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  accent: string;
};

// Placeholder playlist — the player UI plays synthesized tones per track.
export const tracks: Track[] = [
  { id: "t1", title: "Boot Sequence", artist: "Kernel Panic", duration: 184, accent: "from-sky-400 to-indigo-600" },
  { id: "t2", title: "Segfault Serenade", artist: "Null Pointer", duration: 213, accent: "from-rose-400 to-red-600" },
  { id: "t3", title: "Garbage Collector", artist: "The Heaps", duration: 197, accent: "from-emerald-400 to-green-600" },
  { id: "t4", title: "Async Awake", artist: "Promise.all", duration: 240, accent: "from-amber-400 to-orange-600" },
];
