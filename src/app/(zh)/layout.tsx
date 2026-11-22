import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { SiteLayout } from "@/components/SiteLayout";

/** Root layout for the Chinese pages (/zh/). */
export default function ZhLayout({ children }: { children: ReactNode }) {
  setRequestLocale("zh");
  return <SiteLayout lang="zh">{children}</SiteLayout>;
}
