import Image from "next/image";
import Link from "next/link";
import { ArticleBylineActions } from "@/components/ArticleBylineActions";
import { authorPath } from "@/lib/authors";
import type { Author } from "@/lib/types";
import { formatPublishedAt } from "@/lib/utils";

const DESK_NAME = "TradeFlock Editorial Desk";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? "T"}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return letters || "TF";
}

export function ArticleHeader({
  author,
  publishedAt,
  shareTitle,
}: {
  author: Author | null | undefined;
  publishedAt: string;
  shareTitle: string;
}) {
  const name = author?.name?.trim() || DESK_NAME;
  const designation = author?.title?.trim() || "";
  const photo = author?.avatar_url?.trim() || "";

  return (
    <div className="my-6 flex flex-col justify-between gap-4 border-y border-neutral-200 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        {photo ? (
          <Image
            src={photo}
            alt={name}
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            unoptimized={!photo.startsWith("/")}
          />
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 font-sans text-[11px] font-semibold text-neutral-700"
            aria-hidden
          >
            {initials(name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950">
            {author?.slug ? (
              <Link href={authorPath(author.slug)} className="hover:text-[#c41e3a]">
                {name}
              </Link>
            ) : (
              name
            )}
          </p>
          {designation ? (
            <p className="text-xs text-neutral-500">{designation}</p>
          ) : null}
          <time dateTime={publishedAt} className="text-xs text-neutral-500">
            {formatPublishedAt(publishedAt)}
          </time>
        </div>
      </div>
      <ArticleBylineActions shareTitle={shareTitle} />
    </div>
  );
}
