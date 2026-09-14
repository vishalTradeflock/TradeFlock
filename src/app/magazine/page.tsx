import type { Metadata } from "next";
import Header from "@/components/Header";
import MagazineDeskGrid from "@/components/MagazineDeskGrid";
import { getMagazines } from "@/lib/magazines";

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
          <MagazineDeskGrid magazines={magazines} />
        ) : (
          <p className="mt-10 text-sm text-neutral-600">
            No editions on the desk yet.
          </p>
        )}
      </main>
    </>
  );
}
