/**
 * The shop copy of both languages, for code that runs on the server or at build time (metadata, Markdown, structured data) and the tests.
 * Client components must not import it, or a page would ship both languages: they take their language's copy from the provider the
 * page renders (useShopCopy in src/storefront/components/copy/context.tsx).
 */
import type { Lang } from "../i18n.ts";
import { en } from "./shop-copy.en.ts";
import { zh, type ShopCopy } from "./shop-copy.zh.ts";
import { describeShopError } from "./shop-error.ts";

export type { ShopCopy };

export const shopCopy: Record<Lang, ShopCopy> = { zh, en };

/** describeShopError with the language's copy looked up here (see shop-error.ts). */
export function shopError(error: unknown, lang: Lang, fallback: { notFound?: string } = {}): string {
  return describeShopError(error, lang, shopCopy[lang], fallback);
}
