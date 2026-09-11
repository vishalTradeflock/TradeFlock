import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "TradeFlock USA is a leading U.S. business and leadership publication covering markets, technology, finance, and the executives who run American companies.",
  openGraph: {
    title: "About Us | TradeFlock USA",
    description:
      "A business and leadership desk for the U.S. market — honest, rigorous coverage of companies, capital, and the people who run them.",
    type: "website",
  },
};

export const revalidate = 120;

const VALUES = [
  {
    title: "Accuracy first",
    body: "Facts, figures, and attributions are checked against independent research and named sources before a story leaves the desk.",
  },
  {
    title: "Useful, not ornamental",
    body: "Coverage should help operators decide. We favor context, numbers, and the thinking behind a move — not ceremony.",
  },
  {
    title: "Independence",
    body: "Editorial judgment sits with the newsroom. Features, nominations, and interviews are evaluated on the record, not on access.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1240px] px-4 py-8">
        <section className="max-w-3xl border-b border-neutral-200 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
            The publication
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
            TradeFlock USA is a leading business and leadership publication
          </h1>
          <p className="mt-4 text-xl leading-8 text-neutral-700">
            We cover the companies, markets, and executives that set the pace
            for American commerce — with the same discipline as a national
            business paper, and none of the noise of a marketing site.
          </p>
        </section>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-0">
          <article className="max-w-3xl lg:col-span-8 lg:pr-10">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Mission
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">
                Business coverage that helps leaders decide
              </h2>
              <div className="prose prose-neutral prose-article mt-4 max-w-3xl text-[17px] leading-7">
                <p>
                  TradeFlock was founded in 2015 on a simple brief: business
                  journalism should do more than inform. It should give
                  operators, founders, and investors the context to see a
                  market clearly, spot a shift early, and act.
                </p>
                <p>
                  The U.S. edition launched in 2023 as a focused desk for a
                  market defined by scale and constant reinvention. We report
                  not only on outcomes — deals, appointments, earnings — but on
                  the strategy, risk, and ideas behind them.
                </p>
                <p>
                  Integrity and quality remain the test. Every article,
                  interview, and briefing is held to the same standard:
                  accurate, timely, and useful to people building companies.
                </p>
              </div>
            </section>

            <section className="mt-10 border-t border-neutral-200 pt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Editorial values
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">
                How the desk works
              </h2>
              <ul className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
                {VALUES.map((value) => (
                  <li key={value.title} className="py-4">
                    <h3 className="font-serif text-lg font-semibold tracking-tight">
                      {value.title}
                    </h3>
                    <p className="mt-1 text-[15px] leading-7 text-neutral-700">
                      {value.body}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[15px] leading-7 text-neutral-700">
                Stories begin with research from primary documents, company
                disclosures, and on-the-record conversations. We quote sources
                where due. Nominations for leadership features are accepted,
                then evaluated internally — background, record, and substance —
                before any questionnaire or interview is sent.
              </p>
            </section>
          </article>

          <aside className="lg:col-span-4 lg:border-l lg:border-neutral-200 lg:pl-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Audience &amp; reach
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">
              Who reads the desk
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-neutral-700">
              TradeFlock USA is written for C-suite leaders, founders,
              operators, and the advisers around them — people who already
              follow markets closely and need reporting that keeps up.
            </p>
            <dl className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
              <div className="py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                  Geography
                </dt>
                <dd className="mt-1 text-neutral-800">
                  United States desk, with sister editions in India and Asia
                  since 2015.
                </dd>
              </div>
              <div className="py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                  Beats
                </dt>
                <dd className="mt-1 text-neutral-800">
                  Technology, markets, finance, and leadership.
                </dd>
              </div>
              <div className="py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c41e3a]">
                  Readers
                </dt>
                <dd className="mt-1 text-neutral-800">
                  Executives, entrepreneurs, and operators who use coverage to
                  brief a board, a product meeting, or an investment memo.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </main>
    </>
  );
}
