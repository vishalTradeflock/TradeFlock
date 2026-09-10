import { WRITER_DESKS, type WriterDesk } from "@/lib/agents/prompts";

export type NewsFeed = {
  name: string;
  url: string;
  desk: WriterDesk;
};

/**
 * Curated public RSS endpoints for a U.S. business desk.
 * Edit this list, or override it at runtime with NEWS_FEEDS_JSON:
 * [{"name":"TechCrunch","url":"https://techcrunch.com/feed/","desk":"tech"}]
 *
 * desk must be one of: tech | markets | ma | strategy | macro | retail
 */
export const DEFAULT_NEWS_FEEDS: readonly NewsFeed[] = [
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    desk: "tech",
  },
  {
    name: "CNBC Technology",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
    desk: "tech",
  },
  {
    name: "CNBC Finance",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    desk: "markets",
  },
  {
    name: "CNBC Economy",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
    desk: "macro",
  },
  {
    name: "CNBC Retail",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000116",
    desk: "retail",
  },
  {
    name: "Federal Reserve",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    desk: "macro",
  },
  {
    name: "SEC Press Releases",
    url: "https://www.sec.gov/news/pressreleases.rss",
    desk: "markets",
  },
  {
    name: "NPR Business",
    url: "https://feeds.npr.org/1006/rss.xml",
    desk: "markets",
  },
  {
    name: "PR Newswire M&A",
    url: "https://www.prnewswire.com/rss/mergers-and-acquisitions-list.rss",
    desk: "ma",
  },
];

function isWriterDesk(value: string): value is WriterDesk {
  return (WRITER_DESKS as readonly string[]).includes(value);
}

function isFeedRecord(value: unknown): value is { name: unknown; url: unknown; desk: unknown } {
  return typeof value === "object" && value !== null && "name" in value && "url" in value && "desk" in value;
}

export function parseNewsFeedsJson(raw: string): NewsFeed[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("NEWS_FEEDS_JSON must be a non-empty JSON array");
  }

  return parsed.map((entry, index) => {
    if (!isFeedRecord(entry)) {
      throw new Error(`NEWS_FEEDS_JSON[${index}] must be { name, url, desk }`);
    }

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    const desk = typeof entry.desk === "string" ? entry.desk.trim().toLowerCase() : "";

    if (!name || !url || !isWriterDesk(desk)) {
      throw new Error(
        `NEWS_FEEDS_JSON[${index}] needs a name, http(s) url, and desk (${WRITER_DESKS.join("|")})`,
      );
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`NEWS_FEEDS_JSON[${index}] url must start with http(s)`);
    }

    return { name, url, desk };
  });
}

export function resolveNewsFeeds(): { feeds: NewsFeed[]; warning?: string } {
  const raw = process.env.NEWS_FEEDS_JSON?.trim();
  if (!raw) {
    return { feeds: [...DEFAULT_NEWS_FEEDS] };
  }

  try {
    return { feeds: parseNewsFeedsJson(raw) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid NEWS_FEEDS_JSON";
    return { feeds: [...DEFAULT_NEWS_FEEDS], warning: message };
  }
}
