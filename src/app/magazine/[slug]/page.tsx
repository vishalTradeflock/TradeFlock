import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { MagazineHonoreeCard } from "@/components/MagazineHonoreeCard";
import { MagazineIssueHero } from "@/components/MagazineIssueHero";
import { getArticlesByMagazineId } from "@/lib/articles";
import { directoryHonoreesForIssue } from "@/lib/magazine-honorees";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";
import { magazineIssueUrl } from "@/lib/seo";

export const revalidate = 60;
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
  const url = magazineIssueUrl(magazine.slug);
  const image = magazine.cover_image_url
    ? { url: magazine.cover_image_url, alt: magazine.title }
    : undefined;

  return {
    title: magazine.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: magazine.title,
      description,
      type: "article",
      url,
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
  const honorees = directoryHonoreesForIssue(slug, articles, magazine.title);

  return (
    <>
      <Header activePage="magazine" />
      <main className="bg-[#faf9f7]">
        <MagazineIssueHero
          magazine={magazine}
          ctaLabel={
            honorees.length
              ? "Access digital flipbook"
              : "Read full edition in flipbook"
          }
        />

        {honorees.length ? (
          <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 md:grid-cols-2 lg:grid-cols-3">
            {honorees.map((honoree, index) => (
              <MagazineHonoreeCard
                key={honoree.slug || honoree.name}
                honoree={honoree}
                magazine={magazine}
                index={index}
                priority={index < 3}
              />
            ))}
          </section>
        ) : null}
      </main>
    </>
  );
}
