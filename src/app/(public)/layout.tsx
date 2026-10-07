import { GlobalHeadCode } from "@/components/GlobalHeadCode";
import { GlobalHeadScripts } from "@/components/GlobalHeadScripts";
import { shouldInjectGlobalHead } from "@/lib/public-head";
import { getGlobalHeadCode, getHeaderScripts } from "@/lib/site-settings";

/**
 * Public pages only. This layout does not read request headers, so the
 * routes under it can honor `revalidate` and stay on the CDN. Studio is
 * outside this group and does not receive the executable head snippets.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const injectPublicHead = shouldInjectGlobalHead("/");
  const [headerScripts, globalHeadCode] = await Promise.all([
    injectPublicHead ? getHeaderScripts() : Promise.resolve([]),
    injectPublicHead ? getGlobalHeadCode() : Promise.resolve(""),
  ]);

  return (
    <>
      <head>{injectPublicHead ? <GlobalHeadCode html={globalHeadCode} /> : null}</head>
      {injectPublicHead ? <GlobalHeadScripts scripts={headerScripts} /> : null}
      {children}
    </>
  );
}
