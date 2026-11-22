import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { messagesFor } from "@/i18n/messages";

export default function ZhShopLayout({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="zh"
      messages={{ storefront: { shop: messagesFor("zh").storefront.shop } }}
      timeZone="UTC"
    >
      {children}
    </NextIntlClientProvider>
  );
}
