import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Leadership",
  description:
    "Executive strategy, organizational culture, governance, and lessons from founders.",
  path: "/leadership",
});

export const revalidate = 120;

export default function LeadershipPage() {
  return (
    <CategoryFeed
      categoryTitle="Leadership"
      categoryDescription="Executive strategy, organizational culture, governance, and lessons from founders."
      categorySlug="leadership"
    />
  );
}
