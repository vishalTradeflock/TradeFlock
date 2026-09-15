"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudioDialog } from "@/components/studio/StudioDialog";
import { storyPreviewHref, type DeskStory, type StudioStoryStatus } from "@/components/studio/types";
import { isModerator, type StudioRole } from "@/lib/studio/roles";
import { cn, formatTimeAgo } from "@/lib/utils";

const TABS: { id: StudioStoryStatus; label: string }[] = [
  { id: "review", label: "In Review" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
];

export default function StudioDesk({
  role,
  lists,
}: {
  role: StudioRole;
  lists: { review: DeskStory[]; published: DeskStory[]; drafts: DeskStory[] };
}) {
  const router = useRouter();
  const moderator = isModerator(role);
  const defaultTab: StudioStoryStatus = "review";
  const [tab, setTab] = useState<StudioStoryStatus>(defaultTab);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const stories = useMemo(() => {
    if (tab === "review") return lists.review;
    if (tab === "published") return lists.published;
    return lists.drafts;
  }, [lists, tab]);

  const counts = {
    review: lists.review.length,
    published: lists.published.length,
    draft: lists.drafts.length,
  };

  async function remove(story: DeskStory) {
    setError("");
    const response = await fetch(`/api/posts/${story.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not delete this story.");
      setPendingId(null);
      return;
    }
    setPendingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="min-h-dvh bg-white">
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
          Moderator
        </p>
        <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight">The desk</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Review submissions, edit copy, and keep the live book in order.
        </p>

        <nav className="mt-8 flex gap-6 border-b border-neutral-200">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px border-b py-3 text-[11px] font-semibold uppercase tracking-widest",
                tab === item.id
                  ? "border-[#c41e3a] text-[#c41e3a]"
                  : "border-transparent text-neutral-500 hover:text-neutral-900",
              )}
            >
              {item.label}
              <span className="ml-2 tabular-nums text-neutral-400">{counts[item.id]}</span>
            </button>
          ))}
        </nav>

        {error ? <p className="mt-4 text-sm text-[#c41e3a]">{error}</p> : null}

        {stories.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-500">
            {tab === "review"
              ? "Nothing is waiting on the spike."
              : tab === "published"
                ? "No live stories in this tray."
                : "No drafts yet. Open Write to start a piece."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
            {stories.map((story) => (
              <li key={story.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                    {story.categoryName}
                    {` · ${story.authorName}`}
                    {` · ${formatTimeAgo(story.updatedAt)}`}
                  </p>
                  <h2 className="mt-1 font-serif text-xl font-semibold tracking-tight">
                    <Link href={`/studio/write?id=${story.id}`} className="hover:text-[#c41e3a]">
                      {story.title}
                    </Link>
                  </h2>
                  {story.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-600">{story.excerpt}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {story.status === "published" ? (
                    <Link
                      href={storyPreviewHref(story)}
                      className="h-8 px-2 text-[11px] font-semibold uppercase tracking-widest leading-8 hover:text-[#c41e3a]"
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/studio/write?id=${story.id}`}
                    className="h-8 border border-neutral-200 px-3 text-[11px] font-semibold uppercase tracking-widest leading-8 hover:text-[#c41e3a]"
                  >
                    Edit
                  </Link>
                  {moderator ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setPendingId(story.id)}
                      className="h-8 px-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500 hover:text-[#c41e3a]"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {pendingId ? (
        <StudioDialog title="Delete this story?" onClose={() => setPendingId(null)}>
          <p>This removes the piece from the desk and the live book. This cannot be undone.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="h-8 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
              onClick={() => setPendingId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-8 bg-[#c41e3a] px-3 text-[11px] font-semibold uppercase tracking-widest text-white"
              onClick={() => {
                const story = [...lists.review, ...lists.published, ...lists.drafts].find(
                  (item) => item.id === pendingId,
                );
                if (story) void remove(story);
              }}
            >
              Delete
            </button>
          </div>
        </StudioDialog>
      ) : null}
    </div>
  );
}
