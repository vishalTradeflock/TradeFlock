/**
 * Desk personas (Sophia Brennan, Marcus Chen, and the other correspondent
 * profiles) are editorial bylines. Article structured data names that byline
 * as a Person. `isHumanAuthor` is only for the hidden AI-disclosure copy:
 * personas are not treated as human reviewers there.
 *
 * The DB marks personas with authors.author_type = 'persona'.
 */
export const PERSONA_AUTHOR_SLUGS: ReadonlySet<string> = new Set([
  "marcus-chen",
  "sophia-brennan",
  "james-whitaker",
  "elena-vasquez",
  "priya-nair",
  "marcus-vance",
  "david-chen",
]);

export const NEWSROOM_AUTHOR_SLUG = "tradeflock-newsroom";
export const NEWSROOM_AUTHOR_NAME = "TradeFlock Newsroom";
/** Schema.org author when an article has no byline. */
export const FALLBACK_AUTHOR_ORG_NAME = "TradeFlock";
/** Visible byline when the article has no author record to name. */
export const ARTICLE_DESK_LABEL = "TradeFlock Editorial Desk";

const SUPPRESSED_AUTHOR_TEXT = /tradeflock newsroom|ai-assisted/i;

export type AuthorLike = {
  name?: string | null;
  slug?: string | null;
  title?: string | null;
  bio?: string | null;
  author_type?: string | null;
} | null | undefined;

export function isHumanAuthor(author: AuthorLike): boolean {
  if (!author?.slug) return false;
  if (author.author_type && author.author_type !== "person") return false;
  if (author.slug === NEWSROOM_AUTHOR_SLUG) return false;
  return !PERSONA_AUTHOR_SLUGS.has(author.slug);
}

export function containsSuppressedAuthorLabel(value: string | null | undefined): boolean {
  return SUPPRESSED_AUTHOR_TEXT.test(value ?? "");
}

function cleanText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Organization stand-in, not a correspondent byline. */
export function isOrganizationAuthor(author: AuthorLike): boolean {
  if (!author) return false;
  if (author.author_type === "organization") return true;
  if (cleanText(author.slug) === NEWSROOM_AUTHOR_SLUG) return true;
  return containsSuppressedAuthorLabel(author.name);
}

/**
 * Display name for JSON-LD, author meta, and the article byline.
 * Null when the article has no correspondent to name.
 */
export function bylineDisplayName(author: AuthorLike): string | null {
  if (!author || isOrganizationAuthor(author)) return null;
  const name = cleanText(author.name);
  if (!name || containsSuppressedAuthorLabel(name)) return null;
  return name;
}

/** Public profile route: src/app/(public)/author/[slug]/page.tsx */
export function authorProfilePath(slug: string | null | undefined): string | null {
  const clean = cleanText(slug).replace(/^\/+|\/+$/g, "");
  if (!clean || clean === NEWSROOM_AUTHOR_SLUG) return null;
  return `/author/${clean}`;
}

export function bylineJobTitle(author: AuthorLike): string | null {
  if (!bylineDisplayName(author)) return null;
  const title = cleanText(author.title);
  if (!title || containsSuppressedAuthorLabel(title)) return null;
  return title;
}

export function bylineBio(author: AuthorLike): string | null {
  if (!bylineDisplayName(author)) return null;
  const bio = cleanText(author.bio);
  if (!bio || containsSuppressedAuthorLabel(bio)) return null;
  return bio;
}

export function articleBylinePresentation(author: AuthorLike): {
  name: string;
  title: string | null;
  bio: string | null;
  profilePath: string | null;
} {
  const name = bylineDisplayName(author);
  if (!name) {
    return { name: ARTICLE_DESK_LABEL, title: null, bio: null, profilePath: null };
  }
  return {
    name,
    title: bylineJobTitle(author),
    bio: bylineBio(author),
    profilePath: authorProfilePath(author?.slug),
  };
}

/** `<meta name="author">` / Open Graph author. Never the newsroom label. */
export function articleAuthorMetadata(
  author: AuthorLike,
  canonicalFor: (path: string) => string,
): { name: string; url?: string } {
  const name = bylineDisplayName(author);
  if (!name) return { name: FALLBACK_AUTHOR_ORG_NAME };
  const profile = authorProfilePath(author?.slug);
  return profile ? { name, url: canonicalFor(profile) } : { name };
}

/** schema.org author node for NewsArticle / Article. */
export function authorStructuredData(
  author: AuthorLike,
  canonicalFor: (path: string) => string,
): Record<string, unknown> {
  const name = bylineDisplayName(author);
  if (!name) {
    return {
      "@type": "Organization",
      name: FALLBACK_AUTHOR_ORG_NAME,
      url: canonicalFor("/"),
    };
  }

  const profile = authorProfilePath(author?.slug);
  const jobTitle = bylineJobTitle(author);
  return {
    "@type": "Person",
    name,
    ...(profile ? { url: canonicalFor(profile) } : {}),
    ...(jobTitle ? { jobTitle } : {}),
  };
}

export function aiDisclosureText(author: AuthorLike): string {
  return isHumanAuthor(author)
    ? "This article was written with AI assistance and reviewed by TradeFlock's Wire Editor, an AI editing assistant, before publication. See our standards."
    : "This article was produced by TradeFlock's AI-assisted newsroom. It was reported from the primary sources cited and approved by the Wire Editor, an AI editing assistant. No human reviews it after that step. See our standards.";
}
