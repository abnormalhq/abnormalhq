import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { SiteLayout } from "@/components/SiteLayout";

/** Root layout for the English pages (/, the default language). */
export default function EnLayout({ children }: { children: ReactNode }) {
  setRequestLocale("en");
  return <SiteLayout lang="en">{children}</SiteLayout>;
}
