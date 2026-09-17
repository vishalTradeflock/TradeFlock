import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { IssueShareButton } from "@/components/IssueShareButton";
import { MagazineFlipbookFrame } from "@/components/MagazineFlipbookFrame";
import { magazineExternalHref, parseFlipbookPage } from "@/lib/magazine-links";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";
import { magazineIssueUrl } from "@/lib/seo";

export const revalidate = 120;
export const dynamicParams = true;

type MagazineReadPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
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

  const description =
    magazine.description ??
    `Digital flipbook of ${magazine.title} from the TradeFlock USA magazine desk.`;
  const url = `${magazineIssueUrl(magazine.slug)}/read`;
  const image = magazine.cover_image_url
    ? { url: magazine.cover_image_url, alt: magazine.title }
    : undefined;

  return {
    title: `Read ${magazine.title}`,
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

export default async function MagazineReadPage({
  params,
  searchParams,
}: MagazineReadPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) notFound();

  const page = parseFlipbookPage(query.page);
  const externalHref = magazineExternalHref(magazine);

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden bg-neutral-950">
      <header className="flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 text-white">
        <Link
          href={`/magazine/${magazine.slug}`}
          className="text-xs font-semibold uppercase tracking-wider text-neutral-300 transition hover:text-white"
        >
          ← Back to Issue
        </Link>
        <p className="hidden max-w-xl truncate font-serif text-sm text-white sm:block">
          {magazine.title}
        </p>
        <div className="flex items-center gap-4">
          <IssueShareButton
            title={magazine.title}
            className="h-auto border-0 bg-transparent px-0 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:text-white"
          />
          {externalHref ? (
            <a
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open edition in a new tab"
              className="text-neutral-300 transition hover:text-white"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            </a>
          ) : null}
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)] w-full items-center justify-center bg-neutral-900">
        <MagazineFlipbookFrame magazine={magazine} queryPage={page} />
      </div>
    </div>
  );
}
