/**
 * The redeem copy facades for server components and tests, formatted from the shared next-intl message sources.
 */
import { createTranslator } from "use-intl/core";
import type { Copy, Lang } from "./i18n.ts";
import { createOnboardCopyFacade } from "./copy-facade.ts";
import type { MessageTranslator } from "../i18n/translation-facade.ts";
import { storefrontMessages } from "./messages.ts";

function copyFor(locale: Lang): Copy {
  const messages = { storefront: storefrontMessages[locale] };
  const translator = createTranslator({
    locale,
    messages,
    namespace: "storefront.redeem",
  });
  return createOnboardCopyFacade(translator as unknown as MessageTranslator, messages.storefront.redeem, locale);
}

export const copy: Record<Lang, Copy> = {
  en: copyFor("en"),
  zh: copyFor("zh"),
};
