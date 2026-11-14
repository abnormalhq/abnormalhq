/**
 * USDT (TRC-20) on TRON, the third way of paying (`shop.usdt` in docs/onboard-contract.json; "USDT payments" in
 * docs/storefront-api.md): the catalog's `payment.usdt` and USDT prices, the request builders, quotes and code previews in
 * hundredths of a USDT, the pay/usdt client, the dev mock's simulated chain and the Worker's route.
 */
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import {
  createRenewalOrder,
  createShopOrder,
  currencyFits,
  formatAmount,
  formatUsdt,
  getAccountMailboxes,
  getRenewal,
  getShopCatalog,
  getShopOrder,
  parseShopCatalog,
  PAYMENT_PROVIDERS,
  previewCoupon,
  previewCoupons,
  quoteSeats,
  seatTotals,
  seatUsdtPrice,
  ShopApiError,
  startUsdtPayment,
  USDT_CURRENCY,
  usdtDecimal,
  usdtUnits,
} from "@/storefront/lib/shop";
import { TRON_ADDRESS, USDT_NETWORKS } from "@/storefront/lib/catalog";
import { orderCoupon } from "@/storefront/lib/coupon";
import { parsePurchaseQuote, quotePurchase, type QuoteAsk } from "@/storefront/lib/quote";
import { shopCopy } from "@/storefront/lib/shop-copy";
import {
  MOCK_USDT_ADDRESS,
  MOCK_USDT_CONTRACT,
  MOCK_USDT_PRICES,
  MOCK_USDT_SEEN_AT,
  MockShopStore,
  SEAT_PRODUCT,
} from "@/storefront/mock/shop";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import { SHOP_ROUTES, USDT_ROUTE } from "@/storefront/worker/shop";
import { USDT_POLL_LIMIT_MS, USDT_POLL_MS } from "@/storefront/components/ShopUsdtCheckout";
import { catalogResponse, usdtCatalogPayment, usdtPayResponse } from "./fixtures/shop-contract";

const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
  shop: {
    providers: string[];
    seats: { maxTotalCentsUnit: Record<string, string> };
    usdt: {
      routes: Record<string, string[]>;
      currency: string;
      networks: string[];
      catalogFields: string[];
      productFields: string[];
      seatPlanFields: string[];
      payStatuses: string[];
      payFields: string[];
    };
  };
};

const ORDER_ID = "abcdefghijklmno";
const PLAN = "productabcdefgh";

function respond(body: unknown, status = 200, headers: HeadersInit = {}) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return Response.json(body, { status, headers });
  });
  return calls;
}

/* ---- The contract ---- */

test("contract: USDT is the third way of paying, with its route, currency, networks and the fields the client reads", async () => {
  expect([...PAYMENT_PROVIDERS]).toStrictEqual(contract.shop.providers);
  expect(contract.shop.providers).toContain("usdt");
  expect(Object.keys(contract.shop.seats.maxTotalCentsUnit)).toStrictEqual(contract.shop.providers);
  expect(contract.shop.usdt.routes).toStrictEqual({ [USDT_ROUTE]: ["POST"] });
  expect(SHOP_ROUTES[USDT_ROUTE]).toStrictEqual(["POST"]);
  expect(USDT_CURRENCY).toBe(contract.shop.usdt.currency);
  expect([...USDT_NETWORKS]).toStrictEqual(contract.shop.usdt.networks);

  // The catalog's payment.usdt, a plan's and a seat plan's USDT price: every field mail lists is on the parsed catalog.
  const seat = { ...catalogResponse.products[0], id: "seatplanabcdefg", kind: "seat", seatMin: 2, seatMax: 50 };
  const catalog = parseShopCatalog({
    ...catalogResponse,
    payment: { ...catalogResponse.payment, usdt: usdtCatalogPayment },
    products: [{ ...catalogResponse.products[0], usdtPriceMinor: 120 }],
    seatProducts: [{ ...seat, usdtPriceMinor: 60, unitUsdtPriceMinor: 60 }],
  });
  expect(Object.keys(catalog.payment.usdt!).toSorted()).toStrictEqual(contract.shop.usdt.catalogFields.toSorted());
  for (const field of contract.shop.usdt.productFields) expect(catalog.products[0]).toHaveProperty(field, 120);
  for (const field of contract.shop.usdt.seatPlanFields) expect(catalog.seatProducts![0]).toHaveProperty(field, 60);

  // pay/usdt: the statuses and, for an open order, exactly the fields mail lists.
  expect(contract.shop.usdt.payStatuses).toStrictEqual(["open", "paid"]);
  expect(Object.keys(usdtPayResponse).toSorted()).toStrictEqual(contract.shop.usdt.payFields.toSorted());
  respond(usdtPayResponse);
  const open = await startUsdtPayment(ORDER_ID);
  expect(Object.keys(open).toSorted()).toStrictEqual(contract.shop.usdt.payFields.toSorted());
});

