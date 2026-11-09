import { Onboard } from "@/storefront/components/Onboard";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("en", "redeem");

export default function EnRedeemPage() {
  return (
    <StorePage>
      <Onboard lang="en" />
    </StorePage>
  );
}
