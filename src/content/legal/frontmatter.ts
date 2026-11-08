/**
 * Validated frontmatter of the four legal documents; the Markdown versions, the sitemap's lastModified and the structured data all read it from here.
 * Validated up front just like the HTML pages: a missing field fails the build and names the file, instead of emitting content with undefined in it.
 */
import { frontmatter as enPrivacy } from "@/content/legal/en/privacy.mdx";
import { frontmatter as enTerms } from "@/content/legal/en/terms.mdx";
import { frontmatter as zhPrivacy } from "@/content/legal/zh/privacy.mdx";
import { frontmatter as zhTerms } from "@/content/legal/zh/terms.mdx";
import type { Lang } from "@/data/site";
import { parseLegalFrontmatter } from "@/lib/legal";
import type { LegalFrontmatter } from "./types";

export const legalFrontmatters: Record<Lang, Record<"/privacy/" | "/terms/", LegalFrontmatter>> = {
  zh: {
    "/privacy/": parseLegalFrontmatter(zhPrivacy, "zh/privacy.mdx"),
    "/terms/": parseLegalFrontmatter(zhTerms, "zh/terms.mdx"),
  },
  en: {
    "/privacy/": parseLegalFrontmatter(enPrivacy, "en/privacy.mdx"),
    "/terms/": parseLegalFrontmatter(enTerms, "en/terms.mdx"),
  },
};
