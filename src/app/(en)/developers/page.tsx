import type { Metadata } from "next";
import { DevelopersOverview } from "@/components/DevelopersOverview";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.en.developers;

export const metadata: Metadata = pageMetadata({
  lang: "en",
  path: "/developers/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function EnDevelopersPage() {
  return <DevelopersOverview lang="en" />;
}
