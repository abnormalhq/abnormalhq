/**
 * The list of every page on the site. The sitemap, llms.txt, the Markdown versions and the content negotiation in next.config.ts all read it from here; a new page is added in one place.
 * next.config.ts also imports this file, so it may only depend on modules without runtime side effects.
 */
import type { Lang } from "../data/site.ts";
import { langs, localePath } from "../i18n/paths.ts";

/** Page path without the language prefix. */
export const pagePaths = ["/", "/download/", "/privacy/", "/terms/"] as const;
export type PagePath = (typeof pagePaths)[number];

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
