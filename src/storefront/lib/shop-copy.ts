/**
 * The shop copy facade for server code and tests, formatted from the shared next-intl message sources.
 */
import { createTranslator } from "use-intl/core";
import type { MessageTranslator } from "../../i18n/translation-facade.ts";
import type { Lang } from "../i18n.ts";
import { describeShopError } from "./shop-error.ts";
import { createShopCopyFacade } from "../copy-facade.ts";
import type { ShopCopy } from "./shop-copy.types.ts";
import { storefrontMessages } from "../messages.ts";

export type { ShopCopy };

function shopCopyFor(locale: Lang): ShopCopy {
  const messages = { storefront: storefrontMessages[locale] };
  const translator = createTranslator({
    locale,
    messages,
    namespace: "storefront.shop",
  });
  return createShopCopyFacade(translator as unknown as MessageTranslator, messages.storefront.shop);
}

export const shopCopy: Record<Lang, ShopCopy> = {
  en: shopCopyFor("en"),
  zh: shopCopyFor("zh"),
};

/** describeShopError with the language's copy looked up here (see shop-error.ts). */
export function shopError(error: unknown, lang: Lang, fallback: { notFound?: string } = {}): string {
  return describeShopError(error, lang, shopCopy[lang], fallback);
}
