import Link from "next/link";
import SafeArticleImage from "@/components/SafeArticleImage";
import { articleCoverSrc, deskCoverFallback } from "@/lib/images";
import type { ArticleWithRelations } from "@/lib/types";
import { articlePath } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

function readingMinutes(excerpt: string) {
  const words = excerpt.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

export function RecommendedSuccessInsights({
  articles,
}: {
  articles: ArticleWithRelations[];
}) {
  if (!articles.length) return null;

  return (
    <section className="my-16 border-t border-neutral-200 pt-12">
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-neutral-950">
        More From Success Insights
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Executive profiles, leadership lessons, and strategic perspectives.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {articles.map((article) => {
          const imageUrl = articleCoverSrc(article);
          const fallbackSrc = deskCoverFallback(article);
          const excerpt = article.dek?.trim() || article.excerpt;
          return (
            <Link
              key={article.id}
              href={articlePath(article.slug)}
              className="group flex h-full flex-col overflow-hidden border border-neutral-200 bg-white transition hover:border-neutral-400"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100">
                <SafeArticleImage
                  src={imageUrl}
                  alt={article.cover_image_alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  loading="lazy"
                  fallbackSrc={fallbackSrc === imageUrl ? undefined : fallbackSrc}
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-4 px-4 text-[10px] font-bold uppercase tracking-wider text-[#c41e3a]">
                Success Insights
              </p>
              <h3 className="mt-1 px-4 font-serif text-base font-bold leading-snug tracking-tight text-neutral-950 transition group-hover:text-[#c41e3a] line-clamp-2">
                {article.title}
              </h3>
              {excerpt ? (
                <p className="mt-1.5 px-4 text-xs leading-5 text-neutral-500 line-clamp-2">
                  {excerpt}
                </p>
              ) : null}
              <p className="mt-auto border-t border-neutral-200 p-4 pt-3 text-[11px] tabular-nums text-neutral-500">
                {formatShortDate(article.published_at)}
                <span className="mx-1.5">·</span>
                {readingMinutes(excerpt)} min read
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
