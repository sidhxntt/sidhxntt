import { profile } from "@/data/portfolio";

// Preview-style resume viewer rendering the real PDF at /public/resume.pdf.
// Desktop embeds it; iOS Safari can't scroll embedded PDFs, so phones get an
// open/download card instead.

export function Resume() {
  return (
    <div className="flex h-full flex-col">
      {/* Preview-style toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-black/5 bg-white/50 px-4 py-2 max-md:hidden dark:border-white/10 dark:bg-neutral-800/60">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">resume.pdf</span>
        <div className="flex items-center gap-2">
          <a
            href={profile.resumeDriveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-black/[0.06] px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-black/10 dark:bg-white/[0.08] dark:text-neutral-200 dark:hover:bg-white/15"
          >
            Open in Drive ↗
          </a>
          <a
            href={profile.resumeUrl}
            download
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Download PDF
          </a>
        </div>
      </div>

      {/* Embedded PDF (desktop) */}
      <div className="flex-1 bg-neutral-200/60 max-md:hidden dark:bg-neutral-900/60">
        <iframe
          src={`${profile.resumeUrl}#toolbar=0&navpanes=0`}
          title="Resume PDF"
          className="h-full w-full border-0"
        />
      </div>

      {/* iOS inset-grouped layout (phones only, <768px) */}
      <div className="hidden min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#f2f2f7] px-4 pb-10 pt-4 max-md:block dark:bg-black">
        <h1 className="text-[34px] font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Resume</h1>

        <div className="mt-3 rounded-[12px] bg-white px-4 py-3.5 dark:bg-neutral-900">
          <p className="text-[20px] font-bold text-neutral-900 dark:text-neutral-50">{profile.name}</p>
          <p className="text-[15px] text-neutral-500 dark:text-neutral-400">{profile.role}</p>
          <p className="mt-0.5 truncate text-[15px] text-blue-500">{profile.email}</p>
        </div>

        <div className="mt-6 overflow-hidden rounded-[12px] bg-white dark:bg-neutral-900">
          <a
            href={profile.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3.5 active:bg-black/[0.04] dark:active:bg-white/[0.06]"
          >
            <span className="text-[17px] text-neutral-900 dark:text-neutral-50">View resume.pdf</span>
            <span className="text-[15px] text-neutral-400">›</span>
          </a>
          <a
            href={profile.resumeUrl}
            download
            className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3.5 active:bg-black/[0.04] dark:border-white/[0.08] dark:active:bg-white/[0.06]"
          >
            <span className="text-[17px] text-blue-500">Download PDF</span>
            <span className="text-[15px] text-neutral-400">›</span>
          </a>
          <a
            href={profile.resumeDriveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3.5 active:bg-black/[0.04] dark:border-white/[0.08] dark:active:bg-white/[0.06]"
          >
            <span className="text-[17px] text-blue-500">Open in Drive</span>
            <span className="text-[15px] text-neutral-400">›</span>
          </a>
        </div>
      </div>
    </div>
  );
}
