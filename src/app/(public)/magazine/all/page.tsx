import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import MagazineDeskGrid from "@/components/MagazineDeskGrid";
import { getMagazines } from "@/lib/magazines";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Magazine Archive",
  description:
    "The complete TradeFlock USA archive of executive editions, special reports, and digital flipbooks.",
  path: "/magazine/all",
  ogTitle: "Magazine Archive | TradeFlock USA",
});

export const revalidate = 120;

export default async function MagazineArchivePage() {
  const magazines = await getMagazines();

  return (
    <>
      <Header activePage="magazine" />
      <main className="mx-auto max-w-[1240px] px-4 py-8">
        <header className="border-b border-neutral-200 pb-8">
          <Link
            href="/magazine"
            className="mb-2 inline-block text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← Featured Issue
          </Link>
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
