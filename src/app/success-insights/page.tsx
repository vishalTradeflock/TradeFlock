import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import GrowthStrategies from "@/components/GrowthStrategies";
import LeadershipSpotlight from "@/components/LeadershipSpotlight";
import SafeArticleImage from "@/components/SafeArticleImage";
import { SUCCESS_INSIGHTS_SPOTLIGHT_COUNT } from "@/lib/cache";
import {
  getArticles,
  getSuccessInsightsArchive,
  toArticleListCard,
} from "@/lib/articles";
import { formatPublishedAt } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Success Insights",
  description:
    "Executive interviews, growth strategies, and leadership spotlights from the TradeFlock USA desk.",
  openGraph: {
    title: "Success Insights | TradeFlock USA",
    description:
      "How American operators grow companies — interviews, strategy, and leadership reporting.",
    type: "website",
  },
};

export const revalidate = 120;

export default async function SuccessInsightsPage() {
  const insights = await getSuccessInsightsArchive();
  const desk = insights.length ? insights : await getArticles("leadership", 36);
  const featured = desk[0];
  const afterFeatured = featured
    ? desk.filter((article) => article.id !== featured.id)
    : desk;
  const interviews = afterFeatured
    .slice(0, SUCCESS_INSIGHTS_SPOTLIGHT_COUNT)
    .map(toArticleListCard);
  const spotlightIds = new Set(interviews.map((item) => item.id));
  const strategies = afterFeatured
    .filter((article) => !spotlightIds.has(article.id))
    .map(toArticleListCard);

  return (
    <>
      <Header activePage="success-insights" tickerArticles={desk.slice(0, 12)} />
      <main className="mx-auto max-w-[1240px] px-4 py-8">
        <section className="max-w-3xl border-b border-neutral-200 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
            Success insights
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
            How operators grow — and what they learned doing it
          </h1>
          <p className="mt-4 text-xl leading-8 text-neutral-700">
            Executive interviews, growth strategy, and leadership spotlights
            from the TradeFlock USA desk. Built for people who run companies,
            not for the press release.
          </p>
        </section>

        {featured ? (
          <section className="mt-8 grid grid-cols-1 gap-8 border-b border-neutral-200 pb-10 lg:grid-cols-12 lg:gap-0">
            <Link
              href={`/news/${featured.slug}`}
              className="group lg:col-span-7 lg:pr-10"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                <SafeArticleImage
                  src={featured.cover_image_url}
                  alt={featured.cover_image_alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="object-cover transition-opacity group-hover:opacity-90"
                />
              </div>
            </Link>
            <div className="lg:col-span-5 lg:border-l lg:border-neutral-200 lg:pl-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
                Featured interview
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight">
                <Link
                  href={`/news/${featured.slug}`}
                  className="hover:text-[#c41e3a]"
                >
                  {featured.title}
                </Link>
              </h2>
              {featured.dek ? (
                <p className="mt-3 text-[17px] leading-7 text-neutral-700">
                  {featured.dek}
                </p>
              ) : (
                <p className="mt-3 text-[17px] leading-7 text-neutral-700">
                  {featured.excerpt}
                </p>
              )}
              <p className="mt-4 text-xs text-neutral-500">
                By{" "}
                <span className="font-semibold text-neutral-800">
                  {featured.author.name}
                </span>
                <span className="mx-1.5">·</span>
                {formatPublishedAt(featured.published_at)}
              </p>
            </div>
          </section>
        ) : null}

        <LeadershipSpotlight articles={interviews} />
        <GrowthStrategies articles={strategies} />
      </main>
    </>
  );
}
