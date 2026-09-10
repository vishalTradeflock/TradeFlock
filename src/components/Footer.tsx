import Link from "next/link";
import { NAV_CATEGORIES } from "@/lib/types";

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-serif text-2xl font-semibold tracking-tight">
            TradeFlock
            <span className="ml-1 font-sans text-[10px] font-bold tracking-[0.2em] text-[#c41e3a]">
              USA
            </span>
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-600">
            An independent business desk covering markets, technology, finance,
            and the people who run American companies.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
          {NAV_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/?category=${category.slug}`}
              className="hover:text-[#c41e3a]"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-neutral-200">
        <p className="mx-auto max-w-[1240px] px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          © {new Date().getFullYear()} TradeFlock USA. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
