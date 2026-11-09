import { Shop } from "@/storefront/components/Shop";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("zh");

export default function ZhShopPage() {
  return (
    <StorePage>
      <Shop lang="zh" />
    </StorePage>
  );
}
