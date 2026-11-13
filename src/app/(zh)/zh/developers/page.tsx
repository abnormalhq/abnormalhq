import type { Metadata } from "next";
import { DevelopersOverview } from "@/components/DevelopersOverview";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.zh.developers;

export const metadata: Metadata = pageMetadata({
  lang: "zh",
  path: "/developers/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function ZhDevelopersPage() {
  return <DevelopersOverview lang="zh" />;
}
