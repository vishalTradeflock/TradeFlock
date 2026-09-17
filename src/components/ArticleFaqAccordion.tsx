"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ArticleFaqAccordion({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  const baseId = useId();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (!faqs.length) return null;

  return (
    <section className="mt-12" aria-labelledby={`${baseId}-heading`}>
      <h2
        id={`${baseId}-heading`}
        className="mb-4 font-serif text-2xl font-bold text-neutral-900"
      >
        Frequently Asked Questions
      </h2>
      <div className="divide-y divide-neutral-200 border-y border-neutral-200">
        {faqs.map((faq, index) => {
          const expanded = Boolean(open[index]);
          const panelId = `${baseId}-panel-${index}`;
          return (
            <div key={`${faq.question}-${index}`}>
              <h3 className="m-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-4 text-left font-semibold text-neutral-900"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpen((current) => ({ ...current, [index]: !current[index] }))
                  }
                >
                  {faq.question}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-300",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <p className="pb-4 text-sm leading-relaxed text-neutral-600">{faq.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
