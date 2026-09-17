import Link from "next/link";
import Header from "@/components/Header";
import SafeArticleImage from "@/components/SafeArticleImage";
import { getCategoryDesk } from "@/lib/articles";
import { HOME_ARTICLE_LIMIT } from "@/lib/cache";
import { articlePath } from "@/lib/types";
import { formatPublishedAt, formatShortDate } from "@/lib/utils";

type CategoryFeedProps = {
  categoryTitle: string;
  categoryDescription: string;
  categorySlug: string;
};

export default async function CategoryFeed({
  categoryTitle,
  categoryDescription,
  categorySlug,
}: CategoryFeedProps) {
  const slug = categorySlug.trim().toLowerCase().replace(/\s+/g, "-");
  const articles = await getCategoryDesk(categorySlug, HOME_ARTICLE_LIMIT);
  const featured = articles[0];
  const rest = articles.slice(1);
  const activeSlug = featured?.category.slug ?? slug;

  return (
    <>
      <Header activeCategory={activeSlug} tickerArticles={articles.slice(0, 12)} />
      <main className="mx-auto max-w-[1240px] px-4 py-8">
        <nav aria-label="Breadcrumb" className="text-xs text-neutral-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-[#c41e3a]">
                Home
              </Link>
            </li>
            <li aria-hidden className="text-neutral-300">
              &gt;
            </li>
            <li className="font-medium text-neutral-800">{categoryTitle}</li>
          </ol>
        </nav>

        <header className="mt-6 max-w-3xl border-b border-neutral-200 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
            TRADEFLOCK USA DESK
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {categoryTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            {categoryDescription}
          </p>
        </header>

        {featured ? (
          <>
            <section className="mt-8 grid grid-cols-1 items-center gap-8 border-b border-neutral-200 pb-10 lg:grid-cols-12">
              <Link
                href={articlePath(featured.slug)}
                className="group relative block aspect-[16/9] overflow-hidden bg-neutral-100 lg:col-span-7"
              >
                <SafeArticleImage
                  src={featured.cover_image_url}
                  alt={featured.cover_image_alt || featured.title}
                  fill
                  priority
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </Link>
              <div className="lg:col-span-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
                  {featured.category.name}
                </p>
                <h2 className="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight">
                  <Link
                    href={articlePath(featured.slug)}
                    className="transition hover:text-[#c41e3a]"
                  >
                    {featured.title}
                  </Link>
                </h2>
                <p className="mt-3 text-[17px] leading-7 text-neutral-700 line-clamp-4">
                  {featured.dek?.trim() || featured.excerpt}
                </p>
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

            {rest.length ? (
              <section className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <article key={article.id}>
                    <Link href={articlePath(article.slug)} className="group block">
                      <div className="relative aspect-[16/9] overflow-hidden bg-neutral-100">
                        <SafeArticleImage
                          src={article.cover_image_url}
                          alt={article.cover_image_alt || article.title}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                          loading="lazy"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <h3 className="mt-3 font-serif text-lg font-bold leading-snug tracking-tight transition group-hover:text-[#c41e3a]">
                        {article.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {article.excerpt}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {article.author.name}
                        <span className="mx-1.5">·</span>
                        {formatShortDate(article.published_at)}
                      </p>
                    </Link>
                  </article>
                ))}
              </section>
            ) : null}
          </>
        ) : (
          <p className="mt-10 text-sm text-neutral-600">
            No articles found in this category yet.{" "}
            <Link href="/" className="font-semibold text-[#c41e3a] hover:underline">
              Back to Home
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
