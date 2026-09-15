import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";

export const revalidate = 120;
export const dynamicParams = true;

type MagazineReadPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const magazines = await getMagazines();
  return magazines.map((magazine) => ({ slug: magazine.slug }));
}

export async function generateMetadata({
  params,
}: MagazineReadPageProps): Promise<Metadata> {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) {
    return { title: "Edition not found" };
  }

  return {
    title: `Read ${magazine.title}`,
    description:
      magazine.description ??
      `Digital flipbook of ${magazine.title} from the TradeFlock USA magazine desk.`,
    openGraph: {
      title: magazine.title,
      description: magazine.description ?? "TradeFlock USA magazine edition.",
      type: "article",
      publishedTime: magazine.published_at,
    },
  };
}

export default async function MagazineReadPage({ params }: MagazineReadPageProps) {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) notFound();

  const viewerSrc = magazine.pdf_url
    ? `/dflip/viewer.html?pdf=${encodeURIComponent(magazine.pdf_url)}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen select-none flex-col overflow-hidden bg-[#141414]">
      <header className="z-20 flex h-11 w-full items-center justify-between border-b border-neutral-800 bg-[#1c1c1c] px-4">
        <Link
          href={`/magazine/${magazine.slug}`}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 transition hover:text-white"
        >
          ← Back to Overview
        </Link>
        <span className="hidden max-w-md truncate text-xs font-medium text-neutral-300 sm:block">
          {magazine.title}
        </span>
        {magazine.pdf_url ? (
          <a
            href={magazine.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs tracking-wider text-neutral-400 transition hover:text-white"
          >
            Download PDF
          </a>
        ) : (
          <span className="w-[5.5rem]" aria-hidden />
        )}
      </header>

      <main className="h-[calc(100dvh-44px)] w-full flex-1 bg-[#1a1a1a]">
        {viewerSrc ? (
          <iframe
            src={viewerSrc}
            title={magazine.title}
            className="block h-full w-full border-0"
            allow="fullscreen"
          />
        ) : (
          <p className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-neutral-400">
            PDF unavailable
          </p>
        )}
      </main>
    </div>
  );
}
