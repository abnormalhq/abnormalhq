import type { Metadata } from "next";
import { HelpCenter } from "@/components/HelpCenter";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.zh.help;

export const metadata: Metadata = pageMetadata({
  lang: "zh",
  path: "/help/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function ZhHelpPage() {
  return <HelpCenter lang="zh" />;
}
