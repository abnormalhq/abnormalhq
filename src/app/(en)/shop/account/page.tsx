import { Suspense } from "react";
import { ShopAccount } from "@/storefront/components/ShopAccount";
import { ShopPageLoading } from "@/storefront/components/ShopParts";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/server";

export const metadata = shopMetadata("en", "account");

/** Reads the query string in the browser (useSearchParams), so the prerendered HTML shows the fallback until it hydrates. */
export default function EnAccountPage() {
  return (
    <StorePage>
      <Suspense fallback={<ShopPageLoading>Loading your account…</ShopPageLoading>}>
        <ShopAccount lang="en" />
      </Suspense>
    </StorePage>
  );
}
