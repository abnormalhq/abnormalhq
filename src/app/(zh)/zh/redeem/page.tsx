import { Onboard } from "@/storefront/components/Onboard";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("zh", "redeem");

export default function ZhRedeemPage() {
  return (
    <StorePage>
      <Onboard lang="zh" />
    </StorePage>
  );
}
