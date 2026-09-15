import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import MagazineCover from "@/components/MagazineCover";
import { getMagazineBySlug, getMagazines } from "@/lib/magazines";
import type { Magazine } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

export const revalidate = 120;
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
      ...(magazine.cover_image_url
        ? { images: [{ url: magazine.cover_image_url, alt: magazine.title }] }
        : {}),
    },
  };
}

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

function IssueCover({ magazine }: { magazine: Magazine }) {
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
      sizes="(min-width: 768px) 40vw, 90vw"
      priority
    />
  );
}

function editionSynopsis(magazine: Magazine, year: string) {
  const fromDesk = magazine.description?.trim();
  if (fromDesk) return fromDesk;
  return `This TradeFlock USA executive edition, “${magazine.title},” gathers leadership interviews, operational lessons, and market reports for decision-makers. Inside are candid conversations and a closer look at the executives and operators shaping ${year}.`;
}

const HIGHLIGHTS = [
  "Executive spotlights from operators whose decisions are reshaping their industries.",
  "Industry benchmarks and market reports for boards and C-suites.",
  "In-depth profiles and leadership interviews from the magazine desk.",
  "A digital interactive edition — read it as a flipbook or download the PDF.",
];

export default async function MagazineOverviewPage({
  params,
}: MagazineOverviewPageProps) {
  const { slug } = await params;
  const magazine = await getMagazineBySlug(slug);
  if (!magazine) notFound();

  const meta = issueMeta(magazine.published_at);

  return (
    <>
      <Header activePage="magazine" />
      <main className="bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 py-12 md:grid-cols-12">
          <nav
            aria-label="Breadcrumb"
            className="text-xs text-neutral-500 md:col-span-12"
          >
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-[#c41e3a]">
                  Home
                </Link>
              </li>
              <li aria-hidden className="text-neutral-300">
                &gt;
              </li>
              <li>
                <Link href="/magazine" className="hover:text-[#c41e3a]">
                  Magazine
                </Link>
              </li>
              <li aria-hidden className="text-neutral-300">
                &gt;
              </li>
              <li className="font-medium text-neutral-800">{magazine.title}</li>
            </ol>
          </nav>

          <div className="md:col-span-5">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md shadow-2xl">
              <span
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-3 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
                aria-hidden
              />
              <IssueCover magazine={magazine} />
            </div>
            <Link
              href={`/magazine/${magazine.slug}/read`}
              className="mt-4 block w-full rounded bg-[#c41e3a] px-4 py-3 text-center text-sm font-semibold text-white shadow transition hover:opacity-90"
            >
              Read Digital Flipbook ↗
            </Link>
            {magazine.pdf_url ? (
              <a
                href={magazine.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block w-full rounded border border-neutral-300 px-4 py-2.5 text-center text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                Download PDF File
              </a>
            ) : null}
          </div>

          <div className="space-y-6 md:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#c41e3a]">
              TRADEFLOCK EXECUTIVE EDITION
            </p>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {magazine.title}
            </h1>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-neutral-400">
                  Published
                </dt>
                <dd className="mt-1">
                  <time dateTime={magazine.published_at}>{meta.label}</time>
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-widest text-neutral-400">
                  Volume / Issue
                </dt>
                <dd className="mt-1">
                  Vol. {meta.year} · {meta.month} Issue
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-widest text-neutral-400">
                  Format
                </dt>
                <dd className="mt-1">Digital Interactive Edition</dd>
              </div>
            </dl>
            <hr className="border-neutral-200" />
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Editorial Overview
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-700">
                {editionSynopsis(magazine, meta.year)}
              </p>
            </section>
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Inside This Edition
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-700">
                {HIGHLIGHTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
