import type { Metadata } from "next";
import { FALLBACK_COVER_IMAGE } from "@/lib/images";
import { getBaseUrl } from "@/lib/site-url";
import { faqAnswerPlainText } from "@/lib/studio/faqs";
import { publicStoryPath, resolveSeoDescription, resolveSeoTitle } from "@/lib/studio/seo";
import { sectionPath, type ArticleWithRelations, type Magazine } from "@/lib/types";

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

export type BreadcrumbItem = {
  name: string;
  path: string;
};

/**
 * First-party OG file to use once `public/og/default.jpg` exists.
 * Do not generate that asset here — swap DEFAULT_OG_IMAGE.url to
 * getCanonicalUrl(FIRST_PARTY_OG_IMAGE_PATH) when it is published.
 */
export const FIRST_PARTY_OG_IMAGE_PATH = "/og/default.jpg";

/**
 * Global OG fallback. Currently the Unsplash building photo at
 * FALLBACK_COVER_IMAGE (`photo-1486406146926-c627a92ad1ab` in src/lib/images.ts).
 * All pages without a dedicated share image use this via getOgImage().
 */
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
  if (!trimmed || trimmed === "/") return origin();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = stripTracking(new URL(trimmed));
      return canonicalFromPathname(parsed.pathname);
    } catch {
      return origin();
    }
  }

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? "/";
  const pathname = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return canonicalFromPathname(pathname);
}

function canonicalFromPathname(pathname: string) {
  const path = pathnameWithoutSlash(pathname);
  if (path === "/") return origin();
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
    alt: article.featured_image_alt?.trim() || article.cover_image_alt?.trim() || "",
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
    authors: article.author.slug
      ? [{ name: article.author.name, url: getCanonicalUrl(`/author/${article.author.slug}`) }]
      : [{ name: article.author.name }],
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

export function organizationId() {
  return `${getBaseUrl()}/#organization`;
}

export function websiteId() {
  return `${getBaseUrl()}/#website`;
}

function publisherRef() {
  return {
    "@id": organizationId(),
    "@type": "NewsMediaOrganization" as const,
    name: SITE_NAME,
    logo: {
      "@type": "ImageObject" as const,
      url: PUBLISHER_LOGO_URL,
    },
  };
}

export function publicSectionPath(slug: string) {
  const clean = slug.trim().toLowerCase();
  if (clean === "technology") return "/tech";
  return sectionPath(clean);
}

export function siteStructuredData() {
  const url = getCanonicalUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["NewsMediaOrganization", "Organization"],
        "@id": organizationId(),
        name: SITE_NAME,
        url,
        logo: {
          "@type": "ImageObject",
          url: PUBLISHER_LOGO_URL,
        },
        description:
          "An independent business desk covering markets, technology, finance, and the people who run American companies.",
        email: "info@tradeflock.com",
        telephone: "+1-201-379-2252",
        address: {
          "@type": "PostalAddress",
          streetAddress: "River Point, 17th Floor, 444 W Lake Street",
          addressLocality: "Chicago",
          addressRegion: "IL",
          postalCode: "60606",
          addressCountry: "US",
        },
        sameAs: [
          "https://www.linkedin.com/company/tradeflock-usa",
          "https://www.linkedin.com/company/tradeflock",
        ],
      },
      {
        "@type": "WebSite",
        "@id": websiteId(),
        name: SITE_NAME,
        url,
        inLanguage: "en-US",
        publisher: { "@id": organizationId() },
      },
    ],
  };
}

export function breadcrumbListStructuredData(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList" as const,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem" as const,
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path),
    })),
  };
}

export function categoryStructuredData(categoryTitle: string, categorySlug: string) {
  return {
    "@context": "https://schema.org",
    ...breadcrumbListStructuredData([
      { name: "Home", path: "/" },
      { name: categoryTitle, path: publicSectionPath(categorySlug) },
    ]),
  };
}

export function articleStructuredData(
  article: ArticleWithRelations,
  canonical: string,
  image: ShareImage | null,
) {
  const share = image ? getOgImage(image) : getOgImage(storyShareImage(article));
  const categoryHref = publicSectionPath(article.category.slug);
  const newsArticle = {
    "@type": "NewsArticle",
    "@id": `${canonical}#article`,
    url: canonical,
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
      name: article.author?.name?.trim() || "TradeFlock Editorial Desk",
      ...(article.author?.slug
        ? { url: getCanonicalUrl(`/author/${article.author.slug}`) }
        : {}),
    },
    publisher: publisherRef(),
    image: [share.url],
    isPartOf: { "@id": websiteId() },
  };

  const graph: Record<string, unknown>[] = [
    newsArticle,
    breadcrumbListStructuredData([
      { name: "Home", path: "/" },
      ...(categoryHref !== "/"
        ? [{ name: article.category.name, path: categoryHref }]
        : []),
      { name: article.title, path: `/news/${article.slug}` },
    ]),
  ];

  const faqs = article.faqs ?? [];
  if (faqs.length) {
    const entities = faqs
      .map((faq) => {
        const question = faq.question.trim();
        const answer = faqAnswerPlainText(faq.answer);
        if (!question || !answer) return null;
        return {
          "@type": "Question",
          name: question,
          acceptedAnswer: {
            "@type": "Answer",
            text: answer,
          },
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    if (entities.length) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: entities,
      });
    }
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function magazineStructuredData(magazine: Magazine, canonical: string) {
  const image = getOgImage(
    magazine.cover_image_url
      ? { url: magazine.cover_image_url, alt: magazine.title }
      : null,
  );
  const description =
    magazine.description?.trim() ||
    `Digital edition of ${magazine.title} from the TradeFlock USA magazine desk.`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        url: canonical,
        headline: magazine.title,
        description,
        datePublished: asIsoDate(magazine.published_at),
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": canonical,
        },
        publisher: publisherRef(),
        image: [image.url],
        isPartOf: { "@id": websiteId() },
      },
      breadcrumbListStructuredData([
        { name: "Home", path: "/" },
        { name: "Magazine", path: "/magazine" },
        { name: magazine.title, path: `/magazine/${magazine.slug}` },
      ]),
    ],
  };
}

export function authorPersonStructuredData(author: {
  name: string;
  slug: string;
  bio?: string | null;
  title?: string | null;
  avatar_url?: string | null;
}) {
  const url = getCanonicalUrl(`/author/${author.slug}`);
  const image = absoluteMediaUrl(author.avatar_url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${url}#person`,
        name: author.name,
        url,
        ...(author.title ? { jobTitle: author.title } : {}),
        ...(author.bio ? { description: author.bio } : {}),
        ...(image ? { image } : {}),
        worksFor: { "@id": organizationId() },
      },
      breadcrumbListStructuredData([
        { name: "Home", path: "/" },
        { name: author.name, path: `/author/${author.slug}` },
      ]),
    ],
  };
}
