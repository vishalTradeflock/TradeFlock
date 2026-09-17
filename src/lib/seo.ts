import type { Metadata } from "next";
import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import { getBaseUrl } from "@/lib/site-url";
import { publicStoryPath, resolveSeoDescription, resolveSeoTitle } from "@/lib/studio/seo";
import type { ArticleWithRelations } from "@/lib/types";

export const SITE_NAME = "TradeFlock USA";
export const PUBLISHER_LOGO_URL =
  "https://www.tradeflockusa.com/wp-content/uploads/2025/03/Tradeflock-Logo_1-02.png";

const CATEGORY_STORY_PREFIX =
  /^(?:\/)?(tech|technology|markets|leadership|finance|business|success-insights)\/([a-z0-9][a-z0-9-]*)$/i;

export type ArticleFaq = {
  question: string;
  answer: string;
};

export type ShareImage = {
  url: string;
  alt: string;
};

export const DEFAULT_OG_IMAGE: ShareImage = {
  url: FALLBACK_COVER_IMAGE,
  alt: SITE_NAME,
};

function origin() {
  return getBaseUrl();
}

function stripTracking(url: URL) {
  url.search = "";
  url.hash = "";
  return url;
}

function isPreviewHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".vercel.app")
  );
}

function pathnameWithoutSlash(pathname: string) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return clean;
}

/** Build a production absolute URL. Alias of getCanonicalUrl for relative paths. */
export function getAbsoluteUrl(path: string) {
  return getCanonicalUrl(path);
}

export function absoluteUrl(path: string) {
  return getCanonicalUrl(path);
}

/** Canonical URL on the production origin. Never includes query strings. */
export function getCanonicalUrl(path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return `${origin()}/`;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = stripTracking(new URL(trimmed));
      return canonicalFromPathname(parsed.pathname);
    } catch {
      return `${origin()}/`;
    }
  }

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? "/";
  const pathname = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return canonicalFromPathname(pathname);
}

function canonicalFromPathname(pathname: string) {
  const path = pathnameWithoutSlash(pathname);
  if (path === "/") return `${origin()}/`;
  return `${origin()}${path}`;
}

export function newsArticleUrl(slug: string) {
  return getCanonicalUrl(publicStoryPath(slug));
}

export function magazineIssueUrl(slug: string) {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  return getCanonicalUrl(`/magazine/${clean}`);
}

export function magazineReadUrl(slug: string) {
  return `${magazineIssueUrl(slug)}/read`;
}

/**
 * Prefer the live route URL. Stored CMS canonicals are only used when they
 * already resolve to this site with no query string.
 */
export function usableCanonicalUrl(value: string | null | undefined, fallback: string) {
  const fallbackUrl = getCanonicalUrl(fallback);
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallbackUrl;

  try {
    const parsed = stripTracking(new URL(trimmed, origin()));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallbackUrl;
    if (isPreviewHost(parsed.hostname)) return fallbackUrl;

    const path = pathnameWithoutSlash(parsed.pathname);
    const categoryMatch = path.replace(/^\//, "").match(CATEGORY_STORY_PREFIX);
    if (categoryMatch?.[2]) return newsArticleUrl(categoryMatch[2]);

    return canonicalFromPathname(path);
  } catch {
    return fallbackUrl;
  }
}

/** Make a media URL absolute on a public host. Drops localhost / Vercel preview URLs. */
export function absoluteMediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    return absoluteMediaUrl(`https:${trimmed}`);
  }

  if (trimmed.startsWith("/")) {
    return `${origin()}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (isPreviewHost(parsed.hostname)) {
      const path = parsed.pathname + parsed.search;
      if (path.startsWith("/covers/") || path.startsWith("/placeholder")) {
        return `${origin()}${path}`;
      }
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getOgImage(image?: ShareImage | null): ShareImage {
  const url = image?.url ? absoluteMediaUrl(image.url) : null;
  if (url) {
    return { url, alt: image?.alt?.trim() || SITE_NAME };
  }
  return DEFAULT_OG_IMAGE;
}

export function parseArticleFaqs(raw: unknown): ArticleFaq[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const faqs: ArticleFaq[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const question = String(row.question ?? row.title ?? row.name ?? "").replace(/\s+/g, " ").trim();
    const answer = String(row.answer ?? row.body ?? row.text ?? "").replace(/\s+/g, " ").trim();
    if (!question || !answer) continue;
    faqs.push({ question, answer });
  }
  return faqs;
}

export function storyShareImage(article: {
  title: string;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  featured_image?: string | null;
  featured_image_alt?: string | null;
  image_url?: string | null;
}): ShareImage | null {
  const raw =
    article.featured_image?.trim() ||
    article.image_url?.trim() ||
    article.cover_image_url?.trim() ||
    "";
  const url = absoluteMediaUrl(raw);
  if (!url) return null;
  return {
    url,
    alt: article.featured_image_alt?.trim() || article.cover_image_alt?.trim() || article.title,
  };
}

function socialImages(images?: ShareImage[]) {
  const resolved = (images ?? [])
    .map((image) => getOgImage(image))
    .filter((image, index, list) => list.findIndex((item) => item.url === image.url) === index);
  return resolved.length ? resolved : [DEFAULT_OG_IMAGE];
}

export function publicPageMetadata({
  title,
  description,
  path,
  ogTitle,
  type = "website",
  images,
}: {
  title: string;
  description: string;
  path: string;
  ogTitle?: string;
  type?: "website" | "article";
  images?: ShareImage[];
}): Metadata {
  const url = getCanonicalUrl(path);
  const socialTitle = ogTitle ?? `${title} | ${SITE_NAME}`;
  const ogImages = socialImages(images);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: socialTitle,
      description,
      url,
      type,
      siteName: SITE_NAME,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: ogImages.map((image) => image.url),
    },
  };
}

export function articlePageMetadata(article: ArticleWithRelations): Metadata {
  const title = resolveSeoTitle(article.meta_title, article.title);
  const description = resolveSeoDescription(article.meta_description, article.excerpt);
  const url = newsArticleUrl(article.slug);
  const image = getOgImage(storyShareImage(article));
  return {
    title,
    description,
    authors: [{ name: article.author.name }],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: SITE_NAME,
      publishedTime: article.published_at,
      modifiedTime: article.updated_at ?? article.published_at,
      authors: [article.author.name],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export function magazinePageMetadata({
  title,
  description,
  path,
  publishedTime,
  image,
}: {
  title: string;
  description: string;
  path: string;
  publishedTime?: string | null;
  image?: ShareImage | null;
}): Metadata {
  const url = getCanonicalUrl(path);
  const ogImage = getOgImage(image);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: SITE_NAME,
      ...(publishedTime ? { publishedTime } : {}),
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}

function asIsoDate(value: string | null | undefined) {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function articleStructuredData(
  article: ArticleWithRelations,
  canonical: string,
  image: ShareImage | null,
) {
  const share = image ? getOgImage(image) : getOgImage(storyShareImage(article));
  const newsArticle = {
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    datePublished: asIsoDate(article.published_at),
    dateModified: asIsoDate(article.updated_at) ?? asIsoDate(article.published_at),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    author: {
      "@type": "Person",
      name: article.author.name,
    },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: PUBLISHER_LOGO_URL,
      },
    },
    image: [share.url],
  };

  const faqs = article.faqs ?? [];
  if (!faqs.length) {
    return {
      "@context": "https://schema.org",
      ...newsArticle,
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      newsArticle,
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}
