import type { Lang } from "../../data/site.ts";
import { helpEn } from "./en.ts";
import { helpPath, helpSlugs, type HelpArticle, type HelpContent, type HelpSlug } from "./types.ts";
import { helpZh } from "./zh.ts";

export { helpCategoryIds, helpPath, helpSlugs } from "./types.ts";
export type { DocBlock, DocSection, HelpArticle, HelpCategoryId, HelpContent, HelpSlug } from "./types.ts";

export const helpContent: Record<Lang, HelpContent> = { en: helpEn, zh: helpZh };

/** The slug in a page path such as /help/apple-mail/, or undefined when the path is not an article's. */
export function helpSlugOf(path: string): HelpSlug | undefined {
  return helpSlugs.find((slug) => helpPath(slug) === path);
}

export function helpArticle(lang: Lang, slug: HelpSlug): HelpArticle {
  const article = helpContent[lang].articles.find((item) => item.slug === slug);
  if (!article) throw new Error(`No ${lang} help article for ${slug}`);
  return article;
}

/** The articles of a language in the order of helpSlugs, the order every list of them uses. */
export function helpArticles(lang: Lang): readonly HelpArticle[] {
  return helpSlugs.map((slug) => helpArticle(lang, slug));
}
