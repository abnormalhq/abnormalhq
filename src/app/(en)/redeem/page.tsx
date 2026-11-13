import { Onboard } from "@/storefront/components/Onboard";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("en", "redeem");

export default function EnRedeemPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("en", "/redeem/")} />
      <Onboard lang="en" />
    </StorePage>
  );
}
