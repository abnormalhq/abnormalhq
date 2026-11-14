"use client";

/**
 * The page language's storefront copy for client components. The copy holds functions, so a server component cannot hand it over as props;
 * instead each language has its own small provider (shop-en.tsx, shop-zh.tsx, onboard-en.tsx, onboard-zh.tsx) that imports only that
 * language's module, and the page of that language renders it. The client bundle of a page so carries one language, not both.
 */
import { createContext, use } from "react";
import type { Copy } from "@/storefront/i18n";
import type { ShopCopy } from "@/storefront/lib/shop-copy.zh";

export const ShopCopyContext = createContext<ShopCopy | null>(null);
export const OnboardCopyContext = createContext<Copy | null>(null);

/** The shop copy of the page's language; the shop pages render ShopCopyEn or ShopCopyZh around their content. */
export function useShopCopy(): ShopCopy {
  const t = use(ShopCopyContext);
  if (!t) throw new Error("useShopCopy needs ShopCopyEn or ShopCopyZh above it");
  return t;
}

/** The redeem page's copy of the page's language; the redeem pages render OnboardCopyEn or OnboardCopyZh around it. */
export function useOnboardCopy(): Copy {
  const t = use(OnboardCopyContext);
  if (!t) throw new Error("useOnboardCopy needs OnboardCopyEn or OnboardCopyZh above it");
  return t;
}
