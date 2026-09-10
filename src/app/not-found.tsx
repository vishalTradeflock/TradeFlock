import Link from "next/link";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1240px] px-4 py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
          Desk
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">
          Story not found
        </h1>
        <p className="mt-3 max-w-lg text-neutral-600">
          That headline is no longer on the wire. Return to the homepage for the
          latest from the business desk.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-semibold uppercase tracking-[0.14em] text-[#c41e3a] hover:underline"
        >
          Back to TradeFlock USA
        </Link>
      </main>
    </>
  );
}
