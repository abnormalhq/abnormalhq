import type { Metadata } from "next";
import { ClaudeConnector } from "@/components/ClaudeConnector";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.zh.claude;

export const metadata: Metadata = pageMetadata({
  lang: "zh",
  path: "/claude/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function ZhClaudePage() {
  return <ClaudeConnector lang="zh" />;
}
