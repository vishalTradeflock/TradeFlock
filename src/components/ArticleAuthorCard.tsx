import Image from "next/image";
import Link from "next/link";
import type { Author } from "@/lib/types";
import { authorPath } from "@/lib/authors";

const DESK_NAME = "TradeFlock Editorial Desk";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = `${parts[0]?.[0] ?? "T"}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return letters || "TF";
}

export function ArticleAuthorCard({ author }: { author: Author | null | undefined }) {
  const name = author?.name?.trim() || DESK_NAME;
  const designation = author?.title?.trim() || "";
  const bio = author?.bio?.trim() || "";
  const photo = author?.avatar_url?.trim() || "";

  return (
    <section className="mt-12 flex items-start gap-4 border-t border-neutral-200 pt-8">
      {photo ? (
        <Image
          src={photo}
          alt={name}
          width={64}
          height={64}
          className="h-16 w-16 rounded-full object-cover"
          unoptimized={!photo.startsWith("/")}
        />
      ) : (
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neutral-200 font-sans text-sm font-semibold text-neutral-700"
          aria-hidden
        >
          {initials(name)}
        </span>
      )}
      <div className="min-w-0">
        {author?.slug ? (
          <h2 className="font-serif text-lg font-bold text-neutral-900">
            <Link href={authorPath(author.slug)} className="hover:text-[#c41e3a]">
              {name}
            </Link>
          </h2>
        ) : (
          <h2 className="font-serif text-lg font-bold text-neutral-900">{name}</h2>
        )}
        {designation ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-red-600">{designation}</p>
        ) : null}
        {bio ? (
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">{bio}</p>
        ) : null}
      </div>
    </section>
  );
}
