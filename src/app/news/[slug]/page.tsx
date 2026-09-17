import type { Metadata } from "next";
import Link from "next/link";
import SafeArticleImage from "@/components/SafeArticleImage";
import { notFound, permanentRedirect } from "next/navigation";
import Header from "@/components/Header";
import { ArticleAuthorCard } from "@/components/ArticleAuthorCard";
import { ArticleFaqAccordion } from "@/components/ArticleFaqAccordion";
import { JsonLd } from "@/components/JsonLd";
import {
  resolvePublishedArticleRequest,
} from "@/lib/article-slug-request";
import {
  getArticleBySlug,
  getArticleSlugs,
  getRelatedArticles,
  normalizeArticleSlug,
  resolvePublishedSlugRedirect,
} from "@/lib/articles";
import { sanitizeArticleBody } from "@/lib/sanitize-article-body";
import { articleCoverSrc, deskCoverFallback } from "@/lib/images";
import {
  articlePageMetadata,
  articleStructuredData,
  newsArticleUrl,
  storyShareImage,
} from "@/lib/seo";
import { articlePath, sectionPath } from "@/lib/types";
import { formatPublishedAt } from "@/lib/utils";

export const revalidate = 120;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.slice(0, 12).map((slug) => ({ slug }));
}

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

async function loadPublishedArticleOrRedirect(slug: string) {
  const requested = normalizeArticleSlug(slug);
  const redirectToSlug = await resolvePublishedSlugRedirect(requested);
  const redirected = resolvePublishedArticleRequest({
    requestedSlug: requested,
    redirectToSlug,
    articleFound: false,
  });
  if (redirected.kind === "redirect") {
    permanentRedirect(redirected.location);
  }
  return getArticleBySlug(requested);
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadPublishedArticleOrRedirect(slug);
  if (!article) {
    return { title: "Story not found" };
  }

  return articlePageMetadata(article);
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await loadPublishedArticleOrRedirect(slug);
  if (!article) {
    notFound();
  }

  const related = await getRelatedArticles(article);
  const coverSrc = articleCoverSrc(article);
  const coverFallback = deskCoverFallback(article);
  const body = sanitizeArticleBody(article.body, {
    title: article.title,
    coverImageUrl: article.cover_image_url,
  });
  const showCoverCaption = Boolean(
    (article.featured_image_alt?.trim() || article.cover_image_alt?.trim()) &&
      (article.featured_image_alt?.trim() || article.cover_image_alt).trim().toLowerCase() !==
        article.title.trim().toLowerCase(),
  );
  const canonical = newsArticleUrl(article.slug);
  const image = storyShareImage(article);

  return (
    <>
      <Header activeCategory={article.category.slug} />
      <JsonLd data={articleStructuredData(article, canonical, image)} />
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-0">
          <article className="lg:col-span-8 lg:pr-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
              <Link href={sectionPath(article.category.slug)} className="hover:underline">
                {article.category.name}
              </Link>
            </span>
            <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              {article.title}
            </h1>
            {article.dek ? (
              <p className="mt-4 text-xl leading-8 text-neutral-700">{article.dek}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-neutral-200 py-3 text-sm">
              <div>
                <span className="font-semibold text-neutral-950">
                  {article.author?.slug ? (
                    <Link href={`/author/${article.author.slug}`} className="hover:text-[#c41e3a]">
                      {article.author?.name?.trim() || "TradeFlock Editorial Desk"}
                    </Link>
                  ) : (
                    article.author?.name?.trim() || "TradeFlock Editorial Desk"
                  )}
                </span>
                {article.author?.title ? (
                  <span className="mt-0.5 block text-xs text-neutral-500">{article.author.title}</span>
                ) : null}
              </div>
              <span className="hidden h-8 w-px bg-neutral-200 sm:block" />
              <time dateTime={article.published_at} className="text-xs text-neutral-500">
                {formatPublishedAt(article.published_at)}
              </time>
            </div>

            <div className="relative mt-5 flex min-h-[200px] items-center justify-center overflow-hidden bg-neutral-100">
              <SafeArticleImage
                src={coverSrc}
                alt={article.featured_image_alt?.trim() || article.cover_image_alt}
                width={1600}
                height={900}
                priority
                sizes="(min-width: 1024px) 66vw, 100vw"
                fallbackSrc={coverFallback === coverSrc ? undefined : coverFallback}
                className="mx-auto h-auto max-h-[500px] w-auto object-contain object-top"
              />
            </div>
            {showCoverCaption ? (
              <p className="mt-2 text-[11px] text-neutral-500">
                {article.featured_image_alt?.trim() || article.cover_image_alt}
              </p>
            ) : null}

            <div
              className="prose-article prose prose-neutral mt-8 max-w-none prose-p:mb-5 prose-p:leading-relaxed prose-h2:mt-10 prose-h2:mb-3 prose-h3:mt-8 prose-h3:mb-3 prose-a:inline prose-a:font-normal [&_a]:inline [&_a]:font-normal [&_a]:underline [&_a]:text-[#c41e3a] hover:[&_a]:text-[#9f1830]"
              dangerouslySetInnerHTML={{ __html: body }}
            />

            <ArticleAuthorCard author={article.author} />
            <ArticleFaqAccordion faqs={article.faqs ?? []} />
          </article>

          <aside className="lg:col-span-4 lg:border-l lg:border-neutral-200 lg:pl-8">
            <h2 className="border-b border-neutral-200 pb-2 font-serif text-xl font-semibold tracking-tight">
              Related
            </h2>
            <ul className="divide-y divide-neutral-200">
              {related.map((item) => (
                <li key={item.id} className="py-4">
                  <Link href={articlePath(item.slug)} className="group flex gap-3">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden bg-neutral-100">
                      <SafeArticleImage
                        src={articleCoverSrc(item)}
                        alt={item.cover_image_alt}
                        fill
                        sizes="96px"
                        loading="lazy"
                        fallbackSrc={deskCoverFallback(item)}
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
