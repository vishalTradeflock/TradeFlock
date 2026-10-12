import { revalidatePath, revalidateTag } from "next/cache";
import { SITEMAP_CACHE_TAG } from "@/lib/sitemap-tag";

export { SITEMAP_CACHE_TAG };

/** Drop the cached sitemap document so the next request reads published rows. */
export function revalidatePublishedSitemap() {
  revalidateTag(SITEMAP_CACHE_TAG, { expire: 0 });
  revalidatePath("/sitemap.xml");
}
