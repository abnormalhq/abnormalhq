"use client";

import { useLocale, useMessages, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { MessageTranslator } from "@/i18n/translation-facade";
import type { Copy, Lang } from "@/storefront/i18n";
import type { ShopCopy } from "@/storefront/lib/shop-copy.types";
import { createOnboardCopyFacade, createShopCopyFacade } from "@/storefront/copy-facade";

export function useShopCopy(): ShopCopy {
  const t = useTranslations("storefront.shop");
  const messages = useMessages() as { storefront: { shop: Record<string, unknown> } };
  return useMemo(
    () => createShopCopyFacade(t as unknown as MessageTranslator, messages.storefront.shop),
    [t, messages],
  );
}

export function useOnboardCopy(): Copy {
  const t = useTranslations("storefront.redeem");
  const locale = useLocale() as Lang;
  const messages = useMessages() as { storefront: { redeem: Record<string, unknown> } };
  return useMemo(
    () => createOnboardCopyFacade(t as unknown as MessageTranslator, messages.storefront.redeem, locale),
    [t, messages, locale],
  );
}
