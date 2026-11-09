import { Guide } from "@/storefront/components/Guide";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("en", "guide");

export default function EnGuidePage() {
  return (
    <StorePage>
      <Guide lang="en" />
    </StorePage>
  );
}
