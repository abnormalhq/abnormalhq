import { Onboard } from "@/storefront/components/Onboard";
import { JsonLd } from "@/components/ui/json-ld";
import { storeStructuredData } from "@/lib/structured-data";
import { StorePage } from "@/storefront/components/StorePage";
import { storeMetadata } from "@/storefront/server";
import { NextIntlClientProvider } from "next-intl";
import { messagesFor } from "@/i18n/messages";

export const metadata = storeMetadata("en", "redeem");

export default function EnRedeemPage() {
  return (
    <StorePage>
      <JsonLd data={storeStructuredData("en", "/redeem/")} />
      <NextIntlClientProvider
        locale="en"
        messages={{ storefront: { redeem: messagesFor("en").storefront.redeem } }}
        timeZone="UTC"
      >
        <Onboard lang="en" />
      </NextIntlClientProvider>
    </StorePage>
  );
}
