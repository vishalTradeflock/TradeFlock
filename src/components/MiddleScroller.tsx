import Link from "next/link";
import SafeArticleImage from "@/components/SafeArticleImage";
import type { ArticleWithRelations } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

const LOOP_MAX = 20;

function loopSource(articles: ArticleWithRelations[]) {
  const seen = new Set<string>();
  const unique: ArticleWithRelations[] = [];
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    unique.push(article);
    if (unique.length >= LOOP_MAX) break;
  }
  return unique;
}

export default function MiddleScroller({
  articles,
}: {
  articles: ArticleWithRelations[];
}) {
  const source = loopSource(articles);
  if (!source.length) return null;
  const displayArticles = [...source, ...source];

  return (
    <div className="group relative h-[620px] overflow-hidden border-neutral-200 lg:h-0 lg:min-h-full lg:self-stretch lg:border-l lg:px-5">
      <div className="absolute inset-0 overflow-hidden">
        <div className="scroll-up-track hover:[animation-play-state:paused]">
          <div>
            {source.map((article) => (
              <RailCard key={`${article.id}-a`} article={article} />
            ))}
          </div>
          <div aria-hidden>
            {displayArticles.slice(source.length).map((article) => (
              <RailCard key={`${article.id}-b`} article={article} />
            ))}
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-background to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-background to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}

function RailCard({ article }: { article: ArticleWithRelations }) {
  return (
    <Link
      href={`/news/${article.slug}`}
      className="flex gap-3 border-b border-border/40 py-3 hover:[&_h3]:text-[#c41e3a]"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-100">
        <SafeArticleImage
          src={article.cover_image_url}
          alt={article.cover_image_alt}
          fill
          sizes="64px"
          className="object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
          {article.category.name}
        </p>
        <h3 className="mt-0.5 line-clamp-2 font-serif text-[15px] font-semibold leading-snug tracking-tight text-neutral-950">
          {article.title}
        </h3>
        <p className="mt-1 text-[11px] text-neutral-500">
          {formatShortDate(article.published_at)}
        </p>
      </div>
    </Link>
  );
}
