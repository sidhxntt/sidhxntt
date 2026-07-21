"use client";

import { profile } from "@/data/portfolio";
import { openExternal } from "@/lib/browser";
import { playClick } from "@/lib/sounds";
import { useWindowManager } from "@/components/window/WindowManager";
import { Avatar } from "@/components/Avatar";

// Mail-compose style contact window. The "Send" button is a mailto link.

export function Contact() {
  const { openApp } = useWindowManager();

  const openExternalLink = (url: string) => {
    playClick();
    openExternal(url);
  };

  return (
    <div className="flex h-full flex-col text-neutral-800 dark:text-neutral-200">
      <div className="shrink-0 space-y-0 border-b border-black/5 bg-white/50 px-5 py-3 text-sm max-md:hidden dark:border-white/10 dark:bg-neutral-800/60">
        <div className="flex gap-2 border-b border-black/5 py-1.5 dark:border-white/10">
          <span className="w-14 text-neutral-400">To:</span>
          <span className="font-medium text-blue-600 dark:text-blue-400">{profile.email}</span>
        </div>
        <div className="flex gap-2 py-1.5">
          <span className="w-14 text-neutral-400">Subject:</span>
          <span className="font-medium">Hey {profile.name.split(" ")[0]}, let&apos;s talk!</span>
        </div>
      </div>

      <div className="flex-1 p-5 text-[15px] leading-relaxed max-md:hidden">
        <p className="mb-3">Hi there 👋</p>
        <p className="mb-3 text-neutral-600 dark:text-neutral-300">
          Want to work together, chat about an idea, or hire me? The fastest way to reach me is
          email — or find me on any of these:
        </p>
        <div className="mb-5 flex flex-wrap gap-2">
          {profile.socials.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => openExternalLink(s.url)}
              className="rounded-lg bg-black/[0.06] px-4 py-1.5 text-sm font-semibold text-neutral-700 transition hover:bg-black/10 dark:bg-white/[0.08] dark:text-neutral-200 dark:hover:bg-white/15"
            >
              {s.label} ↗
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-black/5 bg-white/50 px-5 py-3 max-md:hidden dark:border-white/10 dark:bg-neutral-800/60">
        <a
          href={`mailto:${profile.email}?subject=${encodeURIComponent("Hello from your portfolio!")}`}
          className="inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          ✉️ Send me an email
        </a>
      </div>

      {/* iOS Contacts card (phones only, <768px) */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-y-auto bg-[#f2f2f7] max-md:flex dark:bg-black">
        <div className="flex flex-col items-center px-4 pb-10 pt-10">
          <Avatar size={96} textClassName="text-[40px] font-medium" />
          <h1 className="mt-4 text-center text-[26px] font-semibold text-neutral-900 dark:text-neutral-50">
            {profile.name}
          </h1>
          <p className="text-[15px] text-neutral-500 dark:text-neutral-400">{profile.role}</p>

          <div className="mt-7 w-full max-w-sm overflow-hidden rounded-[12px] bg-white dark:bg-neutral-900">
            <a
              href={`mailto:${profile.email}?subject=${encodeURIComponent("Hello from your portfolio!")}`}
              onClick={() => playClick()}
              className="block px-4 py-2.5 active:bg-black/[0.05] dark:active:bg-white/[0.08]"
            >
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">email</p>
              <p className="truncate text-[17px] text-blue-500">{profile.email}</p>
            </a>
          </div>

          <div className="mt-4 w-full max-w-sm overflow-hidden rounded-[12px] bg-white dark:bg-neutral-900">
            {profile.socials.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => openExternalLink(s.url)}
                className={`block w-full px-4 py-2.5 text-left active:bg-black/[0.05] dark:active:bg-white/[0.08] ${
                  i > 0 ? "border-t border-black/[0.06] dark:border-white/[0.08]" : ""
                }`}
              >
                <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{s.label.toLowerCase()}</p>
                <p className="truncate text-[17px] text-blue-500">{s.url.replace(/^https?:\/\//, "")}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
