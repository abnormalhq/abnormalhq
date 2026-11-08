import { site } from "../data/site.ts";
import { pages } from "./pages.ts";

interface MediaRange {
  type: string;
  params: string[];
  q: number;
}

const markdownByUrl = new Map(pages.map((page) => [page.url, page.markdown]));

function parseAccept(accept: string | null): MediaRange[] {
  return (accept ?? "")
    .toLowerCase()
    .split(",")
    .map((part) => {
      const [type = "", ...rest] = part.split(";").map((value) => value.trim());
      const qIndex = rest.findIndex((param) => param.startsWith("q="));
      // Everything after q is accept-ext, not media type parameters.
      const params = qIndex < 0 ? rest : rest.slice(0, qIndex);
      return {
        type,
        // RFC 9110 allows empty parameters, such as a stray trailing semicolon in text/markdown;.
        params: params.filter(Boolean).map((param) => param.replaceAll('"', "")),
        q: qIndex < 0 ? 1 : Number(rest[qIndex]!.slice(2)),
      };
    });
}

/**
 * The weight a range gives our response. Both responses are charset=utf-8, so ranges with other parameters do not match;
 * a range with parameters is more specific than one without (RFC 9110) and wins.
 */
function weightOf(ranges: MediaRange[], type: string): number | undefined {
  const matching = ranges.filter((range) => range.type === type && range.params.every((p) => p === "charset=utf-8"));
  return (matching.find((range) => range.params.length > 0) ?? matching[0])?.q;
}

/**
 * Markdown is only considered when text/markdown is spelled out, so requests with only wildcards still get HTML.
 * HTML takes the weight of the most specific matching range; on a tie Markdown wins, since browsers never send text/markdown.
 */
export function wantsMarkdown(accept: string | null): boolean {
  const ranges = parseAccept(accept);
  const markdown = weightOf(ranges, "text/markdown") ?? 0;
  const html = weightOf(ranges, "text/html") ?? weightOf(ranges, "text/*") ?? weightOf(ranges, "*/*") ?? 0;
  return markdown > 0 && markdown >= html;
}

/** The Markdown address this request should be routed to instead; undefined when no negotiation is needed. */
export function markdownUrl(request: Request): URL | undefined {
  const url = new URL(request.url);
  // www is 301-redirected to the main domain by the redirects in next.config.ts. Let it redirect on its original path first and negotiate on the main domain, otherwise it would redirect permanently to the /md/ address.
  if (url.hostname === site.wwwHost) return undefined;
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;

  const markdown = markdownByUrl.get(url.pathname);
  if (!markdown || !wantsMarkdown(request.headers.get("accept"))) return undefined;
  url.pathname = markdown;
  return url;
}

/**
 * The same address has an HTML and a Markdown version, so a negotiated response must declare Vary: Accept, or a shared cache could hand Markdown to a browser.
 * It has to be added at the Worker layer: in production, responses of prerendered routes do not always carry the Vary the route set itself.
 */
export function varyOnAccept(response: Response): Response {
  const negotiated = new Response(response.body, response);
  negotiated.headers.append("Vary", "Accept");
  return negotiated;
}
