import type { Metadata } from "next";
import { SecurityOverview } from "@/components/SecurityOverview";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.en.security;

export const metadata: Metadata = pageMetadata({
  lang: "en",
  path: "/security/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function EnSecurityPage() {
  return <SecurityOverview lang="en" />;
}
