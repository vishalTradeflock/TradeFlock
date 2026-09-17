import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import MagazineCard from "@/components/MagazineCard";
import MagazineCover from "@/components/MagazineCover";
import { getMagazines } from "@/lib/magazines";
import { publicPageMetadata } from "@/lib/seo";
import type { Magazine } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

export const metadata: Metadata = publicPageMetadata({
  title: "Featured Issue",
  description:
    "The current TradeFlock USA digital exclusive and previous executive editions.",
  path: "/magazine",
  ogTitle: "Featured Issue | TradeFlock USA",
});

export const revalidate = 120;

function issueMeta(iso: string) {
  const date = new Date(iso);
  const year = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "America/New_York",
  }).format(date);
  return {
    year,
    month,
    label: formatShortDate(iso),
  };
}

function FeaturedCover({ magazine }: { magazine: Magazine }) {
  const src = magazine.cover_image_url?.trim() ?? "";
  if (!src) {
    return (
      <MagazineCover
        pdfUrl={magazine.pdf_url}
        title={magazine.title}
        publishedAt={magazine.published_at}
        coverImageUrl={magazine.cover_image_url}
        className="w-full"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={magazine.title}
      fill
      className="object-cover"
      sizes="(min-width: 1024px) 24rem, 90vw"
      priority
    />
  );
}

export default async function MagazineShowcasePage() {
  const magazines = await getMagazines();
  const featured = magazines[0];
  const previousEditions = magazines.slice(1);
  const editionCount = magazines.length;
  const featuredMeta = featured ? issueMeta(featured.published_at) : null;

  return (
    <>
      <Header activePage="magazine" />
      <main className="bg-white pb-16">
        {featured && featuredMeta ? (
          <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 py-12 lg:grid-cols-12 lg:gap-16 lg:py-16">
            <div className="flex justify-center lg:col-span-5">
              <Link
                href={`/magazine/${featured.slug}`}
                className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-md shadow-2xl transition duration-300 hover:scale-[1.02]"
              >
                <FeaturedCover magazine={featured} />
              </Link>
            </div>

            <div className="space-y-5 lg:col-span-7">
              <p className="text-xs font-bold uppercase tracking-widest text-[#c41e3a]">
                CURRENT EDITION • DIGITAL EXCLUSIVE
              </p>
              <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                {featured.title}
              </h1>
              <p className="text-xs text-neutral-500">
                <time dateTime={featured.published_at}>{featuredMeta.label}</time>
                <span className="mx-2" aria-hidden>
                  ·
                </span>
                Vol. {featuredMeta.year}
                <span className="mx-2" aria-hidden>
                  ·
                </span>
                {featuredMeta.month} Issue
              </p>
              <p className="max-w-2xl text-base leading-7 text-neutral-700">
                {featured.description ??
                  `A digital exclusive from the TradeFlock USA magazine desk — leadership, markets, and the decisions shaping ${featuredMeta.year}.`}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Link
                  href={`/magazine/${featured.slug}/read`}
                  className="inline-flex items-center gap-2 rounded-md bg-[#c41e3a] px-6 py-3 text-sm font-semibold text-white shadow hover:opacity-90"
                >
                  Read Flipbook →
                </Link>
                {featured.pdf_url ? (
                  <a
                    href={featured.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-neutral-600 hover:text-[#c41e3a] hover:underline"
                  >
                    Download PDF
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <p className="mx-auto max-w-7xl px-4 py-16 text-sm text-neutral-600">
            No editions on the desk yet.
          </p>
        )}

        {previousEditions.length ? (
          <section className="pt-4">
            <div className="mx-auto mb-6 flex max-w-7xl items-center justify-between border-b border-neutral-200 px-4 pb-4">
              <h2 className="font-serif text-2xl font-bold tracking-tight">
                Previous Editions
              </h2>
              <Link
                href="/magazine/all"
                className="flex items-center gap-1 text-sm font-semibold text-[#c41e3a] hover:opacity-80"
              >
                View All {editionCount} Editions →
              </Link>
            </div>
            <div className="magazine-reel scrollbar-thin mx-auto flex max-w-7xl items-stretch snap-x gap-5 overflow-x-auto scroll-smooth px-4 pb-6">
              {previousEditions.map((item) => (
                <MagazineCard
                  key={item.id}
                  magazine={item}
                  className="w-64 flex-none snap-start"
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
