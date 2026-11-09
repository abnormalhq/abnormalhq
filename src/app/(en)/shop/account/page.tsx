import { Suspense } from "react";
import { ShopAccount } from "@/storefront/components/ShopAccount";
import { shopPageClass } from "@/storefront/components/ShopParts";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("en", "account");

/** Reads the query string in the browser (useSearchParams), so the prerendered HTML shows the fallback until it hydrates. */
export default function EnAccountPage() {
  return (
    <StorePage>
      <Suspense
        fallback={
          <div className={shopPageClass}>
            <p role="status">Loading your account…</p>
          </div>
        }
      >
        <ShopAccount lang="en" />
      </Suspense>
    </StorePage>
  );
}
