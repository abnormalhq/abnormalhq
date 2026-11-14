import { Suspense } from "react";
import { ShopOrder } from "@/storefront/components/ShopOrder";
import { ShopPageLoading } from "@/storefront/components/ShopParts";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("en", "orders");

/** Reads the query string in the browser (useSearchParams), so the prerendered HTML shows the fallback until it hydrates. */
export default function EnOrdersPage() {
  return (
    <StorePage>
      <Suspense fallback={<ShopPageLoading>Loading your order…</ShopPageLoading>}>
        <ShopOrder lang="en" />
      </Suspense>
    </StorePage>
  );
}
