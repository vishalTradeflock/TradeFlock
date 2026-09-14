import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FlipbookReader from "./flipbook";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";

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
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen select-none flex-col overflow-hidden bg-[#1e1e1e]">
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/magazine"
          className="shrink-0 rounded bg-black/40 px-3 py-1 text-xs tracking-wider text-neutral-400 uppercase hover:text-white"
        >
          ← Back to Desk
        </Link>
        <h1 className="min-w-0 flex-1 text-center text-sm font-medium text-neutral-300 line-clamp-1">
          {magazine.title}
        </h1>
        {magazine.pdf_url ? (
          <a
            href={magazine.pdf_url}
            className="shrink-0 text-xs text-neutral-400 hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            Download PDF
          </a>
        ) : (
          <span className="w-[5.5rem] shrink-0" aria-hidden />
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <FlipbookReader pdfUrl={magazine.pdf_url} />
      </div>
    </div>
  );
}
