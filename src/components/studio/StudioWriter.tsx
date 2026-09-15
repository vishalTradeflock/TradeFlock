"use client";

import {
  Command,
  EditorBubble,
  EditorBubbleItem,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  HorizontalRule,
  ImageResizer,
  Placeholder,
  StarterKit,
  TiptapLink,
  UpdatedImage,
  createImageUpload,
  createSuggestionItems,
  handleCommandNavigation,
  handleImageDrop,
  handleImagePaste,
  renderItems,
  type EditorInstance,
} from "novel";
import { ImageIcon, Minus, Quote, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveStudioDraft, type SaveDraftResult } from "@/app/studio/actions";
import { StudioDialog } from "@/components/studio/StudioDialog";
import { StudioSeoDrawer } from "@/components/studio/StudioSeoDrawer";
import { unsplashEditorSrc } from "@/lib/images";
import { excerptFromHtml } from "@/lib/studio/copy";
import { storyPreviewHref } from "@/components/studio/types";
import { cn } from "@/lib/utils";
import type { StudioRole } from "@/lib/studio/roles";
import { isModerator } from "@/lib/studio/roles";
import { signOutStudioClient } from "@/lib/studio/browser-auth";
import type { StudioCategory } from "@/components/studio/types";

type UnsplashPhoto = {
  id: string;
  alt: string;
  url: string;
  thumb?: string;
  photographer: string;
  photographerUrl: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

async function uploadFile(file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/studio/upload", { method: "POST", body: form });
  const payload = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !payload.url) throw new Error(payload.error ?? "Upload failed.");
  return payload.url;
}

