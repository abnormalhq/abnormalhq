import { Suspense } from "react";
import { ShopAccount } from "@/storefront/components/ShopAccount";
import { shopPageClass } from "@/storefront/components/ShopParts";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("zh", "account");

/** Reads the query string in the browser (useSearchParams), so the prerendered HTML shows the fallback until it hydrates. */
export default function ZhAccountPage() {
  return (
    <StorePage>
      <Suspense
        fallback={
          <div className={shopPageClass}>
            <p role="status">正在加载账户…</p>
          </div>
        }
      >
        <ShopAccount lang="zh" />
      </Suspense>
    </StorePage>
  );
}
