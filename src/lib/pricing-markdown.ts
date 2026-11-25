import type { Lang } from "@/data/site";
import { liveCatalog } from "@/storefront/server";
import { compareMarkdown, pricingMarkdown } from "./markdown";
import { markdownResponse } from "./markdown-response";
import { pageFor } from "./pages";

/**
 * Markdown response of the pricing page: reads the catalog on every request, like the HTML page, for the /md/pricing/ and
 * /md/zh/pricing/ routes. Kept out of markdown.ts, which the tests import and which must not depend on the request or the bindings.
 */
export async function pricingMarkdownResponse(lang: Lang): Promise<Response> {
  return markdownResponse(pageFor(lang, "/pricing/"), pricingMarkdown(lang, await liveCatalog(lang)));
}

/** Markdown response of the comparison page, which reads the catalog for Abnormal Mail's storage, trial and own domains. */
export async function compareMarkdownResponse(lang: Lang): Promise<Response> {
  return markdownResponse(pageFor(lang, "/compare/"), compareMarkdown(lang, await liveCatalog(lang)));
}
