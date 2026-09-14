import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import FlipbookReader from "./flipbook";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";
import { formatPublishedAt, formatShortDate } from "@/lib/utils";

export const revalidate = 120;
export const dynamicParams = true;

type MagazinePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const magazines = await getMagazines();
  return magazines.map((magazine) => ({ slug: magazine.slug }));
}

export async function generateMetadata({
  params,
}: MagazinePageProps): Promise<Metadata> {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) {
    return { title: "Edition not found" };
  }

  return {
    title: magazine.title,
    description:
      magazine.description ??
      `Digital edition of ${magazine.title} from the TradeFlock USA magazine desk.`,
    openGraph: {
      title: magazine.title,
      description: magazine.description ?? "TradeFlock USA magazine edition.",
      type: "article",
      publishedTime: magazine.published_at,
    },
  };
}

export default async function MagazineReaderPage({ params }: MagazinePageProps) {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) notFound();

  return (
    <>
      <Header activePage="magazine" />
      <main className="mx-auto max-w-[1240px] px-4 py-6">
        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/magazine"
              className="text-xs font-semibold uppercase tracking-widest text-neutral-500 hover:text-[#c41e3a]"
            >
              ← Back to Magazines
            </Link>
            <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              {magazine.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {formatPublishedAt(magazine.published_at)}
              <span className="mx-2 text-neutral-300">|</span>
              {formatShortDate(magazine.published_at)}
            </p>
          </div>
          {magazine.pdf_url ? (
            <a
              href={magazine.pdf_url}
              className="shrink-0 rounded bg-[#c41e3a] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              target="_blank"
              rel="noreferrer"
            >
              Download PDF
            </a>
          ) : null}
        </div>

        {magazine.description ? (
          <p className="mx-auto mt-6 max-w-3xl text-[17px] leading-7 text-neutral-700">
            {magazine.description}
          </p>
        ) : null}

        <div className="mx-auto mt-8 w-full max-w-6xl">
          <FlipbookReader pdfUrl={magazine.pdf_url} />
        </div>
      </main>
    </>
  );
}
