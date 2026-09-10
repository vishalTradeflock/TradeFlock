import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Reach the TradeFlock USA desk — newsroom pitches, partnership inquiries, and reader notes. Chicago office and editorial guidance.",
  openGraph: {
    title: "Contact Us | TradeFlock USA",
    description:
      "Write to the TradeFlock USA newsroom. Official email, U.S. office, and how to submit an editorial pitch.",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1240px] px-4 py-8">
        <section className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
            The desk
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
            Contact TradeFlock USA
          </h1>
          <p className="mt-4 text-xl leading-8 text-neutral-700">
            Tips, corrections, partnership notes, and leadership nominations
            all come through this desk. Write clearly. We read everything that
            lands.
          </p>
        </section>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-0">
          <div className="lg:col-span-7 lg:pr-10">
            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              Write to us
            </h2>
            <p className="mt-2 mb-6 text-sm leading-6 text-neutral-600">
              Use a work email so we can route your note to the right editor.
            </p>
            <ContactForm />
          </div>

          <aside className="divide-y divide-neutral-200 border-neutral-200 lg:col-span-5 lg:border-l lg:pl-8">
            <section className="pb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Official email
              </p>
              <a
                href="mailto:info@tradeflock.com"
                className="mt-2 block text-lg font-semibold text-neutral-950 hover:text-[#c41e3a]"
              >
                info@tradeflock.com
              </a>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                General inquiries, corrections, and partnership notes.
              </p>
            </section>

            <section className="py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                U.S. office
              </p>
              <address className="mt-2 not-italic text-[15px] leading-7 text-neutral-800">
                River Point, 17th Floor
                <br />
                444 W Lake Street
                <br />
                Chicago, IL 60606, USA
              </address>
              <p className="mt-3 text-sm text-neutral-600">
                Phone{" "}
                <a href="tel:+12013792252" className="hover:text-[#c41e3a]">
                  +1 201 379 2252
                </a>
              </p>
            </section>

            <section className="pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Editorial submissions
              </p>
              <p className="mt-2 text-[15px] leading-7 text-neutral-700">
                Pitch a story or nominate a leader in the form, with a one-line
                hook, why it matters to U.S. business readers, and relevant
                public sources. We do not accept drafted advertorials as news.
              </p>
              <p className="mt-3 text-[15px] leading-7 text-neutral-700">
                Features are evaluated by the editorial team — record,
                substance, and public interest — before any interview
                questionnaire is sent. Allow several business days for a first
                read.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
