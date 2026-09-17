import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/site-url";
import { publicStoryPath } from "@/lib/studio/seo";
import type { ArticleWithRelations } from "@/lib/types";

export const SITE_NAME = "TradeFlock USA";
export const PUBLISHER_LOGO_URL =
  "https://www.tradeflockusa.com/wp-content/uploads/2025/03/Tradeflock-Logo_1-02.png";

export type ArticleFaq = {
  question: string;
  answer: string;
};

export function absoluteUrl(path: string) {
  const origin = getBaseUrl();
  const trimmed = path.trim();
  if (!trimmed) return origin;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function newsArticleUrl(slug: string) {
  return `${getBaseUrl()}${publicStoryPath(slug)}`;
}

export function magazineIssueUrl(slug: string) {
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  return `${getBaseUrl()}/magazine/${clean}`;
}

export function usableCanonicalUrl(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return trimmed;
  } catch {
    /* fall through */
  }
  return fallback;
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
}) {
  const url =
    article.featured_image?.trim() ||
    article.image_url?.trim() ||
    article.cover_image_url?.trim() ||
    "";
  if (!url) return null;
  return {
    url,
    alt: article.featured_image_alt?.trim() || article.cover_image_alt?.trim() || article.title,
  };
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
  images?: { url: string; alt: string }[];
}): Metadata {
  const url = absoluteUrl(path);
  const socialTitle = ogTitle ?? `${title} | ${SITE_NAME}`;
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
      ...(images?.length ? { images } : {}),
    },
    twitter: {
      card: images?.length ? "summary_large_image" : "summary",
      title: socialTitle,
      description,
      ...(images?.length ? { images: images.map((image) => image.url) } : {}),
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
  image: { url: string; alt: string } | null,
) {
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
    ...(image ? { image: [image.url] } : {}),
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
