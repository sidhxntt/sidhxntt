import Image from "next/image";
import { linkApps, profile, projects, type Project } from "@/data/portfolio";
import { Doorways } from "@/components/landing/Doorways";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { Timeline } from "@/components/landing/Timeline";
import { MobileMenu } from "@/components/landing/MobileMenu";
import { CaseStudy } from "@/components/landing/CaseStudy";

// The landing site: a normal, scrollable portfolio built from the same data
// as the Interactive OS (src/data/portfolio.ts). OS-only content — photos,
// music, notes, games — deliberately stays out.

const [firstName, ...rest] = profile.name.split(" ");
const lastName = rest.join(" ");

// "I'm a backend engineer who builds data platforms and developer tools."
const [lede, ...bioRest] = profile.bio[1].split(/(?<=\.)\s+/);

// "Currently Building Invytt" — the company name becomes a linked pill.
const NOW = { name: "Invytt", url: "https://invytt.com" };
const [nowBefore, nowAfter] = profile.tagline.split(NOW.name);

const SECTIONS = [
  { label: "Work", href: "#work" },
  { label: "Experience", href: "#experience" },
  { label: "Writing", href: "#writing" },
  { label: "Contact", href: "#contact" },
];

// Where I write things down. URLs come from linkApps (the same Medium and
// Notion icons the Interactive OS shows); the words here are landing-only.
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
// (data labels double as Siri's lookup keys, so the display casing lives here)
const DISPLAY_LABEL: Record<string, string> = { Buymeacoffee: "Buy Me a Coffee" };
const FOOTER_LINKS = [
  ...profile.socials.filter((s) => s !== CALL && !PRIMARY_LINKS.includes(s)),
  ...linkApps.map((l) => ({ label: l.name, url: l.url })),
].map((l) => ({ ...l, label: DISPLAY_LABEL[l.label] ?? l.label }));

