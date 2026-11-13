import { Onboard } from "@/storefront/components/Onboard";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("zh", "redeem");

export default function ZhRedeemPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("zh", "/redeem/")} />
      <Onboard lang="zh" />
    </StorePage>
  );
}
