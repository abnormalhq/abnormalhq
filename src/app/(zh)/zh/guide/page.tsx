import { Guide } from "@/storefront/components/Guide";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("zh", "guide");

export default function ZhGuidePage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("zh", "/guide/")} />
      <Guide lang="zh" />
    </StorePage>
  );
}
