"use client";

import type { ReactNode } from "react";
import { en } from "@/storefront/lib/shop-copy.en";
import { ShopCopyContext } from "./context";

/** Provides the shop copy in English to the shop pages' client components (see context.tsx). */
export function ShopCopyEn({ children }: { children: ReactNode }) {
  return <ShopCopyContext value={en}>{children}</ShopCopyContext>;
}
