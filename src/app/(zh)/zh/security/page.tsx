import type { Metadata } from "next";
import { SecurityOverview } from "@/components/SecurityOverview";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.zh.security;

export const metadata: Metadata = pageMetadata({
  lang: "zh",
  path: "/security/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function ZhSecurityPage() {
  return <SecurityOverview lang="zh" />;
}
