import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { linkApps, profile, projects, type Project } from "@/data/portfolio";
import { CaseStudy } from "@/components/landing/CaseStudy";
import Juno, { PixelWord } from "@/components/landing/Juno";
import { SiteNav } from "@/components/landing/SiteNav";
import { SocialIcon } from "@/components/landing/SocialIcon";
import { Timeline } from "@/components/landing/Timeline";

// The site: one long page of the notebook. It opens on the Juno hero (a desk
// you can pick things up from), then the same paper carries the rest: what I
// do on torn notes, work on index cards and polaroids, the timeline, writing
// and a way to reach me. Content comes from src/data/portfolio.ts.

// "I'm a backend engineer who builds data platforms and developer tools."
// opens the bio; the rest of it leads the About section.
const [, ...bioRest] = profile.bio[1].split(/(?<=\.)\s+/);

const SECTIONS = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Experience", href: "#experience" },
  { label: "Writing", href: "#writing" },
];
const CONTACT = { label: "Contact", href: "#contact" };
const RESUME = { label: "Resume", href: profile.resumeUrl };

// The newsletter (extensions/newsletter), served by this site at /newsletter.
const NEWSLETTER = { label: "Newsletter", href: "/newsletter" };

// Where I write things down. URLs come from linkApps in @/data/portfolio;
// the words here are landing-only.
const WRITING = [
  {
    id: "notion",
    name: "System Design Wiki",
    summary:
      "My notes on designing real systems, kept as a wiki: the fundamentals first, then domain knowledge and real use cases.",
    topics: ["APIs", "Microservice communication", "Scaling", "Caching", "Storage", "Big data"],
    cta: "Read the wiki on Notion",
  },
  {
    id: "medium",
    name: "Articles",
    summary: "Longer write-ups on what I learn building backends, data pipelines and infrastructure.",
    topics: ["System design", "Kubernetes", "AWS", "Apache Spark", "Concurrency", "AI and engineering"],
    cta: "Read my articles on Medium",
  },
].flatMap((w) => {
  const app = linkApps.find((l) => l.id === w.id);
  return app ? [{ ...w, url: app.url }] : [];
});

// After the Banner Health case study: one featured project with a large
// screenshot, then compact rows. The rest live on GitHub.
const WORK = ["rudder", "praxis", "mock-me", "gitbundle"];
const [featured, ...rows] = WORK.map((id) => projects.find((p) => p.id === id)).filter(
  (p): p is Project => p !== undefined,
);
// Praxis and Praxis Pro are one idea in two stacks: one row, two links.
const SIBLING: Record<string, { label: string; project?: Project }> = {
  praxis: { label: "Praxis Pro (Django edition)", project: projects.find((p) => p.id === "praxis-pro") },
};

// The contact block keeps the ways an employer reaches out; everything else
// moves to the footer.
const CALL = profile.socials.find((s) => s.label === "Book a call");
const GITHUB = profile.socials.find((s) => s.label === "GitHub");
const PRIMARY_LINKS = profile.socials.filter((s) => s.label === "GitHub" || s.label === "LinkedIn");
const FOOTER_LINKS = [
  ...profile.socials.filter((s) => s !== CALL && !PRIMARY_LINKS.includes(s)),
  ...linkApps.map((l) => ({ label: l.name, url: l.url })),
];

