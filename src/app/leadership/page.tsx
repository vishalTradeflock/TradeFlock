import type { Metadata } from "next";
import CategoryFeed from "@/components/CategoryFeed";

export const metadata: Metadata = {
  title: "Leadership",
  description:
    "Executive strategy, organizational culture, governance, and lessons from founders.",
  openGraph: {
    title: "Leadership | TradeFlock USA",
    description:
      "Executive strategy, organizational culture, governance, and lessons from founders.",
    type: "website",
  },
};

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
