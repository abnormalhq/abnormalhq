import { Onboard } from "@/storefront/components/Onboard";
import { JsonLd } from "@/components/ui/json-ld";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/server";
import { NextIntlClientProvider } from "next-intl";
import { messagesFor } from "@/i18n/messages";

export const metadata = storeMetadata("zh", "redeem");

export default function ZhRedeemPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("zh", "/redeem/")} />
      <NextIntlClientProvider
        locale="zh"
        messages={{ storefront: { redeem: messagesFor("zh").storefront.redeem } }}
        timeZone="UTC"
      >
        <Onboard lang="zh" />
      </NextIntlClientProvider>
    </StorePage>
  );
}
