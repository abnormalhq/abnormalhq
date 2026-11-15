import { Shop } from "@/storefront/components/Shop";
import { ShopCatalogPrefetch } from "@/storefront/components/ShopCatalogPrefetch";
import { JsonLd } from "@/components/ui/json-ld";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/server";

export const metadata = shopMetadata("zh");

export default function ZhShopPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("zh", "/shop/")} />
      <ShopCatalogPrefetch lang="zh" />
      <Shop lang="zh" />
    </StorePage>
  );
}
