import type { Metadata } from "next";
import Link from "next/link";
import SafeArticleImage from "@/components/SafeArticleImage";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getArticleBySlug, getRelatedArticles, normalizeArticleSlug } from "@/lib/articles";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";
import { formatPublishedAt } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const cleanSlug = normalizeArticleSlug(slug);
  const article = await getArticleBySlug(cleanSlug);
  if (!article) {
    return { title: "Story not found" };
  }

  return {
    title: article.title,
    description: article.excerpt,
    authors: [{ name: article.author.name }],
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.published_at,
      authors: [article.author.name],
      images: [
        {
          url: article.cover_image_url,
          alt: article.cover_image_alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [article.cover_image_url],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const cleanSlug = normalizeArticleSlug(slug);
  const article = await getArticleBySlug(cleanSlug);
  if (!article) notFound();

  const related = await getRelatedArticles(article);
  const body = sanitizeArticleBody(article.body, {
    title: article.title,
    coverImageUrl: article.cover_image_url,
  });
  const showCoverCaption =
    Boolean(article.cover_image_alt) &&
    article.cover_image_alt.trim().toLowerCase() !== article.title.trim().toLowerCase();

  return (
    <>
      <Header activeCategory={article.category.slug} />
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-0">
          <article className="lg:col-span-8 lg:pr-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
              <Link href={`/?category=${article.category.slug}`} className="hover:underline">
                {article.category.name}
              </Link>
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              {article.title}
            </h1>
            {article.dek ? (
              <p className="mt-4 text-xl leading-8 text-neutral-700">{article.dek}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-neutral-200 py-3 text-sm">
              <div>
                <p className="font-semibold text-neutral-950">{article.author.name}</p>
                {article.author.title ? (
                  <p className="text-xs text-neutral-500">{article.author.title}</p>
                ) : null}
              </div>
              <span className="hidden h-8 w-px bg-neutral-200 sm:block" />
              <time dateTime={article.published_at} className="text-xs text-neutral-500">
                {formatPublishedAt(article.published_at)}
              </time>
            </div>

            <div className="relative mt-5 flex min-h-[200px] items-center justify-center overflow-hidden bg-neutral-100">
              <SafeArticleImage
                src={article.cover_image_url}
                alt={article.cover_image_alt}
                width={1600}
                height={900}
                priority
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="mx-auto h-auto max-h-[500px] w-auto object-contain object-top"
              />
            </div>
            {showCoverCaption ? (
              <p className="mt-2 text-[11px] text-neutral-500">{article.cover_image_alt}</p>
            ) : null}

            <div
              className="prose-article prose prose-neutral mt-8 max-w-none prose-p:mb-5 prose-p:leading-relaxed prose-h3:mt-8 prose-h3:mb-3"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </article>

          <aside className="lg:col-span-4 lg:border-l lg:border-neutral-200 lg:pl-8">
            <h2 className="border-b border-neutral-200 pb-2 font-serif text-xl font-semibold tracking-tight">
              Related
            </h2>
            <ul className="divide-y divide-neutral-200">
              {related.map((item) => (
                <li key={item.id} className="py-4">
                  <Link href={`/news/${item.slug}`} className="group flex gap-3">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden bg-neutral-100">
                      <SafeArticleImage
                        src={item.cover_image_url}
                        alt={item.cover_image_alt}
                        fill
                        sizes="96px"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                        {item.category.name}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold leading-5 text-neutral-950 group-hover:text-[#c41e3a]">
                        {item.title}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
    </>
  );
}
