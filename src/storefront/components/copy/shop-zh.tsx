"use client";

import type { ReactNode } from "react";
import { zh } from "@/storefront/lib/shop-copy.zh";
import { ShopCopyContext } from "./context";

/** Provides the shop copy in Chinese to the shop pages' client components (see context.tsx). */
export function ShopCopyZh({ children }: { children: ReactNode }) {
  return <ShopCopyContext value={zh}>{children}</ShopCopyContext>;
}
