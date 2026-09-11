import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "TradeFlock Magazine",
  description:
    "The print and digital magazine of TradeFlock USA — featured editions, cover stories, and issues on U.S. business and leadership.",
  openGraph: {
    title: "TradeFlock Magazine | TradeFlock USA",
    description:
      "Featured editions, cover stories, and digital issues from TradeFlock USA.",
    type: "website",
  },
};

export const revalidate = 120;

const FEATURED = {
  volume: "Vol. 12 No. 9",
  season: "September 2026",
  kicker: "Cover story",
  title: "The operators rewriting American capital",
  dek: "Private credit, on-device AI, and a slower Fed — the autumn issue of TradeFlock Magazine maps the decisions that will set the next four quarters.",
};

const EDITIONS = [
  {
    volume: "Vol. 12 No. 8",
    season: "August 2026",
    title: "Leadership after the rate peak",
    kicker: "Cover",
  },
  {
    volume: "Vol. 12 No. 7",
    season: "July 2026",
    title: "Chips, power, and the new industrial map",
    kicker: "Cover",
  },
  {
    volume: "Vol. 12 No. 6",
    season: "June 2026",
    title: "Who still owns the American boardroom",
    kicker: "Cover",
  },
];

const DIGITAL_ISSUES = [
  {
    label: "September 2026 · Digital",
    title: "Full issue PDF — markets, tech, and the C-suite brief",
  },
  {
    label: "August 2026 · Digital",
    title: "Leadership package: appointments, activism, and succession",
  },
  {
    label: "July 2026 · Digital",
    title: "Special report: AI capex and the supplier chain",
  },
  {
    label: "Archive",
    title: "Earlier volumes of TradeFlock Magazine",
  },
];

export default function MagazinePage() {
  return (
    <>
      <Header activePage="magazine" />
      <main className="mx-auto max-w-[1240px] px-4 py-8">
        <section className="max-w-3xl border-b border-neutral-200 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
            The magazine
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
            TradeFlock Magazine
          </h1>
          <p className="mt-4 text-xl leading-8 text-neutral-700">
            The monthly print and digital edition of the desk — cover stories,
            leadership interviews, and the issues that do not fit a news cycle.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-8 border-b border-neutral-200 pb-10 lg:grid-cols-12 lg:gap-0">
          <article className="lg:col-span-7 lg:pr-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
              Featured edition
            </p>
            <div className="mt-3 flex aspect-[3/4] max-w-sm flex-col justify-end border border-neutral-200 bg-white p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {FEATURED.volume}
                <span className="mx-2 text-neutral-300">|</span>
                {FEATURED.season}
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950">
                {FEATURED.title}
              </h2>
            </div>
          </article>

          <div className="lg:col-span-5 lg:border-l lg:border-neutral-200 lg:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              {FEATURED.kicker}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug tracking-tight">
              {FEATURED.title}
            </h2>
            <p className="mt-3 text-[17px] leading-7 text-neutral-700">
              {FEATURED.dek}
            </p>
            <p className="mt-6 text-sm leading-6 text-neutral-600">
              Digital and print editions of this issue will appear here. This
              page is a placeholder for the magazine shelf.
            </p>
            <Link
              href="/contact"
              className="mt-4 inline-block text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a] hover:underline"
            >
              Inquire about the issue
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Recent covers
          </h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {EDITIONS.map((edition) => (
              <article
                key={edition.volume}
                className="border-t border-neutral-200 pt-4"
              >
                <div className="flex aspect-[3/4] flex-col justify-end border border-neutral-200 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    {edition.volume}
                  </p>
                  <h3 className="mt-2 font-serif text-lg font-semibold leading-snug tracking-tight">
                    {edition.title}
                  </h3>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                  {edition.kicker}
                </p>
                <p className="mt-1 text-sm text-neutral-600">{edition.season}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 border-t border-neutral-200 pt-8">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Digital issues
          </h2>
          <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
            {DIGITAL_ISSUES.map((issue) => (
              <li key={issue.label} className="py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  {issue.label}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold tracking-tight text-neutral-950">
                  {issue.title}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
