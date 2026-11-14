import { Onboard } from "@/storefront/components/Onboard";
import { OnboardCopyZh } from "@/storefront/components/copy/onboard-zh";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("zh", "redeem");

export default function ZhRedeemPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("zh", "/redeem/")} />
      {/* The form reads its copy from here, so the page ships one language (see copy/context.tsx). */}
      <OnboardCopyZh>
        <Onboard lang="zh" />
      </OnboardCopyZh>
    </StorePage>
  );
}
