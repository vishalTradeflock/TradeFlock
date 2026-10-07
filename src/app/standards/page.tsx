import type { Metadata } from "next";
import Header from "@/components/Header";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Editorial Standards and AI Use",
  description:
    "How the TradeFlock USA newsroom uses AI, how stories are selected, sourced and approved, and who makes the final publishing decision.",
  path: "/standards",
});

export const revalidate = 3600;

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "AI is part of this newsroom",
    body: [
      "TradeFlock USA news coverage is produced with AI assistance. AI assistants find story leads, research primary sources, organize facts, draft copy and run editorial checks. We do not hide this, and we label it on every news article.",
      "Stories bylined “TradeFlock Newsroom” are produced by our AI-assisted desks. We do not invent journalists, interviews, quotes or first-hand reporting.",
    ],
  },
  {
    title: "How a story is selected",
    body: [
      "Our automated Signal Desk reads news feeds and primary sources, including SEC EDGAR 8-K filings and Federal Reserve releases. It produces short story leads, not articles. No automated lead can become a TradeFlock article by itself.",
      "A reporting desk (macro, markets, M&A, strategy, technology or retail) must claim the lead, check the primary sources and file a reporting packet that answers one question: what does TradeFlock add that the original source does not? If the answer is only a rewrite of the announcement, we do not publish it.",
    ],
  },
  {
    title: "Who approves publication",
    body: [
      "Every news story is scored by the Wire Editor against a published scorecard covering added value, accuracy, sourcing, news value, context, reader value, search fit and style. A story publishes only with a PUBLISH verdict, a perfect accuracy score and no unresolved hard fails.",
      "The Wire Editor is an AI editing assistant. Its PUBLISH verdict is the final step: no human reviews a news story after the Wire Editor approves it. Our publishing system enforces this gate in the database, and limits normal news output to eight stories a day.",
    ],
  },
  {
    title: "Exceptions",
    body: [
      "Magazine features, Success Insights profiles and stories published before October 7, 2026 follow their earlier processes and are not covered by the Wire Editor gate.",
    ],
  },
  {
    title: "Corrections",
    body: [
      "When we get something wrong we correct the article and log the change. To report an error, use our contact page.",
    ],
  },
];

export default function StandardsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[860px] px-4 py-8">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Editorial standards and AI use
        </h1>
        {SECTIONS.map((section) => (
          <section key={section.title} className="mt-8">
            <h2 className="font-serif text-xl font-semibold text-neutral-900">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="mt-3 text-base leading-relaxed text-neutral-700">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
