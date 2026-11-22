import { en as marketingEn } from "./en.ts";
import { zh as marketingZh } from "./zh.ts";
import { storefrontMessages } from "../storefront/content.ts";
import type { Lang } from "../data/site.ts";

export const messages = {
  en: {
    marketing: marketingEn,
    storefront: storefrontMessages.en,
  },
  zh: {
    marketing: marketingZh,
    storefront: storefrontMessages.zh,
  },
} as const;

export function messagesFor(lang: Lang) {
  return messages[lang];
}
