import { Suspense } from "react";
import { ShopRenew } from "@/storefront/components/ShopRenew";
import { shopPageClass } from "@/storefront/components/ShopParts";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("zh", "renew");

/** Reads the query string in the browser (useSearchParams), so the prerendered HTML shows the fallback until it hydrates. */
export default function ZhRenewPage() {
  return (
    <StorePage>
      <Suspense
        fallback={
          <div className={shopPageClass}>
            <p role="status">正在加载续费信息…</p>
          </div>
        }
      >
        <ShopRenew lang="zh" />
      </Suspense>
    </StorePage>
  );
}
