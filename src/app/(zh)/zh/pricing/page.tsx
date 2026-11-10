import type { Metadata } from "next";
import { Pricing } from "@/components/Pricing";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { liveCatalog } from "@/storefront/lib/catalog-live";

const t = copies.zh.pricing;

export const metadata: Metadata = pageMetadata({
  lang: "zh",
  path: "/pricing/",
  title: t.metaTitle,
  description: t.metaDescription,
});

// Prices are read from the shop on every request (src/storefront/lib/catalog-server.ts), so this page is not prerendered:
// a build must never bake in a price.
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  return <Pricing lang="zh" catalog={await liveCatalog("zh")} />;
}
