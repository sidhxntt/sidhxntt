"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";
import { api } from "@nl-convex/_generated/api";
import type { Id } from "@nl-convex/_generated/dataModel";
import { Cover } from "../../components/Cover";
import { errorMessage } from "../../components/errors";
import { BASE, href } from "../../lib/config";
import { formatDate } from "../../lib/format";
import { AdminGate } from "./Gate";
import { Icon } from "./icons";
import { EditorSkeleton } from "./Skeletons";
import { RichText, type RichTextValue } from "./RichText";
import { useImageStore } from "./uploads";

// /newsletter/admin/edit/<id> (or /new): one post, series or folder.

type Kind = "post" | "series" | "folder";
type Tree = NonNullable<FunctionReturnType<typeof api.posts.adminTree>>;

function slugify(input: string) {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

export default function AdminEdit({ id, parent }: { id: string; parent?: string }) {
  return (
    <main id="main" className="wrap admin admin--editor">
      <AdminGate fallback={<EditorSkeleton />}>
        <Loader id={id} parent={parent} />
      </AdminGate>
    </main>
  );
}

function Loader({ id, parent }: { id: string; parent?: string }) {
  const isNew = id === "new";
  const post = useQuery(api.posts.adminGet, isNew ? "skip" : { id: id as Id<"posts"> });
  const tree = useQuery(api.posts.adminTree, {});
  if (tree === undefined || (!isNew && post === undefined)) return <EditorSkeleton />;
  if (!isNew && !post) {
    return (
      <div className="notice">
        <h1>That entry is gone</h1>
        <Link className="btn" href={`${BASE}/admin`}>
          Back to the dashboard
        </Link>
      </div>
    );
  }
  return <Form key={post?._id ?? "new"} post={post ?? null} tree={tree ?? []} defaultParent={parent} />;
}

type Post = NonNullable<FunctionReturnType<typeof api.posts.adminGet>>;

function Form({ post, tree, defaultParent }: { post: Post | null; tree: Tree; defaultParent?: string }) {
  const save = useMutation(api.posts.save);
  const remove = useMutation(api.posts.remove);
  const sendPost = useAction(api.emails.sendPost);
  const topics = useQuery(api.posts.topics, {});
  const stats = useQuery(api.subscribers.stats, {});
  const { upload } = useImageStore();

  const [id, setId] = useState<Id<"posts"> | null>(post?._id ?? null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [kind, setKind] = useState<Kind>(post?.kind ?? "post");
  const [parentId, setParentId] = useState<string>(
    post?.parentId ?? (defaultParent && tree.some((t) => t.id === defaultParent) ? defaultParent : ""),
  );
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [topic, setTopic] = useState(post?.topic ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [cover, setCover] = useState<{ id: Id<"_storage">; url: string | null } | null>(
    post?.coverImageId ? { id: post.coverImageId, url: post.coverUrl } : null,
  );
  const [content, setContent] = useState<RichTextValue>({ json: post?.contentJson ?? "", html: post?.contentHtml ?? "" });
  const [status, setStatus] = useState<"draft" | "published">(post?.status ?? "draft");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [emailedAt, setEmailedAt] = useState<number | null>(post?.emailedAt ?? null);
  const [showSettings, setShowSettings] = useState(true);
  // on a narrow screen the settings start folded away under the text
  useEffect(() => {
    if (window.matchMedia("(max-width: 64rem)").matches) setShowSettings(false);
  }, []);

  const touch = () => setDirty(true);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Links inside the app don't reload the page, so beforeunload can't catch
  // them: with unsaved changes, a click on one asks first.
  const router = useRouter();
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function showToast(text: string) {
    clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // where this entry could live: any series or folder that isn't itself or inside it
  const parents = useMemo(() => {
    const children = new Map<string, string[]>();
    for (const t of tree) if (t.parentId) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t.id]);
    const blocked = new Set<string>();
    const block = (x: string) => {
      blocked.add(x);
      for (const c of children.get(x) ?? []) block(c);
    };
    if (id) block(id);
    const trail = (t: Tree[number]): string[] => {
      const names = [t.title];
      let p = t.parentId;
      while (p) {
        const node = tree.find((x) => x.id === p);
        if (!node) break;
        names.unshift(node.title);
        p = node.parentId;
      }
      return names;
    };
    const depth = (t: Tree[number]): number => {
      let d = 0;
      let p = t.parentId;
      while (p) {
        d++;
        p = tree.find((x) => x.id === p)?.parentId ?? null;
      }
      return d;
    };
    return tree
      .filter((t) => t.kind !== "post" && !blocked.has(t.id))
      .map((t) => ({ id: t.id, kind: t.kind, label: trail(t).join(" / "), depth: depth(t) }));
  }, [tree, id]);

  const shownSlug = slugTouched ? slug : title.trim() ? slugify(title) : "";
  const livePath = useMemo(() => {
    if (status !== "published" || !id) return null;
    const self = tree.find((t) => t.id === id);
    if (!self) return null;
    const path: string[] = [];
    let node: Tree[number] | undefined = self;
    while (node) {
      if (node.status !== "published") return null;
      path.unshift(node.slug);
      const pid: string | null = node.parentId;
      node = pid ? tree.find((t) => t.id === pid) : undefined;
    }
    return path;
  }, [tree, id, status]);

  async function submit(nextStatus: "draft" | "published", quiet = false): Promise<boolean> {
    setBusy(nextStatus === "published" ? "Publishing…" : "Saving…");
    setMessage(null);
    try {
      const res = await save({
        id: id ?? undefined,
        kind,
        title,
        slug: slugTouched ? slug : undefined,
        parentId: (parentId || undefined) as Id<"posts"> | undefined,
        topic,
        excerpt,
        coverImageId: cover?.id,
        contentJson: content.json || undefined,
        contentHtml: content.html || undefined,
        status: nextStatus,
      });
      setStatus(nextStatus);
      setSlug(res.slug);
      setSlugTouched(true);
      setDirty(false);
      if (!id) {
        setId(res.id);
        window.history.replaceState(null, "", `${BASE}/admin/edit/${res.id}`);
      }
      const changed = nextStatus !== status;
      if (!quiet && (changed || nextStatus === "published")) {
        showToast(
          nextStatus === "published"
            ? changed
              ? "Published. Readers see it within a minute."
              : "Updated. Readers see it within a minute."
            : "Unpublished. It's a draft again.",
        );
      }
      return true;
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function email(mode: "test" | "all") {
    if (!id) return;
    setBusy(mode === "test" ? "Sending a test…" : "Sending…");
    setMessage(null);
    try {
      const res = await sendPost({ postId: id, mode, force: mode === "all" && !!emailedAt });
      if (mode === "all") setEmailedAt(Date.now());
      showToast(
        res.skipped
          ? "AutoSend isn't set up yet (no AUTOSEND_API_KEY), so nothing was sent. See the README."
          : mode === "test"
            ? "Test sent to your inbox."
            : `Sent to ${res.sent} subscriber${res.sent === 1 ? "" : "s"}${res.failed ? `, ${res.failed} failed` : ""}.`,
      );
    } catch (e) {
      setMessage({ kind: "error", text: errorMessage(e) });
    } finally {
      setBusy(null);
      setConfirmSend(false);
    }
  }

  const words = useMemo(() => countWords(content.html), [content.html]);
  const parentTrail = useMemo(() => {
    const names: string[] = [];
    let pid: string | null = parentId || null;
    while (pid) {
      const node = tree.find((t) => t.id === pid);
      if (!node) break;
      names.unshift(node.title);
      pid = node.parentId;
    }
    return names;
  }, [tree, parentId]);
  const urlBase = useMemo(() => {
    const segs: string[] = [];
    let pid: string | null = parentId || null;
    while (pid) {
      const node = tree.find((t) => t.id === pid);
      if (!node) break;
      segs.unshift(node.slug);
      pid = node.parentId;
    }
    return `/newsletter/${segs.map((x) => `${x}/`).join("")}`;
  }, [tree, parentId]);

  // Cmd/Ctrl+S saves without changing whether it's live
  const saveRef = useRef<() => void>(() => {});
  saveRef.current = () => {
    if (!busy && title.trim()) void submit(status, true);
  };
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const subtitle = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(titleRef, title);
  useAutoHeight(subtitle, excerpt);

  async function uploadCover(file: File) {
    if (!file.type.startsWith("image/")) {
      setMessage({ kind: "error", text: "That file isn't an image." });
      return;
    }
    setBusy("Uploading cover…");
    try {
      const { storageId, url } = await upload(file);
      setCover({ id: storageId, url });
      touch();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(null);
    }
  }

  const live = status === "published";
  const state = busy ?? (dirty ? "Unsaved changes" : live ? "Published" : id ? "Draft saved" : "New draft");
  const kindName = KIND_NAME[kind];

  return (
    <div className="ed">
      <div className="ed-bar">
        <div className="ed-bar__start">
          <Link className="icon-btn" href={`${BASE}/admin`} aria-label="Back to the dashboard" title="Back to the dashboard">
            <Icon name="back" />
          </Link>
          <div className="ed-bar__where">
            <span className="ed-bar__trail">
              {live ? "Published" : "Draft"} {kindName.toLowerCase()}
              {parentTrail.length > 0 ? ` in ${parentTrail.join(" / ")}` : ""}
            </span>
            <span className={`ed-bar__state ${dirty ? "is-dirty" : ""}`} role="status" aria-live="polite">
              <span className="ed-bar__dot" aria-hidden="true" />
              {state}
            </span>
          </div>
        </div>
        <div className="ed-bar__end">
          {kind !== "folder" && (
            <span className="ed-bar__count">
              {words.toLocaleString("en-US")} {words === 1 ? "word" : "words"}, {Math.max(1, Math.round(words / 220))} min
            </span>
          )}
          {livePath && (
            <a className="btn btn--small btn--ghost" href={href(livePath)} target="_blank" rel="noopener">
              View <Icon name="external" size={14} />
            </a>
          )}
          <button
            type="button"
            className="btn btn--small"
            disabled={!!busy || !title.trim()}
            title="Save (⌘S)"
            onClick={() => void submit("draft")}
          >
            {live ? "Unpublish" : "Save draft"}
          </button>
          <button
            type="button"
            className="btn btn--small btn--primary"
            disabled={!!busy || !title.trim()}
            onClick={() => void submit("published")}
          >
            {live ? "Update" : "Publish"}
          </button>
          <button
            type="button"
            className="icon-btn ed-bar__settings"
            aria-label="Settings"
            aria-expanded={showSettings}
            aria-controls="ed-settings"
            onClick={() => setShowSettings((v) => !v)}
          >
            <Icon name="settings" />
          </button>
        </div>
      </div>
      {leaveTo && (
        <div className="ed-message ed-message--leave" role="alertdialog" aria-label="Unsaved changes">
          <span>You have unsaved changes.</span>
          <span className="side-actions">
            <button
              type="button"
              className="btn btn--small btn--primary"
              disabled={!!busy || !title.trim()}
              onClick={async () => {
                const to = leaveTo;
                if (await submit(status, true)) {
                  setLeaveTo(null);
                  router.push(to);
                }
              }}
            >
              Save and leave
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                const to = leaveTo;
                setDirty(false);
                setLeaveTo(null);
                router.push(to);
              }}
            >
              Leave without saving
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setLeaveTo(null)}>
              Keep editing
            </button>
          </span>
        </div>
      )}
      {toast && (
        <p className="toast" role="status" key={toast.key}>
          {toast.text}
        </p>
      )}
      {message && (
        <p className={`ed-message ${message.kind === "error" ? "ed-message--error" : ""}`} role="status">
          {message.text}
          <button type="button" className="ed-message__close" aria-label="Dismiss" onClick={() => setMessage(null)}>
            ×
          </button>
        </p>
      )}

      <div className={`ed-layout ${showSettings ? "" : "ed-layout--focus"}`}>
        <div className="ed-canvas">
          <CoverSlot
            cover={cover}
            title={title}
            busy={!!busy}
            onFile={uploadCover}
            onRemove={() => {
              setCover(null);
              touch();
            }}
          />
          <label className="sr-only" htmlFor="title">
            Title
          </label>
          <textarea
            id="title"
            ref={titleRef}
            rows={1}
            className="ed-title"
            placeholder={kind === "post" ? "Title" : `${kindName} name`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value.replace(/\n/g, " "));
              touch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                subtitle.current?.focus();
              }
            }}
          />
          <label className="sr-only" htmlFor="excerpt">
            Summary
          </label>
          <textarea
            id="excerpt"
            ref={subtitle}
            rows={1}
            className="ed-subtitle"
            maxLength={300}
            placeholder="Add a one-line summary for cards, emails and link previews"
            value={excerpt}
            onChange={(e) => {
              setExcerpt(e.target.value.replace(/\n/g, " "));
              touch();
            }}
          />
          <RichText
            initialJson={post?.contentJson}
            initialHtml={post?.contentHtml}
            placeholder={
              kind === "post"
                ? "Tell your story, or paste from Notion, Google Docs or anywhere…"
                : `Optional introduction for this ${kind}…`
            }
            onChange={(v) => {
              setContent(v);
              touch();
            }}
          />
        </div>

        <aside id="ed-settings" className="ed-side" aria-label="Post settings" hidden={!showSettings}>
          <section className="ed-panel" aria-label="Where it lives">
            <div className="ed-row">
              <span className="ed-row__label" id="kind-label">
                Type
              </span>
              <div className="kind-picker" role="radiogroup" aria-labelledby="kind-label">
                {(["post", "series", "folder"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => {
                      setKind(k);
                      touch();
                    }}
                  >
                    <Icon name={KIND_ICON[k]} size={16} />
                    {KIND_NAME[k]}
                  </button>
                ))}
              </div>
              <p className="ed-row__hint">{KIND_HINT[kind]}</p>
            </div>

            <div className="ed-row">
              <label className="ed-row__label" htmlFor="parent">
                Inside
              </label>
              <div className="ed-select">
                <select
                  id="parent"
                  value={parentId}
                  onChange={(e) => {
                    setParentId(e.target.value);
                    touch();
                  }}
                >
                  <option value="">Nothing (top level)</option>
                  {(["series", "folder"] as const).map((group) => {
                    const options = parents.filter((p) => p.kind === group);
                    return options.length ? (
                      <optgroup key={group} label={group === "series" ? "Series" : "Folders"}>
                        {options.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </div>
              <p className="ed-row__hint">{INSIDE_HINT[kind]}</p>
            </div>

            <div className="ed-row">
              <label className="ed-row__label" htmlFor="slug">
                Link
              </label>
              <input
                id="slug"
                className="ed-input ed-input--mono"
                value={shownSlug}
                placeholder="made-from-the-title"
                spellCheck={false}
                autoComplete="off"
                aria-describedby="slug-path"
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                  touch();
                }}
              />
              <p className="ed-row__hint ed-path" id="slug-path">
                {urlBase}
                <strong>{shownSlug || slugify(title || "untitled")}</strong>
              </p>
              {slugTouched && title.trim() && slug !== slugify(title) && (
                <button
                  type="button"
                  className="ed-row__link"
                  onClick={() => {
                    setSlug(slugify(title));
                    touch();
                  }}
                >
                  Match the title again
                </button>
              )}
            </div>

            {kind !== "folder" && (
              <div className="ed-row">
                <label className="ed-row__label" htmlFor="topic">
                  Topic
                </label>
                <input
                  id="topic"
                  className="ed-input"
                  list="topics"
                  value={topic}
                  placeholder="Pick one or type a new one"
                  autoComplete="off"
                  onChange={(e) => {
                    setTopic(e.target.value);
                    touch();
                  }}
                />
                <datalist id="topics">
                  {(topics ?? []).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {(topics ?? []).length > 0 && (
                  <div className="topic-chips" aria-label="Topics you've used">
                    {(topics ?? []).slice(0, 8).map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={topic === t}
                        onClick={() => {
                          setTopic(topic === t ? "" : t);
                          touch();
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {kind === "post" && (
            <section className="ed-group">
              <h2 className="ed-group__title">Email</h2>
              {id && live ? (
                <>
                  <p className="field__hint">
                    {emailedAt
                      ? `Emailed to subscribers on ${formatDate(emailedAt)}.`
                      : `Not emailed yet.${stats ? ` ${stats.active} confirmed subscriber${stats.active === 1 ? "" : "s"}.` : ""}`}
                  </p>
                  <div className="side-actions">
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={!!busy || dirty}
                      onClick={() => void email("test")}
                    >
                      Send me a test
                    </button>
                    {confirmSend ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--small btn--primary"
                          disabled={!!busy}
                          onClick={() => void email("all")}
                        >
                          {emailedAt ? "Yes, send it again" : "Yes, send it"}
                        </button>
                        <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmSend(false)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--small btn--primary"
                        disabled={!!busy || dirty}
                        onClick={() => setConfirmSend(true)}
                      >
                        Email subscribers
                      </button>
                    )}
                  </div>
                  {dirty && <span className="field__hint">Save your changes before emailing.</span>}
                </>
              ) : (
                <p className="field__hint">Publish the post to email it to subscribers.</p>
              )}
            </section>
          )}

          {id && (
            <section className="ed-group ed-group--danger">
              <h2 className="ed-group__title">Delete</h2>
              <p className="field__hint">
                Removes this {kindName.toLowerCase()}, its comments and likes
                {kind !== "post" ? ". Move or delete what's inside it first" : ""}.
              </p>
              {confirmDelete ? (
                <div className="side-actions">
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={async () => {
                      try {
                        await remove({ id });
                        setDirty(false);
                        router.push(`${BASE}/admin`);
                      } catch (e) {
                        setMessage({ kind: "error", text: errorMessage(e) });
                        setConfirmDelete(false);
                      }
                    }}
                  >
                    Delete it
                  </button>
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </button>
                </div>
              ) : (
                <div>
                  <button type="button" className="btn btn--small btn--danger" onClick={() => setConfirmDelete(true)}>
                    Delete…
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

const KIND_NAME = { post: "Post", series: "Series", folder: "Folder" } as const;
const KIND_ICON = { post: "post", series: "series", folder: "folder" } as const;
const KIND_HINT = {
  post: "A single piece of writing.",
  series: "Parts read in order, with an optional introduction.",
  folder: "A group of posts and series, like Blogs or Misc.",
} as const;
const INSIDE_HINT = {
  post: "Put it in a series to make it the next part, or in a folder to group it.",
  series: "Usually inside a folder, like Blogs.",
  folder: "Folders usually sit at the top level.",
} as const;

function countWords(html: string): number {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

// Grow a textarea with its text, so the title and summary wrap like headings
function useAutoHeight(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // the width and the display font can both change after the first paint
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [ref, value]);
}

function CoverSlot(props: {
  cover: { id: Id<"_storage">; url: string | null } | null;
  title: string;
  busy: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      const file = e.dataTransfer.files[0];
      if (file) props.onFile(file);
    },
  };
  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) props.onFile(file);
      }}
    />
  );
  if (!props.cover) {
    return (
      <div className={`ed-cover ed-cover--empty ${over ? "is-over" : ""}`} {...drop}>
        <button type="button" className="ed-cover__add" disabled={props.busy} onClick={() => input.current?.click()}>
          <Icon name="image" /> Add a cover image
        </button>
        <span className="ed-cover__hint">or drop one here. 16:9 works best.</span>
        {picker}
      </div>
    );
  }
  return (
    <div className={`ed-cover ${over ? "is-over" : ""}`} {...drop}>
      <Cover url={props.cover.url} title={props.title || "Cover"} />
      <div className="ed-cover__tools">
        <button type="button" className="btn btn--small" disabled={props.busy} onClick={() => input.current?.click()}>
          Replace
        </button>
        <button type="button" className="btn btn--small" onClick={props.onRemove}>
          Remove
        </button>
      </div>
      {picker}
    </div>
  );
}
