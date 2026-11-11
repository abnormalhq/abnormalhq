/**
 * A catalog as GET /api/shop/catalog answers it (mail's getPublicShop), already through the client's parser: a discounted one-time plan
 * sold for LDC only, and a subscription that can also be bought by card and renews for less than its first period.
 */
import type { SeatProduct, ShopCatalog } from "../../src/storefront/lib/catalog.ts";

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

/**
 * A plan sold per mailbox, as mail lists it under `seatProducts`: every price is for one seat (3.33 LDC at 10% off, the example of
 * mail's docs/shop.md; 1.99 USD by card), bought 2 to 50 at a time, and its buyer may connect two domains of their own.
 */
export const seatPlan: SeatProduct = {
  id: "planseatsabcdef",
  name: "Team seats",
  description: "Mailboxes for a team.",
  originalPriceCents: 333,
  discountPercent: 10,
  priceCents: 300,
  mailboxCount: 2,
  quotaMb: 2048,
  quotaSupportedByDomain: { "abnormalhq.com": true },
  codeExpiresDays: 30,
  domains: ["abnormalhq.com"],
  periodDays: 30,
  renewPriceCents: 0,
  fiatPriceMinor: 199,
  customDomains: 2,
  minQuantity: 2,
  maxQuantity: 50,
  unitOriginalPriceCents: 333,
  unitPriceCents: 300,
  unitRenewPriceCents: 300,
  unitFiatPriceMinor: 199,
};

/** The same catalog with the seat plan on sale. */
export const seatCatalog: ShopCatalog = { ...catalog, seatProducts: [seatPlan] };
