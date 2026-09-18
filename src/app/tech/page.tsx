import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Technology",
  description:
    "Insights on AI, digital transformation, enterprise software, and emerging technology.",
  path: "/tech",
});

export const revalidate = 120;

export default function TechPage() {
  return (
    <CategoryFeed
      categoryTitle="Technology"
      categoryDescription="Insights on AI, digital transformation, enterprise software, and emerging technology."
      categorySlug="tech"
    />
  );
}
