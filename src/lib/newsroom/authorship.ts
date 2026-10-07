/**
 * Invented correspondent personas used by the old wire. They are not real
 * people and must never be presented as human authors (structured data, AI
 * disclosure). The DB marks them authors.author_type = 'persona'.
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

export type AuthorLike = { name?: string | null; slug?: string | null; author_type?: string | null } | null | undefined;

export function isHumanAuthor(author: AuthorLike): boolean {
  if (!author?.slug) return false;
  if (author.author_type && author.author_type !== "person") return false;
  if (author.slug === NEWSROOM_AUTHOR_SLUG) return false;
  return !PERSONA_AUTHOR_SLUGS.has(author.slug);
}

/** schema.org author node: Person only for real people, else the publisher Organization. */
export function authorStructuredData(
  author: AuthorLike,
  canonicalFor: (path: string) => string,
): Record<string, unknown> {
  if (isHumanAuthor(author)) {
    return {
      "@type": "Person",
      name: author!.name?.trim() || "TradeFlock",
      url: canonicalFor(`/author/${author!.slug}`),
    };
  }
  return {
    "@type": "Organization",
    name: NEWSROOM_AUTHOR_NAME,
    url: canonicalFor("/standards"),
  };
}

export function aiDisclosureText(author: AuthorLike): string {
  return isHumanAuthor(author)
    ? "This article was written with AI assistance and reviewed by TradeFlock's Wire Editor, an AI editing assistant, before publication. See our standards."
    : "This article was produced by TradeFlock's AI-assisted newsroom. It was reported from the primary sources cited and approved by the Wire Editor, an AI editing assistant. No human reviews it after that step. See our standards.";
}
