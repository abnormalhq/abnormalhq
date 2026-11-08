import type { Metadata } from "next";
import { Download } from "@/components/Download";
import { copies } from "@/i18n";
import { pageMetadata } from "@/lib/metadata";
import { fetchDesktopReleases } from "@/lib/releases";

const t = copies.en.download;

export const metadata: Metadata = pageMetadata({
  lang: "en",
  path: "/download/",
  title: t.metaTitle,
  description: t.metaDescription,
});

// The release list is read on every request (src/lib/releases.ts), so this page is not prerendered and a new mail release needs no redeploy.
export const dynamic = "force-dynamic";

export default async function DownloadPage() {
  return <Download lang="en" releases={await fetchDesktopReleases()} />;
}
