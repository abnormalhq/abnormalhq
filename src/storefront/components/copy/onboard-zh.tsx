"use client";

import type { ReactNode } from "react";
import { zh } from "@/storefront/i18n.zh";
import { OnboardCopyContext } from "./context";

/** Provides the redeem page's copy in Chinese to its client components (see context.tsx). */
export function OnboardCopyZh({ children }: { children: ReactNode }) {
  return <OnboardCopyContext value={zh}>{children}</OnboardCopyContext>;
}
