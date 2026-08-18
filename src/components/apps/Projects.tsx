"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { projects, type Project } from "@/data/portfolio";
import { consumePendingProject, subscribeProjectNav } from "@/lib/project-nav";
import { playClick } from "@/lib/sounds";
import { ProjectCarousel } from "./ProjectCarousel";

function ProjectDetail({ project, onBack }: { project: Project; onBack: () => void }) {
  // Project links leave the OS entirely — the in-app Safari proxies pages and
  // many of these hosts block framing, so a real browser tab is the honest hop.
  const openExternal = (url: string) => {
    playClick();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 text-neutral-800 max-md:px-5 max-md:pb-8 dark:text-neutral-100">
      <button
        onClick={() => {
          playClick();
          onBack();
        }}
        className="mb-4 self-start rounded-md bg-black/[0.06] px-3 py-1 text-sm font-medium text-neutral-600 hover:bg-black/10 max-md:rounded-lg max-md:px-4 max-md:py-2 dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/15"
      >
        ← Back
      </button>
      <ProjectCarousel
        projectId={project.id}
        projectName={project.name}
        images={project.images}
      />
      <h1 className="text-xl font-bold max-md:text-2xl">{project.name}</h1>
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">{project.tagline}</p>
      <p className="mb-4 text-[15px] leading-relaxed">{project.description}</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {project.tech.map((t) => (
          <span key={t} className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
            {t}
          </span>
        ))}
      </div>
      <div className="mt-auto flex gap-2 max-md:flex-col max-md:gap-3 max-md:pt-4">
        {project.link && (
          <button
            type="button"
            onClick={() => openExternal(project.link!)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 max-md:w-full max-md:rounded-xl max-md:py-3 max-md:text-base"
          >
            Visit ↗
          </button>
        )}
        {project.repo && (
          <button
            type="button"
            onClick={() => openExternal(project.repo!)}
            className="rounded-lg bg-black/[0.08] px-4 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-black/15 max-md:w-full max-md:rounded-xl max-md:py-3 max-md:text-base dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15"
          >
            Source ↗
          </button>
        )}
      </div>
    </div>
  );
}

export function Projects() {
  const [selected, setSelected] = useState<Project | null>(null);

  // Finder deep-links straight to a project's detail
  useEffect(() => {
    const jump = (id: string) => {
      const p = projects.find((x) => x.id === id);
      if (p) setSelected(p);
    };
    const pending = consumePendingProject();
    if (pending) jump(pending);
    return subscribeProjectNav(jump);
  }, []);

  if (selected) return <ProjectDetail project={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {projects.length} items
      </p>
      <div className="grid gap-4 max-md:grid-cols-1 md:grid-cols-3">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => {
              playClick();
              setSelected(project);
            }}
            className="group flex flex-col items-stretch gap-2 rounded-xl p-3 text-left transition hover:bg-black/[0.05] max-md:gap-3 max-md:rounded-2xl max-md:p-4 dark:hover:bg-white/[0.08]"
          >
            <div className="relative aspect-[2940/1912] w-full overflow-hidden rounded-lg bg-neutral-200 shadow-sm transition group-hover:scale-[1.02] max-md:rounded-xl dark:bg-neutral-800">
              <Image
                src={project.images[0]}
                alt={`${project.name} screenshot`}
                fill
                sizes="(max-width: 768px) 100vw, 300px"
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{project.name}</p>
              <p className="line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{project.tagline}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
