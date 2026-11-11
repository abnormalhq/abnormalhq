/**
 * Sample responses of the shop API, shaped after mail's implementation (src/lib/shop/public.ts, customers.ts, subscriptions.ts and each endpoint's route.ts).
 * The client parser (tests/shop-api.test.ts) and the development mock API (tests/shop-mock.test.ts) are both tested against them, so three sides share one contract.
 * When mail changes a response shape, change this first.
 */

export const ORDER_ID = "abcdefghijklmno";
export const SUBSCRIPTION_ID = "subscription001";

/** GET /api/shop/catalog: both LDC and card payment on. */
export const catalogResponse = {
  available: true,
  payment: { ldc: true, stripe: { currency: "usd" } },
  products: [
    {
      id: "productabcdefgh",
      name: "月付邮箱",
      description: "",
      originalPriceCents: 1000,
      discountPercent: 25,
      priceCents: 750,
      domains: ["abnormal.bid"],
      mailboxCount: 1,
      quotaMb: 1024,
      codeExpiresDays: 30,
      periodDays: 30,
      renewPriceCents: 600,
      fiatPriceMinor: 499,
      enabled: true,
      created: "2026-09-01T00:00:00.000Z",
      updated: "2026-09-01T00:00:00.000Z",
      quotaSupportedByDomain: { "abnormal.bid": true },
    },
  ],
  onboardUrl: "https://onboard.abnormalhq.com/",
  // Always present since mail #221: whether a discount code can be used right now, i.e. whether to offer the field.
  coupons: true,
};

/**
 * GET /api/shop/orders?id=...: a paid card subscription purchase order. `order` is mail's public projection (PUBLIC_ORDER_FIELDS, i.e.
 * publicOrderFields in docs/onboard-contract.json, checked by tests/contract.test.ts), without merchant id, transaction id or internal row id.
 */
export const orderResponse = {
  order: {
    id: ORDER_ID,
    productName: "月付邮箱",
    originalPriceCents: 499,
    discountPercent: 0,
    priceCents: 499,
    domains: ["abnormal.bid"],
    mailboxCount: 1,
    quotaMb: 1024,
    codeExpiresDays: 30,
    kind: "purchase",
    periodDays: 30,
    renewPriceCents: 499,
    subscriptionId: null,
    periods: 1,
    provider: "stripe",
    currency: "usd",
    // An order without a discount code: mail publishes "" and 0.
    couponCode: "",
    couponDiscountCents: 0,
    status: "paid",
    created: "2026-09-22T00:00:00.000Z",
    paidAt: "2026-09-22T00:01:00.000Z",
    quotaSupportedByDomain: { "abnormal.bid": true },
  },
  code: "ABCD-EFGH-JKLM-NPQR",
  codeStatus: "available",
  onboardUrl: "https://onboard.abnormalhq.com/",
  subscription: {
    currentPeriodEnd: "2026-10-22T00:01:00.000Z",
    state: "active",
    renewToken: "signed.renewal.token",
    provider: "stripe",
    autoRenew: true,
  },
};

/** POST /api/shop/renewal: renewal info of an LDC subscription. */
export const renewalResponse = {
  subscriptionId: SUBSCRIPTION_ID,
  productName: "月付邮箱",
  mailboxCount: 1,
  periodDays: 30,
  renewPriceCents: 600,
  currentPeriodEnd: "2026-10-22T00:00:00.000Z",
  state: "grace",
  mailboxes: ["alice@abnormal.bid"],
  maxPeriods: 12,
  hasContactEmail: true,
  provider: "ldc",
  autoRenew: false,
};

/** GET /api/shop/account: one LDC subscription, one card purchase order and one unpaid renewal order. */
export const accountResponse = {
  email: "buyer@example.com",
  hasPassword: false,
  google: { email: "buyer@gmail.com" },
  subscriptions: [
    {
      id: SUBSCRIPTION_ID,
      productName: "月付邮箱",
      state: "active",
      currentPeriodEnd: "2026-10-22T00:00:00.000Z",
      periodDays: 30,
      renewPriceCents: 600,
      mailboxCount: 1,
      mailboxes: ["alice@abnormal.bid"],
      renewToken: "signed.renewal.token",
      provider: "ldc",
      autoRenew: false,
      currency: "",
      fiatRenewMinor: 0,
    },
  ],
  orders: [
    {
      id: ORDER_ID,
      kind: "purchase",
      productName: "月付邮箱",
      priceCents: 499,
      periods: 1,
      periodDays: 30,
      status: "paid",
      provider: "stripe",
      currency: "usd",
      created: "2026-09-22T00:00:00.000Z",
      paidAt: "2026-09-22T00:01:00.000Z",
      code: "ABCD-EFGH-JKLM-NPQR",
      codeStatus: "available",
      // An order without a discount code: "" and 0, as on the order itself.
      couponCode: "",
      couponDiscountCents: 0,
    },
    {
      id: "renewal00000001",
      kind: "renewal",
      productName: "月付邮箱",
      priceCents: 1200,
      periods: 2,
      periodDays: 30,
      status: "pending",
      provider: "ldc",
      currency: "",
      created: "2026-10-20T00:00:00.000Z",
      paidAt: null,
      code: null,
      codeStatus: null,
      couponCode: "",
      couponDiscountCents: 0,
    },
  ],
};
