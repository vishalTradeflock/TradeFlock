import type { Metadata } from "next";
import Link from "next/link";
import SafeArticleImage from "@/components/SafeArticleImage";
import { notFound, permanentRedirect } from "next/navigation";
import Header from "@/components/Header";
import { ArticleAuthorCard } from "@/components/ArticleAuthorCard";
import { ArticleFaqAccordion } from "@/components/ArticleFaqAccordion";
import { ArticleHeader } from "@/components/ArticleHeader";
import ArticleNewsletterModal from "@/components/ArticleNewsletterModal";
import { JsonLd } from "@/components/JsonLd";
import { RelatedArticles } from "@/components/RelatedArticles";
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
import { THUMB_96x64 } from "@/lib/image-optimization";
import { articleCoverSrc, deskCoverFallback } from "@/lib/images";
import {
  articlePageMetadata,
  articleStructuredData,
  newsArticleUrl,
  storyShareImage,
} from "@/lib/seo";
import { articlePath, sectionPath, RESERVED_ROOT_SLUGS } from "@/lib/types";

export const revalidate = 120;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs
    .filter((slug) => !RESERVED_ROOT_SLUGS.has(slug.trim().toLowerCase()))
    .slice(0, 12)
    .map((slug) => ({ slug }));
}

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

async function loadPublishedArticleOrRedirect(slug: string) {
  const requested = normalizeArticleSlug(slug);
  if (RESERVED_ROOT_SLUGS.has(requested.toLowerCase())) {
    return null;
  }
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

  const currentCategory = article.category?.name?.trim() || "Tech";
  const related = await getRelatedArticles(article, 9);
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

            <ArticleHeader
              author={article.author}
              publishedAt={article.published_at}
              shareTitle={article.title}
            />

            {coverSrc ? (
              <div className="relative my-8 aspect-[16/9] w-full overflow-hidden border border-neutral-200">
                <SafeArticleImage
                  src={coverSrc}
                  alt={article.featured_image_alt?.trim() || article.cover_image_alt || article.title}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 850px"
                  fallbackSrc={coverFallback === coverSrc ? undefined : coverFallback}
                  className="object-cover transition-transform duration-500 hover:scale-[1.01]"
                />
              </div>
            ) : null}
            {showCoverCaption ? (
              <p className="mt-2 text-[11px] text-neutral-500">
                {article.featured_image_alt?.trim() || article.cover_image_alt}
              </p>
            ) : null}

            <div
              className="prose-article prose prose-neutral mt-8 max-w-none prose-p:mb-5 prose-p:leading-relaxed prose-h2:mt-10 prose-h2:mb-3 prose-h3:mt-8 prose-h3:mb-3 prose-img:my-6 prose-img:h-auto prose-img:w-full prose-img:rounded-lg prose-img:bg-transparent prose-img:p-0 prose-a:inline prose-a:font-normal [&_a]:inline [&_a]:font-normal [&_a]:underline [&_a]:text-[#c41e3a] hover:[&_a]:text-[#9f1830]"
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
              {related.slice(0, 5).map((item) => (
                <li key={item.id} className="py-4">
                  <Link href={articlePath(item.slug)} className="group flex gap-3">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden bg-neutral-100">
                      <SafeArticleImage
                        src={articleCoverSrc(item)}
                        alt={item.cover_image_alt}
                        width={THUMB_96x64.width}
                        height={THUMB_96x64.height}
                        loading="lazy"
                        fallbackSrc={deskCoverFallback(item)}
                        className="h-full w-full"
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
        <RelatedArticles categoryName={currentCategory} articles={related} />
      </main>
      <ArticleNewsletterModal key={article.slug} articleSlug={article.slug} />
    </>
  );
}
