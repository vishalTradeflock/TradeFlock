import Link from "next/link";
import type { ReactNode } from "react";
import { NAV_CATEGORIES } from "@/lib/types";
import { getBreakingArticles } from "@/lib/articles";
import { cn, formatDateline } from "@/lib/utils";
import { Search } from "lucide-react";

type HeaderProps = {
  activeCategory?: string;
};

export default async function Header({ activeCategory }: HeaderProps) {
  const breaking = await getBreakingArticles();
  const dateline = formatDateline();
  const tickerItems = [...breaking, ...breaking];

  return (
    <header className="bg-white">
      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-1.5">
          <span className="shrink-0 bg-[#c41e3a] px-2 py-0.5 text-[10px] font-bold tracking-[0.16em]">
            BREAKING
          </span>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="ticker-track gap-10 text-[12px] leading-5 text-neutral-100">
              {tickerItems.map((article, index) => (
                <Link
                  key={`${article.id}-${index}`}
                  href={`/news/${article.slug}`}
                  className="shrink-0 hover:text-white"
                >
                  <span className="mr-2 font-semibold uppercase tracking-wider text-[#ff6b81]">
                    {article.category.name}
                  </span>
                  {article.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
          <p>
            {dateline}
            <span className="mx-2 text-neutral-300">|</span>
            New York
            <span className="mx-2 text-neutral-300">|</span>
            Late Edition
          </p>
          <p className="hidden sm:block">Vol. 12 No. 254</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1240px] items-end justify-between px-4 pb-3 pt-4">
        <Link href="/" className="group block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.42em] text-neutral-500">
            Business &amp; Markets
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            TradeFlock
            <span className="ml-2 align-top font-sans text-[11px] font-bold tracking-[0.28em] text-[#c41e3a]">
              USA
            </span>
          </h1>
        </Link>
        <form
          action="/"
          className="mb-1 hidden items-center border-b border-neutral-300 md:flex"
          role="search"
        >
          <Search className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
          <input
            name="q"
            type="search"
            placeholder="Search the desk"
            className="w-48 bg-transparent px-2 py-1 text-sm outline-none placeholder:text-neutral-400"
            aria-label="Search"
          />
        </form>
      </div>

      <nav
        className="border-y border-neutral-200 bg-white"
        aria-label="Sections"
      >
        <div className="mx-auto flex max-w-[1240px] items-center gap-0 overflow-x-auto px-2 sm:px-4">
          <NavLink href="/" active={!activeCategory}>
            Home
          </NavLink>
          {NAV_CATEGORIES.map((category) => (
            <NavLink
              key={category.slug}
              href={`/?category=${category.slug}`}
              active={activeCategory === category.slug}
            >
              {category.name}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 border-b-2 px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em]",
        active
          ? "border-[#c41e3a] text-neutral-950"
          : "border-transparent text-neutral-600 hover:text-neutral-950",
      )}
    >
      {children}
    </Link>
  );
}
