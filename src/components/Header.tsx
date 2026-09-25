import Link from "next/link";
import type { ReactNode } from "react";
import { BreakingTicker } from "@/components/BreakingTicker";
import { MastheadDateline } from "@/components/MastheadDateline";
import TradeFlockLogo from "@/components/TradeFlockLogo";
import { NAV_CATEGORIES, type ArticleWithRelations } from "@/lib/types";
import { getSuccessInsightsArticles } from "@/lib/articles";
import { successInsightsTickerArticles } from "@/lib/success-insights";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type HeaderProps = {
  activeCategory?: string;
  activePage?: "magazine" | "success-insights";
  tickerArticles?: ArticleWithRelations[];
  mastheadAsH1?: boolean;
};

const TICKER_LIMIT = 12;

export default async function Header({
  activeCategory,
  activePage,
  tickerArticles,
  mastheadAsH1 = false,
}: HeaderProps) {
  // Breaking ticker is Success Insights only, on every page.
  let rawTicker = successInsightsTickerArticles(tickerArticles ?? [], TICKER_LIMIT);
  if (!rawTicker.length) {
    rawTicker = successInsightsTickerArticles(
      await getSuccessInsightsArticles(TICKER_LIMIT),
      TICKER_LIMIT,
    );
  }
  const tickerArticlesForStrip = rawTicker.slice(0, TICKER_LIMIT);

  return (
    <header className="bg-white">
      <div className="border-b border-neutral-200 bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-1.5">
          <span className="shrink-0 bg-[#c41e3a] px-2 py-0.5 text-[10px] font-bold tracking-[0.16em]">
            BREAKING
          </span>
          <BreakingTicker articles={tickerArticlesForStrip} />
        </div>
      </div>

      <div className="border-b border-neutral-200">
        <div
          className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-neutral-500"
          suppressHydrationWarning
        >
          <MastheadDateline />
          <p className="hidden sm:block">Vol. 12 No. 254</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1240px] items-end justify-between px-4 pb-3 pt-4">
        <Link href="/" className="group block" aria-label="TradeFlock USA">
          {mastheadAsH1 ? (
            <h1 className="m-0 p-0 text-inherit">
              <TradeFlockLogo className="text-4xl sm:text-5xl" />
            </h1>
          ) : (
            <TradeFlockLogo className="text-4xl sm:text-5xl" />
          )}
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
          <NavLink href="/" active={!activeCategory && !activePage}>
            Home
          </NavLink>
          {NAV_CATEGORIES.map((category) => (
            <NavLink
              key={category.slug}
              href={`/${category.slug}`}
              active={activeCategory === category.slug}
            >
              {category.name}
            </NavLink>
          ))}
          <NavLink
            href="/success-insights"
            active={activePage === "success-insights"}
          >
            Success Insights
          </NavLink>
          <NavLink href="/magazine" active={activePage === "magazine"}>
            Magazine
          </NavLink>
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
