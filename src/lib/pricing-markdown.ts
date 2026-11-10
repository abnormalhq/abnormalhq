import type { Lang } from "@/data/site";
import { liveCatalog } from "@/storefront/lib/catalog-live";
import { pricingMarkdown } from "./markdown";
import { markdownResponse } from "./markdown-response";
import { pageFor } from "./pages";

/**
 * Markdown response of the pricing page: reads the catalog on every request, like the HTML page, for the /md/pricing/ and
 * /md/zh/pricing/ routes. Kept out of markdown.ts, which the tests import and which must not depend on the request or the bindings.
 */
export async function pricingMarkdownResponse(lang: Lang): Promise<Response> {
  return markdownResponse(pageFor(lang, "/pricing/"), pricingMarkdown(lang, await liveCatalog(lang)));
}
