import Script from "next/script";
import type { HeaderScript } from "@/lib/site-settings";

export function GlobalHeadScripts({ scripts }: { scripts: HeaderScript[] }) {
  if (!scripts.length) return null;

  return (
    <>
      {scripts.map((script) =>
        script.src ? (
          <Script key={script.id} id={script.id} src={script.src} strategy="afterInteractive" />
        ) : script.js ? (
          <Script
            key={script.id}
            id={script.id}
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: script.js }}
          />
        ) : null,
      )}
    </>
  );
}
