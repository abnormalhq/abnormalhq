/**
 * The help center's articles (/help/<slug>/) and the security overview (/security/): long-form content kept apart from the UI
 * copy in src/i18n, one file per language, both typed here. tests/help.test.ts compares the two languages block by block.
 * This file is imported by src/lib/pages.ts (and through it by next.config.ts), so it must stay free of runtime side effects
 * and of TypeScript syntax Node cannot run directly.
 *
 * Text may use the two markup forms of the storefront copy (src/storefront/components/RichText.tsx): **bold** and
 * [text](link). A link without a protocol is a site path relative to the language root: (shop/account/) is /shop/account/ on
 * the English pages and /zh/shop/account/ on the Chinese ones.
 */

/** Every article, in the order the index, the sitemap and llms.txt list them. */
export const helpSlugs = [
  "getting-started",
  "apple-mail",
  "outlook",
  "thunderbird",
  "gmail-android",
  "imap-smtp",
  "two-step-verification",
  "import-and-export",
  "labels-filters-forwarding",
  "calendar",
  "renewals",
  "discount-codes",
  "team-mailboxes",
  "own-domain",
  "delete-mailbox",
  "ai-features",
] as const;
export type HelpSlug = (typeof helpSlugs)[number];

/** The groups of the index page. */
export const helpCategoryIds = ["start", "apps", "security", "mail", "billing", "privacy"] as const;
export type HelpCategoryId = (typeof helpCategoryIds)[number];

export type DocBlock = { p: string } | { ol: readonly string[] } | { ul: readonly string[] };

export interface DocSection {
  title: string;
  blocks: readonly DocBlock[];
  /**
   * The section's numbered list is a procedure that does what the section title says: the page then also describes it as
   * a schema.org HowTo. Only for real step-by-step instructions, never for a list of facts.
   */
  howTo?: true;
}

export interface HelpArticle {
  slug: HelpSlug;
  category: HelpCategoryId;
  /** The page's h1, its entry on the index and the link text in llms.txt. */
  title: string;
  /** One or two sentences: the lead under the h1, the meta description and the index entry. */
  summary: string;
  /** Extra words the index search matches, beyond title and summary: names people type that the title does not contain. */
  keywords: readonly string[];
  sections: readonly DocSection[];
}

export interface HelpContent {
  categories: Readonly<Record<HelpCategoryId, string>>;
  articles: readonly HelpArticle[];
}

/** The security and privacy overview: one document of the same shape as an article. */
export interface SecurityContent {
  title: string;
  summary: string;
  /** YYYY-MM-DD: when the statements were last checked against mail's documentation and the privacy policy. */
  reviewed: string;
  sections: readonly DocSection[];
}

/**
 * A block of code on the developer documentation, shown exactly as written: no markup, no link resolution, never translated.
 * `language` names the fence in the Markdown version.
 */
export type CodeBlock = { code: string; language: "sh" | "js" | "json" };
/** The developer documentation's blocks: the articles' three, plus code. In its text `inline code` in backticks is allowed too. */
export type DevDocBlock = DocBlock | CodeBlock;

export interface DevDocSection {
  title: string;
  blocks: readonly DevDocBlock[];
  /** Generated content shown at the end of the section, after its blocks: the error code table or the endpoint list. */
  slot?: "errors" | "reference";
}

/** The developer documentation (/developers/): one document of the security overview's shape, with code blocks. */
export interface DevelopersContent {
  title: string;
  summary: string;
  /** YYYY-MM-DD: when the statements were last checked against mail's docs/api.md, mcp.md and api-versioning.md. */
  reviewed: string;
  sections: readonly DevDocSection[];
}

/** The page path of an article, without the language prefix. */
export function helpPath(slug: HelpSlug): `/help/${HelpSlug}/` {
  return `/help/${slug}/`;
}
