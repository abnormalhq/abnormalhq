import { Shop } from "@/storefront/components/Shop";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("en");

export default function EnShopPage() {
  return (
    <StorePage>
      <Shop lang="en" />
    </StorePage>
  );
}
