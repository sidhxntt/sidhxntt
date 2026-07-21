"use client";

import { useMemo, useState } from "react";
import { playClick } from "@/lib/sounds";
import { useIsMobile } from "@/lib/useIsMobile";
import { CODE_TREE, DEFAULT_CODE_FILE, getCodeSample } from "@/data/code-samples";

import type { CodeLanguage } from "@/data/code-samples";

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  tsx: "TypeScript React",
  ts: "TypeScript",
  css: "CSS",
};

/* ---------- Tokenizer ---------- */

type Token = { text: string; color: string };

const COLORS = {
  comment: "#6a9955",
  string: "#ce9178",
  keyword: "#569cd6",
  number: "#b5cec8",
  tag: "#4ec9b0",
  plain: "#d4d4d4",
};

const KEYWORDS = new Set([
  "import", "export", "const", "let", "function", "return", "if", "else",
  "type", "interface", "new", "async", "await", "for", "while", "switch",
  "case", "default", "class", "extends", "typeof", "null", "undefined",
  "true", "false", "void", "in", "of", "as",
]);

// Order matters: comments, then strings, then words/numbers.
const LINE_RE =
  /\/\*.*?\*\/|\/\*.*|\/\/.*|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?|[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?/g;

function tokenizeLine(line: string, state: { inBlockComment: boolean }): Token[] {
  const tokens: Token[] = [];
  let start = 0;

  if (state.inBlockComment) {
    const end = line.indexOf("*/");
    if (end === -1) {
      if (line.length > 0) tokens.push({ text: line, color: COLORS.comment });
      return tokens;
    }
    tokens.push({ text: line.slice(0, end + 2), color: COLORS.comment });
    state.inBlockComment = false;
    start = end + 2;
  }

  const rest = line.slice(start);
  LINE_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = LINE_RE.exec(rest)) !== null) {
    if (m.index > last) {
      tokens.push({ text: rest.slice(last, m.index), color: COLORS.plain });
    }
    const t = m[0];
    let color = COLORS.plain;

    if (t.startsWith("/*")) {
      color = COLORS.comment;
      if (!t.endsWith("*/")) state.inBlockComment = true;
    } else if (t.startsWith("//")) {
      color = COLORS.comment;
    } else if (t[0] === '"' || t[0] === "'" || t[0] === "`") {
      color = COLORS.string;
    } else if (/^\d/.test(t)) {
      color = COLORS.number;
    } else if (KEYWORDS.has(t)) {
      color = COLORS.keyword;
    } else if (/^[A-Z]/.test(t)) {
      color = COLORS.tag;
    }

    tokens.push({ text: t, color });
    last = m.index + t.length;
  }

  if (last < rest.length) {
    tokens.push({ text: rest.slice(last), color: COLORS.plain });
  }
  return tokens;
}

function tokenize(source: string): Token[][] {
  const state = { inBlockComment: false };
  return source.split("\n").map((line) => tokenizeLine(line, state));
}

