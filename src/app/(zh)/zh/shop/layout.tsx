import type { ReactNode } from "react";
import { ShopCopyZh } from "@/storefront/components/copy/shop-zh";

/** The shop pages' client components read their copy from here, so their bundle carries Chinese only (see copy/context.tsx). */
export default function ZhShopLayout({ children }: { children: ReactNode }) {
  return <ShopCopyZh>{children}</ShopCopyZh>;
}
