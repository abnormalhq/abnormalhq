/**
 * The Markdown of any page in the list (src/lib/pages.ts), for the /md/ routes and llms-full.txt. The pricing and download pages
 * take what they show from the live catalog and the release list, which the caller reads for the request; the rest are generated
 * from the copy and content alone. Kept out of markdown.ts because the legal sources are inlined by the bundler (raw-loader).
 */
import { legalFrontmatters } from "@/content/legal/frontmatter";
import { legalSources } from "@/content/legal/sources";
import { helpSlugOf } from "@/content/help";
import type { Lang } from "@/data/site";
import {
  claudeMarkdown,
  downloadMarkdown,
  helpArticleMarkdown,
  helpIndexMarkdown,
  homeMarkdown,
  legalMarkdown,
  pricingMarkdown,
  securityMarkdown,
  stripFrontmatter,
} from "./markdown";
import type { Page } from "./pages";
import type { DesktopReleases } from "./releases";
import type { ShopCatalog } from "@/storefront/lib/catalog";
import { storeMarkdown, storeMarkdownPaths, type StoreMarkdownPath } from "@/storefront/lib/markdown";

/** What the two per-request pages read: the catalog of each language (null when it could not be read) and the release list. */
export interface LiveData {
  catalogs: Record<Lang, ShopCatalog | null>;
  releases: DesktopReleases | undefined;
}

const isStorePage = (path: string): path is StoreMarkdownPath => storeMarkdownPaths.some((store) => store === path);

/** The pages whose Markdown needs no live data, prerendered by src/app/md/[[...slug]]/route.ts. */
export const isPrerendered = (page: Page) => page.path !== "/download/" && page.path !== "/pricing/";

export function pageMarkdown({ lang, path }: Page, live?: LiveData): string {
  if (path === "/") return homeMarkdown(lang);
  if (isStorePage(path)) return storeMarkdown(lang, path);
  if (path === "/help/") return helpIndexMarkdown(lang);
  if (path === "/security/") return securityMarkdown(lang);
  if (path === "/claude/") return claudeMarkdown(lang);
  const article = helpSlugOf(path);
  if (article) return helpArticleMarkdown(lang, article);
  if (path === "/privacy/" || path === "/terms/")
    return legalMarkdown(lang, legalFrontmatters[lang][path], stripFrontmatter(legalSources[lang][path]));
  if (!live) throw new Error(`the Markdown of ${path} needs the live catalog and release list`);
  if (path === "/pricing/") return pricingMarkdown(lang, live.catalogs[lang]);
  return downloadMarkdown(lang, live.releases);
}
