import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import MagazineCover from "@/components/MagazineCover";
import { getMagazines } from "@/lib/magazines";
import { formatShortDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "The Magazine Desk",
  description:
    "Browse TradeFlock USA executive editions, special reports, and digital flipbooks.",
  openGraph: {
    title: "The Magazine Desk | TradeFlock USA",
    description:
      "Executive editions, special reports, and digital flipbooks from TradeFlock USA.",
    type: "website",
  },
};

export const revalidate = 120;

export default async function MagazineCatalogPage() {
  const magazines = await getMagazines();

  return (
    <>
      <Header activePage="magazine" />
      <main className="mx-auto max-w-[1240px] px-4 py-8">
        <header className="border-b border-neutral-200 pb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#c41e3a]">
            TRADEFLOCK ARCHIVE
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight text-foreground">
            The Magazine Desk
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-7 text-neutral-700">
            Browse executive editions, special reports, and digital flipbooks.
          </p>
        </header>

        {magazines.length ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {magazines.map((magazine) => (
              <article key={magazine.id} className="min-w-0">
                <Link href={`/magazine/${magazine.slug}`} className="block">
                  <MagazineCover pdfUrl={magazine.pdf_url} title={magazine.title} />
                </Link>
                <h2 className="mt-3 font-serif text-lg font-semibold leading-snug tracking-tight">
                  <Link
                    href={`/magazine/${magazine.slug}`}
                    className="hover:text-[#c41e3a]"
                  >
                    {magazine.title}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatShortDate(magazine.published_at)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/magazine/${magazine.slug}`}
                    className="rounded bg-[#c41e3a] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Read Flipbook
                  </Link>
                  {magazine.pdf_url ? (
                    <a
                      href={magazine.pdf_url}
                      className="text-xs text-muted-foreground hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download PDF
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-sm text-neutral-600">
            No editions on the desk yet.
          </p>
        )}
      </main>
    </>
  );
}
