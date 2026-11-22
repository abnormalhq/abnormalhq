import { en as redeemEn } from "./i18n.en.ts";
import { zh as redeemZh } from "./i18n.zh.ts";
import { en as shopEn } from "./lib/shop-copy.en.ts";
import { zh as shopZh } from "./lib/shop-copy.zh.ts";
import type { Lang } from "../data/site.ts";

export const storefrontMessages = {
  en: { redeem: redeemEn, shop: shopEn },
  zh: { redeem: redeemZh, shop: shopZh },
} as const satisfies Record<Lang, { redeem: object; shop: object }>;
