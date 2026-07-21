"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { htmlToMd, mdToHtml } from "@/lib/markdown";

// The Notes body editor. Notes persist as markdown, but the visitor never sees
// markdown: this is a contenteditable holding rendered HTML, and typing a
// marker ("## ", "- ", "**bold**") reformats the text in place the moment the
// marker completes — the syntax disappears as you type it.
//
// execCommand is deprecated on paper and still the only cross-browser way to
// restructure a contenteditable without shipping an editor framework. Every
// call here has a plain-DOM fallback path in the browsers that matter.

export type NoteEditorHandle = {
  /** "bold" | "italic" | "underline" — applied to the selection */
  format: (command: string) => void;
  /** "h1" | "h2" | "h3" | "blockquote" | "p" — retypes the current block */
  formatBlock: (tag: string) => void;
  insertList: (ordered: boolean) => void;
  /** wraps the selection in a link; empty url unlinks it */
  insertLink: (url: string) => void;
  insertImage: (src: string, alt: string) => void;
  insertRule: () => void;
  insertChecklist: () => void;
  insertTable: () => void;
  /** text currently selected, so the toolbar can prefill a link dialog */
  selectedText: () => string;
  focus: () => void;
};

/** Block markers, longest first so "###" wins over "#". */
const BLOCK_RULES: { pattern: RegExp; run: () => void }[] = [
  { pattern: /^###$/, run: () => document.execCommand("formatBlock", false, "h3") },
  { pattern: /^##$/, run: () => document.execCommand("formatBlock", false, "h2") },
  { pattern: /^#$/, run: () => document.execCommand("formatBlock", false, "h1") },
  { pattern: /^>$/, run: () => document.execCommand("formatBlock", false, "blockquote") },
  { pattern: /^[-*]$/, run: () => document.execCommand("insertUnorderedList") },
  { pattern: /^\d+\.$/, run: () => document.execCommand("insertOrderedList") },
];

/** Inline markers, applied the moment the closing marker is typed. */
const INLINE_RULES: { pattern: RegExp; wrap: (inner: string) => string }[] = [
  { pattern: /\*\*([^*]+)\*\*$/, wrap: (s) => `<strong>${s}</strong>` },
  { pattern: /__([^_]+)__$/, wrap: (s) => `<u>${s}</u>` },
  { pattern: /(?:^|[^*])\*([^*]+)\*$/, wrap: (s) => `<em>${s}</em>` },
  { pattern: /`([^`]+)`$/, wrap: (s) => `<code>${s}</code>` },
];

/** ⌘B / ⌘I / ⌘U, like every other editor on the machine. */
const SHORTCUTS: Record<string, string> = { b: "bold", i: "italic", u: "underline" };

function currentTextBeforeCaret(): { node: Text; offset: number; text: string } | null {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || !sel.anchorNode) return null;
  if (sel.anchorNode.nodeType !== Node.TEXT_NODE) return null;
  const node = sel.anchorNode as Text;
  const offset = sel.anchorOffset;
  return { node, offset, text: (node.textContent ?? "").slice(0, offset) };
}

function selectRange(node: Text, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export const NoteEditor = forwardRef<
  NoteEditorHandle,
  {
    /** changes only when a different note is opened — drives a full re-render */
    noteId: string;
    markdown: string;
    onChange: (markdown: string) => void;
    className?: string;
    placeholder?: string;
  }
>(function NoteEditor({ noteId, markdown, onChange, className = "", placeholder }, ref) {
  const elRef = useRef<HTMLDivElement>(null);
  // what we last handed upward — lets us tell our own edits from external ones
  const emitted = useRef<string | null>(null);
  // last caret/selection inside the editor, kept alive across toolbar clicks
  const saved = useRef<Range | null>(null);

  // Re-render the HTML only when the note changes or someone else edits the
  // markdown. Re-rendering on our own keystrokes would reset the caret.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (markdown === emitted.current) return;
    el.innerHTML = mdToHtml(markdown);
    emitted.current = markdown;
  }, [noteId, markdown]);

  const emit = () => {
    const el = elRef.current;
    if (!el) return;
    const md = htmlToMd(el);
    emitted.current = md;
    onChange(md);
  };

  /** "## " at the start of a line becomes a heading, and the marker vanishes. */
  const applyBlockRule = (): boolean => {
    const at = currentTextBeforeCaret();
    if (!at) return false;
    const rule = BLOCK_RULES.find((r) => r.pattern.test(at.text));
    if (!rule) return false;
    selectRange(at.node, 0, at.offset);
    document.execCommand("delete");
    rule.run();
    return true;
  };

  /** "**bold**" reformats as soon as the closing pair lands. */
  const applyInlineRule = (): boolean => {
    const at = currentTextBeforeCaret();
    if (!at) return false;
    for (const rule of INLINE_RULES) {
      const m = rule.pattern.exec(at.text);
      if (!m) continue;
      // the *em* rule captures a leading character that must survive
      const leading = /^[*`_]/.test(m[0]) ? 0 : 1;
      selectRange(at.node, at.offset - m[0].length + leading, at.offset);
      document.execCommand("insertHTML", false, rule.wrap(m[1]));
      return true;
    }
    return false;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const command = (e.metaKey || e.ctrlKey) && SHORTCUTS[e.key.toLowerCase()];
    if (command) {
      e.preventDefault();
      document.execCommand(command);
      emit();
      return;
    }
    if (e.key !== " ") return;
    if (applyBlockRule()) {
      e.preventDefault();
      emit();
    }
  };

  const onInput = (e: React.FormEvent) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (data === "*" || data === "`" || data === "_") applyInlineRule();
    emit();
  };

  // Paste as plain text — pasted rich HTML would smuggle in tags htmlToMd
  // can't serialise, and the note would lose them on the next save anyway.
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  const rememberSelection = () => {
    const el = elRef.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) saved.current = range.cloneRange();
  };

  /** Clicking a toolbar button blurs the editor — put the caret back first. */
  const restore = () => {
    const el = elRef.current;
    if (!el) return;
    el.focus();
    const range = saved.current;
    if (!range || !el.contains(range.commonAncestorContainer)) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const run = (fn: () => void) => {
    restore();
    fn();
    emit();
  };

  useImperativeHandle(ref, () => ({
    format: (command: string) => run(() => document.execCommand(command)),
    formatBlock: (tag: string) => run(() => document.execCommand("formatBlock", false, tag)),
    insertList: (ordered: boolean) =>
      run(() => document.execCommand(ordered ? "insertOrderedList" : "insertUnorderedList")),
    insertLink: (url: string) =>
      run(() => {
        if (!url) return document.execCommand("unlink");
        document.execCommand("createLink", false, url);
      }),
    insertImage: (src: string, alt: string) =>
      run(() =>
        document.execCommand(
          "insertHTML",
          false,
          `<p><img src="${src}" alt="${alt.replace(/"/g, "&quot;")}"></p><p><br></p>`,
        ),
      ),
    insertRule: () => run(() => document.execCommand("insertHTML", false, "<hr><p><br></p>")),
    insertChecklist: () =>
      run(() => {
        document.execCommand("insertUnorderedList");
        const li = window.getSelection()?.anchorNode?.parentElement?.closest("li");
        li?.parentElement?.setAttribute("data-checklist", "1");
        li?.setAttribute("data-check", "0");
      }),
    insertTable: () =>
      run(() =>
        document.execCommand(
          "insertHTML",
          false,
          "<table><thead><tr><th>Column 1</th><th>Column 2</th></tr></thead>" +
            "<tbody><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>",
        ),
      ),
    selectedText: () => saved.current?.toString() ?? "",
    focus: () => elRef.current?.focus(),
  }));

  return (
    <div
      ref={elRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Note body"
      data-placeholder={placeholder}
      onKeyDown={onKeyDown}
      onInput={onInput}
      onPaste={onPaste}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      // iOS selection handles move without any mouse events — capture on touch too
      onTouchEnd={rememberSelection}
      onBlur={rememberSelection}
      // Checklist rows toggle on click, like Apple Notes
      onClick={(e) => {
        const li = (e.target as HTMLElement).closest("li");
        if (!li?.dataset.check) return;
        const rect = li.getBoundingClientRect();
        if (e.clientX > rect.left + 24) return; // only the box, not the text
        li.dataset.check = li.dataset.check === "1" ? "0" : "1";
        emit();
      }}
      className={`note-body ${className}`}
    />
  );
});
