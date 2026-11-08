import type { ReactNode } from "react";
import { SiteLayout } from "@/components/SiteLayout";

/** Root layout for the English pages (/, the default language). */
export default function EnLayout({ children }: { children: ReactNode }) {
  return <SiteLayout lang="en">{children}</SiteLayout>;
}
