import Image from "next/image";
import Link from "next/link";
import { HonoreeOutboundLinks } from "@/components/MagazineSocialIcons";
import { honoreeSpreadHref } from "@/lib/magazine-links";
import type { Magazine, MagazineHonoree } from "@/lib/types";

const CARD_IMAGE_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";

export function MagazineHonoreeCard({
  honoree,
  magazine,
  index,
  priority = false,
}: {
  honoree: MagazineHonoree;
  magazine: Magazine;
  index: number;
  priority?: boolean;
}) {
  const photo = honoree.photo_url?.trim() || "";
  const titleCompany = [honoree.designation, honoree.company].filter(Boolean).join(" · ");
  const flipbookHref = honoreeSpreadHref(magazine, honoree);
  const linkedinHref =
    honoree.linkedin_url ||
    `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${honoree.name} ${honoree.company ?? ""}`)}`;

  return (
    <article className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm">
      {photo ? (
        <Image
          src={photo}
          alt={honoree.name}
          fill
          sizes={CARD_IMAGE_SIZES}
          priority={priority}
          unoptimized={!photo.startsWith("/")}
          className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
      ) : null}

      <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/60 p-4 text-white backdrop-blur-md transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
        <p className="text-base font-bold text-white">{honoree.name}</p>
        {titleCompany ? <p className="mt-0.5 text-xs text-neutral-300">{titleCompany}</p> : null}
      </div>

      <div className="pointer-events-auto absolute inset-0 flex flex-col justify-between bg-black/65 p-6 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <div>
          <h3 className="font-serif text-lg font-bold text-white">{honoree.name}</h3>
          {titleCompany ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#c41e3a]">
              {titleCompany}
            </p>
          ) : null}
          {honoree.bio ? (
            <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-neutral-200">{honoree.bio}</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <HonoreeOutboundLinks
            name={honoree.name}
            linkedinUrl={linkedinHref}
            className="text-white"
          />
          <a
            href={flipbookHref}
            className="text-[10px] font-semibold uppercase tracking-widest text-white hover:text-[#c41e3a]"
          >
            Read flipbook
          </a>
          {honoree.slug ? (
            <Link
              href={`/news/${honoree.slug}`}
              className="text-[10px] font-semibold uppercase tracking-widest text-white hover:text-[#c41e3a]"
            >
              Full story
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
