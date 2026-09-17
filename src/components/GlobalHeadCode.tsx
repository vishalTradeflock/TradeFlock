/**
 * Raw HTML from site_settings.global_head_code.
 *
 * This field has site-wide code execution capability (scripts, pixels, JSON-LD).
 * It must remain writable only by authorized Studio/masthead roles via server
 * actions + service role. Do not sanitize in a way that strips <script>, <meta>,
 * <link>, or JSON-LD. Do not expose an anonymous write path.
 */
export function GlobalHeadCode({ html }: { html: string }) {
  const trimmed = html.trim();
  if (!trimmed) return null;
  return (
    <script
      id="tradeflock-global-head"
      dangerouslySetInnerHTML={{
        __html: `</script>${trimmed}<script type="application/json">`,
      }}
    />
  );
}
