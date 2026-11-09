import { Guide } from "@/storefront/components/Guide";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("zh", "guide");

export default function ZhGuidePage() {
  return (
    <StorePage>
      <Guide lang="zh" />
    </StorePage>
  );
}
