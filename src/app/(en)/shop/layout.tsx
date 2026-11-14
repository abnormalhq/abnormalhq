import type { ReactNode } from "react";
import { ShopCopyEn } from "@/storefront/components/copy/shop-en";

/** The shop pages' client components read their copy from here, so their bundle carries English only (see copy/context.tsx). */
export default function EnShopLayout({ children }: { children: ReactNode }) {
  return <ShopCopyEn>{children}</ShopCopyEn>;
}
