import Image from "next/image";
import { HonoreeOutboundLinks } from "@/components/MagazineSocialIcons";
import { directoryDisplayName, honoreeLinkedInHref } from "@/lib/honoree";
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
  const name = directoryDisplayName(honoree.name, magazine.title);
  const photo = honoree.photo_url?.trim() ?? "";
  if (!photo || /building|skyscraper|placeholder|unsplash\.com/i.test(photo)) {
    return null;
  }
  const designation = honoree.designation?.trim() || "";
  const page = honoree.magazine_page || honoree.page || (index + 1) * 2 + 2;
  const flipbookHref = `/magazine/${magazine.slug}/read#page/${page}`;
  const linkedinHref = honoreeLinkedInHref({
    name,
    company: honoree.company,
    linkedinUrl: honoree.linkedin_url,
  });

  return (
    <article className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900">
      <Image
        src={photo}
        alt={name}
        fill
        sizes={CARD_IMAGE_SIZES}
        priority={priority}
        unoptimized={!photo.startsWith("/")}
        className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
      />

      <div className="absolute bottom-4 left-4 right-4 z-10 rounded-xl bg-black/60 p-4 text-white backdrop-blur-md transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
        <p className="text-base font-bold text-white">{name}</p>
        {designation ? <p className="mt-0.5 text-xs text-neutral-300">{designation}</p> : null}
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between bg-black/75 p-6 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div>
          <h3 className="font-serif text-lg font-bold text-white">{name}</h3>
          {designation ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#c41e3a]">
              {designation}
            </p>
          ) : null}
          {honoree.bio ? (
            <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-neutral-200">{honoree.bio}</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <HonoreeOutboundLinks name={name} linkedinUrl={linkedinHref} className="text-white" />
          <a
            href={flipbookHref}
            className="inline-flex items-center bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-950 transition-colors hover:bg-[#c41e3a] hover:text-white"
          >
            Read in flipbook
          </a>
        </div>
      </div>
    </article>
  );
}
