/**
 * The list of every page on the site. The sitemap, llms.txt, the Markdown versions and the content negotiation in next.config.ts all read it from here; a new page is added in one place.
 * next.config.ts also imports this file, so it may only depend on modules without runtime side effects.
 */
import type { Lang } from "../data/site.ts";
import { langs, localePath } from "../i18n/paths.ts";

/** Page path without the language prefix. The storefront pages (redeem, guide, shop) came from the retired onboard site. */
export const pagePaths = ["/", "/shop/", "/redeem/", "/guide/", "/download/", "/privacy/", "/terms/"] as const;
export type PagePath = (typeof pagePaths)[number];

/**
 * Storefront pages that depend on a purchase or login session: noindex, so they are not in the sitemap and have no Markdown version,
 * but the Worker's language redirect still applies to them (src/lib/lang.ts), with their query string kept.
 */
export const sessionPagePaths = ["/shop/orders/", "/shop/renew/", "/shop/account/"] as const;
export type SessionPagePath = (typeof sessionPagePaths)[number];

export interface Page {
  lang: Lang;
  path: PagePath;
  /** HTML address with the language prefix. */
  url: string;
  /** Markdown address of the same page, served by src/app/md/[[...slug]]/route.ts. */
  markdown: string;
}

export function pageFor(lang: Lang, path: PagePath): Page {
  const url = localePath(lang, path);
  return { lang, path, url, markdown: `/md${url}` };
}

export const pages: readonly Page[] = langs.flatMap((lang) => pagePaths.map((path) => pageFor(lang, path)));

/** Every HTML page the language redirect knows: the indexed pages and the session pages, each in every language. */
export const pageUrls: readonly { lang: Lang; path: PagePath | SessionPagePath; url: string }[] = langs.flatMap(
  (lang) => [...pagePaths, ...sessionPagePaths].map((path) => ({ lang, path, url: localePath(lang, path) })),
);
