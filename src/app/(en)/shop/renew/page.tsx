import { Suspense } from "react";
import { ShopRenew } from "@/storefront/components/ShopRenew";
import { shopPageClass } from "@/storefront/components/ShopParts";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("en", "renew");

/** Reads the query string in the browser (useSearchParams), so the prerendered HTML shows the fallback until it hydrates. */
export default function EnRenewPage() {
  return (
    <StorePage>
      <Suspense
        fallback={
          <div className={shopPageClass}>
            <p role="status">Loading renewal…</p>
          </div>
        }
      >
        <ShopRenew lang="en" />
      </Suspense>
    </StorePage>
  );
}
