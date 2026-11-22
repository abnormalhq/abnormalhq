import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { messagesFor } from "@/i18n/messages";

export default function EnShopLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ storefront: { shop: messagesFor("en").storefront.shop } }}
      timeZone="UTC"
    >
      {children}
    </NextIntlClientProvider>
  );
}
