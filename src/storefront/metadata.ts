import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { copy, type Lang } from "./i18n";
import { shopCopy } from "./lib/shop-copy";

/** The redeem page and the guide: title and description from the storefront copy, the rest (hreflang, social cards) as every page of the site. */
export function storeMetadata(lang: Lang, page: "redeem" | "guide"): Metadata {
  const t = copy[lang];
  return page === "guide"
    ? pageMetadata({ lang, path: "/guide/", title: t.guide.title, description: t.guide.description })
    : pageMetadata({ lang, path: "/redeem/", title: t.title, description: t.description });
}

export function shopMetadata(lang: Lang, page: "shop" | "orders" | "renew" | "account" = "shop"): Metadata {
  const t = shopCopy[lang];
  const label = { shop: t.nav, orders: t.orderLabel, renew: t.renewEyebrow, account: t.accountEyebrow }[page];
  return {
    // The order, renewal and account pages depend on a purchase or login session: noindex, and no Markdown version.
    ...pageMetadata({
      lang,
      path: page === "shop" ? "/shop/" : `/shop/${page}/`,
      title: `${label} · Abnormal`,
      description: t.description,
      index: page === "shop",
    }),
    referrer: "same-origin",
  };
}
