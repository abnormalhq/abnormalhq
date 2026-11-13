import { llmsFullTxt } from "@/lib/markdown";
import { pageMarkdown } from "@/lib/page-markdown";
import { fetchDesktopReleases } from "@/lib/releases";
import { liveCatalog } from "@/storefront/lib/catalog-live";

// It carries the pricing and download pages, which read the catalog and the release list on every request, so it is not prerendered either.
export const dynamic = "force-dynamic";

export async function GET() {
  const [en, zh, releases] = await Promise.all([liveCatalog("en"), liveCatalog("zh"), fetchDesktopReleases()]);
  const live = { catalogs: { en, zh }, releases };
  return new Response(
    llmsFullTxt((page) => pageMarkdown(page, live)),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
