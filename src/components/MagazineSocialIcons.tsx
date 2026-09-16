import { Globe } from "lucide-react";

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.24 8.5h4.52V24H.24zM8.26 8.5h4.33v2.12h.06c.6-1.14 2.08-2.34 4.28-2.34 4.58 0 5.42 3.02 5.42 6.94V24h-4.52v-7.62c0-1.82-.03-4.16-2.54-4.16-2.54 0-2.93 1.98-2.93 4.03V24H8.26z" />
    </svg>
  );
}

export function HonoreeOutboundLinks({
  name,
  linkedinUrl,
  websiteUrl,
  className = "text-neutral-900",
}: {
  name: string;
  linkedinUrl: string;
  websiteUrl?: string | null;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${name} on LinkedIn`}
        className="transition-colors hover:text-[#c41e3a]"
      >
        <LinkedInIcon className="h-4 w-4" />
      </a>
      {websiteUrl ? (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} website`}
          className="transition-colors hover:text-[#c41e3a]"
        >
          <Globe className="h-4 w-4" strokeWidth={1.75} />
        </a>
      ) : null}
    </div>
  );
}