/* ---- The catalog ---- */

test("catalog: payment.usdt is read when usable, and is absent when off, missing or not usable; LDC and card stay as they were", () => {
  const read = (usdt: unknown) =>
    parseShopCatalog({ ...catalogResponse, payment: { ...catalogResponse.payment, usdt } }).payment;
  expect(read(usdtCatalogPayment)).toStrictEqual({
    ldc: true,
    stripe: { currency: "usd" },
    usdt: { currency: "usdt", network: "nile", contract: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf" },
  });
  expect(read({ ...usdtCatalogPayment, network: "mainnet" }).usdt?.network).toBe("mainnet");
  // A mail before USDT (no key), USDT switched off (null), and anything the page could not show: off, and not there at all.
  for (const usdt of [
    undefined,
    null,
    {},
    { ...usdtCatalogPayment, currency: "usd" },
    { ...usdtCatalogPayment, network: "shasta" },
    { ...usdtCatalogPayment, contract: "0x55d398326f99059fF775485246999027B3197955" },
    { ...usdtCatalogPayment, contract: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeB0" },
    { ...usdtCatalogPayment, contract: undefined },
    "usdt",
  ]) {
    expect(read(usdt), JSON.stringify(usdt)).toStrictEqual({ ldc: true, stripe: { currency: "usd" } });
  }
  // "usdt" is no card currency: a card that says it counts as off, as any unusable card currency does.
  expect(
    parseShopCatalog({ ...catalogResponse, payment: { ldc: true, stripe: { currency: "usdt" } } }).payment,
  ).toStrictEqual({ ldc: true, stripe: null });
});

test("catalog: a plan's usdtPriceMinor and a seat plan's unitUsdtPriceMinor, with the fallback a card price has, absent before USDT", () => {
  const [plan] = catalogResponse.products;
  const fixed = (patch: object) =>
    parseShopCatalog({ ...catalogResponse, products: [{ ...plan, ...patch }] }).products[0]!;
  expect(fixed({ usdtPriceMinor: 120 }).usdtPriceMinor).toBe(120);
  // 0 says "not with USDT" and is kept as mail sent it; a mail before USDT sends nothing, and the plan has no such field.
  expect(fixed({ usdtPriceMinor: 0 }).usdtPriceMinor).toBe(0);
  expect(fixed({})).not.toHaveProperty("usdtPriceMinor");
  for (const usdtPriceMinor of [-1, 1.5, "120", null]) {
    expect(() => fixed({ usdtPriceMinor }), String(usdtPriceMinor)).toThrow(ShopApiError);
  }

  const seat = { ...plan, id: "seatplanabcdefg", planKind: "seats", minQuantity: 2, maxQuantity: 50 };
  const seats = (patch: object) =>
    parseShopCatalog({ ...catalogResponse, seatProducts: [{ ...seat, ...patch }] }).seatProducts![0]!;
  // The explicit field wins and is what the plan's own field says too; without it the plan's usdtPriceMinor is one seat's.
  expect(seats({ usdtPriceMinor: 70, unitUsdtPriceMinor: 60 })).toMatchObject({
    usdtPriceMinor: 60,
    unitUsdtPriceMinor: 60,
  });
  expect(seats({ usdtPriceMinor: 70 })).toMatchObject({ usdtPriceMinor: 70, unitUsdtPriceMinor: 70 });
  expect(seats({ unitUsdtPriceMinor: 65 })).toMatchObject({ usdtPriceMinor: 65, unitUsdtPriceMinor: 65 });
  const before = seats({});
  expect(before).not.toHaveProperty("usdtPriceMinor");
  expect(before).not.toHaveProperty("unitUsdtPriceMinor");
  expect(() => seats({ unitUsdtPriceMinor: 1.5 })).toThrow(ShopApiError);
});

test("seat totals: quantity × one seat's USDT price, judged on its own like the card's, an estimate the quote replaces", () => {
  expect(seatUsdtPrice({ unitUsdtPriceMinor: 60 }, 7)).toBe(420);
  expect(seatUsdtPrice({ usdtPriceMinor: 60 }, 7)).toBe(420);
  expect(seatUsdtPrice({ unitUsdtPriceMinor: 0 }, 7)).toBeNull();
  expect(seatUsdtPrice({}, 7)).toBeNull();
  expect(seatUsdtPrice({ unitUsdtPriceMinor: 60 }, 0)).toBeNull();
  expect(seatUsdtPrice({ unitUsdtPriceMinor: 60 }, 7, 400)).toBeNull();

  // 1,500.00 LDC a seat is too many at 700; 0.60 USDT a seat is not: only LDC is closed.
  const plan = { originalPriceCents: 150_000, discountPercent: 0, fiatPriceMinor: 0, unitUsdtPriceMinor: 60 };
  expect(seatTotals(plan, 700, { ldc: true, card: false, usdt: true })).toStrictEqual({
    ldc: null,
    card: null,
    usdt: 42_000,
    ldcTooMany: true,
    cardTooMany: false,
    usdtTooMany: false,
    tooMany: false,
  });
  expect(seatTotals(plan, 700, { ldc: true, card: false, usdt: true }, 40_000)).toMatchObject({
    usdtTooMany: true,
    tooMany: true,
  });
});

/* ---- Money ---- */

test("money: USDT amounts read 12.34 USDT in every language, and each way of paying is written in its own unit", () => {
  expect(formatUsdt(1234)).toBe("12.34 USDT");
  expect(formatUsdt(5)).toBe("0.05 USDT");
  for (const lang of ["zh", "en"] as const) expect(formatAmount(1234, "usdt", "usdt", lang)).toBe("12.34 USDT");
  // LDC and card exactly as before.
  expect(formatAmount(750, "ldc", "")).toBe("7.50 LDC");
  expect(formatAmount(750, undefined, undefined)).toBe("7.50 LDC");
  expect(formatAmount(499, "stripe", "usd", "en")).toBe("$4.99");
  expect(formatAmount(499, "stripe", "", "en")).toBe("");

  // Each way of paying counts in its own unit, and an amount in another one is not shown.
  expect(currencyFits("ldc", "")).toBe(true);
  expect(currencyFits("stripe", "usd")).toBe(true);
  expect(currencyFits("usdt", "usdt")).toBe(true);
  for (const [provider, currency] of [
    ["ldc", "usdt"],
    ["ldc", "usd"],
    ["stripe", ""],
    ["stripe", "usdt"],
    ["usdt", ""],
    ["usdt", "usd"],
    ["usdt", "USDT"],
  ] as const) {
    expect(currencyFits(provider, currency), `${provider} ${currency}`).toBe(false);
  }

  // The chain's amounts, exact to the token's six decimals.
  expect(usdtUnits("12.34")).toBe(12_340_000);
  expect(usdtUnits("0.000001")).toBe(1);
  expect(usdtUnits("7")).toBe(7_000_000);
  for (const bad of ["", "-1", "1.2345678", "1e3", "01.00", ".5", "12.34 ", 12.34, null]) {
    expect(usdtUnits(bad), String(bad)).toBeNull();
  }
  expect(usdtDecimal(12_340_000)).toBe("12.34");
  expect(usdtDecimal(1)).toBe("0.000001");
  expect(usdtDecimal(5_500_000)).toBe("5.50");
  expect(usdtDecimal(0)).toBe("0.00");
});

/* ---- Request builders ---- */

test("request builders: provider usdt is sent wherever it is not LDC, for checkout, the code previews, renewal and the quote", async () => {
  let calls = respond({ orderId: ORDER_ID }, 201);
  await createShopOrder(PLAN, "en", "", "usdt", "WELCOME", 7);
  expect(calls[0]!.body).toStrictEqual({ productId: PLAN, provider: "usdt", coupon: "WELCOME", quantity: 7 });

  calls = respond({ orderId: ORDER_ID }, 201);
  await createRenewalOrder("signed-token", 2, "en", "", "usdt");
  expect(calls[0]!.body).toStrictEqual({ token: "signed-token", periods: 2, provider: "usdt" });
  // LDC still sends no provider at all.
  await createRenewalOrder("signed-token", 2, "en");
  expect(calls[1]!.body).toStrictEqual({ token: "signed-token", periods: 2 });

  const couponQuote = {
    code: "WELCOME",
    provider: "usdt",
    currency: "usdt",
    basePriceCents: 120,
    discountCents: 24,
    priceCents: 96,
    firstPeriodOnly: true,
  };
  calls = respond({ valid: true, ...couponQuote });
  expect(await previewCoupon(PLAN, "usdt", "welcome")).toStrictEqual(couponQuote);
  expect(calls[0]!.body).toStrictEqual({ productId: PLAN, provider: "usdt", coupon: "welcome" });

  calls = respond({ quotes: [null, { productId: PLAN, ...couponQuote }] });
  expect(
    await previewCoupons(
      [
        { productId: PLAN, provider: "ldc" },
        { productId: PLAN, provider: "usdt" },
      ],
      "welcome",
    ),
  ).toStrictEqual([null, couponQuote]);
  expect(calls[0]!.body).toStrictEqual({
    products: [{ productId: PLAN }, { productId: PLAN, provider: "usdt" }],
    coupon: "welcome",
  });

  calls = respond({ error: "x" }, 500);
  await quotePurchase({ productId: PLAN, providers: ["ldc", "stripe", "usdt"], quantity: 0 }).catch(() => null);
  expect(calls[0]!.body).toStrictEqual({ productId: PLAN, providers: ["ldc", "stripe", "usdt"] });
});

test("coupon preview: a USDT quote must be in USDT; an answer in another unit, or for another way of paying, fails", async () => {
  const quote = {
    valid: true,
    code: "WELCOME",
    provider: "usdt",
    currency: "usdt",
    basePriceCents: 120,
    discountCents: 24,
    priceCents: 96,
    firstPeriodOnly: false,
  };
  for (const patch of [{ currency: "" }, { currency: "usd" }, { provider: "stripe" }, { provider: "ldc" }]) {
    respond({ ...quote, ...patch });
    await expect(previewCoupon(PLAN, "usdt", "WELCOME"), JSON.stringify(patch)).rejects.toBeInstanceOf(ShopApiError);
  }
  // A card quote that says "usdt" is no card quote either.
  respond({ ...quote, provider: "stripe" });
  await expect(previewCoupon(PLAN, "stripe", "WELCOME")).rejects.toBeInstanceOf(ShopApiError);
  // A fixed amount never applies to USDT: mail answers that the code can't be used, and the page says so in both languages.
  respond({ valid: false });
  expect(await previewCoupon(PLAN, "usdt", "LDC1")).toBeNull();
  for (const lang of ["zh", "en"] as const) expect(shopCopy[lang].couponNotForUsdt).toMatch(/USDT/);
});

test("order coupon: a USDT order's code is mail's own, and a remembered one is read like a card order's (no plan discount)", () => {
  const order = {
    id: ORDER_ID,
    priceCents: 96,
    originalPriceCents: 120,
    discountPercent: 0,
    provider: "usdt" as const,
  };
  expect(orderCoupon({ ...order, couponCode: "WELCOME", couponDiscountCents: 24 }, null)).toStrictEqual({
    code: "WELCOME",
    discountCents: 24,
    baseCents: 120,
  });
  expect(orderCoupon(order, { orderId: ORDER_ID, code: "WELCOME", baseCents: 120 })).toStrictEqual({
    code: "WELCOME",
    discountCents: 24,
    baseCents: 120,
  });
});

/* ---- Quotes ---- */

test("quote: a USDT price is read in hundredths of a USDT, without a plan discount; one in another unit fails the quote", () => {
  const ask: QuoteAsk = { productId: PLAN, providers: ["ldc", "usdt"], quantity: 7 };
  const ldc = {
    provider: "ldc",
    available: true,
    currency: "",
    unitOriginalPriceCents: 333,
    unitPriceCents: 300,
    subtotalCents: 2331,
    discountPercent: 10,
    planDiscountCents: 233,
    basePriceCents: 2098,
    coupon: null,
    totalCents: 2098,
    renewPriceCents: 2100,
  };
  const usdt = {
    provider: "usdt",
    available: true,
    currency: "usdt",
    unitOriginalPriceCents: 60,
    unitPriceCents: 60,
    subtotalCents: 420,
    discountPercent: 0,
    planDiscountCents: 0,
    basePriceCents: 420,
    coupon: null,
    totalCents: 420,
    renewPriceCents: 420,
  };
  const body = (entry: object) => ({
    productId: PLAN,
    planKind: "seats",
    quantity: 7,
    minQuantity: 2,
    maxQuantity: 50,
    periodDays: 30,
    prices: [ldc, entry],
  });
  const quoted = parsePurchaseQuote(body(usdt), ask);
  expect(quoted.prices[1]).toMatchObject({ available: true, provider: "usdt", currency: "usdt", totalCents: 420 });
  for (const patch of [{ currency: "" }, { currency: "usd" }, { currency: "USDT" }, { provider: "stripe" }]) {
    expect(() => parsePurchaseQuote(body({ ...usdt, ...patch }), ask), JSON.stringify(patch)).toThrow(ShopApiError);
  }
  // A card price never says "usdt".
  expect(() =>
    parsePurchaseQuote(body({ ...usdt, provider: "stripe" }), { ...ask, providers: ["ldc", "stripe"] }),
  ).toThrow(ShopApiError);
});

/* ---- Seats of a USDT subscription ---- */

test("seats: a USDT seat subscription is quoted exactly in USDT and its seats are read like LDC's", async () => {
  respond({
    add: 2,
    seats: 5,
    provider: "usdt",
    currency: "usdt",
    priceCents: 87,
    exact: true,
    periodEnd: "2026-12-01T00:00:00.000Z",
  });
  expect(await quoteSeats(ORDER_ID, 2)).toMatchObject({
    provider: "usdt",
    currency: "usdt",
    priceCents: 87,
    exact: true,
  });
  for (const currency of ["", "usd"]) {
    respond({ add: 2, seats: 5, provider: "usdt", currency, priceCents: 87, exact: true, periodEnd: "x" });
    await expect(quoteSeats(ORDER_ID, 2), currency).rejects.toBeInstanceOf(ShopApiError);
  }
  const group = (seats: object) => ({
    groups: [
      {
        orderId: ORDER_ID,
        productName: "Team",
        code: "ABCD-EFGH-JKLM-NPQR",
        codeStatus: "available",
        usesLeft: 1,
        mailboxLimit: 3,
        codeExpires: null,
        domains: [],
        locked: false,
        seats,
        mailboxes: [],
      },
    ],
    servers: {},
    webmail: null,
  });
  const seats = {
    seats: 3,
    seatsNext: null,
    min: 2,
    max: 50,
    seatPriceCents: 60,
    provider: "usdt",
    currency: "usdt",
    periodDays: 30,
    periodEnd: "2026-12-01T00:00:00.000Z",
    removing: [],
  };
  respond(group(seats));
  expect((await getAccountMailboxes())!.groups[0]!.seats).toMatchObject({ provider: "usdt", currency: "usdt" });
  respond(group({ ...seats, currency: "" }));
  await expect(getAccountMailboxes()).rejects.toBeInstanceOf(ShopApiError);
});

/* ---- pay/usdt ---- */

test("pay/usdt client: an open order's address and exact amount, paid, and every malformed answer refused", async () => {
  const calls = respond(usdtPayResponse);
  await expect(startUsdtPayment(ORDER_ID, "en")).resolves.toStrictEqual(usdtPayResponse);
  // JSON with the order id only, to this site's own API.
  expect(calls).toStrictEqual([{ url: "/api/shop/pay/usdt", body: { orderId: ORDER_ID } }]);

  respond({ status: "paid" });
  await expect(startUsdtPayment(ORDER_ID)).resolves.toStrictEqual({ status: "paid" });

  // Part of it on chain, more on its way: the decimals as mail writes them (up to six).
  const partial = { ...usdtPayResponse, network: "mainnet", received: "5.000001", confirming: "7.339999" };
  respond(partial);
  await expect(startUsdtPayment(ORDER_ID)).resolves.toStrictEqual(partial);

  // Nothing half-right reaches the page: not the address, the amount or the network the buyer would send to.
  for (const patch of [
    { status: "pending" },
    { status: undefined },
    { network: "shasta" },
    { token: "USDC" },
    { contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { address: "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYd" },
    { address: "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH0" },
    { address: "TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdO" },
    { address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed" },
    { address: "javascript:alert(1)" },
    { address: undefined },
    { amount: "12.3400001" },
    { amount: "-12.34" },
    { amount: "1e1" },
    { amount: 12.34 },
    { amount: "12.35" },
    { amountMinor: 1235 },
    { amountMinor: 0, amount: "0" },
    { amountMinor: "1234" },
    { received: "abc" },
    { received: undefined },
    { confirming: "-1" },
  ]) {
    respond({ ...usdtPayResponse, ...patch });
    await expect(startUsdtPayment(ORDER_ID), JSON.stringify(patch)).rejects.toBeInstanceOf(ShopApiError);
  }
  respond(null);
  await expect(startUsdtPayment(ORDER_ID)).rejects.toBeInstanceOf(ShopApiError);

  // mail's refusals come through with their status, and the rate limit with its wait.
  respond({ error: "Order not found." }, 404);
  await expect(startUsdtPayment(ORDER_ID)).rejects.toMatchObject({ status: 404, message: "Order not found." });
  respond({ error: "This order is not paid with USDT." }, 409);
  await expect(startUsdtPayment(ORDER_ID)).rejects.toMatchObject({ status: 409 });
  respond({ error: "Too many requests." }, 429, { "Retry-After": "30" });
  await expect(startUsdtPayment(ORDER_ID)).rejects.toMatchObject({ status: 429, retryAfter: 30 });
  respond({ error: "USDT is not configured." }, 503);
  await expect(startUsdtPayment(ORDER_ID)).rejects.toMatchObject({ status: 503, answered: true });
});

test("order page: pay/usdt is asked every 5 seconds while visible, for up to two hours, and the copy covers every state", () => {
  expect(USDT_POLL_MS).toBe(5_000);
  expect(USDT_POLL_LIMIT_MS).toBe(2 * 60 * 60 * 1000);
  const panel = readFileSync("src/storefront/components/ShopUsdtCheckout.tsx", "utf8");
  // Only while the tab is shown, and the QR code is the library's matrix drawn as inline SVG of the address alone.
  expect(panel).toMatch(/document\.visibilityState === "visible"/);
  expect(panel).toMatch(/encode\(address, \{/);
  expect(panel).not.toMatch(/dangerouslySetInnerHTML/);
  expect(panel).toMatch(/role="img"/);
  // The order page hands a USDT order to the panel, re-reads the order on `paid`, and leaves its own polling to it.
  const page = readFileSync("src/storefront/components/ShopOrder.tsx", "utf8");
  expect(page).toMatch(/<ShopUsdtCheckout orderId=\{order\.id\}/);
  expect(page).toMatch(/if \(!pending \|\| usdt\) return;/);
  expect(TRON_ADDRESS.test(MOCK_USDT_ADDRESS)).toBe(true);
  for (const lang of ["zh", "en"] as const) {
    const t = shopCopy[lang];
    expect(t.usdtWarning("12.34 USDT")).toContain("12.34 USDT");
    expect(t.usdtWarning("12.34 USDT")).toMatch(/TRC-20/);
    expect(t.usdtPartial("5.00", "12.34", "7.34")).toContain("7.34");
    expect(new Set([t.usdtWaiting, t.usdtConfirming, t.usdtPaid, t.usdtStopped]).size).toBe(4);
    expect(t.usdtTestnet).toMatch(/Nile/);
  }
  expect(shopCopy.en.usdtWarning("12.34 USDT")).toBe(
    "Send USDT on the TRON network (TRC-20) only. Other tokens or networks are lost. Exchanges that deduct a withdrawal fee from the amount: make sure the amount that arrives is at least 12.34 USDT.",
  );
});

/* ---- The dev mock ---- */

const ORIGIN = "http://localhost:4320";
const NOW = Date.parse("2026-11-10T00:00:00.000Z");
const ONE_TIME = "demoproduct0001";
const MONTHLY = "demoproduct0002";

/** Points the client at a store, carrying the purchase cookie the way a browser would. */
function browser(store: MockShopStore) {
  const jar = new Map<string, string>();
  const routes: string[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = String(url).split("/api/shop/")[1]!;
    const route = path.split("?")[0]!;
    routes.push(route);
    const headers = new Headers(init?.headers);
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    if (cookie) headers.set("Cookie", cookie);
    if (init?.body !== undefined) headers.set("Origin", ORIGIN);
    const response = await store.fetch(
      route,
      new Request(`${ORIGIN}/api/shop/${path}`, { method: init?.method ?? "GET", headers, body: init?.body }),
    );
    for (const line of response.headers.getSetCookie()) {
      const [name, value] = line.split(";")[0]!.split("=");
      if (value) jar.set(name!, value);
    }
    return response;
  });
  return routes;
}

test("dev shop: USDT prices in the catalog, a USDT order, and pay/usdt seeing then confirming the transfer before the code appears", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MockShopStore(() => NOW);
  const routes = browser(store);
  const catalog = await getShopCatalog(undefined, "en");
  expect(catalog.payment.usdt).toStrictEqual({ currency: "usdt", network: "nile", contract: MOCK_USDT_CONTRACT });
  expect(catalog.products.map((product) => product.usdtPriceMinor)).toStrictEqual([
    MOCK_USDT_PRICES[ONE_TIME],
    MOCK_USDT_PRICES[MONTHLY],
  ]);
  expect(catalog.seatProducts![0]).toMatchObject({
    usdtPriceMinor: MOCK_USDT_PRICES[SEAT_PRODUCT.id],
    unitUsdtPriceMinor: MOCK_USDT_PRICES[SEAT_PRODUCT.id],
  });

  // The quote prices USDT next to LDC and card, in its own unit and without the plan's discount.
  const quoted = await quotePurchase({ productId: SEAT_PRODUCT.id, providers: ["ldc", "stripe", "usdt"], quantity: 7 });
  expect(quoted.prices[2]).toMatchObject({ provider: "usdt", currency: "usdt", totalCents: 420, discountPercent: 0 });
  expect(seatTotals(catalog.seatProducts![0]!, 7, { ldc: true, card: true, usdt: true }).usdt).toBe(420);

  // Checkout with USDT: a USDT order at the plan's USDT price.
  const id = await createShopOrder(ONE_TIME, "en", "", "usdt");
  const placed = await getShopOrder(id);
  expect(placed.order).toMatchObject({
    provider: "usdt",
    currency: "usdt",
    priceCents: 150,
    originalPriceCents: 150,
    discountPercent: 0,
    status: "pending",
  });
  expect(placed.code).toBeNull();

  // The first looks find nothing, the third the transfer on its way, the fourth confirms it.
  const looks = [];
  for (let look = 1; look <= MOCK_USDT_SEEN_AT; look += 1) looks.push(await startUsdtPayment(id, "en"));
  expect(looks.map((look) => (look.status === "open" ? look.confirming : look.status))).toStrictEqual([
    "0.00",
    "0.00",
    "1.50",
  ]);
  expect(looks[0]).toStrictEqual({
    status: "open",
    network: "nile",
    token: "USDT",
    contract: MOCK_USDT_CONTRACT,
    address: MOCK_USDT_ADDRESS,
    amount: "1.50",
    amountMinor: 150,
    received: "0.00",
    confirming: "0.00",
  });
  expect(await startUsdtPayment(id, "en")).toStrictEqual({ status: "paid" });
  // The order page then reads the order again: paid, with its code, as for any other way of paying.
  const paid = await getShopOrder(id);
  expect([paid.order.status, paid.code]).toStrictEqual(["paid", "ABCD-EFGH-JKLM-NPQR"]);
  expect(await startUsdtPayment(id, "en")).toStrictEqual({ status: "paid" });
  expect(routes.filter((route) => route === "pay/usdt")).toHaveLength(MOCK_USDT_SEEN_AT + 2);

  // An order of another way of paying is no USDT order.
  const ldc = await createShopOrder(ONE_TIME, "en");
  await expect(startUsdtPayment(ldc, "en")).rejects.toMatchObject({ status: 409 });
});

test("dev shop: codes and USDT: a percentage applies, a fixed amount never does", async () => {
  const store = new MockShopStore(() => NOW);
  browser(store);
  const welcome = await previewCoupon(MONTHLY, "usdt", "WELCOME", undefined, "en");
  expect(welcome).toStrictEqual({
    code: "WELCOME",
    provider: "usdt",
    currency: "usdt",
    basePriceCents: 80,
    discountCents: 16,
    priceCents: 64,
    firstPeriodOnly: true,
  });
  expect(await previewCoupon(MONTHLY, "usdt", "LDC1", undefined, "en")).toBeNull();
  // Checkout with the code: the order carries it, and pay/usdt asks for the price after it.
  const id = await createShopOrder(MONTHLY, "en", "", "usdt", "WELCOME");
  expect((await getShopOrder(id)).order).toMatchObject({
    priceCents: 64,
    couponCode: "WELCOME",
    couponDiscountCents: 16,
  });
  expect(await startUsdtPayment(id, "en")).toMatchObject({ amount: "0.64", amountMinor: 64 });
});

test("dev shop: a subscription bought with USDT renews with USDT only, and its renewal is paid like a purchase", async () => {
  const store = new MockShopStore(() => NOW);
  browser(store);
  const id = await createShopOrder(MONTHLY, "en", "", "usdt");
  for (let look = 0; look <= MOCK_USDT_SEEN_AT; look += 1) await startUsdtPayment(id, "en");
  const { subscription } = await getShopOrder(id);
  expect(subscription).toMatchObject({ provider: "usdt", renewToken: `demo-${id}` });
  const renewal = await getRenewal(subscription!.renewToken!, undefined, "en");
  expect(renewal).toMatchObject({ provider: "usdt", currency: "usdt", renewPriceCents: 80, maxPeriods: 12 });
  // Not with LDC (nor by card): mail refuses; with USDT, a renewal order in USDT.
  await expect(createRenewalOrder(subscription!.renewToken!, 2, "en")).rejects.toMatchObject({ status: 409 });
  const renewalId = await createRenewalOrder(subscription!.renewToken!, 2, "en", "", "usdt");
  expect((await getShopOrder(renewalId)).order).toMatchObject({
    kind: "renewal",
    provider: "usdt",
    currency: "usdt",
    priceCents: 160,
  });
  expect(await startUsdtPayment(renewalId, "en")).toMatchObject({ amount: "1.60", amountMinor: 160 });
  // An LDC subscription is never renewed with USDT.
  const ldc = await createShopOrder(MONTHLY, "en");
  // The demo's pay form counts as paid (through the stub, which carries this browser's purchase cookie).
  const paidForm = await fetch(`/api/shop/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ orderId: ldc, lang: "en" }).toString(),
  });
  expect(paidForm.status).toBe(303);
  const ldcRenewal = (await getShopOrder(ldc)).subscription!.renewToken!;
  await expect(createRenewalOrder(ldcRenewal, 1, "en", "", "usdt")).rejects.toMatchObject({ status: 409 });
});

test("dev shop: with USDT off it is a mail before USDT: no payment.usdt, no USDT prices, no pay/usdt, no usdt way of paying", async () => {
  const store = new MockShopStore(() => NOW, true, true, true, true, true, true, false);
  browser(store);
  const catalog = await getShopCatalog();
  expect(catalog.payment).toStrictEqual({ ldc: true, stripe: { currency: "usd" } });
  expect(catalog.products.every((product) => !("usdtPriceMinor" in product))).toBe(true);
  expect(catalog.seatProducts![0]).not.toHaveProperty("unitUsdtPriceMinor");
  await expect(createShopOrder(ONE_TIME, "en", "", "usdt")).rejects.toMatchObject({ status: 409 });
  const id = await createShopOrder(ONE_TIME, "en");
  await expect(startUsdtPayment(id, "en")).rejects.toMatchObject({ status: 404 });
  await expect(quotePurchase({ productId: ONE_TIME, providers: ["ldc", "usdt"], quantity: 0 })).rejects.toMatchObject({
    status: 400,
  });
});

/* ---- The Worker ---- */

const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";

function bindings(mail: (request: Request) => Promise<Response>): StorefrontEnv {
  return { MAIL: { fetch: mail }, MAIL_ORIGIN: mailOrigin };
}

function payUsdt(headers: Record<string, string> = {}, method = "POST"): Request {
  return new Request(`${siteOrigin}/api/shop/pay/usdt`, {
    method,
    headers: {
      Origin: siteOrigin,
      "Content-Type": "application/json",
      Cookie: `mailhq_shop=${"a".repeat(64)}; mailhq_customer=${"c".repeat(43)}; other=secret`,
      ...headers,
    },
    ...(method === "POST" ? { body: JSON.stringify({ orderId: ORDER_ID }) } : {}),
  });
}

test("Worker: pay/usdt is proxied as JSON with the buyer's two cookies, and passes mail's answers and refusals through", async () => {
  const mail = vi.fn(async (forwarded: Request) => {
    expect(new URL(forwarded.url).href).toBe(`${mailOrigin}/api/shop/pay/usdt`);
    expect(forwarded.headers.get("cookie")).toBe(`mailhq_shop=${"a".repeat(64)}; mailhq_customer=${"c".repeat(43)}`);
    expect(forwarded.headers.get("origin")).toBe(siteOrigin);
    expect(await forwarded.json()).toStrictEqual({ orderId: ORDER_ID });
    return Response.json(usdtPayResponse);
  });
  const response = await worker.fetch(payUsdt(), bindings(mail));
  expect(response.status).toBe(200);
  expect(await response.json()).toStrictEqual(usdtPayResponse);
  expect(response.headers.get("Cache-Control")).toMatch(/no-store/);
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(mail).toHaveBeenCalledOnce();

  for (const [status, body, headers] of [
    [404, { error: "Order not found." }, {}],
    [409, { error: "This order is not paid with USDT." }, {}],
    [429, { error: "Too many requests." }, { "Retry-After": "30" }],
    [503, { error: "USDT is not configured." }, {}],
  ] as const) {
    const answered = await worker.fetch(
      payUsdt(),
      bindings(async () => Response.json(body, { status, headers })),
    );
    expect([answered.status, await answered.json()]).toStrictEqual([status, body]);
    if (status === 429) expect(answered.headers.get("Retry-After")).toBe("30");
  }
});

test("Worker: pay/usdt keeps every check: same origin, JSON only, POST only; never a redirect; an old mail's 404 page is a JSON 404", async () => {
  const unreachable = bindings(async () => expect.unreachable("mail must not be called"));
  expect((await worker.fetch(payUsdt({ Origin: "https://attacker.example" }), unreachable)).status).toBe(403);
  const noOrigin = payUsdt();
  noOrigin.headers.delete("Origin");
  expect((await worker.fetch(noOrigin, unreachable)).status).toBe(403);
  expect(
    (await worker.fetch(payUsdt({ "Content-Type": "application/x-www-form-urlencoded" }), unreachable)).status,
  ).toBe(415);
  const get = await worker.fetch(payUsdt({}, "GET"), unreachable);
  expect([get.status, get.headers.get("Allow")]).toStrictEqual([405, "POST"]);

  // A redirect is not an answer of pay/usdt: only the pay form may send the buyer anywhere.
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const redirected = await worker.fetch(
    payUsdt(),
    bindings(
      async () => new Response(null, { status: 303, headers: { Location: "https://checkout.stripe.com/c/pay/x" } }),
    ),
  );
  expect(redirected.status).toBe(503);
  expect(redirected.headers.get("Location")).toBeNull();
  log.mockRestore();

  // A mail before USDT answers its own 404 page: the page gets a JSON 404 ("not offered"), not an outage.
  const old = await worker.fetch(
    payUsdt(),
    bindings(
      async () => new Response("<html>Not found</html>", { status: 404, headers: { "Content-Type": "text/html" } }),
    ),
  );
  expect(old.status).toBe(404);
  expect(old.headers.get("Content-Type")).toMatch(/^application\/json/);
  const body = (await old.json()) as { error: unknown };
  expect(typeof body.error).toBe("string");
  // ...which the client throws as a 404 like any other, and the order page shows as "not offered".
  respond(body, 404);
  await expect(startUsdtPayment(ORDER_ID)).rejects.toMatchObject({ status: 404 });
});
