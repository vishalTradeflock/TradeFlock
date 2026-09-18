"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Link2, Mail, Send, Share2 } from "lucide-react";

type ShareLink = {
  name: string;
  href: string;
  icon: ReactNode;
};

const XIcon = (
  <svg className="h-3.5 w-3.5 fill-neutral-700" viewBox="0 0 24 24" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = (
  <svg className="h-3.5 w-3.5 fill-[#0A66C2]" viewBox="0 0 24 24" aria-hidden>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const FacebookIcon = (
  <svg className="h-3.5 w-3.5 fill-[#1877F2]" viewBox="0 0 24 24" aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const WhatsAppIcon = (
  <svg className="h-3.5 w-3.5 fill-[#25D366]" viewBox="0 0 24 24" aria-hidden>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.8c2.17 0 4.2.85 5.73 2.38 1.53 1.54 2.38 3.57 2.38 5.73 0 4.46-3.64 8.1-8.1 8.1-1.41 0-2.79-.36-4.01-1.04l-.29-.17-3.12.82.83-3.04-.18-.3a8.07 8.07 0 0 1-1.24-4.37c0-4.47 3.64-8.11 8.1-8.11m-3.3 4.4c-.2 0-.53.08-.81.4-.27.31-1.05 1.03-1.05 2.51s1.08 2.91 1.23 3.11c.15.2 2.09 3.35 5.17 4.57 2.56 1.01 3.08.81 3.64.76.56-.05 1.8-.74 2.05-1.45.26-.71.26-1.32.18-1.45-.08-.13-.3-.2-.63-.35s-1.8-.89-2.08-1c-.27-.1-.47-.15-.67.16-.2.3-.77 1-.94 1.2-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.91-2.21-.24-.58-.48-.5-.67-.51z" />
  </svg>
);

const RedditIcon = (
  <svg className="h-3.5 w-3.5 fill-[#FF4500]" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12.75a1.25 1.25 0 0 1-2.5 0 1.25 1.25 0 0 1 2.5 0zm2.75 3.75c-1.917 0-3.561-.77-4.5-1.917a.25.25 0 1 1 .4-.31c.837 1.026 2.29 1.727 4.1 1.727s3.263-.701 4.1-1.727a.25.25 0 0 1 .4.31c-.939 1.147-2.583 1.917-4.5 1.917zm2.75-3.75a1.25 1.25 0 0 1-2.5 0 1.25 1.25 0 0 1 2.5 0z" />
  </svg>
);

function currentPageUrl() {
  return window.location.href;
}

function shareLinksFor(title: string, url: string): ShareLink[] {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(`${title} ${url}`);

  return [
    {
      name: "Email",
      icon: <Mail className="h-3.5 w-3.5 text-neutral-500" />,
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "Twitter / X",
      icon: XIcon,
      href: `https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      name: "Telegram",
      icon: <Send className="h-3.5 w-3.5 text-[#229ED9]" />,
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      name: "LinkedIn",
      icon: LinkedInIcon,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: "WhatsApp",
      icon: WhatsAppIcon,
      href: `https://api.whatsapp.com/send?text=${encodedText}`,
    },
    {
      name: "Reddit",
      icon: RedditIcon,
      href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
  ];
}

export function EditorialShareMenu({ title }: { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(currentPageUrl()).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => {
        /* ignore */
      },
    );
  };

  const shareLinks = isOpen ? shareLinksFor(title, currentPageUrl()) : [];

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-neutral-100"
      >
        <Share2 className="h-3.5 w-3.5 text-neutral-500" />
        <span>Share</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-neutral-200 bg-white py-1 text-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={copyToClipboard}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs text-neutral-900 transition hover:bg-neutral-100"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Link2 className="h-3.5 w-3.5 text-neutral-500" />
            )}
            <span>{copied ? "Link copied!" : "Copy link"}</span>
          </button>

          <div className="my-1 h-px bg-neutral-200" />

          {shareLinks.map((item) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              {item.icon}
              <span>{item.name}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
