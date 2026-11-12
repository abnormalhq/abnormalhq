import type { Metadata } from "next";
import { ClaudeConnector } from "@/components/ClaudeConnector";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.en.claude;

export const metadata: Metadata = pageMetadata({
  lang: "en",
  path: "/claude/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function EnClaudePage() {
  return <ClaudeConnector lang="en" />;
}
