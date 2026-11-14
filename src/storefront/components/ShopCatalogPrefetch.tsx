import type { Lang } from "@/storefront/i18n";
import { earlyCatalogScript } from "@/storefront/lib/catalog";

/**
 * Starts the shop page's catalog request from the HTML itself, as the browser parses it, instead of after the page's scripts have
 * loaded and hydrated (see earlyCatalogScript). The page stays prerendered: the catalog is the visitor's own request, as before,
 * with their cookies, and never baked into the build. Shop picks the answer up with takeEarlyCatalog.
 */
export function ShopCatalogPrefetch({ lang }: { lang: Lang }) {
  return <script dangerouslySetInnerHTML={{ __html: earlyCatalogScript(lang) }} />;
}
