import Link from "next/link";
import TradeFlockLogo from "@/components/TradeFlockLogo";

const FOOTER_HEADING_CLASS =
  "mb-4 text-[11px] font-mono uppercase tracking-widest text-muted-foreground";
const FOOTER_LINK_CLASS =
  "block text-xs font-medium uppercase tracking-wider text-foreground/80 transition-colors hover:text-foreground";
const FOOTER_STACK_CLASS = "flex flex-col space-y-2.5";

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

const INITIATIVE_LINKS: FooterLink[] = [
  {
    href: "https://tradeflock.com/40-under-40-nomination-guide/",
    label: "40 UNDER 40",
    external: true,
  },
  {
    href: "https://tradeflock.com/nexus-an-executive-thought-leadership-community/",
    label: "TRADEFLOCK NEXUS",
    external: true,
  },
  {
    href: "https://nexus.tradeflock.com/login.php",
    label: "NEXUS LOGIN",
    external: true,
  },
];

const COMPANY_LINKS: FooterLink[] = [
  { href: "/about", label: "ABOUT US" },
  { href: "/contact", label: "CONTACT US" },
];

function BrandIcon({
  d,
  className,
}: {
  d: string;
  className: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    href: "https://www.linkedin.com/company/tradeflock-usa/",
    label: "LinkedIn USA",
    hoverClass: "hover:text-[#0A66C2]",
    iconClass: "h-5 w-5 fill-current",
    path: "M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z",
  },
  {
    href: "https://www.linkedin.com/company/tradeflock/",
    label: "LinkedIn Global",
    hoverClass: "hover:text-[#0A66C2]",
    iconClass: "h-5 w-5 fill-current",
    path: "M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z",
  },
  {
    href: "https://x.com/tradeflock",
    label: "X (Twitter)",
    hoverClass: "hover:text-foreground",
    iconClass: "h-[18px] w-[18px] fill-current",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    href: "https://www.facebook.com/tradeflock",
    label: "Facebook",
    hoverClass: "hover:text-[#1877F2]",
    iconClass: "h-5 w-5 fill-current",
    path: "M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z",
  },
  {
    href: "https://www.instagram.com/tradeflock/",
    label: "Instagram",
    hoverClass: "hover:text-[#E4405F]",
    iconClass: "h-5 w-5 fill-current",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    href: "https://www.youtube.com/@tradeflock",
    label: "YouTube",
    hoverClass: "hover:text-[#FF0000]",
    iconClass: "h-5 w-5 fill-current",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
];

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-[1240px] px-4">
        <nav
          aria-label="Follow"
          className="flex items-center justify-center gap-6 border-b border-border/40 py-8"
        >
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
              className={`text-neutral-500 transition-colors ${link.hoverClass}`}
            >
              <BrandIcon d={link.path} className={link.iconClass} />
            </a>
          ))}
        </nav>

        <div className="grid items-start gap-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="inline-block">
              <TradeFlockLogo className="text-2xl" />
            </Link>
            <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-600">
              An independent business desk covering markets, technology, finance,
              and the people who run American companies.
            </p>
          </div>

          <FooterNav title="INITIATIVES" links={INITIATIVE_LINKS} />
          <FooterNav title="COMPANY" links={COMPANY_LINKS} />

          <div>
            <h4 className={FOOTER_HEADING_CLASS}>CONTACT US</h4>
            <div className={FOOTER_STACK_CLASS}>
              <a href="mailto:info@tradeflock.com" className={FOOTER_LINK_CLASS}>
                info@tradeflock.com
              </a>
              <a href="tel:+12013792252" className={FOOTER_LINK_CLASS}>
                +1 201 379 2252
              </a>
              <a href="tel:+13473218020" className={FOOTER_LINK_CLASS}>
                +1 347 321 8020
              </a>
              <p className="pt-0.5 text-xs font-medium uppercase leading-relaxed tracking-wider text-foreground/80">
                River Point, 17th Floor,
                <br />
                444 W Lake St, Chicago, IL 60606
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-neutral-200">
        <p className="mx-auto max-w-[1240px] px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
          © {new Date().getFullYear()} TradeFlock USA. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterNav({
  title,
  links,
}: {
  title: string;
  links: readonly FooterLink[];
}) {
  return (
    <nav aria-label={title}>
      <h4 className={FOOTER_HEADING_CLASS}>{title}</h4>
      <div className={FOOTER_STACK_CLASS}>
        {links.map((link) =>
          link.external ? (
            <a
              key={link.href}
              href={link.href}
              className={FOOTER_LINK_CLASS}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ) : (
            <Link key={link.href} href={link.href} className={FOOTER_LINK_CLASS}>
              {link.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
