import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import LatestScroller from "@/components/LatestScroller";
import MiddleScroller from "@/components/MiddleScroller";
import SafeArticleImage from "@/components/SafeArticleImage";
import { LATEST_SCROLLER_LIMIT } from "@/lib/cache";
import { getCategoryDesk, getHomeLayout, getSuccessInsightsArticles } from "@/lib/articles";
import { publicPageMetadata } from "@/lib/seo";
import { NAV_CATEGORIES, articlePath, type ArticleWithRelations } from "@/lib/types";
import { formatShortDate, formatTimeAgo } from "@/lib/utils";

const DEEP_DIVE_FALLBACK =
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80";

const DESK_SCROLLER_LIMIT = 12;

function matchesDesk(article: ArticleWithRelations, slug: string, name: string) {
  const deskSlug = slug.trim().toLowerCase();
  const deskName = name.trim().toLowerCase();
  const articleSlug = article.category.slug.trim().toLowerCase();
  const articleName = article.category.name.trim().toLowerCase();
  if (articleSlug === deskSlug || articleName === deskName) return true;
  if (deskSlug === "tech") {
    return articleSlug === "technology" || articleName === "technology";
  }
  return false;
}

function articlesForDesk(
  fetched: ArticleWithRelations[],
  recent: ArticleWithRelations[],
  slug: string,
  name: string,
) {
  const fromFetched = fetched.filter((article) => matchesDesk(article, slug, name));
  if (fromFetched.length) return fromFetched.slice(0, DESK_SCROLLER_LIMIT);
  const fromRecent = recent.filter((article) => matchesDesk(article, slug, name));
  if (fromRecent.length) return fromRecent.slice(0, DESK_SCROLLER_LIMIT);
  return [];
}

export const revalidate = 120;

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "TradeFlock USA — Business & Markets",
    description:
      "U.S. business news on markets, technology, finance, and leadership. An editorial desk in the tradition of a national business paper.",
    path: "/",
    ogTitle: "TradeFlock USA — Business & Markets",
  }),
  title: {
    absolute: "TradeFlock USA — Business & Markets",
  },
};

export default async function Home() {
  const [
    {
      featured,
      mostRead,
      editorialArticles,
    },
    successInsightsArticles,
    ...deskQueries
  ] = await Promise.all([
    getHomeLayout(),
    getSuccessInsightsArticles(20),
    ...NAV_CATEGORIES.map((category) => getCategoryDesk(category.slug, DESK_SCROLLER_LIMIT)),
  ]);

  const heroArticles = editorialArticles.slice(0, 8);
  const lead = heroArticles[0] ?? featured;
  const deepDiveTop = editorialArticles.slice(8, 10);
  const deepDiveSub = editorialArticles.slice(10, 16);
  const occupied = new Set(
    [...heroArticles, ...deepDiveTop, ...deepDiveSub].map((article) => article.id),
  );
  const remainingEditorial = editorialArticles.filter(
    (article) => !occupied.has(article.id),
  );
  const bigTakeArticles = remainingEditorial.slice(0, 12);
  const latestArticles = remainingEditorial.slice(12, 12 + LATEST_SCROLLER_LIMIT);
  const middleRail =
    successInsightsArticles.length > 0
      ? successInsightsArticles
      : editorialArticles.filter((article) => !occupied.has(article.id)).slice(0, 20);
  const deskSections = NAV_CATEGORIES.map((category, index) => ({
    title: category.name,
    articles: articlesForDesk(
      deskQueries[index] ?? [],
      editorialArticles,
      category.slug,
      category.name,
    ),
  }));

  if (!lead && !heroArticles.length) {
    return (
      <>
        <Header tickerArticles={successInsightsArticles} mastheadAsH1 />
        <main className="mx-auto max-w-[1240px] px-4 py-16">
          <p className="text-sm text-neutral-600">No stories on the desk yet.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header tickerArticles={successInsightsArticles} mastheadAsH1 />
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        <section className="grid min-h-0 grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:items-stretch lg:gap-0">
          <div className="min-h-0 lg:col-span-6 lg:pr-6">
            <HeroCarousel articles={heroArticles} />

            <hr className="my-6 border-border" />
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Deep Dive
            </h2>

            {deepDiveTop.length ? (
              <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {deepDiveTop.map((article) => (
                  <Link key={article.id} href={articlePath(article.slug)} className="group block">
                    <div className="relative mb-3 aspect-[16/10] w-full overflow-hidden rounded bg-muted">
                      <SafeArticleImage
                        src={article.cover_image_url}
                        alt={article.cover_image_alt || article.title}
                        fill
                        sizes="(min-width: 640px) 25vw, 100vw"
                        loading="lazy"
                        unoptimized
                        fallbackSrc={DEEP_DIVE_FALLBACK}
                      />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                      {article.category.name}
                    </p>
                    <h3 className="mt-1 line-clamp-2 font-serif text-base font-semibold leading-snug group-hover:underline">
                      {article.title}
                    </h3>
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
                  <Link key={article.id} href={articlePath(article.slug)} className="group block">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c41e3a]">
                      {article.category.name}
                    </p>
                    <h3 className="mt-1 line-clamp-2 font-serif text-sm font-bold leading-snug text-neutral-950 group-hover:underline">
                      {article.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTimeAgo(article.published_at)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid min-h-0 grid-cols-1 items-stretch gap-6 lg:col-span-6 lg:grid-cols-2 lg:gap-0 lg:self-stretch">
            <MiddleScroller articles={middleRail} />

            <aside className="min-h-0 lg:border-l lg:border-neutral-200 lg:pl-5">
              <RankedRail title="Most Read" articles={mostRead.slice(0, 5)} />
              <RankedRail
                title="The Big Take"
                articles={bigTakeArticles}
                className="mt-8"
                scrollable
              />
            </aside>
          </div>
        </section>

        <div className="my-8 w-full border-b border-border/60" />

        {latestArticles.length ? (
          <LatestScroller articles={latestArticles} />
        ) : null}

        {deskSections.map((desk) =>
          desk.articles.length ? (
            <div key={desk.title}>
              <div className="my-8 w-full border-b border-border/60" />
              <LatestScroller title={desk.title} articles={desk.articles} />
            </div>
          ) : null,
        )}
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
      <h2 className="border-b border-neutral-200 pb-2 font-serif text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {scrollable ? (
        <div className="h-[615px] space-y-4 overflow-y-auto pr-2">
          <ol>
            {articles.map((article, index) => (
              <li key={article.id} className="py-3">
                <Link href={articlePath(article.slug)} className="group flex gap-3">
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
      ) : (
        <ol className="divide-y divide-neutral-200">
          {articles.map((article, index) => (
            <li key={article.id} className="py-3">
              <Link href={articlePath(article.slug)} className="group flex gap-3">
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
      )}
    </div>
  );
}
