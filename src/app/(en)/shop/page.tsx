import { Shop } from "@/storefront/components/Shop";
import { ShopCatalogPrefetch } from "@/storefront/components/ShopCatalogPrefetch";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { shopMetadata } from "@/storefront/metadata";

export const metadata = shopMetadata("en");

export default function EnShopPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("en", "/shop/")} />
      <ShopCatalogPrefetch lang="en" />
      <Shop lang="en" />
    </StorePage>
  );
}
