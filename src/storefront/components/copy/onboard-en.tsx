"use client";

import type { ReactNode } from "react";
import { en } from "@/storefront/i18n.en";
import { OnboardCopyContext } from "./context";

/** Provides the redeem page's copy in English to its client components (see context.tsx). */
export function OnboardCopyEn({ children }: { children: ReactNode }) {
  return <OnboardCopyContext value={en}>{children}</OnboardCopyContext>;
}
