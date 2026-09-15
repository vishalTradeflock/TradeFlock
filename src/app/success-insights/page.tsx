import type { Metadata } from "next";
import Header from "@/components/Header";
import FeaturedInsightsSlider from "@/components/FeaturedInsightsSlider";
import GrowthStrategies from "@/components/GrowthStrategies";
import LeadershipSpotlight from "@/components/LeadershipSpotlight";
import { SUCCESS_INSIGHTS_SPOTLIGHT_COUNT } from "@/lib/cache";
import {
  getArticles,
  getSuccessInsightsArchive,
  toArticleListCard,
} from "@/lib/articles";
import type { ArticleWithRelations } from "@/lib/types";

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

function takeFeaturedInterviews(
  insights: ArticleWithRelations[],
  latest: ArticleWithRelations[],
) {
  if (insights.length >= 10) return insights.slice(0, 10);

  const merged = [...insights];
  for (const article of latest) {
    if (merged.length >= 10) break;
    if (!merged.some((row) => row.id === article.id)) merged.push(article);
  }
  return merged.slice(0, 10);
}

export default async function SuccessInsightsPage() {
  const insights = await getSuccessInsightsArchive();
  const latest = insights.length >= 10 ? [] : await getArticles(undefined, 36);
  const desk = insights.length ? insights : latest;
  const featuredList = takeFeaturedInterviews(insights, latest);
  const featuredIds = new Set(featuredList.map((article) => article.id));
  const afterFeatured = desk.filter((article) => !featuredIds.has(article.id));
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

        <FeaturedInsightsSlider
          interviews={featuredList.map((article) => ({
            ...toArticleListCard(article),
            excerpt: article.dek?.trim() || article.excerpt,
          }))}
        />

        <LeadershipSpotlight articles={interviews} />
        <GrowthStrategies articles={strategies} />
      </main>
    </>
  );
}
