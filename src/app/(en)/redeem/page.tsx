import { Onboard } from "@/storefront/components/Onboard";
import { OnboardCopyEn } from "@/storefront/components/copy/onboard-en";
import { JsonLd } from "@/components/JsonLd";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/metadata";

export const metadata = storeMetadata("en", "redeem");

export default function EnRedeemPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("en", "/redeem/")} />
      {/* The form reads its copy from here, so the page ships one language (see copy/context.tsx). */}
      <OnboardCopyEn>
        <Onboard lang="en" />
      </OnboardCopyEn>
    </StorePage>
  );
}
