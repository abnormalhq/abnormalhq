/**
 * The retired standalone storefront (abnormalhq/onboard) at onboard.abnormalhq.com. Its custom domain now points at this
 * Worker: the API under /api keeps being proxied there (worker.ts handles it before this), so Linux DO Credit
 * notifications and anything else still sent to the old address keep working, and every other request is 301-redirected
 * to the same page on the main site.
 *
 * The old site had Chinese at the root and English under /en/; here English is at the root and Chinese under /zh/, and
 * the redeem page moved from the language root to redeem/. Query strings (order numbers, renewal and login tokens) are
 * kept as they are. A /zh/ path on the old host is also understood, for links mail builds in the new layout before the
 * shop address in its sales settings is changed.
 */
import { site, type Lang } from "../../data/site.ts";
import { localePath } from "../../i18n/paths.ts";

export const legacyHosts: readonly string[] = ["onboard.abnormalhq.com", "onboard.abnormal.bid"];

/** Files that keep their path on the main site. */
const SAME_PATH = new Set(["/llms.txt", "/robots.txt", "/sitemap.xml"]);
/** The old Markdown versions: /md/index.md, /md/en/guide.md and so on. */
const OLD_MARKDOWN = /^\/md\/(?:(en|zh)\/)?(index|guide|shop)\.md$/;

/** The main-site path for a path of the old storefront. */
export function legacyPath(pathname: string): string {
  if (SAME_PATH.has(pathname)) return pathname;
  const markdown = OLD_MARKDOWN.exec(pathname);
  if (markdown) {
    const lang: Lang = markdown[1] === "en" ? "en" : "zh";
    const page = markdown[2] === "index" ? "redeem" : markdown[2];
    return `/md${localePath(lang, `/${page}/`)}`;
  }
  const prefix = /^\/(en|zh)(?=\/|$)/.exec(pathname);
  const lang: Lang = prefix?.[1] === "en" ? "en" : "zh";
  let rest = prefix ? pathname.slice(prefix[0].length) : pathname;
  if (!rest || rest === "/") rest = "/redeem/";
  if (!rest.endsWith("/") && !/\.[a-z0-9]+$/i.test(rest)) rest += "/";
  return localePath(lang, rest);
}

/** The redirect for a request to the old storefront's host; undefined for any other host. */
export function legacyRedirect(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (!legacyHosts.includes(url.hostname)) return undefined;
  const target = new URL(`${legacyPath(url.pathname)}${url.search}`, site.url);
  // 308 keeps the method and body for anything that is not a plain page load.
  const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
  return new Response(null, { status, headers: { Location: target.href, "Cache-Control": "public, max-age=3600" } });
}
