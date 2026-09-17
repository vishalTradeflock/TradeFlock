import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { MagazineHonoreeCard } from "@/components/MagazineHonoreeCard";
import { MagazineIssueHero } from "@/components/MagazineIssueHero";
import { JsonLd } from "@/components/JsonLd";
import { getArticlesByMagazineId } from "@/lib/articles";
import { directoryHonoreesForIssue } from "@/lib/magazine-honorees";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";
import { magazinePageMetadata, magazineStructuredData, magazineIssueUrl } from "@/lib/seo";

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
  const image = magazine.cover_image_url
    ? { url: magazine.cover_image_url, alt: magazine.title }
    : null;

  return magazinePageMetadata({
    title: magazine.title,
    description,
    path: `/magazine/${magazine.slug}`,
    publishedTime: magazine.published_at,
    image,
  });
}

export default async function MagazineOverviewPage({
  params,
}: MagazineOverviewPageProps) {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) notFound();

  const articles = await getArticlesByMagazineId(magazine);
  const honorees = directoryHonoreesForIssue(slug, articles, magazine.title);
  const canonical = magazineIssueUrl(magazine.slug);

  return (
    <>
      <Header activePage="magazine" />
      <JsonLd data={magazineStructuredData(magazine, canonical)} />
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
          <section className="mx-auto max-w-7xl px-4 py-12">
            <h2 className="sr-only">Honorees</h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {honorees.map((honoree, index) => (
                <MagazineHonoreeCard
                  key={honoree.slug || honoree.name}
                  honoree={honoree}
                  magazine={magazine}
                  index={index}
                  priority={index < 3}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
