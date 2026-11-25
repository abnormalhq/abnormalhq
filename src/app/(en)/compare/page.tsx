import type { Metadata } from "next";
import { Compare } from "@/components/Compare";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { liveCatalog } from "@/storefront/server";

const t = copies.en.compare;

export const metadata: Metadata = pageMetadata({
  lang: "en",
  path: "/compare/",
  title: t.metaTitle,
  description: t.metaDescription,
});

// Abnormal Mail's storage, trial and own domains are read from the shop on every request, as on the pricing page: a build must
// never bake in what the shop sells.
export const dynamic = "force-dynamic";

export default async function EnComparePage() {
  return <Compare lang="en" catalog={await liveCatalog("en")} />;
}
