import { Guide } from "@/storefront/components/Guide";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("en", "guide");

export default function EnGuidePage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("en", "/guide/")} />
      <Guide lang="en" />
    </StorePage>
  );
}
