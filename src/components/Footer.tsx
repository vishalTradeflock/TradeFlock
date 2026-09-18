import Link from "next/link";
import TradeFlockLogo from "@/components/TradeFlockLogo";

type FooterLink = {
  href: string;
  label: string;
  external?: boolean;
};

const INITIATIVE_LINKS: FooterLink[] = [
  {
    href: "https://tradeflock.com/40-under-40-nomination-guide/",
    label: "40 Under 40",
    external: true,
  },
  {
    href: "https://nexus.tradeflock.com/login.php",
    label: "Nexus",
    external: true,
  },
];

const COMPANY_LINKS: FooterLink[] = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

const SOCIAL_LINKS = [
  {
    href: "https://www.linkedin.com/company/tradeflock-usa",
    label: "LinkedIn",
  },
  {
    href: "https://www.linkedin.com/company/tradeflock",
    label: "LinkedIn Global",
  },
];

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="inline-block">
            <TradeFlockLogo className="text-2xl" />
          </Link>
          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-600">
            An independent business desk covering markets, technology, finance,
            and the people who run American companies.
          </p>
        </div>

        <FooterNav title="Initiatives" links={INITIATIVE_LINKS} />
        <FooterNav title="Company" links={COMPANY_LINKS} />

        <nav aria-label="Social">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Follow
          </p>
          <ul className="mt-3 space-y-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="transition hover:text-[#c41e3a]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                className="transition hover:text-[#c41e3a]"
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="transition hover:text-[#c41e3a]">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
