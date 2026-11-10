import type { Metadata } from "next";
import { HelpCenter } from "@/components/HelpCenter";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";

const t = copies.en.help;

export const metadata: Metadata = pageMetadata({
  lang: "en",
  path: "/help/",
  title: t.metaTitle,
  description: t.metaDescription,
});

export default function EnHelpPage() {
  return <HelpCenter lang="en" />;
}
