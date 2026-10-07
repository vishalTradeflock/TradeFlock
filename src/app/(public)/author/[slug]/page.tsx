import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { getPublishedArticlesByAuthorId } from "@/lib/articles";
import { authorPath, getAuthorBySlug } from "@/lib/authors";
import {
  authorPersonStructuredData,
  publicPageMetadata,
} from "@/lib/seo";
import { articlePath } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

export const revalidate = 120;
export const dynamicParams = true;

type AuthorPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return { title: "Author not found" };
  const articles = await getPublishedArticlesByAuthorId(author.id, 1);
  if (!articles.length) return { title: "Author not found" };

  return publicPageMetadata({
    title: author.name,
    description: author.bio?.trim() || `Stories by ${author.name} for TradeFlock USA.`,
    path: authorPath(author.slug),
    ogTitle: `${author.name} | TradeFlock USA`,
    images: author.avatar_url ? [{ url: author.avatar_url, alt: author.name }] : undefined,
  });
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const articles = await getPublishedArticlesByAuthorId(author.id, 60);
  if (!articles.length) notFound();

  const photo = author.avatar_url?.trim() || "";

  return (
    <>
      <Header />
      <JsonLd data={authorPersonStructuredData(author)} />
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
            <li className="font-medium text-neutral-800">{author.name}</li>
          </ol>
        </nav>

        <header className="mt-6 flex items-start gap-5 border-b border-neutral-200 pb-8">
          {photo ? (
            <Image
              src={photo}
              alt={author.name}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover"
              unoptimized={!photo.startsWith("/")}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
              The desk
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-neutral-950">
              {author.name}
            </h1>
            {author.title ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#c41e3a]">
                {author.title}
              </p>
            ) : null}
            {author.bio ? (
              <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-700">{author.bio}</p>
            ) : null}
          </div>
        </header>

        <section className="mt-8">
          <h2 className="border-b border-neutral-200 pb-2 font-serif text-xl font-semibold tracking-tight">
            Stories
          </h2>
          <ul className="divide-y divide-neutral-200">
            {articles.map((article) => (
              <li key={article.id} className="py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                  {article.category.name}
                </p>
                <Link
                  href={articlePath(article.slug)}
                  className="mt-1 block font-serif text-xl font-semibold tracking-tight hover:text-[#c41e3a]"
                >
                  {article.title}
                </Link>
                <p className="mt-1 text-xs text-neutral-500">
                  <time dateTime={article.published_at}>{formatShortDate(article.published_at)}</time>
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
