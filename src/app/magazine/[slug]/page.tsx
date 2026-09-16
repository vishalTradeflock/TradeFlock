import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { MagazineCoverStory } from "@/components/MagazineCoverStory";
import { MagazineHonoreeCard } from "@/components/MagazineHonoreeCard";
import { getArticlesByMagazineId } from "@/lib/articles";
import {
  HEALTHCARE_2026_HONOREES,
  HEALTHCARE_EDITION_SLUG,
} from "@/lib/data/seed-honorees";
import { resolveIssueHonorees } from "@/lib/magazine-honorees";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";

export const revalidate = 3600;
export const dynamicParams = true;

type MagazineOverviewPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const magazines = await getMagazines();
  return magazines.map((magazine) => ({ slug: magazine.slug }));
}

export async function generateMetadata({
  params,
}: MagazineOverviewPageProps): Promise<Metadata> {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) {
    return { title: "Edition not found" };
  }

  const description =
    magazine.description ??
    `Digital edition of ${magazine.title} from the TradeFlock USA magazine desk.`;
  const image = magazine.cover_image_url
    ? { url: magazine.cover_image_url, alt: magazine.title }
    : undefined;

  return {
    title: magazine.title,
    description,
    openGraph: {
      title: magazine.title,
      description,
      type: "article",
      url: `/magazine/${magazine.slug}`,
      publishedTime: magazine.published_at,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: magazine.title,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

export default async function MagazineOverviewPage({
  params,
}: MagazineOverviewPageProps) {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) notFound();

  const articles = await getArticlesByMagazineId(magazine);
  const source =
    articles.length < 10 && magazine.slug === HEALTHCARE_EDITION_SLUG
      ? { ...magazine, honorees: HEALTHCARE_2026_HONOREES }
      : magazine;
  const honorees = resolveIssueHonorees(source, articles);
  const [coverStory, ...directory] = honorees;

  return (
    <>
      <Header activePage="magazine" />
      <main className="bg-[#faf9f7]">
        {coverStory ? (
          <MagazineCoverStory honoree={coverStory} magazine={magazine} />
        ) : (
          <section className="mx-auto max-w-7xl px-4 py-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Special Edition
            </p>
            <h1 className="mt-3 font-serif text-3xl tracking-tight text-neutral-900 lg:text-4xl">
              {magazine.title}
            </h1>
            <p className="mt-6 text-sm leading-6 text-neutral-600">
              Honoree profiles for this edition will appear here as stories are assigned to the
              issue.
            </p>
          </section>
        )}

        {directory.length ? (
          <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-2 lg:grid-cols-3">
            {directory.map((honoree, index) => (
              <MagazineHonoreeCard
                key={`${honoree.name}-${index}`}
                honoree={honoree}
                magazine={magazine}
                index={index + 1}
                priority={index < 2}
              />
            ))}
          </section>
        ) : null}
      </main>
    </>
  );
}