export default function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <SiteNav links={[...SECTIONS, CONTACT]} newsletter={NEWSLETTER} resume={RESUME} />

      {/* The first screen: the desk. Its own pixel bar is the site's nav up here. */}
      <section id="top" className="hero" aria-label="Intro">
        <Juno
          name="SID"
          tabs={[
            { label: "Home", href: "#top" },
            { label: "Work", href: "#work", phone: false },
            { label: NEWSLETTER.label, href: NEWSLETTER.href },
            { label: "Writing", href: "#writing", phone: false },
          ]}
          contact={CONTACT}
          tags={["Builds backends", "Ships early", "Backend engineer", "Bengaluru, IN"]}
          status={profile.tagline}
          line={["I build data platforms and dev tools", "that are easy to trace."]}
          cta="See the work"
          ctaHref="#work"
          portrait={profile.avatar}
          street="/photos/sunset.jpg"
          desk="/photos/ice.jpg"
          captions={["that's me", "sunset at sea", "a frozen waterfall"]}
          notes={[
            { big: "10M+", small: "patient records a day", by: "Banner Health" },
            { big: "−40%", small: "time to deliver", by: "Tredence" },
            { big: "20+", small: "products shipped", by: "and counting" },
          ]}
        />
      </section>

      <main id="main">
        {/* ── What I do ─────────────────────────────────────────── */}
        <section className="nb-section" id="about" aria-labelledby="about-title">
          <div className="nb-wrap">
            <Head id="about-title" word="WHAT I DO" label="What I do" aside="the short version" />
            <p className="about__lead">{bioRest.join(" ")}</p>
            <ul className="about__notes">
              {profile.expertise.map((e, i) => (
                <li key={e.area} className="nb-note" style={{ "--c": NOTE_TONES[i % 3], "--r": NOTE_TILT[i % 3] } as CSSProperties}>
                  <h3 className="about__area nb-pixel">{e.area}</h3>
                  <p>{e.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Work ─────────────────────────────────────────────── */}
        <section className="nb-section" id="work" aria-labelledby="work-title">
          <div className="nb-wrap">
            <Head
              id="work-title"
              word="WORK"
              label="Selected work"
              aside="the platform I build at work, then things I built on my own"
            />
            <CaseStudy />
            {featured && <FeaturedProject project={featured} />}
            <ul className="projects">
              {rows.map((p, i) => (
                <ProjectCard key={p.id} project={p} tilt={CARD_TILT[i % 3]} />
              ))}
            </ul>
            {GITHUB && (
              <p className="projects__more">
                <a className="nb-btn nb-btn--light" href={GITHUB.url} target="_blank" rel="noopener">
                  More on GitHub
                </a>
              </p>
            )}
          </div>
        </section>

        {/* ── Experience ───────────────────────────────────────── */}
        <section className="nb-section" id="experience" aria-labelledby="experience-title">
          <div className="nb-wrap">
            <Head id="experience-title" word="EXPERIENCE" label="Experience" aside="where I've worked" />
            <Timeline jobs={profile.experience} />
            <div className="skills">
              <h3 className="skills__title nb-hand">tools I reach for</h3>
              <ul className="skills__keys">
                {profile.skills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Writing ──────────────────────────────────────────── */}
        <section className="nb-section" id="writing" aria-labelledby="writing-title">
          <div className="nb-wrap">
            <Head
              id="writing-title"
              word="WRITING"
              label="Writing"
              aside="what I learn building systems, written down"
            />
            <div className="writing">
              <div className="writing__news nb-note" style={{ "--c": "var(--nb-note-blue)", "--r": "-1.5deg" } as CSSProperties}>
                <p className="writing__kicker nb-pixel">The newsletter</p>
                <p className="writing__pitch">
                  Series on how software is put together, and single posts on what I&rsquo;m building. Free, in your
                  inbox.
                </p>
                <a className="nb-btn" href={NEWSLETTER.href}>
                  Read the newsletter
                </a>
              </div>
              {WRITING.map((w, i) => (
                <article key={w.id} className="writing__item nb-sheet" style={{ "--r": i ? "0.8deg" : "-0.6deg" } as CSSProperties}>
                  <h3 className="writing__name">{w.name}</h3>
                  <p className="writing__summary">{w.summary}</p>
                  <ul className="nb-chips" aria-label={`${w.name} topics`}>
                    {w.topics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p>
                    <a className="nb-link" href={w.url} target="_blank" rel="noopener">
                      {w.cta}
                    </a>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────── */}
        <section className="nb-section contact" id="contact" aria-labelledby="contact-title">
          <div className="nb-wrap">
            <Head id="contact-title" word="HELLO" label="Contact" />
            <p className="contact__talk nb-hand">let&rsquo;s talk.</p>
            <p className="contact__intro">
              Open to backend, infrastructure and developer-tooling work. Email is the fastest way to reach me.
            </p>
            <a className="contact__email" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
            <div className="contact__actions">
              {CALL && (
                <a className="nb-btn" href={CALL.url} target="_blank" rel="noopener">
                  Book a call
                </a>
              )}
              <a className="nb-btn nb-btn--light" href={profile.resumeUrl} download>
                Download resume
              </a>
            </div>
            <ul className="contact__links" aria-label="Profiles">
              {PRIMARY_LINKS.map((l) => (
                <li key={l.url}>
                  <a className="icon-link" href={l.url} target="_blank" rel="noopener">
                    <SocialIcon label={l.label} />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="nb-wrap footer__inner">
          <p className="footer__sign nb-hand">
            © {new Date().getFullYear()} {profile.name}, written on paper and shipped on the web.
          </p>
          <ul className="footer__links" aria-label="Also on">
            <li>
              <a className="icon-link" href={NEWSLETTER.href}>
                Newsletter
              </a>
            </li>
            {FOOTER_LINKS.map((l) => (
              <li key={l.url}>
                <a className="icon-link" href={l.url} target="_blank" rel="noopener">
                  <SocialIcon label={l.label} size={14} />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}

const NOTE_TONES = ["var(--nb-note-blue)", "var(--nb-note-yellow)", "var(--nb-note-green)"];
const NOTE_TILT = ["-1.5deg", "1deg", "-0.6deg"];
const CARD_TILT = ["-1.2deg", "0.8deg", "-0.4deg"];

// A section's name in the pixel alphabet, with a handwritten aside
function Head({ id, word, label, aside }: { id: string; word: string; label: string; aside?: string }) {
  return (
    <header className="nb-head">
      <h2 id={id} className="nb-head__title">
        <span className="nb-sr">{label}</span>
        <PixelWord word={word} className="nb-word" />
      </h2>
      {aside && (
        <p className="nb-head__aside nb-hand">
          <svg className="nb-arrow" viewBox="0 0 50 30" aria-hidden>
            <path d="M46 6c-12 0-26 6-36 18" />
            <path d="M18 23l-9 2 2-9" />
          </svg>
          {aside}
        </p>
      )}
    </header>
  );
}

function ProjectLinks({ project }: { project: Project }) {
  const sibling = SIBLING[project.id];
  const siblingUrl = sibling?.project?.link ?? sibling?.project?.repo;
  return (
    <p className="project__links">
      {project.link && (
        <a className="nb-link" href={project.link} target="_blank" rel="noopener">
          Visit site<span className="nb-sr">: {project.name}</span>
        </a>
      )}
      {project.repo && (
        <a className="nb-link" href={project.repo} target="_blank" rel="noopener">
          Source code<span className="nb-sr">: {project.name}</span>
        </a>
      )}
      {sibling && siblingUrl && (
        <a className="nb-link" href={siblingUrl} target="_blank" rel="noopener">
          {sibling.label}
        </a>
      )}
    </p>
  );
}

// The first six tools tell the story; a full stack list is noise to most readers.
function TechList({ project }: { project: Project }) {
  return (
    <ul className="nb-chips" aria-label={`${project.name} tech stack`}>
      {project.tech.slice(0, 6).map((t) => (
        <li key={t}>{t}</li>
      ))}
      {project.tech.length > 6 && <li>+{project.tech.length - 6} more</li>}
    </ul>
  );
}

function Polaroid({ src, alt, caption, sizes, children }: { src: string; alt: string; caption: string; sizes: string; children?: ReactNode }) {
  return (
    <figure className="nb-polaroid">
      <span className="nb-polaroid__pic">
        <Image src={src} alt={alt} fill sizes={sizes} />
      </span>
      <figcaption className="nb-polaroid__cap">{caption}</figcaption>
      {children}
    </figure>
  );
}

function FeaturedProject({ project }: { project: Project }) {
  return (
    <article className="feature">
      <div className="feature__shot" style={{ "--r": "-2deg" } as CSSProperties}>
        <span className="feature__tape" aria-hidden />
        <Polaroid
          src={project.images[0]}
          alt={`${project.name} screenshot`}
          caption={project.name}
          sizes="(max-width: 860px) 92vw, 56vw"
        />
      </div>
      <div className="feature__text">
        <p className="feature__kicker nb-tape" style={{ "--c": "var(--nb-mint)", "--r": "-2deg" } as CSSProperties}>
          Featured project
        </p>
        <h3 className="feature__name">{project.name}</h3>
        <p className="feature__tagline">{project.tagline}</p>
        <p className="feature__desc">{project.description}</p>
        <TechList project={project} />
        <ProjectLinks project={project} />
      </div>
    </article>
  );
}

function ProjectCard({ project, tilt }: { project: Project; tilt: string }) {
  return (
    <li className="project" style={{ "--r": tilt } as CSSProperties}>
      <Polaroid src={project.images[0]} alt={`${project.name} screenshot`} caption={project.name} sizes="(max-width: 860px) 92vw, 30vw" />
      <div className="project__text">
        <h3 className="nb-sr">{project.name}</h3>
        <p className="project__tagline">{project.tagline}</p>
        <TechList project={project} />
        <ProjectLinks project={project} />
      </div>
    </li>
  );
}
