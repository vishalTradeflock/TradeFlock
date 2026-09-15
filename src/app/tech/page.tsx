import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";

export const metadata: Metadata = {
  title: "Technology",
  description:
    "Insights on AI, digital transformation, enterprise software, and emerging technology.",
  openGraph: {
    title: "Technology | TradeFlock USA",
    description:
      "Insights on AI, digital transformation, enterprise software, and emerging technology.",
    type: "website",
  },
};

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
