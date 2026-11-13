/**
 * Shared by the help center's articles, the security overview, the Claude connector page and the developer documentation
 * (src/content/): their text as Markdown and as plain text.
 * The content uses the storefront copy's two markup forms, **bold** and [text](link), which are already Markdown; only site
 * links need work, since in the content they are relative to the language root (the page resolves them the same way through
 * RichText). Runs in Node as is: the tests, the Markdown routes and the structured data all use it.
 */
import { site, type Lang } from "../data/site.ts";
import { localePath } from "../i18n/paths.ts";
import type { DevDocBlock, DevDocSection } from "../content/help/types.ts";

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const external = (href: string) => /^(https?:|mailto:|#)/.test(href);

/** The language root that site links in the content are relative to: "/" or "/zh/". */
export function docBase(lang: Lang): string {
  return localePath(lang, "/");
}

/** Every link target in a text, as written. */
export function linkTargets(text: string): string[] {
  return [...text.matchAll(LINK)].map((match) => match[2]!);
}

/** Markdown needs full addresses: (shop/account/) becomes (https://abnormalhq.com/zh/shop/account/) on a Chinese page. */
export function withAbsoluteLinks(text: string, lang: Lang): string {
  return text.replace(LINK, (link, label: string, href: string) =>
    external(href) ? link : `[${label}](${site.url}${docBase(lang)}${href})`,
  );
}

/** The text without its markup, for structured data and search: links keep their label, bold and `code` their words. */
export function plainText(text: string): string {
  return text
    .replace(LINK, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Every text of a block, in order. Code is not text: it has no markup, no links and is the same in every language. A command
 * is not prose either: its label is the block's text.
 */
export function blockTexts(block: DevDocBlock): readonly string[] {
  if ("language" in block) return [];
  if ("code" in block) return [block.label];
  if ("p" in block) return [block.p];
  return "ol" in block ? block.ol : block.ul;
}

function blockMarkdown(block: DevDocBlock, lang: Lang): string {
  if ("language" in block) return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
  if ("code" in block) return `${withAbsoluteLinks(block.label, lang)}\n\n\`\`\`sh\n${block.code}\n\`\`\``;
  if ("p" in block) return withAbsoluteLinks(block.p, lang);
  if ("ol" in block) return block.ol.map((item, index) => `${index + 1}. ${withAbsoluteLinks(item, lang)}`).join("\n");
  return block.ul.map((item) => `- ${withAbsoluteLinks(item, lang)}`).join("\n");
}

/** The sections as Markdown parts (second-level headings and their blocks), to join with blank lines. */
export function sectionsMarkdown(sections: readonly DevDocSection[], lang: Lang): string[] {
  return sections.flatMap((section) => [
    `## ${section.title}`,
    ...section.blocks.map((block) => blockMarkdown(block, lang)),
  ]);
}

/** The anchor of a section on its page: sections are numbered, so the anchor does not depend on the language. */
export function sectionId(index: number): string {
  return `section-${index + 1}`;
}
