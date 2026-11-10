import { legalFrontmatters } from "@/content/legal/frontmatter";
import { legalSources } from "@/content/legal/sources";
import { helpSlugOf } from "@/content/help";
import { helpArticleMarkdown, helpIndexMarkdown, homeMarkdown, legalMarkdown, stripFrontmatter } from "@/lib/markdown";
import { markdownResponse } from "@/lib/markdown-response";
import { pages, type Page } from "@/lib/pages";
import { storeMarkdown, storeMarkdownPaths, type StoreMarkdownPath } from "@/storefront/lib/markdown";

export const dynamic = "force-static";
export const dynamicParams = false;

const slugOf = (page: Page) => page.markdown.split("/").filter(Boolean).slice(1);

// The download page's Markdown includes the release list read at runtime, and the pricing page's the live catalog; they live in their own
// routes (md/download/, md/pricing/ and the same under md/zh/) and are not prerendered here.
const prerendered = pages.filter((page) => page.path !== "/download/" && page.path !== "/pricing/");

export function generateStaticParams() {
  return prerendered.map((page) => ({ slug: slugOf(page) }));
}

const isStorePage = (path: string): path is StoreMarkdownPath => storeMarkdownPaths.some((store) => store === path);

function render({ lang, path }: Page): string {
  if (path === "/") return homeMarkdown(lang);
  if (isStorePage(path)) return storeMarkdown(lang, path);
  if (path === "/help/") return helpIndexMarkdown(lang);
  const article = helpSlugOf(path);
  if (article) return helpArticleMarkdown(lang, article);
  if (path === "/privacy/" || path === "/terms/")
    return legalMarkdown(lang, legalFrontmatters[lang][path], stripFrontmatter(legalSources[lang][path]));
  throw new Error(`the Markdown of ${path} has its own route`);
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const page = prerendered.find((candidate) => slugOf(candidate).join("/") === slug.join("/"));
  if (!page) return new Response(null, { status: 404 });
  return markdownResponse(page, render(page));
}