export default function LandingPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="nav">
        <div className="nav__inner">
          <a className="nav__name" href="#top">
            {profile.name}
          </a>
          <nav className="nav__desktop" aria-label="Sections">
            <ul className="nav__links">
              {SECTIONS.map((s) => (
                <li key={s.href}>
                  <a href={s.href}>{s.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="nav__end">
            <a className="nav__resume" href={profile.resumeUrl} target="_blank" rel="noopener">
              Resume
            </a>
            <ThemeToggle />
            <MobileMenu
              links={[...SECTIONS, { label: "Resume", href: profile.resumeUrl, external: true }]}
            />
          </div>
        </div>
      </header>

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="hero" id="top" aria-labelledby="hero-name">
          <div className="wrap">
            <h1 className="hero__name" id="hero-name">
              <span className="hero__line">{firstName}</span>
              <span className="hero__line hero__line--2">{lastName}</span>
            </h1>
            <div className="hero__intro">
              <p className="hero__lede">
                {lede} Based in {profile.location}.
              </p>
              <p className="hero__now">
                {nowAfter === undefined ? (
                  profile.tagline
                ) : (
                  <span>
                    {nowBefore}
                    <a className="hero__company" href={NOW.url} target="_blank" rel="noopener">
                      {NOW.name}
                    </a>
                    {nowAfter}
                  </span>
                )}
              </p>
              <div className="hero__actions">
                <a className="button button--primary" href={`mailto:${profile.email}`}>
                  Email me
                </a>
                {CALL && (
                  <a className="button" href={CALL.url} target="_blank" rel="noopener">
                    Book a call
                  </a>
                )}
                <a className="text-link" href={profile.resumeUrl} download>
                  Download resume (PDF)
                </a>
              </div>
            </div>
            <Doorways />
          </div>
        </section>

        {/* ── About ────────────────────────────────────────────── */}
        <section className="section" id="about" aria-labelledby="about-title">
          <div className="wrap section__grid">
            <h2 className="section__title" id="about-title">
              What I do
            </h2>
            <div className="section__body">
              <p className="about__lead">{bioRest.join(" ")}</p>
              <dl className="expertise">
                {profile.expertise.map((e) => (
                  <div key={e.area} className="expertise__row">
                    <dt>{e.area}</dt>
                    <dd>{e.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ── Work ─────────────────────────────────────────────── */}
        <section className="section" id="work" aria-labelledby="work-title">
          <div className="wrap">
            <div className="section__grid">
              <h2 className="section__title" id="work-title">
                Selected work
              </h2>
              <p className="section__intro">
                The data platform I build at work, then products and developer tools I&rsquo;ve built end to end
                on my own.
              </p>
            </div>
            <div className="featured">
              <CaseStudy />
              {featured && <FeaturedProject project={featured} />}
            </div>
            <ul className="projects">
              {rows.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </ul>
            {GITHUB && (
              <p className="projects__more">
                <a className="text-link" href={GITHUB.url} target="_blank" rel="noopener">
                  More projects on GitHub
                </a>
              </p>
            )}
          </div>
        </section>

        {/* ── Experience ───────────────────────────────────────── */}
        <section className="section" id="experience" aria-labelledby="experience-title">
          <div className="wrap section__grid">
            <h2 className="section__title" id="experience-title">
              Experience
            </h2>
            <div className="section__body">
              <Timeline jobs={profile.experience} />
              <h3 className="skills__title">Tools I work with</h3>
              <ul className="skills">
                {profile.skills.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Writing ──────────────────────────────────────────── */}
        <section className="section" id="writing" aria-labelledby="writing-title">
          <div className="wrap section__grid">
            <h2 className="section__title" id="writing-title">
              Writing
            </h2>
            <div className="section__body">
              <p className="section__intro">What I learn building systems, written down so others can use it too.</p>
              <ul className="writing">
                {WRITING.map((w) => (
                  <li key={w.id} className="writing__item">
                    <h3 className="project__name">{w.name}</h3>
                    <p className="project__tagline">{w.summary}</p>
                    <ul className="tech" aria-label={`${w.name} topics`}>
                      {w.topics.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <p className="project__links">
                      <a href={w.url} target="_blank" rel="noopener">
                        {w.cta}
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────── */}
        <section className="section contact" id="contact" aria-labelledby="contact-title">
          <div className="wrap">
            <h2 className="contact__title" id="contact-title">
              Let&rsquo;s talk.
            </h2>
            <p className="contact__intro">
              Open to backend, infrastructure and developer-tooling work. Email is the fastest way to reach me.
            </p>
            <a className="contact__email" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
            <div className="contact__actions">
              {CALL && (
                <a className="button button--primary" href={CALL.url} target="_blank" rel="noopener">
                  Book a call
                </a>
              )}
              <a className="button" href={profile.resumeUrl} download>
                Download resume
              </a>
            </div>
            <ul className="contact__links" aria-label="Profiles">
              {PRIMARY_LINKS.map((l) => (
                <li key={l.url}>
                  <a className="text-link" href={l.url} target="_blank" rel="noopener">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer__inner">
          <p>
            © {new Date().getFullYear()} {profile.name}
          </p>
          <p>
            Also explore this portfolio as the <a href="/interactive">Interactive OS</a> or the{" "}
            <a href="/game">Game OS</a>.
          </p>
        </div>
        <ul className="wrap footer__links" aria-label="Also on">
          {FOOTER_LINKS.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </>
  );
}

function ProjectLinks({ project }: { project: Project }) {
  const sibling = SIBLING[project.id];
  const siblingUrl = sibling?.project?.link ?? sibling?.project?.repo;
  return (
    <p className="project__links">
      {project.link && (
        <a href={project.link} target="_blank" rel="noopener">
          Visit site<span className="sr-only">: {project.name}</span>
        </a>
      )}
      {project.repo && (
        <a href={project.repo} target="_blank" rel="noopener">
          Source code<span className="sr-only">: {project.name}</span>
        </a>
      )}
      {sibling && siblingUrl && (
        <a href={siblingUrl} target="_blank" rel="noopener">
          {sibling.label}
        </a>
      )}
    </p>
  );
}

// The first six tools tell the story; a full stack list is noise to most readers.
function TechList({ project }: { project: Project }) {
  return (
    <ul className="tech" aria-label={`${project.name} tech stack`}>
      {project.tech.slice(0, 6).map((t) => (
        <li key={t}>{t}</li>
      ))}
      {project.tech.length > 6 && <li>+{project.tech.length - 6} more</li>}
    </ul>
  );
}

function FeaturedProject({ project }: { project: Project }) {
  return (
    <article className="feature">
      <div className="feature__shot">
        <Image
          src={project.images[0]}
          alt={`${project.name} screenshot`}
          fill
          sizes="(max-width: 860px) 100vw, 60vw"
          className="shot"
        />
      </div>
      <div className="feature__text">
        <h3 className="feature__name">{project.name}</h3>
        <p className="feature__tagline">{project.tagline}</p>
        <p className="feature__desc">{project.description}</p>
        <TechList project={project} />
        <ProjectLinks project={project} />
      </div>
    </article>
  );
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <li className="project">
      <div className="project__text">
        <h3 className="project__name">{project.name}</h3>
        <p className="project__tagline">{project.tagline}</p>
        <TechList project={project} />
        <ProjectLinks project={project} />
      </div>
      <div className="project__shot">
        <Image
          src={project.images[0]}
          alt={`${project.name} screenshot`}
          fill
          sizes="(max-width: 860px) 100vw, 320px"
          className="shot"
        />
      </div>
    </li>
  );
}
