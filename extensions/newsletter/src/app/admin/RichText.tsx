"use client";

import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { useRef, useState } from "react";
import { Icon } from "./icons";
import { cleanPastedHtml } from "./paste";
import { isStoredImage, useImageStore } from "./uploads";

// The post editor. Pasting from Notion, Google Docs, Medium or any web page
// keeps headings, bold, italics, links, lists, quotes, code, tables and
// images; pasted images are copied into the newsletter's own storage.

const lowlight = createLowlight(common);
const LANGUAGES = ["plaintext", "bash", "javascript", "typescript", "python", "go", "json", "yaml", "sql", "rust", "java", "css", "xml", "dockerfile", "ini", "diff"];

export type RichTextValue = { json: string; html: string };

export function RichText({
  initialJson,
  initialHtml,
  onChange,
  placeholder = "Write, or paste from anywhere…",
}: {
  initialJson?: string;
  initialHtml?: string;
  onChange: (value: RichTextValue) => void;
  placeholder?: string;
}) {
  const { upload, store } = useImageStore();
  const [status, setStatus] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const initialContent: JSONContent | string | undefined = (() => {
    if (initialJson) {
      try {
        const doc = JSON.parse(initialJson) as JSONContent;
        if (doc && doc.type === "doc") return doc;
      } catch {
        /* fall through to the HTML */
      }
    }
    return initialHtml || undefined;
  })();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
      Image.configure({ allowBase64: true }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight,
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: "prose", "aria-label": "Post content" },
      transformPastedHTML: cleanPastedHtml,
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        // a screenshot or image file on its own (rich text with images is
        // handled after it lands, by the importer below)
        if (files.length === 0 || event.clipboardData?.getData("text/html")) return false;
        void insertFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void insertFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current({ json: JSON.stringify(editor.getJSON()), html: editor.getHTML() });
      importImages(editor);
    },
    onCreate: ({ editor }) => importImages(editor),
  });

  async function insertFiles(files: File[]) {
    if (!editor) return;
    for (const file of files) {
      setStatus(`Uploading ${file.name}…`);
      try {
        const { url } = await upload(file);
        editor.chain().focus().setImage({ src: url, alt: "" }).run();
        setStatus(null);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Upload failed.");
      }
    }
  }

  // Copies every image that isn't in our storage yet (pasted from Notion,
  // Docs or the web, or a data: URL) and points the post at the copy.
  function importImages(ed: Editor) {
    const todo = new Set<string>();
    ed.state.doc.descendants((node) => {
      if (node.type.name !== "image") return;
      const src = String(node.attrs.src ?? "");
      if (!src || isStoredImage(src) || pending.current.has(src) || failed.current.has(src)) return;
      todo.add(src);
    });
    for (const src of todo) {
      pending.current.add(src);
      setStatus(`Copying ${pending.current.size} image${pending.current.size === 1 ? "" : "s"} into the newsletter…`);
      store(src)
        .then((url) => {
          const { tr } = ed.state;
          ed.state.doc.descendants((node, pos) => {
            if (node.type.name === "image" && node.attrs.src === src) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url });
            }
          });
          if (tr.docChanged) ed.view.dispatch(tr);
        })
        .catch(() => {
          failed.current.add(src);
        })
        .finally(() => {
          pending.current.delete(src);
          const n = failed.current.size;
          setStatus(
            pending.current.size > 0
              ? `Copying ${pending.current.size} image${pending.current.size === 1 ? "" : "s"} into the newsletter…`
              : n > 0
                ? `${n} image${n === 1 ? "" : "s"} couldn't be copied and still point to the original site. Replace ${n === 1 ? "it" : "them"} with an upload.`
                : null,
          );
        });
    }
  }

  return (
    <div className="rte">
      {editor && <Toolbar editor={editor} onPickImages={insertFiles} />}
      {status && (
        <p className="rte__status" role="status">
          {status}
        </p>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, onPickImages }: { editor: Editor; onPickImages: (files: File[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : e.isActive("heading", { level: 4 })
              ? "h4"
              : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      language: (e.getAttributes("codeBlock").language as string | undefined) ?? "plaintext",
      table: e.isActive("table"),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  const B = ({
    label,
    on,
    run,
    children,
    disabled,
  }: {
    label: string;
    on?: boolean;
    run: () => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" aria-label={label} title={label} aria-pressed={on} disabled={disabled} onClick={run}>
      {children}
    </button>
  );

  return (
    <div className="rte__bar" role="toolbar" aria-label="Formatting">
      <select
        aria-label="Text style"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") chain().setParagraph().run();
          else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 }).run();
        }}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
      </select>
      <span className="sep" />
      <B label="Bold" on={s.bold} run={() => chain().toggleBold().run()}>
        <Icon name="bold" />
      </B>
      <B label="Italic" on={s.italic} run={() => chain().toggleItalic().run()}>
        <Icon name="italic" />
      </B>
      <B label="Underline" on={s.underline} run={() => chain().toggleUnderline().run()}>
        <Icon name="underline" />
      </B>
      <B label="Strikethrough" on={s.strike} run={() => chain().toggleStrike().run()}>
        <Icon name="strike" />
      </B>
      <B label="Inline code" on={s.code} run={() => chain().toggleCode().run()}>
        <Icon name="code" />
      </B>
      <B label="Highlight" on={s.highlight} run={() => chain().toggleHighlight().run()}>
        <Icon name="highlight" />
      </B>
      <B
        label={s.link ? "Remove link" : "Add link"}
        on={s.link}
        run={() => {
          if (s.link) return void chain().unsetLink().run();
          const url = window.prompt("Link to");
          if (url) chain().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <Icon name="link" />
      </B>
      <span className="sep" />
      <B label="Bulleted list" on={s.bullet} run={() => chain().toggleBulletList().run()}>
        <Icon name="bullets" />
      </B>
      <B label="Numbered list" on={s.ordered} run={() => chain().toggleOrderedList().run()}>
        <Icon name="numbers" />
      </B>
      <B label="Checklist" on={s.task} run={() => chain().toggleTaskList().run()}>
        <Icon name="checklist" />
      </B>
      <B label="Quote" on={s.quote} run={() => chain().toggleBlockquote().run()}>
        <Icon name="quote" />
      </B>
      <B label="Code block" on={s.codeBlock} run={() => chain().toggleCodeBlock().run()}>
        <Icon name="codeBlock" />
      </B>
      {s.codeBlock && (
        <select
          aria-label="Code language"
          value={s.language}
          onChange={(e) => chain().updateAttributes("codeBlock", { language: e.target.value }).run()}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      )}
      <B label="Divider" run={() => chain().setHorizontalRule().run()}>
        <Icon name="divider" />
      </B>
      <span className="sep" />
      <B label="Align centre" on={s.center} run={() => chain().setTextAlign(s.center ? "left" : "center").run()}>
        <Icon name="center" />
      </B>
      <B
        label="Insert table"
        on={s.table}
        run={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Icon name="table" />
      </B>
      {s.table && (
        <>
          <B label="Add row below" run={() => chain().addRowAfter().run()}>
            +Row
          </B>
          <B label="Add column right" run={() => chain().addColumnAfter().run()}>
            +Col
          </B>
          <B label="Delete row" run={() => chain().deleteRow().run()}>
            −Row
          </B>
          <B label="Delete column" run={() => chain().deleteColumn().run()}>
            −Col
          </B>
          <B label="Delete table" run={() => chain().deleteTable().run()}>
            ✕Table
          </B>
        </>
      )}
      <B label="Insert image" run={() => fileInput.current?.click()}>
        <Icon name="image" />
      </B>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onPickImages(files);
        }}
      />
      <span className="sep" />
      <B label="Undo" disabled={!s.canUndo} run={() => chain().undo().run()}>
        <Icon name="undo" />
      </B>
      <B label="Redo" disabled={!s.canRedo} run={() => chain().redo().run()}>
        <Icon name="redo" />
      </B>
    </div>
  );
}
