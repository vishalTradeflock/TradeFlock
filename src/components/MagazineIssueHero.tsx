import Image from "next/image";
import { issueFlipbookHref } from "@/lib/magazine-links";
import type { Magazine } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

const COVER_SIZES = "(max-width: 768px) 280px, 320px";

function CoverMockup({ magazine }: { magazine: Magazine }) {
  const src = magazine.cover_image_url?.trim() ?? "";
  if (src) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden border border-neutral-200 bg-neutral-100 shadow-md">
        <Image
          src={src}
          alt={`${magazine.title} cover`}
          fill
          priority
          sizes={COVER_SIZES}
          unoptimized={!src.startsWith("/")}
          className="object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div className="relative flex aspect-[3/4] w-full flex-col justify-between border border-neutral-800 bg-neutral-950 p-6 text-white shadow-md">
      <p className="font-serif text-sm font-bold tracking-[0.18em]">TRADEFLOCK</p>
      <p className="font-serif text-xl font-semibold leading-tight tracking-tight">{magazine.title}</p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Digital Edition</p>
    </div>
  );
}

export function MagazineIssueHero({
  magazine,
  ctaLabel = "Access digital flipbook",
}: {
  magazine: Magazine;
  ctaLabel?: string;
}) {
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[320px]">
        <CoverMockup magazine={magazine} />
      </div>

      <div className="min-w-0 border-t border-neutral-200 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Special Edition
          {magazine.year ? ` · ${magazine.year}` : ""}
        </p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-neutral-900 lg:text-5xl">
          {magazine.title}
        </h1>
        {magazine.published_at ? (
          <p className="mt-3 text-xs uppercase tracking-widest text-neutral-500">
            <time dateTime={magazine.published_at}>{formatShortDate(magazine.published_at)}</time>
          </p>
        ) : null}
        {magazine.description ? (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-700">{magazine.description}</p>
        ) : (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-700">
            A digital exclusive from the TradeFlock USA magazine desk.
          </p>
        )}
        <a
          href={issueFlipbookHref(magazine)}
          className="mt-8 inline-flex items-center bg-neutral-950 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#c41e3a]"
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