export default function StudioWriter({
  role,
  categories,
  email,
  initialDraft,
}: {
  role: StudioRole;
  categories: StudioCategory[];
  email: string | null;
  initialDraft?: {
    id: string;
    title: string;
    body: string;
    slug: string;
    categoryId: string;
    status: "draft" | "review" | "published";
    metaTitle?: string;
    metaDescription?: string;
  } | null;
}) {
  const router = useRouter();
  const moderator = isModerator(role);
  const editorRef = useRef<EditorInstance | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number>(0);
  const draftId = useRef(initialDraft?.id ?? "");

  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [categoryId, setCategoryId] = useState(
    initialDraft?.categoryId ?? categories[0]?.id ?? "",
  );
  const saveChain = useRef(Promise.resolve());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [savedStatus, setSavedStatus] = useState<"draft" | "review" | "published">(
    initialDraft?.status ?? "draft",
  );
  const [busyAction, setBusyAction] = useState<"review" | "published" | null>(null);
  const [success, setSuccess] = useState<{
    status: "review" | "published";
    id: string;
    slug: string;
    title: string;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [savedSlug, setSavedSlug] = useState(initialDraft?.slug ?? "");
  const [storyId, setStoryId] = useState(initialDraft?.id ?? "");
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [unsplashQuery, setUnsplashQuery] = useState("boardroom");
  const [unsplashPhotos, setUnsplashPhotos] = useState<UnsplashPhoto[]>([]);
  const [unsplashError, setUnsplashError] = useState("");
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaTitle, setMetaTitle] = useState(initialDraft?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initialDraft?.metaDescription ?? "");
  const [openingPreview, setOpeningPreview] = useState(() =>
    excerptFromHtml(initialDraft?.body ?? ""),
  );

  const resizeTitle = useCallback(() => {
    const node = titleRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resizeTitle();
  }, [title, resizeTitle]);

  const insertUnsplash = useCallback((photo: UnsplashPhoto) => {
    const editor = editorRef.current;
    const src = unsplashEditorSrc(photo.url);
    if (!editor || !src) return;

    let href = "https://unsplash.com/?utm_source=tradeflock&utm_medium=referral";
    try {
      const parsed = new URL(photo.photographerUrl || "https://unsplash.com");
      parsed.searchParams.set("utm_source", "tradeflock");
      parsed.searchParams.set("utm_medium", "referral");
      href = parsed.toString();
    } catch {
      // keep Unsplash homepage attribution if the photographer URL is malformed
    }

    const alt = photo.alt || `Photo by ${photo.photographer}`;
    const inserted = editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "image",
          attrs: { src, alt },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "italic" }], text: "Photo by " },
            {
              type: "text",
              marks: [
                { type: "italic" },
                {
                  type: "link",
                  attrs: {
                    href,
                    target: "_blank",
                    rel: "noreferrer",
                  },
                },
              ],
              text: photo.photographer || "Unsplash",
            },
            { type: "text", marks: [{ type: "italic" }], text: " on Unsplash" },
          ],
        },
      ])
      .run();

    if (!inserted) {
      editor.chain().focus().setImage({ src, alt }).run();
    }
    setUnsplashOpen(false);
  }, []);

  const suggestionItems = useMemo(
    () =>
      createSuggestionItems([
        {
          title: "Image",
          description: "Upload a photo from this computer",
          searchTerms: ["image", "photo", "upload"],
          icon: <ImageIcon className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            fileRef.current?.click();
          },
        },
        {
          title: "Unsplash",
          description: "Search and insert a stock photograph",
          searchTerms: ["unsplash", "stock"],
          icon: <Search className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            setUnsplashOpen(true);
          },
        },
        {
          title: "Quote",
          description: "Insert a pull quote",
          searchTerms: ["quote", "blockquote"],
          icon: <Quote className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
          },
        },
        {
          title: "Divider",
          description: "Insert a horizontal rule",
          searchTerms: ["divider", "hr", "line"],
          icon: <Minus className="h-4 w-4" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
          },
        },
      ]),
    [],
  );

  const slashCommand = useMemo(
    () =>
      Command.configure({
        suggestion: {
          items: () => suggestionItems,
          render: () => renderItems(),
        },
      }),
    [suggestionItems],
  );

  const uploadFn = useMemo(
    () =>
      createImageUpload({
        validateFn: (file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024,
        onUpload: uploadFile,
      }),
    [],
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        horizontalRule: false,
        dropcursor: { color: "#c41e3a", width: 2 },
      }),
      Placeholder.configure({
        placeholder: "Tell the story. Type / for commands.",
      }),
      TiptapLink.configure({ openOnClick: false }),
      UpdatedImage.configure({ allowBase64: false }),
      HorizontalRule,
      slashCommand,
    ],
    [slashCommand],
  );

  const persist = useCallback(
    async (status?: "draft" | "review" | "published"): Promise<SaveDraftResult | null> => {
      let outcome: SaveDraftResult | null = null;
      const run = async () => {
        if (!categoryId) {
          setSaveState("error");
          setSaveError("Choose a desk before saving.");
          return;
        }
        if ((status === "review" || status === "published") && !title.trim()) {
          setSaveState("error");
          setSaveError("Add a headline before submitting.");
          return;
        }
        if (status === "published" && !moderator) {
          setSaveState("error");
          setSaveError("Only a moderator can publish.");
          return;
        }

        setSaveState("saving");
        setSaveError("");
        try {
          const body = editorRef.current?.getHTML() ?? initialDraft?.body ?? "";
          const result = await saveStudioDraft({
            id: draftId.current || null,
            title,
            body,
            categoryId,
            status,
            metaTitle,
            metaDescription,
          });
          outcome = result;
          if (!result.ok) {
            setSaveState("error");
            setSaveError(result.error);
            return;
          }
          draftId.current = result.id;
          setStoryId(result.id);
          setSavedSlug(result.slug);
          setSavedStatus(result.status);
          setSaveState("saved");
          if (typeof window !== "undefined") {
            const next = `/studio/write?id=${result.id}`;
            if (window.location.pathname + window.location.search !== next) {
              window.history.replaceState(null, "", next);
            }
          }
        } catch (error) {
          setSaveState("error");
          setSaveError(error instanceof Error ? error.message : "Could not save draft.");
        }
      };

      const queued = saveChain.current.then(run, run);
      saveChain.current = queued.then(
        () => undefined,
        () => undefined,
      );
      await queued;
      return outcome;
    },
    [categoryId, initialDraft?.body, metaDescription, metaTitle, moderator, title],
  );

  const submitStatus = useCallback(
    (status: "review" | "published") => {
      window.clearTimeout(saveTimer.current);
      setBusyAction(status);
      void persist(status)
        .then((result) => {
          if (result?.ok && (result.status === "review" || result.status === "published")) {
            setSuccess({
              status: result.status,
              id: result.id,
              slug: result.slug,
              title: title.trim() || "Untitled draft",
            });
          }
        })
        .finally(() => setBusyAction(null));
    },
    [persist, title],
  );

  async function deleteStory() {
    const id = draftId.current;
    if (!id) return;
    setDeleteError("");
    const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setDeleteError(payload.error ?? "Could not delete this story.");
      return;
    }
    router.replace("/studio");
  }

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (!title.trim() && !(editorRef.current?.getText() ?? "").trim()) return;
      void persist();
    }, 2000);
    return () => window.clearTimeout(saveTimer.current);
  }, [metaDescription, metaTitle, title, persist]);

  async function searchUnsplash(event?: React.FormEvent) {
    event?.preventDefault();
    setUnsplashLoading(true);
    setUnsplashError("");
    const response = await fetch(
      `/api/studio/unsplash?q=${encodeURIComponent(unsplashQuery || "business")}`,
    );
    const payload = (await response.json()) as {
      photos?: UnsplashPhoto[];
      error?: string;
    };
    setUnsplashLoading(false);
    if (!response.ok) {
      setUnsplashError(payload.error ?? "Search failed.");
      return;
    }
    setUnsplashPhotos(payload.photos ?? []);
  }

  useEffect(() => {
    if (unsplashOpen && unsplashPhotos.length === 0) {
      void searchUnsplash();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsplashOpen]);

  const statusLabel =
    saveState === "saving"
      ? busyAction === "published"
        ? "Publishing…"
        : busyAction === "review"
          ? "Submitting…"
          : "Saving…"
      : saveState === "error"
        ? "Save failed"
        : savedStatus === "published" && saveState === "saved"
          ? "Published"
          : savedStatus === "review" && saveState === "saved"
            ? "In review"
            : saveState === "saved"
              ? "Draft saved"
              : savedStatus === "review"
                ? "In review"
                : savedStatus === "published"
                  ? "Published"
                  : "Draft";
  const saving = saveState === "saving";

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link href="/studio" className="font-serif text-lg font-semibold tracking-tight hover:text-[#c41e3a]">
              TradeFlock Studio
            </Link>
            <p
              className={cn(
                "text-[11px] uppercase tracking-widest",
                saveState === "error" ? "text-[#c41e3a]" : "text-neutral-500",
              )}
            >
              {statusLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {moderator ? (
              <Link
                href="/studio"
                className="h-8 px-2 text-[11px] font-semibold uppercase tracking-widest leading-8 hover:text-[#c41e3a]"
              >
                Desk
              </Link>
            ) : null}
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-8 border border-neutral-200 bg-white px-2 text-[11px] font-semibold uppercase tracking-widest outline-none"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={saving}
              className="h-8 border border-neutral-200 px-3 text-[11px] font-semibold uppercase tracking-widest hover:text-[#c41e3a] disabled:opacity-50"
              onClick={() => submitStatus("review")}
            >
              {busyAction === "review" ? "Submitting…" : "Submit for Review"}
            </button>
            {moderator ? (
              <button
                type="button"
                disabled={saving}
                className="h-8 bg-[#c41e3a] px-3 text-[11px] font-semibold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
                onClick={() => submitStatus("published")}
              >
                {busyAction === "published" ? "Publishing…" : "Publish"}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="SEO settings"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 border border-neutral-200 px-3 text-[11px] font-semibold uppercase tracking-widest hover:text-[#c41e3a]"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
            {moderator && storyId ? (
              <button
                type="button"
                disabled={saving}
                className="h-8 px-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500 hover:text-[#c41e3a] disabled:opacity-50"
                onClick={() => {
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              className="h-8 px-2 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
              onClick={async () => {
                await signOutStudioClient();
                router.replace("/studio/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        {saveError ? (
          <p className="border-t border-neutral-200 bg-white px-4 py-2 text-center text-sm text-[#c41e3a]">
            {saveError}
          </p>
        ) : null}
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {saveError ? <p className="mb-4 text-sm text-[#c41e3a]">{saveError}</p> : null}
        <p className="mb-6 text-[11px] text-neutral-400">{email}</p>
        <textarea
          ref={titleRef}
          value={title}
          rows={1}
          placeholder="Title"
          onChange={(event) => setTitle(event.target.value)}
          className="w-full resize-none border-0 bg-transparent font-serif text-4xl font-bold outline-none placeholder:text-neutral-300 sm:text-5xl"
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !editorRef.current) return;
            try {
              const url = await uploadFile(file);
              editorRef.current.chain().focus().setImage({ src: url, alt: file.name }).run();
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : "Upload failed.");
            }
          }}
        />

        <div className="studio-editor prose prose-neutral mt-8 max-w-none">
          <EditorRoot>
            <EditorContent
              className="relative min-h-[500px] w-full focus:outline-none"
              extensions={extensions}
              editorProps={{
                handleDOMEvents: {
                  keydown: (_view, event) => handleCommandNavigation(event),
                },
                handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
                handleDrop: (view, event, _slice, moved) =>
                  handleImageDrop(view, event, moved, uploadFn),
                attributes: {
                  class: "min-h-[55vh] text-lg leading-8 outline-none",
                },
              }}
              onCreate={({ editor }) => {
                editorRef.current = editor;
                if (initialDraft?.body) editor.commands.setContent(initialDraft.body);
              }}
              onUpdate={({ editor }) => {
                editorRef.current = editor;
                setOpeningPreview(excerptFromHtml(editor.getHTML()));
                window.clearTimeout(saveTimer.current);
                saveTimer.current = window.setTimeout(() => {
                  if (!title.trim() && !editor.getText().trim()) return;
                  void persist();
                }, 2000);
              }}
            >
              <EditorCommand className="z-50 rounded-md border border-neutral-200 bg-white px-1 py-2 shadow-md">
                <EditorCommandEmpty className="px-3 py-2 text-xs text-neutral-500">
                  No command
                </EditorCommandEmpty>
                <EditorCommandList>
                  {suggestionItems.map((item) => (
                    <EditorCommandItem
                      key={item.title}
                      value={item.title}
                      onCommand={(props) => item.command?.(props)}
                      className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm aria-selected:bg-neutral-100"
                    >
                      {item.icon}
                      <span>
                        <span className="block font-semibold">/{item.title.toLowerCase()}</span>
                        <span className="block text-xs text-neutral-500">{item.description}</span>
                      </span>
                    </EditorCommandItem>
                  ))}
                </EditorCommandList>
              </EditorCommand>
              <EditorBubble className="flex overflow-hidden rounded border border-neutral-200 bg-white shadow">
                <BubbleButton
                  label="Bold"
                  onSelect={(editor) => editor.chain().focus().toggleBold().run()}
                >
                  B
                </BubbleButton>
                <BubbleButton
                  label="Italic"
                  onSelect={(editor) => editor.chain().focus().toggleItalic().run()}
                >
                  <span className="italic">I</span>
                </BubbleButton>
                <BubbleButton
                  label="Heading 1"
                  onSelect={(editor) => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                  H1
                </BubbleButton>
                <BubbleButton
                  label="Heading 2"
                  onSelect={(editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  H2
                </BubbleButton>
                <BubbleButton
                  label="Quote"
                  onSelect={(editor) => editor.chain().focus().toggleBlockquote().run()}
                >
                  “”
                </BubbleButton>
                <BubbleButton
                  label="Link"
                  onSelect={(editor) => {
                    const previous = editor.getAttributes("link").href as string | undefined;
                    const next = window.prompt("Link URL", previous ?? "https://");
                    if (next === null) return;
                    if (next === "") {
                      editor.chain().focus().unsetLink().run();
                      return;
                    }
                    editor.chain().focus().setLink({ href: next }).run();
                  }}
                >
                  Link
                </BubbleButton>
              </EditorBubble>
              <ImageResizer />
            </EditorContent>
          </EditorRoot>
        </div>
        <p className="mt-8 text-xs text-neutral-400">
          Drag an image onto the page, or type /image, /quote, /divider, /unsplash.
        </p>
      </div>

      {unsplashOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-xl font-semibold">Unsplash</h2>
              <button
                type="button"
                className="text-xs uppercase tracking-widest text-neutral-500"
                onClick={() => setUnsplashOpen(false)}
              >
                Close
              </button>
            </div>
            <form onSubmit={searchUnsplash} className="mt-4 flex gap-2">
              <input
                value={unsplashQuery}
                onChange={(event) => setUnsplashQuery(event.target.value)}
                placeholder="Search photographs"
                className="flex-1 border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[#c41e3a]"
              />
              <button
                type="submit"
                className="bg-[#c41e3a] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
              >
                Search
              </button>
            </form>
            {unsplashError ? <p className="mt-3 text-sm text-[#c41e3a]">{unsplashError}</p> : null}
            {unsplashLoading ? (
              <p className="mt-6 text-sm text-neutral-500">Searching…</p>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {unsplashPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="group text-left"
                    onClick={() => insertUnsplash(photo)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumb || photo.url}
                      alt={photo.alt}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <span className="mt-1 block text-[11px] text-neutral-500 group-hover:text-[#c41e3a]">
                      {photo.photographer}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {success ? (
        <StudioDialog title={success.status === "published" ? "Published" : "Submitted for review"}>
          <p>
            {success.status === "published"
              ? "The story is live on TradeFlock USA."
              : "The masthead has your copy. It is not on the live book yet."}
          </p>
          <p className="mt-3 font-serif text-lg font-semibold tracking-tight text-neutral-900">
            {success.title}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#c41e3a]">
            {success.status === "published" ? "Published" : "In review"}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link
              href={storyPreviewHref(success)}
              className="h-8 border border-neutral-200 px-3 text-center text-[11px] font-semibold uppercase tracking-widest leading-8 hover:text-[#c41e3a]"
            >
              {success.status === "published" ? "View story" : "Preview in editor"}
            </Link>
            <Link
              href="/studio"
              className="h-8 bg-[#c41e3a] px-3 text-center text-[11px] font-semibold uppercase tracking-widest leading-8 text-white"
            >
              Back to Desk
            </Link>
          </div>
        </StudioDialog>
      ) : null}

      {deleteOpen ? (
        <StudioDialog title="Delete this story?" onClose={() => setDeleteOpen(false)}>
          <p>This removes the piece from the desk and the live book. This cannot be undone.</p>
          {deleteError ? <p className="mt-3 text-sm text-[#c41e3a]">{deleteError}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="h-8 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-8 bg-[#c41e3a] px-3 text-[11px] font-semibold uppercase tracking-widest text-white"
              onClick={() => void deleteStory()}
            >
              Delete
            </button>
          </div>
        </StudioDialog>
      ) : null}

      <StudioSeoDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title={title}
        slug={savedSlug}
        opening={openingPreview}
        metaTitle={metaTitle}
        metaDescription={metaDescription}
        onMetaTitleChange={setMetaTitle}
        onMetaDescriptionChange={setMetaDescription}
      />
    </div>
  );
}

function BubbleButton({
  children,
  label,
  onSelect,
}: {
  children: React.ReactNode;
  label: string;
  onSelect: (editor: EditorInstance) => void;
}) {
  return (
    <EditorBubbleItem
      onSelect={onSelect}
      className="px-2.5 py-1.5 text-xs font-semibold hover:bg-neutral-100"
      aria-label={label}
    >
      {children}
    </EditorBubbleItem>
  );
}
