import { site } from "../data/site.ts";
import type { Page } from "./pages.ts";

/** Markdown responses under /md/, with the same content as the HTML page and a canonical pointing back to the HTML address. */
export function markdownResponse(page: Page, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // This content is the same as the HTML page; search engines should index the HTML address.
      Link: `<${site.url}${page.url}>; rel="canonical"`,
    },
  });
}
