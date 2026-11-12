import { markdownResponse } from "@/lib/markdown-response";
import { isPrerendered, pageMarkdown } from "@/lib/page-markdown";
import { pages, type Page } from "@/lib/pages";

export const dynamic = "force-static";
export const dynamicParams = false;

const slugOf = (page: Page) => page.markdown.split("/").filter(Boolean).slice(1);

// The download page's Markdown includes the release list read at runtime, and the pricing page's the live catalog; they live in their own
// routes (md/download/, md/pricing/ and the same under md/zh/) and are not prerendered here.
const prerendered = pages.filter(isPrerendered);

export function generateStaticParams() {
  return prerendered.map((page) => ({ slug: slugOf(page) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const page = prerendered.find((candidate) => slugOf(candidate).join("/") === slug.join("/"));
  if (!page) return new Response(null, { status: 404 });
  return markdownResponse(page, pageMarkdown(page));
}
