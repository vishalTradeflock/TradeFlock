import Image from "next/image";
import { HonoreeOutboundLinks } from "@/components/MagazineSocialIcons";
import { issueFlipbookHref } from "@/lib/magazine-links";
import type { Magazine, MagazineHonoree } from "@/lib/types";

const HERO_IMAGE_SIZES = "(max-width: 768px) 100vw, 380px";

export function MagazineCoverStory({
  honoree,
  magazine,
}: {
  honoree: MagazineHonoree;
  magazine: Magazine;
}) {
  const photo = honoree.photo_url?.trim() || "";
  const titleCompany = [honoree.designation, honoree.company].filter(Boolean).join(" · ");

  return (
    <section className="mx-auto grid max-w-7xl items-start gap-10 px-4 py-12 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[380px] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 shadow-lg">
        {photo ? (
          <Image
            src={photo}
            alt={honoree.name}
            fill
            priority
            sizes={HERO_IMAGE_SIZES}
            unoptimized={!photo.startsWith("/")}
            className="object-cover object-top"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col justify-center border-t border-neutral-200 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Special Edition
        </p>
        <h1 className="mt-3 font-serif text-3xl tracking-tight text-neutral-900 lg:text-4xl">
          {magazine.title}
        </h1>
        <h2 className="mt-2 font-serif text-2xl font-bold text-neutral-900">{honoree.name}</h2>
        {titleCompany ? (
          <p className="mt-3 text-sm font-semibold uppercase tracking-wider text-red-700">
            {titleCompany}
          </p>
        ) : null}
        {honoree.bio ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700">{honoree.bio}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-5">
          <a
            href={issueFlipbookHref(magazine)}
            className="inline-flex items-center bg-neutral-950 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#c41e3a]"
          >
            Access digital flipbook
          </a>
          <HonoreeOutboundLinks
            name={honoree.name}
            linkedinUrl={
              honoree.linkedin_url ||
              `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${honoree.name} ${honoree.company ?? ""}`)}`
            }
            websiteUrl={honoree.website_url}
          />
        </div>
      </div>
    </section>
  );
}
