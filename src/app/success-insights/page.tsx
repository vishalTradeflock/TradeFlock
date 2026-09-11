import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SafeArticleImage from "@/components/SafeArticleImage";
import { getArticles, getSuccessInsightsArticles } from "@/lib/articles";
import { formatPublishedAt, formatShortDate } from "@/lib/utils";

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
  const insights = await getSuccessInsightsArticles(12);
  const desk = insights.length ? insights : await getArticles("leadership", 12);
  const featured = desk[0];
  const interviews = desk.filter((article) => article.id !== featured?.id).slice(0, 3);
  const spotlightIds = new Set([featured?.id, ...interviews.map((item) => item.id)]);
  const strategies = desk
    .filter((article) => !spotlightIds.has(article.id))
    .slice(0, 6);

  return (
    <>
      <Header activePage="success-insights" tickerArticles={desk} />
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

        {interviews.length ? (
          <section className="mt-10">
            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              Leadership spotlights
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-3">
              {interviews.map((article) => (
                <Link
                  key={article.id}
                  href={`/news/${article.slug}`}
                  className="group border-t border-neutral-200 pt-4"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                    <SafeArticleImage
                      src={article.cover_image_url}
                      alt={article.cover_image_alt}
                      fill
                      sizes="(min-width: 640px) 33vw, 100vw"
                      loading="lazy"
                    />
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                    {article.category.name}
                  </p>
                  <h3 className="mt-1 font-serif text-lg font-semibold leading-snug tracking-tight group-hover:text-[#c41e3a]">
                    {article.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">
                    {article.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Growth strategies
          </h2>
          {strategies.length ? (
            <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
              {strategies.map((article) => (
                <li key={article.id} className="py-4">
                  <Link href={`/news/${article.slug}`} className="group block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      {article.category.name}
                      <span className="mx-2">·</span>
                      {formatShortDate(article.published_at)}
                    </p>
                    <h3 className="mt-1 font-serif text-xl font-semibold tracking-tight group-hover:text-[#c41e3a]">
                      {article.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-neutral-600">
                      {article.excerpt}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-neutral-700">
              This desk will carry playbooks from operators who have already
              made the hard calls — capital, talent, and the unglamorous work of
              compounding. More growth packages land here as they clear the
              edit.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
