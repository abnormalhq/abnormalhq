/**
 * A catalog as GET /api/shop/catalog answers it (mail's getPublicShop), already through the client's parser: a discounted one-time plan
 * sold for LDC only, and a subscription that can also be bought by card and renews for less than its first period.
 */
import type { ShopCatalog } from "../../src/storefront/lib/catalog.ts";

export const catalog: ShopCatalog = {
  available: true,
  payment: { ldc: true, stripe: { currency: "usd" } },
  products: [
    {
      id: "planonetimeabcd",
      name: "Solo",
      description: "One mailbox, paid once.",
      originalPriceCents: 1000,
      discountPercent: 25,
      priceCents: 750,
      mailboxCount: 1,
      quotaMb: 1024,
      quotaSupportedByDomain: { "abnormalhq.com": true },
      codeExpiresDays: 30,
      domains: ["abnormalhq.com"],
      periodDays: 0,
      renewPriceCents: 0,
    },
    {
      id: "planmonthlyabcd",
      name: "Team | Monthly",
      description: "",
      originalPriceCents: 500,
      discountPercent: 0,
      priceCents: 500,
      mailboxCount: 5,
      quotaMb: 2560,
      quotaSupportedByDomain: { "abnormalhq.com": true, "abnormal.bid": true },
      codeExpiresDays: 0,
      domains: ["abnormalhq.com", "abnormal.bid"],
      periodDays: 30,
      renewPriceCents: 400,
      fiatPriceMinor: 299,
    },
  ],
  onboardUrl: "https://abnormalhq.com/",
  addressCheck: true,
};
