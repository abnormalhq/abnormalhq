import { Suspense } from "react";
import { ShopOrder } from "@/storefront/components/ShopOrder";
import { shopPageClass } from "@/storefront/components/ShopParts";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("zh", "orders");

/** Reads the query string in the browser (useSearchParams), so the prerendered HTML shows the fallback until it hydrates. */
export default function ZhOrdersPage() {
  return (
    <StorePage>
      <Suspense
        fallback={
          <div className={shopPageClass}>
            <p role="status">正在加载订单…</p>
          </div>
        }
      >
        <ShopOrder lang="zh" />
      </Suspense>
    </StorePage>
  );
}
