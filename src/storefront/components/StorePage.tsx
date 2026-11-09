import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/**
 * The page column of the storefront pages (redeem, guide, shop, orders, renewal, account), inside the site's own <main>.
 * The registry Container still uses the wider margin step at 800px and 600px; the storefront narrows from those widths on, as onboard did.
 */
export function StorePage({ children }: { children: ReactNode }) {
  return (
    <Container className="pb-20 max-tablet:w-[calc(100%-48px)] max-tablet:pb-16 max-narrow:w-[calc(100%-32px)]">
      {children}
    </Container>
  );
}
