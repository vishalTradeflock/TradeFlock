import Link from "next/link";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import LatestScroller from "@/components/LatestScroller";
import MiddleScroller from "@/components/MiddleScroller";
import SafeArticleImage from "@/components/SafeArticleImage";
import {
  getBigTake,
  getHomeLayout,
  getSuccessInsightsArticles,
  isSuccessInsightsArticle,
  partitionHomeArticles,
} from "@/lib/articles";
import type { ArticleWithRelations } from "@/lib/types";
import { formatShortDate, formatTimeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomeProps = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const category = params.category;
  const [{ featured, mostRead, articles }, bigTake, successInsightsArticles] = await Promise.all([
    getHomeLayout(category),
    getBigTake(8),
    getSuccessInsightsArticles(20),
  ]);
  const editorialArticles = partitionHomeArticles(articles).editorialArticles;

  const heroArticles = editorialArticles.slice(0, 8);
  const lead = heroArticles[0] ?? featured;
  const deepDiveTop = editorialArticles.slice(8, 10);
  const deepDiveSub = editorialArticles.slice(10, 14);
  const latestArticles = editorialArticles.slice(14);
  const editorialMostRead = mostRead.filter((article) => !isSuccessInsightsArticle(article));
  const editorialBigTake = bigTake.filter((article) => !isSuccessInsightsArticle(article));
  const middleRail =
    successInsightsArticles.length > 0
      ? successInsightsArticles
      : editorialArticles.slice(14, 34);

  if (!lead && !heroArticles.length) {
    return (
      <>
        <Header activeCategory={category} tickerArticles={successInsightsArticles} />
        <main className="mx-auto max-w-[1240px] px-4 py-16">
          <p className="text-sm text-neutral-600">No stories on the desk yet.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header activeCategory={category} tickerArticles={successInsightsArticles} />
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        {category ? (
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
            Section · {lead?.category.name ?? category}
          </p>
        ) : null}

        <section className="grid min-h-0 grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-0">
          <div className="min-h-0 lg:col-span-6 lg:pr-6">
            <HeroCarousel articles={heroArticles} />

            <hr className="my-6 border-border" />
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Deep Dive
            </h3>

            {deepDiveTop.length ? (
              <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {deepDiveTop.map((article) => (
                  <Link key={article.id} href={`/news/${article.slug}`} className="group block">
                    <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded bg-neutral-100">
                      <SafeArticleImage
                        src={article.cover_image_url}
                        alt={article.cover_image_alt}
                        fill
                        sizes="(min-width: 640px) 25vw, 100vw"
                      />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                      {article.category.name}
                    </p>
                    <h4 className="mt-1 line-clamp-2 font-serif text-base font-semibold leading-snug group-hover:underline">
                      {article.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {article.author.name}
                      <span className="mx-1.5">·</span>
                      {formatShortDate(article.published_at)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : null}

            {deepDiveSub.length ? (
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 border-t border-border/60 pt-4 sm:grid-cols-2">
                {deepDiveSub.map((article) => (
                  <Link key={article.id} href={`/news/${article.slug}`} className="group block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                      {article.category.name}
                    </p>
                    <h4 className="mt-1 line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
                      {article.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatTimeAgo(article.published_at)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid min-h-0 grid-cols-1 items-stretch gap-6 lg:col-span-6 lg:grid-cols-2 lg:gap-0">
            <MiddleScroller articles={middleRail} />

            <aside className="min-h-0 lg:border-l lg:border-neutral-200 lg:pl-5">
              <RankedRail title="Most Read" articles={editorialMostRead} />
              <RankedRail
                title="The Big Take"
                articles={editorialBigTake}
                className="mt-8"
                scrollable
              />
            </aside>
          </div>
        </section>

        {latestArticles.length ? (
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <LatestScroller articles={latestArticles} />
          </div>
        ) : null}
      </main>
    </>
  );
}

function RankedRail({
  title,
  articles,
  className,
  scrollable = false,
}: {
  title: string;
  articles: ArticleWithRelations[];
  className?: string;
  scrollable?: boolean;
}) {
  if (!articles.length) return null;

  return (
    <div className={className}>
      <h3 className="border-b border-neutral-200 pb-2 font-serif text-xl font-semibold tracking-tight">
        {title}
      </h3>
      <ol
        className={
          scrollable
            ? "max-h-[380px] divide-y divide-neutral-200 overflow-y-auto scroll-smooth scrollbar-thin"
            : "divide-y divide-neutral-200"
        }
      >
        {articles.map((article, index) => (
          <li key={article.id} className="py-3">
            <Link href={`/news/${article.slug}`} className="group flex gap-3">
              <span className="font-serif text-2xl font-semibold leading-none text-[#c41e3a]">
                {index + 1}
              </span>
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  {article.category.name}
                </span>
                <span className="mt-0.5 block text-sm font-semibold leading-5 text-neutral-950 group-hover:text-[#c41e3a]">
                  {article.title}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