/* ---------- Small icons ---------- */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 text-[#cccccc] transition-transform ${open ? "rotate-90" : ""}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 4l4 4-4 4V4z" />
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const teal = name.endsWith(".ts") && !name.endsWith(".tsx");
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-[2px] ${teal ? "bg-teal-400" : "bg-blue-400"}`}
      aria-hidden
    />
  );
}

/* ---------- Component ---------- */

export function CodeApp() {
  const isMobile = useIsMobile();
  const [openTabs, setOpenTabs] = useState<string[]>([DEFAULT_CODE_FILE]);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_CODE_FILE);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Mobile-only: which pane is showing (file list pushes to full-screen code view)
  const [mobileShowCode, setMobileShowCode] = useState(false);

  const openFile = (key: string) => {
    playClick();
    setOpenTabs((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setActiveTab(key);
  };

  const selectTab = (key: string) => {
    playClick();
    setActiveTab(key);
  };

  const closeTab = (key: string) => {
    playClick();
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== key);
      if (key === activeTab) {
        const idx = prev.indexOf(key);
        setActiveTab(next[Math.min(idx, next.length - 1)] ?? "");
      }
      return next;
    });
  };

  const toggleFolder = (folder: string) => {
    playClick();
    setCollapsed((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  const activeFile = activeTab ? getCodeSample(activeTab) : undefined;
  const activeContent = activeFile?.content;

  const lines = useMemo(
    () => (activeContent !== undefined ? tokenize(activeContent) : []),
    [activeContent]
  );

  // iOS layout: file tree is a root list that pushes the code view
  // full-screen with a back button. Desktop (≥768px) is untouched below.
  if (isMobile) {
    return (
      <div className="flex h-full flex-col bg-[#1e1e1e] text-[#d4d4d4]">
        {!mobileShowCode ? (
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            <div className="px-4 py-3 text-xs font-semibold tracking-wider text-[#bbbbbb] select-none">
              EXPLORER
            </div>
            {CODE_TREE.map((group) => {
              const isOpen = !collapsed[group.folder];
              return (
                <div key={group.folder}>
                  <button
                    type="button"
                    onClick={() => toggleFolder(group.folder)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-[#cccccc] select-none active:bg-[#2a2d2e]"
                  >
                    <Chevron open={isOpen} />
                    <span className="truncate">{group.folder}</span>
                  </button>
                  {isOpen &&
                    group.files.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => {
                          openFile(f.key);
                          setMobileShowCode(true);
                        }}
                        className="flex w-full items-center gap-2.5 py-2.5 pr-3 pl-9 text-left text-sm text-[#cccccc] select-none active:bg-[#2a2d2e]"
                      >
                        <FileIcon name={f.name} />
                        <span className="truncate">{f.name}</span>
                        <span aria-hidden className="ml-auto text-[#6e6e6e]">
                          ›
                        </span>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-black/40 bg-[#252526] px-2 py-2">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMobileShowCode(false);
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[#4fc1ff] active:bg-[#2a2d2e]"
              >
                <span aria-hidden>‹</span>
                Files
              </button>
              <span className="flex min-w-0 items-center gap-1.5 text-sm text-white">
                {activeTab && <FileIcon name={activeTab} />}
                <span className="truncate">{activeTab || "No file"}</span>
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {!activeTab || activeContent === undefined ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#6e6e6e]">
                  {activeTab ? `${activeTab} is not available` : "No file open"}
                </div>
              ) : (
                <div className="flex min-w-max font-mono text-[13px] leading-6">
                  <div className="sticky left-0 shrink-0 bg-[#1e1e1e] px-3 py-2 text-right text-[#858585] select-none">
                    {lines.map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <pre className="flex-1 py-2 pr-6 pl-1">
                    {lines.map((tokens, i) => (
                      <div key={i} className="whitespace-pre">
                        {tokens.length === 0
                          ? " "
                          : tokens.map((t, j) => (
                              <span key={j} style={{ color: t.color }}>
                                {t.text}
                              </span>
                            ))}
                      </div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex shrink-0 items-center gap-4 bg-[#007acc] px-3 py-1 text-[11px] text-white select-none">
          <span className="truncate">{mobileShowCode ? activeTab || "—" : "Explorer"}</span>
          <span>{mobileShowCode && lines.length > 0 ? `${lines.length} lines` : ""}</span>
          <span className="ml-auto shrink-0">Portfolio OS</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-[#1e1e1e] bg-[#252526]">
          <div className="px-4 py-2 text-[11px] font-semibold tracking-wider text-[#bbbbbb] select-none">
            EXPLORER
          </div>
          <div className="flex-1 pb-2">
            {CODE_TREE.map((group) => {
              const isOpen = !collapsed[group.folder];
              return (
                <div key={group.folder}>
                  <button
                    type="button"
                    onClick={() => toggleFolder(group.folder)}
                    className="flex w-full items-center gap-1 px-2 py-0.5 text-left text-[12px] text-[#cccccc] select-none hover:bg-[#2a2d2e]"
                  >
                    <Chevron open={isOpen} />
                    <span className="truncate">{group.folder}</span>
                  </button>
                  {isOpen &&
                    group.files.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => openFile(f.key)}
                        className={`flex w-full items-center gap-1.5 py-0.5 pr-2 pl-7 text-left text-[12px] select-none hover:bg-[#2a2d2e] ${
                          activeTab === f.key
                            ? "bg-[#37373d] text-white"
                            : "text-[#cccccc]"
                        }`}
                      >
                        <FileIcon name={f.name} />
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Editor column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Tab bar */}
          <div className="flex shrink-0 overflow-x-auto bg-[#252526]">
            {openTabs.map((tab) => {
              const active = tab === activeTab;
              return (
                <div
                  key={tab}
                  className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-[#1e1e1e] px-3 py-1.5 text-[12px] select-none ${
                    active
                      ? "bg-[#1e1e1e] text-white"
                      : "bg-[#2d2d2d] text-[#969696] hover:text-[#cccccc]"
                  }`}
                  onClick={() => selectTab(tab)}
                >
                  <FileIcon name={tab} />
                  <span>{tab}</span>
                  <button
                    type="button"
                    aria-label={`Close ${tab}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab);
                    }}
                    className={`ml-1 rounded px-0.5 leading-none hover:bg-[#3d3d3d] ${
                      active ? "" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Editor pane */}
          <div className="min-h-0 flex-1 overflow-auto">
            {!activeTab ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[#6e6e6e]">
                No file open
              </div>
            ) : activeContent === undefined ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[#6e6e6e]">
                {activeTab} is not available
              </div>
            ) : (
              <div className="flex min-w-max font-mono text-[12px] leading-5">
                {/* Line numbers */}
                <div className="sticky left-0 shrink-0 bg-[#1e1e1e] px-3 py-2 text-right text-[#858585] select-none">
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                {/* Code */}
                <pre className="flex-1 py-2 pr-6 pl-1">
                  {lines.map((tokens, i) => (
                    <div key={i} className="whitespace-pre">
                      {tokens.length === 0
                        ? " "
                        : tokens.map((t, j) => (
                            <span key={j} style={{ color: t.color }}>
                              {t.text}
                            </span>
                          ))}
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center gap-4 bg-[#007acc] px-3 py-0.5 text-[11px] text-white select-none">
        <span>{activeTab || "—"}</span>
        <span>{lines.length > 0 ? `${lines.length} lines` : ""}</span>
        <span className="ml-auto">{LANGUAGE_LABELS[activeFile?.language ?? "tsx"]}</span>
        <span>Portfolio OS</span>
      </div>
    </div>
  );
}
