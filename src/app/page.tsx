import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import { getBigTake, getHomeLayout } from "@/lib/articles";
import type { ArticleWithRelations } from "@/lib/types";
import { formatPublishedAt, formatShortDate } from "@/lib/utils";

type HomeProps = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const category = params.category;
  const { featured, secondary, mostRead, latest } = await getHomeLayout(category);
  const bigTake = await getBigTake(8);

  if (!featured) {
    return (
      <>
        <Header activeCategory={category} />
        <main className="mx-auto max-w-[1240px] px-4 py-16">
          <p className="text-sm text-neutral-600">No stories on the desk yet.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header activeCategory={category} />
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        {category ? (
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
            Section · {featured.category.name}
          </p>
        ) : null}

        <section className="grid min-h-0 grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-0">
          <article className="min-h-0 lg:col-span-6 lg:pr-6">
            <Link href={`/news/${featured.slug}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                <Image
                  src={featured.cover_image_url}
                  alt={featured.cover_image_alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-opacity group-hover:opacity-90"
                />
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
                {featured.category.name}
              </p>
              <h2 className="mt-1 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950 group-hover:text-[#c41e3a] sm:text-4xl">
                {featured.title}
              </h2>
              {featured.dek ? (
                <p className="mt-2 text-[17px] leading-7 text-neutral-700">{featured.dek}</p>
              ) : null}
              <Byline article={featured} />
            </Link>
          </article>

          <div className="grid min-h-0 grid-cols-1 items-stretch gap-6 lg:col-span-6 lg:grid-cols-2 lg:gap-0">
            <div className="group relative h-[420px] min-h-0 overflow-hidden border-neutral-200 lg:h-0 lg:min-h-full lg:self-stretch lg:border-l lg:px-5">
              <div className="absolute inset-0 overflow-hidden">
                <div className="secondary-marquee">
                  {[0, 1].flatMap((copy) =>
                    secondary.map((article) => (
                      <SecondaryCard
                        key={`${article.id}-${copy}`}
                        article={article}
                      />
                    )),
                  )}
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white to-transparent"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-white to-transparent"
                  aria-hidden
                />
              </div>
            </div>

            <aside className="min-h-0 lg:border-l lg:border-neutral-200 lg:pl-5">
              <RankedRail title="Most Read" articles={mostRead} />
              <RankedRail
                title="The Big Take"
                articles={bigTake}
                className="mt-8"
                scrollable
              />
            </aside>
          </div>
        </section>

        {latest.length ? (
          <section className="mt-8 border-t border-neutral-200 pt-6">
            <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight">The Latest</h3>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((article) => (
                <Link
                  key={article.id}
                  href={`/news/${article.slug}`}
                  className="group border-t border-neutral-200 pt-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                    {article.category.name}
                  </p>
                  <h4 className="mt-1 font-serif text-lg font-semibold leading-snug tracking-tight group-hover:text-[#c41e3a]">
                    {article.title}
                  </h4>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">
                    {article.excerpt}
                  </p>
                  <p className="mt-2 text-[11px] text-neutral-500">
                    {article.author.name}
                    <span className="mx-1.5">·</span>
                    {formatShortDate(article.published_at)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
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

function SecondaryCard({ article }: { article: ArticleWithRelations }) {
  return (
    <Link
      href={`/news/${article.slug}`}
      className="flex gap-3 border-b border-neutral-200 py-3 last:border-b-0 hover:[&_h3]:text-[#c41e3a]"
    >
      <div className="relative h-[72px] w-[96px] shrink-0 overflow-hidden bg-neutral-100">
        <Image
          src={article.cover_image_url}
          alt={article.cover_image_alt}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
          {article.category.name}
        </p>
        <h3 className="mt-0.5 font-serif text-[15px] font-semibold leading-snug tracking-tight text-neutral-950">
          {article.title}
        </h3>
        <p className="mt-1 text-[11px] text-neutral-500">
          {formatShortDate(article.published_at)}
        </p>
      </div>
    </Link>
  );
}

function Byline({ article }: { article: ArticleWithRelations }) {
  return (
    <p className="mt-3 text-xs text-neutral-500">
      By <span className="font-semibold text-neutral-800">{article.author.name}</span>
      <span className="mx-1.5">·</span>
      {formatPublishedAt(article.published_at)}
    </p>
  );
}
