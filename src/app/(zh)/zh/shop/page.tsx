import { Shop } from "@/storefront/components/Shop";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("zh");

export default function ZhShopPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("zh", "/shop/")} />
      <Shop lang="zh" />
    </StorePage>
  );
}
