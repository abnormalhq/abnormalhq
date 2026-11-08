import type { ReactNode } from "react";
import { SiteLayout } from "@/components/SiteLayout";

/** Root layout for the Chinese pages (/zh/). */
export default function ZhLayout({ children }: { children: ReactNode }) {
  return <SiteLayout lang="zh">{children}</SiteLayout>;
}
