import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  parseRefusal,
  PLAN_KINDS,
  REFUSAL_CODES,
  SEAT_MAX,
  seatCardPrice,
  seatOrderPrice,
  seatTotals,
  SHOP_PRICE_MAX_CENTS,
} from "@/storefront/lib/catalog";
import { LANGS } from "@/storefront/i18n";
import {
  parsePurchaseQuote,
  QUOTE_DEBOUNCE_MS,
  QUOTE_RETRY_SECONDS,
  QuoteBoard,
  quotedRange,
  quotePurchase,
  seatFigure,
  seatRefusal,
  upgradePeriodPrices,
  viewOf,
  type PurchaseQuote,
  type QuoteAsk,
  type QuoteView,
} from "@/storefront/lib/quote";
import {
  createShopOrder,
  getAccountMailboxes,
  getShopCatalog,
  getShopOrder,
  isRefusal,
  isSeatProduct,
  parseShopCatalog,
  previewCoupon,
  previewCouponPlans,
  ShopApiError,
} from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { MockShopStore, SEAT_PRODUCT } from "@/storefront/mock/shop";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import { QUOTE_ROUTE } from "@/storefront/worker/shop";
import { catalogResponse } from "./fixtures/shop-contract";

/**
 * Contract version 3 of docs/onboard-contract.json (mail's docs/shop.md, "Storefront contract for seats"): the order quote
 * (POST /api/shop/quote), the explicit fields of a seat plan, coded refusals, and what the pages do against a mail before all
 * of it. The samples are shaped after mail's code (apps/console/src/lib/shop/quote.ts, public.ts, route.ts and refusals.ts).
 */

const ORIGIN = "http://localhost:4321";
const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";
const NOW = Date.parse("2026-09-22T00:00:00Z");
const PLAN = "productabcdefgh";

const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
  version: number;
  shop: {
    planKinds: string[];
    seats: {
      routes: Record<string, string>;
      catalogField: string;
      planFields: string[];
      quoteFields: string[];
      quoteCouponFields: string[];
      maxQuantity: number;
      maxTotalCents: number;
    };
    refusalFields: string[];
    refusalLanguages: string[];
    refusalCodes: Record<string, { status: number; details: string[] }>;
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The example of mail's docs/shop.md: 7 seats of 3.33 LDC at 10% off. */
const quote = {
  productId: PLAN,
  kind: "seats",
  provider: "ldc",
  currency: "",
  quantity: 7,
  minQuantity: 2,
  maxQuantity: 50,
  unitOriginalPriceCents: 333,
  unitPriceCents: 300,
  subtotalCents: 2331,
  discountPercent: 10,
  planDiscountCents: 233,
  basePriceCents: 2098,
  coupon: null,
  totalCents: 2098,
  periodDays: 30,
  renewPriceCents: 2100,
};
const ask: QuoteAsk = { productId: PLAN, provider: "ldc", quantity: 7 };
/** The same seats by card: the plan's Stripe price, no plan discount. */
const cardQuote = {
  ...quote,
  provider: "stripe",
  currency: "usd",
  unitOriginalPriceCents: 199,
  unitPriceCents: 199,
  subtotalCents: 1393,
  discountPercent: 0,
  planDiscountCents: 0,
  basePriceCents: 1393,
  totalCents: 1393,
  renewPriceCents: 1393,
};
/** A fixed plan, which is sold whole. */
const fixedQuote = {
  ...quote,
  kind: "fixed",
  quantity: 1,
  minQuantity: 1,
  maxQuantity: 1,
  unitOriginalPriceCents: 1000,
  unitPriceCents: 750,
  subtotalCents: 1000,
  discountPercent: 25,
  planDiscountCents: 250,
  basePriceCents: 750,
  totalCents: 750,
  renewPriceCents: 600,
};
/** A seat plan as mail's getPublicShop publishes it since version 3: the old fields, and the same facts said outright. */
const seatProduct = {
  id: "seatplanabcdefg",
  kind: "seat",
  seatMin: 2,
  seatMax: 50,
  planKind: "seats",
  minQuantity: 2,
  maxQuantity: 50,
  unitOriginalPriceCents: 333,
  unitPriceCents: 300,
  unitRenewPriceCents: 300,
  unitFiatPriceMinor: 199,
  customDomains: 0,
  name: "团队邮箱",
  description: "",
  originalPriceCents: 333,
  discountPercent: 10,
  priceCents: 300,
  domains: ["abnormal.bid"],
  mailboxCount: 2,
  quotaMb: 2048,
  codeExpiresDays: 30,
  periodDays: 30,
  renewPriceCents: 0,
  fiatPriceMinor: 199,
  enabled: true,
  created: "2026-09-01T00:00:00.000Z",
  updated: "2026-09-01T00:00:00.000Z",
  quotaSupportedByDomain: { "abnormal.bid": true },
};
/** mail's coded refusals, as shopFailure answers them: `error` in the request language, the code, both texts, the numbers. */
const rangeRefusal = {
  error: "Choose between 2 and 5 seats.",
  code: "seat_quantity_out_of_range",
  messages: { zh: "请选择 2 ～ 5 个席位。", en: "Choose between 2 and 5 seats." },
  min: 2,
  max: 5,
};
const totalRefusal = {
  error: "这么多席位的总价超过了单笔订单的上限，请减少数量。",
  code: "seat_total_too_large",
  messages: {
    zh: "这么多席位的总价超过了单笔订单的上限，请减少数量。",
    en: "That many seats cost more than one order can charge. Choose fewer.",
  },
  maxTotalCents: 100_000_000,
};

function respond(body: unknown, status = 200, headers: HeadersInit = {}) {
  const calls: { url: string; body: unknown; lang: string | null; credentials?: string }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      lang: new Headers(init?.headers).get("Accept-Language"),
      credentials: init?.credentials,
    });
    return Response.json(body, { status, headers });
  });
  return calls;
}

/* ---- The contract ---- */

test("contract: version 3's plan kinds, seat limits, refusal codes and languages are the ones the client carries", () => {
  expect(contract.version).toBe(3);
  expect([...PLAN_KINDS]).toStrictEqual(contract.shop.planKinds);
  expect(SEAT_MAX).toBe(contract.shop.seats.maxQuantity);
  expect(SHOP_PRICE_MAX_CENTS).toBe(contract.shop.seats.maxTotalCents);
  expect(contract.shop.seats.routes[QUOTE_ROUTE]).toBe("POST");
  expect(contract.shop.seats.catalogField).toBe("seatProducts");
  // Every code with its status; the details a code carries are the ones the client reads by name.
  expect(REFUSAL_CODES).toStrictEqual(
    Object.fromEntries(Object.entries(contract.shop.refusalCodes).map(([code, { status }]) => [code, status])),
  );
  expect(contract.shop.refusalCodes.seat_quantity_out_of_range!.details).toStrictEqual(["min", "max"]);
  expect(contract.shop.refusalCodes.seat_total_too_large!.details).toStrictEqual(["maxTotalCents"]);
  for (const [code, { details }] of Object.entries(contract.shop.refusalCodes)) {
    const body = {
      error: "x",
      code,
      messages: { zh: "中", en: "en" },
      ...Object.fromEntries(details.map((key) => [key, 3])),
    };
    expect(Object.keys(parseRefusal(body).details), code).toStrictEqual(details);
  }
  // The fields of a refusal, and its texts in exactly the page languages.
  expect(contract.shop.refusalFields).toStrictEqual(["error", "code", "messages"]);
  expect(contract.shop.refusalLanguages.toSorted()).toStrictEqual([...LANGS].toSorted());
});

test("contract: the quote's fields and a seat plan's explicit fields are read one by one, as the contract lists them", async () => {
  expect(Object.keys(quote)).toStrictEqual(contract.shop.seats.quoteFields);
  respond(quote);
  expect(Object.keys(await quotePurchase(ask)).toSorted()).toStrictEqual(contract.shop.seats.quoteFields.toSorted());
  const coded = { valid: true, code: "WELCOME", discountCents: 420, firstPeriodOnly: true };
  expect(Object.keys(coded)).toStrictEqual(contract.shop.seats.quoteCouponFields);
  respond({ ...quote, coupon: coded, totalCents: 1678 });
  expect((await quotePurchase({ ...ask, coupon: "welcome" })).coupon).toStrictEqual(coded);

  // The catalog: every explicit field is on the parsed plan, apart from `planKind`, which is what makes it a seat plan.
  const [plan] = parseShopCatalog({ ...catalogResponse, seatProducts: [seatProduct] }).seatProducts!;
  for (const field of contract.shop.seats.planFields.filter((name) => name !== "planKind"))
    expect(plan, field).toHaveProperty(field, seatProduct[field as keyof typeof seatProduct]);
  expect(isSeatProduct(plan!)).toBe(true);
});

/* ---- The catalog's explicit fields ---- */

test("catalog: a seat plan's range and per-seat prices come from the explicit fields, and from the old ones on a mail before them", () => {
  const parse = (entry: object) => parseShopCatalog({ ...catalogResponse, seatProducts: [entry] }).seatProducts![0]!;
  const explicit = [
    "planKind",
    "minQuantity",
    "maxQuantity",
    "unitOriginalPriceCents",
    "unitPriceCents",
    "unitRenewPriceCents",
    "unitFiatPriceMinor",
  ];
  const before = Object.fromEntries(Object.entries(seatProduct).filter(([key]) => !explicit.includes(key)));
  const expected = {
    minQuantity: 2,
    maxQuantity: 50,
    unitOriginalPriceCents: 333,
    unitPriceCents: 300,
    // No renewal price of its own: a seat renews at its discounted price.
    unitRenewPriceCents: 300,
    unitFiatPriceMinor: 199,
  };
  // The same plan from a mail at version 3 and from one before it reads the same.
  expect(parse(seatProduct)).toMatchObject(expected);
  expect(parse(before)).toStrictEqual(parse(seatProduct));
  // A mail that one day sends the explicit fields alone (no `kind`, `seatMin`, `seatMax`) is read too.
  const only = Object.fromEntries(
    Object.entries(seatProduct).filter(([key]) => !["kind", "seatMin", "seatMax"].includes(key)),
  );
  expect(parse(only)).toStrictEqual(parse(seatProduct));

  // Where the two disagree the explicit fields win, in the range and in every price the pages show for the plan.
  const disagreeing = parse({
    ...seatProduct,
    seatMin: 1,
    seatMax: 9,
    minQuantity: 3,
    maxQuantity: 40,
    unitOriginalPriceCents: 400,
    unitPriceCents: 360,
    unitRenewPriceCents: 350,
    unitFiatPriceMinor: 249,
  });
  expect(disagreeing).toMatchObject({
    minQuantity: 3,
    maxQuantity: 40,
    unitOriginalPriceCents: 400,
    unitPriceCents: 360,
    unitRenewPriceCents: 350,
    unitFiatPriceMinor: 249,
    originalPriceCents: 400,
    priceCents: 360,
    renewPriceCents: 350,
    fiatPriceMinor: 249,
  });
  expect(disagreeing).not.toHaveProperty("seatMin");

  // The renewal price of one seat on a mail before the field: the plan's own, its discounted price without one, 0 for a one-time plan.
  expect(parse({ ...before, renewPriceCents: 280 }).unitRenewPriceCents).toBe(280);
  expect(parse({ ...before, periodDays: 0 }).unitRenewPriceCents).toBe(0);
  // A plan that cannot be bought by card says 0, and reads as "no card price".
  expect(parse({ ...seatProduct, fiatPriceMinor: 0, unitFiatPriceMinor: 0 }).unitFiatPriceMinor).toBe(0);
  expect(parse({ ...before, fiatPriceMinor: undefined }).unitFiatPriceMinor).toBe(0);

  // A field that is present must be usable; `planKind` decides when it is there.
  for (const patch of [
    { planKind: "fixed" },
    { planKind: "seat" },
    { planKind: "seats", kind: undefined, minQuantity: undefined, seatMin: undefined },
    { minQuantity: 0 },
    { minQuantity: 3, maxQuantity: 2 },
    { maxQuantity: 1001 },
    { maxQuantity: "50" },
    { unitPriceCents: 0 },
    { unitPriceCents: 400 },
    { unitOriginalPriceCents: "333" },
    { unitRenewPriceCents: -1 },
    { unitFiatPriceMinor: 1.5 },
  ]) {
    expect(() => parse({ ...seatProduct, ...patch }), JSON.stringify(patch)).toThrow(ShopApiError);
  }
  // `planKind: "seats"` is enough without the stored word.
  expect(parse({ ...seatProduct, kind: undefined }).minQuantity).toBe(2);
});

/* ---- The quote client ---- */

test("quote client: one POST with the plan, the way of paying and the quantity, with the buyer's cookies and the page language", async () => {
  const calls = respond(quote);
  expect(await quotePurchase(ask, undefined, "en")).toStrictEqual(quote);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toMatch(/\/api\/shop\/quote$/);
  // The default way of paying is not sent, like at checkout; a discount code only when the caller has one.
  expect(calls[0]!.body).toStrictEqual({ productId: PLAN, quantity: 7 });
  expect([calls[0]!.lang, calls[0]!.credentials]).toStrictEqual(["en", "same-origin"]);

  const card = respond(cardQuote);
  expect((await quotePurchase({ ...ask, provider: "stripe" })).currency).toBe("usd");
  expect(card[0]!.body).toStrictEqual({ productId: PLAN, provider: "stripe", quantity: 7 });

  // A fixed plan takes no quantity and answers for the plan as a whole.
  const fixed = respond(fixedQuote);
  const whole = await quotePurchase({ productId: PLAN, provider: "ldc", quantity: 0 });
  expect([whole.kind, whole.quantity, whole.totalCents, whole.renewPriceCents]).toStrictEqual(["fixed", 1, 750, 600]);
  expect(fixed[0]!.body).toStrictEqual({ productId: PLAN });

  // A code that cannot be used does not fail the quote: the total is the price without it.
  const coded = respond({ ...quote, coupon: { valid: false } });
  const refused = await quotePurchase({ ...ask, coupon: "NOPE" });
  expect([refused.coupon, refused.totalCents]).toStrictEqual([{ valid: false }, 2098]);
  expect(coded[0]!.body).toStrictEqual({ productId: PLAN, quantity: 7, coupon: "NOPE" });
});

test("quote client: half-right quotes never reach the page", async () => {
  const bad: [object | null, QuoteAsk?][] = [
    [null],
    [{}],
    // For another plan, way of paying or quantity than asked.
    [{ ...quote, productId: "otherproduct001" }],
    [{ ...quote, provider: "stripe", currency: "usd" }],
    [{ ...quote, quantity: 8 }],
    [quote, { ...ask, quantity: 8 }],
    // A card amount without its currency, an LDC amount with one, a currency Intl cannot format.
    [
      { ...cardQuote, currency: "" },
      { ...ask, provider: "stripe" },
    ],
    [{ ...quote, currency: "usd" }],
    [
      { ...cardQuote, currency: "US$" },
      { ...ask, provider: "stripe" },
    ],
    // Amounts that do not add up the way mail says they do.
    [{ ...quote, planDiscountCents: 200 }],
    [{ ...quote, totalCents: 2000 }],
    [{ ...quote, basePriceCents: 0, totalCents: 0, planDiscountCents: 2331 }],
    [{ ...quote, subtotalCents: 2000, planDiscountCents: -98 }],
    [{ ...quote, totalCents: "2098" }],
    [{ ...quote, renewPriceCents: 21.5 }],
    [{ ...quote, discountPercent: 100 }],
    [{ ...quote, unitPriceCents: 400 }],
    // A range no plan has, or a quantity outside the one the quote names.
    [{ ...quote, minQuantity: 0 }],
    [{ ...quote, minQuantity: 8 }],
    [{ ...quote, maxQuantity: 1001 }],
    [{ ...quote, kind: "seat" }],
    // A fixed plan is sold whole, and is what answers a question without a quantity.
    [
      { ...fixedQuote, maxQuantity: 2 },
      { ...ask, quantity: 0 },
    ],
    [fixedQuote],
    [quote, { ...ask, quantity: 0 }],
    // The code: a discount that is not one, a code without a name, an answer about a code that was not sent, none about one that was.
    [
      { ...quote, coupon: { valid: true, code: "WELCOME", discountCents: 0, firstPeriodOnly: true } },
      { ...ask, coupon: "x" },
    ],
    [
      { ...quote, coupon: { valid: true, code: "", discountCents: 420, firstPeriodOnly: true }, totalCents: 1678 },
      { ...ask, coupon: "x" },
    ],
    [
      { ...quote, coupon: { valid: true, code: "WELCOME", discountCents: 420 }, totalCents: 1678 },
      { ...ask, coupon: "x" },
    ],
    [
      { ...quote, coupon: { valid: true, code: "WELCOME", discountCents: 420, firstPeriodOnly: true } },
      { ...ask, coupon: "x" },
    ],
    [{ ...quote, coupon: { valid: false } }],
    [quote, { ...ask, coupon: "WELCOME" }],
    [{ ...quote, coupon: undefined }],
  ];
  for (const [body, asked = ask] of bad) {
    expect(() => parsePurchaseQuote(body, asked), JSON.stringify(body)).toThrow(ShopApiError);
  }
  respond("<html>", 200);
  await expect(quotePurchase(ask)).rejects.toBeInstanceOf(ShopApiError);
});

/* ---- Coded refusals ---- */

test("refusals: a coded refusal keeps its code, both texts and its numbers, and the page shows the text of its own language", async () => {
  // The request went out in Chinese (`error` is Chinese): an English page still shows English, and the other way round.
  respond(totalRefusal, 400);
  const zh: unknown = await quotePurchase(ask, undefined, "zh").catch((cause: unknown) => cause);
  expect(zh).toBeInstanceOf(ShopApiError);
  expect(zh).toMatchObject({
    status: 400,
    answered: true,
    code: "seat_total_too_large",
    messages: totalRefusal.messages,
    details: { maxTotalCents: 100_000_000 },
    message: totalRefusal.messages.zh,
  });
  expect(shopError(zh, "zh")).toBe(totalRefusal.messages.zh);
  expect(shopError(zh, "en")).toBe(totalRefusal.messages.en);
  expect(isRefusal(zh, "seat_total_too_large")).toBe(true);
  expect(isRefusal(zh, "seat_quantity_out_of_range")).toBe(false);
  // Asked in English: the error itself already reads in English, whatever language `error` came in.
  const en: unknown = await quotePurchase(ask, undefined, "en").catch((cause: unknown) => cause);
  expect((en as ShopApiError).message).toBe(totalRefusal.messages.en);

  respond(rangeRefusal, 400);
  const range: unknown = await quotePurchase(ask, undefined, "en").catch((cause: unknown) => cause);
  expect(range).toMatchObject({ code: "seat_quantity_out_of_range", details: { min: 2, max: 5 } });
  expect([shopError(range, "en"), shopError(range, "zh")]).toStrictEqual([
    "Choose between 2 and 5 seats.",
    "请选择 2 ～ 5 个席位。",
  ]);
});

test("refusals: without a code, or without text for the page language, the page falls back to `error` as before", async () => {
  // A mail before coded refusals, and every refusal that has no code.
  respond({ error: "This plan is not available for purchase." }, 409);
  const plain: unknown = await quotePurchase(ask, undefined, "en").catch((cause: unknown) => cause);
  expect(plain).toMatchObject({ status: 409, code: null, messages: {}, details: {} });
  expect(shopError(plain, "en")).toBe("This plan is not available for purchase.");
  expect(shopError(plain, "zh")).toBe("This plan is not available for purchase.");

  // `messages` is ignored without a `code`: it is the code that says the texts are the buyer-facing pair.
  expect(parseRefusal({ error: "x", messages: { zh: "中", en: "en" }, min: 2 })).toStrictEqual({
    code: null,
    messages: {},
    details: {},
  });
  // A code with half the texts, or none: the language that is missing falls back to `error`.
  for (const messages of [{ en: "English only." }, { en: "English only.", zh: "  " }, { en: "English only.", zh: 7 }]) {
    respond({ error: "原文。", code: "product_unavailable", messages }, 409);
    const half: unknown = await quotePurchase(ask, undefined, "zh").catch((cause: unknown) => cause);
    expect([shopError(half, "zh"), shopError(half, "en")], JSON.stringify(messages)).toStrictEqual([
      "原文。",
      "English only.",
    ]);
  }
  for (const messages of [undefined, null, "text", [], {}]) {
    respond({ error: "原文。", code: "product_unavailable", messages }, 409);
    const none: unknown = await quotePurchase(ask, undefined, "en").catch((cause: unknown) => cause);
    expect([shopError(none, "en"), (none as ShopApiError).code]).toStrictEqual(["原文。", "product_unavailable"]);
  }
  // A code the storefront does not know yet is kept and its text shown; details are numbers only, whatever else is sent.
  respond(
    { error: "x", code: "plan_region_locked", messages: { zh: "中", en: "Not sold here." }, region: "eu", limit: 3 },
    451,
  );
  const unknown: unknown = await quotePurchase(ask, undefined, "en").catch((cause: unknown) => cause);
  expect(unknown).toMatchObject({ code: "plan_region_locked", details: { limit: 3 } });
  expect((unknown as ShopApiError).details).not.toHaveProperty("region");
  expect(shopError(unknown, "en")).toBe("Not sold here.");
  // A rate limit still says how long, and an empty body the generic sentence of the page's language.
  respond({ error: "slow down" }, 429, { "Retry-After": "90" });
  const limited: unknown = await quotePurchase(ask).catch((cause: unknown) => cause);
  expect(shopError(limited, "en")).toBe("Too many requests. Try again in 2 minutes.");
  expect(shopError(limited, "zh")).toBe("操作过于频繁，请在 2 分钟后重试。");
  respond(null, 500);
  const empty: unknown = await quotePurchase(ask).catch((cause: unknown) => cause);
  expect([shopError(empty, "en"), shopError(empty, "zh")]).toStrictEqual([
    shopCopy.en.requestError,
    shopCopy.zh.requestError,
  ]);
});

test("refusals: what a failure says about seat quantities is read off its code and numbers", async () => {
  const thrown = async (body: unknown, status = 400) => {
    respond(body, status);
    return quotePurchase(ask).catch((cause: unknown) => cause);
  };
  expect(seatRefusal(await thrown(rangeRefusal))).toStrictEqual({ code: "seat_quantity_out_of_range", min: 2, max: 5 });
  expect(seatRefusal(await thrown(totalRefusal))).toStrictEqual({
    code: "seat_total_too_large",
    maxTotalCents: 100_000_000,
  });
  // Numbers that are not there, or make no range, say nothing; so does every other refusal and anything that is not one.
  for (const body of [
    { ...rangeRefusal, min: undefined },
    { ...rangeRefusal, min: 6 },
    { ...rangeRefusal, max: 1001 },
    { ...rangeRefusal, min: "2" },
    { ...totalRefusal, maxTotalCents: 0 },
    { ...totalRefusal, maxTotalCents: undefined },
    { ...rangeRefusal, code: "seat_quantity_invalid" },
    { error: "Choose between 2 and 5 seats.", min: 2, max: 5 },
  ])
    expect(seatRefusal(await thrown(body)), JSON.stringify(body)).toBeNull();
  expect(seatRefusal(new Error("offline"))).toBeNull();
  expect(seatRefusal(null)).toBeNull();
});

/* ---- The discount code preview ---- */

test("coupon preview: a seat quantity mail does not sell is its own refusal, never 'the code can't be used' and never a legacy backend", async () => {
  const asks = [
    { productId: PLAN, provider: "ldc" as const, quantity: 7 },
    { productId: PLAN, provider: "stripe" as const, quantity: 7 },
  ];
  for (const [refusal, lang, text] of [
    [rangeRefusal, "en", "This plan sells 2 to 5 mailboxes. Adjust the quantity, then apply the code again."],
    [rangeRefusal, "zh", "这个套餐可选 2 ～ 5 个邮箱，请调整数量后再使用优惠码。"],
    [
      totalRefusal,
      "en",
      "That many mailboxes cost more than one order can charge (1000000.00 at most). Choose fewer, then apply the code again.",
    ],
    [totalRefusal, "zh", "所选数量超出了单笔订单的金额上限（1000000.00），请减少邮箱数量后再使用优惠码。"],
  ] as const) {
    // The single form throws the refusal with its code and numbers.
    respond(refusal, 400);
    const single: unknown = await previewCoupon(PLAN, "ldc", "WELCOME", undefined, lang, 7).catch(
      (cause: unknown) => cause,
    );
    expect(single).toMatchObject({ status: 400, code: refusal.code });

    // The several-plans form fails as a whole: ONE request, no fallback to plan-by-plan (which a mail before the form gets
    // for its uncoded 400), and the refusal comes back for the page to show.
    const calls = respond(refusal, 400);
    const result = await previewCouponPlans(asks, "WELCOME", { lang });
    expect(calls).toHaveLength(1);
    expect(result.legacy).toBe(false);
    expect(result.quotes).toStrictEqual([undefined, undefined]);
    // What the shop page says: its own sentence, with the numbers mail sent.
    const seats = seatRefusal(result.error)!;
    const t = shopCopy[lang];
    expect(
      seats.code === "seat_quantity_out_of_range"
        ? t.couponSeatRange(seats.min, seats.max)
        : t.couponSeatTotal((seats.maxTotalCents / 100).toFixed(2)),
    ).toBe(text);
    // And never "this code can't be used": the code was not judged.
    expect(text).not.toBe(t.couponInvalid);
  }
  for (const lang of LANGS) expect(shopCopy[lang].couponSeatRange(3, 3)).toMatch(/3/);
  expect(shopCopy.en.couponSeatRange(1, 1)).toBe(
    "This plan sells exactly 1 mailbox. Adjust the quantity, then apply the code again.",
  );

  // A mail before the several-plans form still answers an uncoded 400, and is then asked plan by plan.
  const legacy = respond({ error: "Choose a plan." }, 400);
  const fallen = await previewCouponPlans(asks, "WELCOME");
  expect(fallen.legacy).toBe(true);
  expect(legacy.length).toBeGreaterThan(1);

  // The page wires it: a seat refusal of the preview is shown with its numbers and handed to the board.
  const source = readFileSync("src/storefront/components/Shop.tsx", "utf8");
  expect(source).toMatch(/const refusal = seatRefusal\(result\.error\);/);
  expect(source).toMatch(/t\.couponSeatRange\(refusal\.min, refusal\.max\)/);
  expect(source).toMatch(/t\.couponSeatTotal\(formatCredits\(refusal\.maxTotalCents\)\)/);
  expect(source).toMatch(/board\.learn\(result\.error,/);
});

/* ---- The board ---- */

interface Pending {
  ask: QuoteAsk;
  signal: AbortSignal;
  resolve: (quote: PurchaseQuote) => void;
  reject: (error: unknown) => void;
}

/** A board whose requests are answered by hand, on fake timers. */
function board(options: { lang?: "zh" | "en" } = {}) {
  const sent: Pending[] = [];
  const quotes = new QuoteBoard({
    ...options,
    fetchQuote: (asked, signal) =>
      new Promise<PurchaseQuote>((resolve, reject) => {
        sent.push({ ask: asked, signal, resolve, reject });
      }),
  });
  const view = (slot: string) => quotes.snapshot().views[slot];
  const settle = () => vi.advanceTimersByTimeAsync(0);
  const answer = (index: number, quantity = sent[index]!.ask.quantity) =>
    sent[index]!.resolve({ ...quote, quantity, provider: sent[index]!.ask.provider } as PurchaseQuote);
  return { quotes, sent, view, settle, answer };
}

const refusalError = (
  body: { error: string; code: string; messages: object; [detail: string]: unknown },
  status = 400,
) => new ShopApiError(body.error, status, true, null, parseRefusal(body));

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

test("board: the first figure is asked for at once; a change of quantity waits, and only the quantity settled on is asked about", async () => {
  const { quotes, sent, view, settle, answer } = board();
  quotes.want("plan:ldc", ask);
  expect(sent).toHaveLength(1);
  expect(view("plan:ldc")).toStrictEqual({ state: "loading" });
  answer(0);
  await settle();
  expect(view("plan:ldc")).toMatchObject({ state: "quoted", quote: { quantity: 7 } });

  // Stepping 8, 9, 10 within the pause: nothing is sent until the buyer stops, then one request for 10.
  for (const quantity of [8, 9, 10]) {
    quotes.want("plan:ldc", { ...ask, quantity });
    await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS - 50);
    expect(view("plan:ldc")).toStrictEqual({ state: "loading" });
  }
  expect(sent).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(50);
  expect(sent.map((item) => item.ask.quantity)).toStrictEqual([7, 10]);
  answer(1);
  await settle();
  expect(view("plan:ldc")).toMatchObject({ state: "quoted", quote: { quantity: 10 } });

  // The same ask again changes nothing and asks nothing.
  const before = quotes.snapshot();
  quotes.want("plan:ldc", { ...ask, quantity: 10 });
  expect(quotes.snapshot()).toBe(before);
  expect(sent).toHaveLength(2);
});

test("board: a request in flight is cancelled when the quantity changes, and a late answer is never shown", async () => {
  const { quotes, sent, view, settle, answer } = board();
  quotes.want("plan:ldc", ask);
  quotes.want("plan:ldc", { ...ask, quantity: 8 });
  // The request for 7 was aborted as soon as the ask changed.
  expect(sent[0]!.signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
  expect(sent.map((item) => item.ask.quantity)).toStrictEqual([7, 8]);
  // The answer for 7 arrives anyway (the network does not always honour an abort), after the one for 8 or before it.
  answer(0);
  await settle();
  expect(view("plan:ldc")).toStrictEqual({ state: "loading" });
  answer(1);
  await settle();
  expect(view("plan:ldc")).toMatchObject({ state: "quoted", quote: { quantity: 8 } });
  // A late failure of the cancelled request changes nothing either.
  sent[0]!.reject(new ShopApiError("", 500));
  await settle();
  expect(view("plan:ldc")).toMatchObject({ state: "quoted", quote: { quantity: 8 } });

  // For one drawing the page can hold the answer for the quantity before: it is not shown as the new quantity's.
  expect(viewOf(quotes.snapshot(), "plan:ldc", PLAN, 8)).toMatchObject({ state: "quoted" });
  expect(viewOf(quotes.snapshot(), "plan:ldc", PLAN, 9)).toBeUndefined();
  expect(viewOf(quotes.snapshot(), "plan:ldc", "otherproduct001", 8)).toBeUndefined();
  expect(viewOf(quotes.snapshot(), "plan:stripe", PLAN, 8)).toBeUndefined();
});

test("board: answers are remembered, so going back to a quantity asks nothing", async () => {
  const { quotes, sent, view, settle, answer } = board();
  quotes.want("plan:ldc", ask);
  answer(0);
  await settle();
  quotes.want("plan:ldc", { ...ask, quantity: 8 });
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
  answer(1);
  await settle();
  // Back to 7: shown at once, without a request and without the pause.
  quotes.want("plan:ldc", ask);
  expect(view("plan:ldc")).toMatchObject({ state: "quoted", quote: { quantity: 7 } });
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS * 2);
  expect(sent).toHaveLength(2);
  // Each way of paying is a slot of its own, with its own answers.
  quotes.want("plan:stripe", { ...ask, provider: "stripe" });
  expect(sent).toHaveLength(3);
  expect(view("plan:ldc")).toMatchObject({ state: "quoted" });
});

test("board: a backend without the quote endpoint (404) is never asked again, and every figure falls back", async () => {
  const { quotes, sent, view, settle } = board();
  quotes.want("plan:ldc", ask);
  quotes.want("plan:stripe", { ...ask, provider: "stripe" });
  expect(sent).toHaveLength(2);
  // The Worker's JSON 404 for mail's own 404 page: no code.
  sent[0]!.reject(new ShopApiError("Endpoint not found.", 404, true));
  await settle();
  expect(quotes.supported).toBe(false);
  expect([view("plan:ldc"), view("plan:stripe")]).toStrictEqual([{ state: "unsupported" }, { state: "unsupported" }]);
  // The other request was cancelled, and nothing is asked from here on: not for a new quantity, not for a new plan.
  expect(sent[1]!.signal.aborted).toBe(true);
  quotes.want("plan:ldc", { ...ask, quantity: 9 });
  quotes.want("other:ldc", { ...ask, productId: "otherproduct001" });
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS * 4);
  expect(sent).toHaveLength(2);
  expect([view("plan:ldc"), view("other:ldc")]).toStrictEqual([{ state: "unsupported" }, { state: "unsupported" }]);
  // The page then shows what it always showed: its own estimate, marked as one.
  expect(
    seatFigure(view("plan:ldc"), seatOrderPrice({ originalPriceCents: 333, discountPercent: 10 }, 9)),
  ).toStrictEqual({
    kind: "estimate",
    totalCents: 2697,
    subtotalCents: 2997,
  });
});

test("board: the rate limit stops every request until Retry-After has passed, then asks once more", async () => {
  const { quotes, sent, view, settle, answer } = board();
  quotes.want("plan:ldc", ask);
  quotes.want("plan:stripe", { ...ask, provider: "stripe" });
  sent[0]!.reject(new ShopApiError("slow down", 429, true, 120));
  await settle();
  // Both figures wait (the other request is cancelled rather than left to run into the same limit).
  expect(view("plan:ldc")).toStrictEqual({ state: "limited", retryAt: NOW + 120_000 });
  expect(view("plan:stripe")).toStrictEqual({ state: "limited", retryAt: NOW + 120_000 });
  expect(sent[1]!.signal.aborted).toBe(true);
  // Changing the quantity meanwhile sends nothing; the figure is the estimate.
  quotes.want("plan:ldc", { ...ask, quantity: 9 });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(sent).toHaveLength(2);
  expect(view("plan:ldc")).toMatchObject({ state: "limited" });
  expect(seatFigure(view("plan:ldc"), { originalPriceCents: 2997, priceCents: 2697 }).kind).toBe("estimate");
  // Once it has passed, each waiting figure is asked about once, for what it is about now.
  await vi.advanceTimersByTimeAsync(60_000);
  expect(sent.slice(2).map((item) => [item.ask.provider, item.ask.quantity])).toStrictEqual([
    ["ldc", 9],
    ["stripe", 7],
  ]);
  answer(2);
  answer(3);
  await settle();
  expect(view("plan:ldc")).toMatchObject({ state: "quoted", quote: { quantity: 9 } });
  expect(view("plan:stripe")).toMatchObject({ state: "quoted", quote: { provider: "stripe" } });

  // A 429 that names no wait: a minute.
  quotes.want("plan:ldc", { ...ask, quantity: 11 });
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
  sent[4]!.reject(new ShopApiError("", 429, true, null));
  await settle();
  expect(view("plan:ldc")).toStrictEqual({ state: "limited", retryAt: Date.now() + QUOTE_RETRY_SECONDS * 1000 });
  // A figure that already has its quote is left alone.
  expect(view("plan:stripe")).toMatchObject({ state: "quoted" });
});

test("board: a coded refusal is mail's answer (shown in the page language, remembered); any other failure is only a missing quote", async () => {
  for (const lang of LANGS) {
    const { quotes, sent, view, settle } = board({ lang });
    quotes.want("plan:ldc", ask);
    sent[0]!.reject(refusalError(totalRefusal));
    await settle();
    expect(view("plan:ldc")).toStrictEqual({
      state: "refused",
      code: "seat_total_too_large",
      message: totalRefusal.messages[lang],
      details: { maxTotalCents: 100_000_000 },
    });
    // The limit mail named is kept for the page's own estimates.
    expect(quotes.snapshot().maxTotalCents).toBe(100_000_000);
    // Remembered: going away and back asks nothing.
    quotes.want("plan:ldc", { ...ask, quantity: 6 });
    quotes.want("plan:ldc", ask);
    expect(view("plan:ldc")).toMatchObject({ state: "refused" });
    await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS * 2);
    expect(sent).toHaveLength(1);
  }

  const { quotes, sent, view, settle, answer } = board({ lang: "en" });
  for (const failure of [
    new ShopApiError("", 0),
    new ShopApiError("The mail service is temporarily unavailable.", 503, true),
    new ShopApiError("", 200),
    new TypeError("Failed to fetch"),
  ]) {
    quotes.want("plan:ldc", ask);
    sent.at(-1)!.reject(failure);
    await settle();
    expect(view("plan:ldc"), String(failure)).toStrictEqual({ state: "unavailable" });
    // Not remembered: the next time the figure is wanted it is asked about again.
    quotes.drop("plan:ldc");
    expect(view("plan:ldc")).toBeUndefined();
  }
  quotes.want("plan:ldc", ask);
  answer(sent.length - 1);
  await settle();
  expect(view("plan:ldc")).toMatchObject({ state: "quoted" });
});

test("board: the plan's range is taken from mail's answers, and a refusal elsewhere makes the board ask again", async () => {
  const { quotes, sent, view, settle, answer } = board({ lang: "en" });
  quotes.want("plan:ldc", ask);
  // The catalog on the page said 2 to 50; mail now says 2 to 5.
  sent[0]!.reject(refusalError(rangeRefusal));
  await settle();
  expect(quotedRange(view("plan:ldc"))).toStrictEqual({ min: 2, max: 5 });
  expect(quotes.snapshot().ranges).toStrictEqual({ [PLAN]: { min: 2, max: 5 } });
  // The page moves the quantity into the range: a new ask, and the range is still known while it is on its way.
  quotes.want("plan:ldc", { ...ask, quantity: 5 });
  expect(quotes.snapshot().ranges[PLAN]).toStrictEqual({ min: 2, max: 5 });
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS);
  sent[1]!.resolve({ ...quote, quantity: 5, maxQuantity: 5 } as PurchaseQuote);
  await settle();
  expect(quotedRange(view("plan:ldc"))).toStrictEqual({ min: 2, max: 5 });

  // A quote's own range is taken the same way.
  quotes.want("wide:ldc", { ...ask, productId: "wideproduct0001" });
  sent[2]!.resolve({ ...quote, productId: "wideproduct0001", minQuantity: 1, maxQuantity: 100 } as PurchaseQuote);
  await settle();
  expect(quotes.snapshot().ranges.wideproduct0001).toStrictEqual({ min: 1, max: 100 });
  // Views that say nothing about the range.
  for (const state of [undefined, { state: "loading" }, { state: "unsupported" }, { state: "unavailable" }] as const)
    expect(quotedRange(state as QuoteView | undefined)).toBeNull();
  expect(quotedRange({ state: "refused", code: "seat_total_too_large", message: "", details: {} })).toBeNull();
  expect(
    quotedRange({ state: "refused", code: "seat_quantity_out_of_range", message: "", details: { min: 4 } }),
  ).toBeNull();

  // The discount preview or checkout was refused for the quantity: what the board remembered is out of date, so every
  // figure is asked about again (at once), and the numbers of the refusal are kept.
  const asked = sent.length;
  quotes.learn(refusalError({ ...rangeRefusal, max: 4 }), PLAN);
  expect(quotes.snapshot().ranges[PLAN]).toStrictEqual({ min: 2, max: 4 });
  expect(sent.slice(asked).map((item) => item.ask.productId)).toStrictEqual([PLAN, "wideproduct0001"]);
  expect(view("plan:ldc")).toStrictEqual({ state: "loading" });
  quotes.learn(refusalError({ ...totalRefusal, maxTotalCents: 50_000_000 }));
  expect(quotes.snapshot().maxTotalCents).toBe(50_000_000);
  // Anything that says nothing about seats is not a reason to ask again.
  const quiet = sent.length;
  quotes.learn(new ShopApiError("This discount code can't be used for this order.", 400, true));
  quotes.learn(new Error("offline"));
  expect(sent).toHaveLength(quiet);
  answer(sent.length - 1);
  await settle();
});

test("board: clearing cancels what is in flight and what is waiting, and the board can be used again", async () => {
  const { quotes, sent, view, settle, answer } = board();
  const seen: number[] = [];
  const stop = quotes.subscribe(() => seen.push(Object.keys(quotes.snapshot().views).length));
  quotes.want("plan:ldc", ask);
  quotes.want("plan:ldc", { ...ask, quantity: 8 });
  quotes.clear();
  expect(sent[0]!.signal.aborted).toBe(true);
  expect(quotes.snapshot().views).toStrictEqual({});
  // The pending change never goes out.
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS * 2);
  expect(sent).toHaveLength(1);
  // React runs an effect's cleanup and the effect again in development: the board asks afresh.
  quotes.want("plan:ldc", ask);
  expect(sent).toHaveLength(2);
  answer(1);
  await settle();
  expect(view("plan:ldc")).toMatchObject({ state: "quoted" });
  expect(seen.at(-1)).toBe(1);
  stop();
  quotes.drop("plan:ldc");
  expect(seen.at(-1)).toBe(1);
});

/* ---- What the card shows ---- */

test("figure: mail's quote is shown as it is; without one the page's estimate stands in, and a total too large closes that way of paying", () => {
  const estimate = seatOrderPrice({ unitOriginalPriceCents: 333, discountPercent: 10 }, 7);
  expect(estimate).toStrictEqual({ originalPriceCents: 2331, priceCents: 2098 });
  // A quote: every number is mail's, including what later periods cost, which the page could only guess before.
  expect(seatFigure({ state: "quoted", quote: quote as PurchaseQuote }, estimate)).toStrictEqual({
    kind: "quoted",
    totalCents: 2098,
    subtotalCents: 2331,
    discountPercent: 10,
    renewPriceCents: 2100,
    periodDays: 30,
    basePriceCents: 2098,
  });
  // The quote wins even where the page would have worked out something else (mail changed the plan since the catalog).
  const dearer = { ...quote, subtotalCents: 2800, planDiscountCents: 280, basePriceCents: 2520, totalCents: 2520 };
  expect(seatFigure({ state: "quoted", quote: dearer as PurchaseQuote }, estimate)).toMatchObject({
    kind: "quoted",
    totalCents: 2520,
  });
  // No quote, for whatever reason: the estimate, exactly as before the endpoint existed.
  for (const view of [
    undefined,
    { state: "loading" },
    { state: "limited", retryAt: NOW + 1000 },
    { state: "unavailable" },
    { state: "unsupported" },
  ] as (QuoteView | undefined)[]) {
    expect(seatFigure(view, estimate), JSON.stringify(view)).toStrictEqual({
      kind: "estimate",
      totalCents: 2098,
      subtotalCents: 2331,
    });
    // An estimate above what one order can charge is "too many", as it always was.
    expect(seatFigure(view, null)).toStrictEqual({ kind: "tooMany" });
  }
  // mail's refusals: too large a total closes this way of paying; anything else is said in mail's words.
  const refused = (code: string, message: string): QuoteView => ({ state: "refused", code, message, details: {} });
  expect(seatFigure(refused("seat_total_too_large", "x"), estimate)).toStrictEqual({ kind: "tooMany" });
  expect(
    seatFigure(refused("product_unavailable", "This plan is not available for purchase."), estimate),
  ).toStrictEqual({
    kind: "refused",
    message: "This plan is not available for purchase.",
  });

  // The fallback follows the limit mail named, and reads either set of names.
  expect(seatCardPrice({ unitFiatPriceMinor: 199 }, 7)).toBe(1393);
  expect(seatCardPrice({ fiatPriceMinor: 199 }, 7)).toBe(1393);
  expect(seatCardPrice({ unitFiatPriceMinor: 199 }, 7, 1000)).toBeNull();
  expect(seatOrderPrice({ originalPriceCents: 333, discountPercent: 10 }, 7, 2000)).toBeNull();
  expect(seatTotals(SEAT_PRODUCT, 7, { ldc: true, card: true })).toMatchObject({
    ldc: { originalPriceCents: 2331, priceCents: 2098 },
    card: 1393,
  });

  // The card says which it is in both languages, and says what later periods cost only with mail's number.
  for (const lang of LANGS) {
    const t = shopCopy[lang];
    expect(t.seatQuoted).not.toBe(t.seatEstimate);
    expect(t.seatRenewsAt("21.00 LDC", 30)).toContain("21.00 LDC");
    expect(t.seatRenewsAt("21.00 LDC", 30)).toContain("30");
  }
  expect(shopCopy.en.seatRenewsAt("21.00 LDC", 30)).toBe("Then 21.00 LDC every 30 days");
  expect(shopCopy.zh.seatRenewsAt("21.00 LDC", 30)).toBe("之后每 30 天续费 21.00 LDC");
  const source = readFileSync("src/storefront/components/Shop.tsx", "utf8");
  // The page asks for quotes without a discount code (each one with a code is a guess against mail's limit).
  expect(source).toMatch(
    /board\.want\(`\$\{productId\}:\$\{provider\}`, \{ productId, provider, quantity: Number\(quantity\) \}\)/,
  );
  expect(source).not.toMatch(/board\.want\([^)]*coupon/);
  expect(source).toMatch(/figures\.some\(\(figure\) => figure\.kind === "estimate"\)\s*\? t\.seatEstimate/);
});

test("renewal page: a trial's upgrade to a seat plan shows mail's quote per way of paying, and its own arithmetic without one", () => {
  const plan = { originalPriceCents: 333, discountPercent: 10, renewPriceCents: 300, fiatPriceMinor: 199 };
  const ldc: QuoteView = { state: "quoted", quote: quote as PurchaseQuote };
  const card: QuoteView = { state: "quoted", quote: cardQuote as PurchaseQuote };
  // Before quotes, and against a mail without them: the page's own figures.
  const own = { firstLdcCents: 2098, renewLdcCents: 2100, cardCents: 1393 };
  expect(upgradePeriodPrices(plan, 7, undefined, undefined)).toStrictEqual(own);
  expect(upgradePeriodPrices(plan, 7, { state: "unsupported" }, { state: "loading" })).toStrictEqual(own);
  expect(upgradePeriodPrices(plan, 7, ldc, card)).toStrictEqual(own);
  // mail's numbers win where they differ, each way of paying on its own.
  const moved = { ...quote, basePriceCents: 2500, totalCents: 2500, subtotalCents: 2733, renewPriceCents: 2600 };
  expect(upgradePeriodPrices(plan, 7, { state: "quoted", quote: moved as PurchaseQuote }, undefined)).toStrictEqual({
    firstLdcCents: 2500,
    renewLdcCents: 2600,
    cardCents: 1393,
  });
  // A refused quote (the plan is not on sale as a new order) is no reason to hide the upgrade: `renew` decides.
  const refused: QuoteView = { state: "refused", code: "product_unavailable", message: "x", details: {} };
  expect(upgradePeriodPrices(plan, 7, refused, refused)).toStrictEqual(own);
});

/* ---- The dev mock, as mail at version 3 and as the mail before it ---- */

function mockRequest(route: string, options: { cookie?: string; body?: unknown; lang?: string } = {}): Request {
  const get = ["catalog", "account", "account/mailboxes"].includes(route) || route.startsWith("orders?");
  const headers = new Headers(options.lang ? { "Accept-Language": options.lang } : {});
  if (options.cookie) headers.set("Cookie", options.cookie);
  if (!get) {
    headers.set("Origin", ORIGIN);
    headers.set("Content-Type", route === "pay" ? "application/x-www-form-urlencoded" : "application/json");
  }
  return new Request(`${ORIGIN}/api/shop/${route}`, {
    method: get ? "GET" : "POST",
    headers,
    ...(get
      ? {}
      : {
          body:
            route === "pay"
              ? new URLSearchParams(options.body as Record<string, string>).toString()
              : JSON.stringify(options.body ?? {}),
        }),
  });
}

/** Points the client at a store, carrying cookies the way a browser would. */
function browser(store: MockShopStore) {
  const jar = new Map<string, string>();
  const send = async (route: string, options: { body?: unknown; lang?: string } = {}) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await store.fetch(route.split("?")[0]!, mockRequest(route, { ...options, cookie }));
    for (const line of response.headers.getSetCookie()) {
      const [name, value] = line.split(";")[0]!.split("=");
      if (value) jar.set(name!, value);
      else jar.delete(name!);
    }
    return response;
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const route = String(url).split("/api/shop/")[1]!;
    return send(route, {
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      lang: new Headers(init?.headers).get("Accept-Language") ?? undefined,
    });
  });
  return { send };
}

/** The demo backend before contract version 3 (`MOCK_QUOTE=off`). */
const before = () => new MockShopStore(() => NOW, true, true, true, true, true, false);

test("dev shop: the quote prices an order like checkout does, for a seat plan and a fixed plan, either way of paying", async () => {
  vi.useRealTimers();
  const store = new MockShopStore(() => NOW);
  const client = browser(store);
  const catalog = await getShopCatalog(undefined, "en");
  const plan = catalog.seatProducts![0]!;
  // The catalog entry carries both forms, like mail.
  const raw = (await (await client.send("catalog")).json()) as { seatProducts: Record<string, unknown>[] };
  for (const field of [...contract.shop.seats.planFields, "kind", "seatMin", "seatMax"])
    expect(raw.seatProducts[0], field).toHaveProperty(field);
  expect(raw.seatProducts[0]).toMatchObject({ kind: "seat", planKind: "seats", seatMin: 2, minQuantity: 2 });

  // 7 seats of 3.33 at 10% off: mail's example. Every field of the contract, and the numbers checkout then charges.
  const ldc = await quotePurchase({ productId: plan.id, provider: "ldc", quantity: 7 }, undefined, "en");
  expect(ldc).toStrictEqual({ ...quote, productId: plan.id });
  const order = (await getShopOrder(await createShopOrder(plan.id, "en", "", "ldc", "", 7))).order;
  expect([order.priceCents, order.originalPriceCents, order.renewPriceCents, order.mailboxCount]).toStrictEqual([
    ldc.totalCents,
    ldc.subtotalCents,
    ldc.renewPriceCents,
    ldc.quantity,
  ]);
  const card = await quotePurchase({ productId: plan.id, provider: "stripe", quantity: 7 });
  expect(card).toStrictEqual({ ...cardQuote, productId: plan.id });
  const cardOrder = (await getShopOrder(await createShopOrder(plan.id, "en", "", "stripe", "", 7))).order;
  expect([cardOrder.priceCents, cardOrder.renewPriceCents, cardOrder.currency]).toStrictEqual([1393, 1393, "usd"]);

  // With a code: what it takes off, and the total checkout charges; a code that cannot be used still answers 200.
  const coded = await quotePurchase({ productId: plan.id, provider: "ldc", quantity: 7, coupon: "welcome" });
  expect([coded.coupon, coded.basePriceCents, coded.totalCents, coded.renewPriceCents]).toStrictEqual([
    { valid: true, code: "WELCOME", discountCents: 420, firstPeriodOnly: true },
    2098,
    1678,
    2100,
  ]);
  const codedOrder = (await getShopOrder(await createShopOrder(plan.id, "en", "", "ldc", "WELCOME", 7))).order;
  expect([codedOrder.priceCents, codedOrder.couponDiscountCents]).toStrictEqual([1678, 420]);
  const unusable = await quotePurchase({ productId: plan.id, provider: "stripe", quantity: 7, coupon: "LDC1" });
  expect([unusable.coupon, unusable.totalCents]).toStrictEqual([{ valid: false }, 1393]);

  // Fixed plans: the catalog's price is already the whole order's, and the quote says the same.
  for (const product of catalog.products) {
    const fixed = await quotePurchase({ productId: product.id, provider: "ldc", quantity: 0 });
    expect([fixed.kind, fixed.quantity, fixed.minQuantity, fixed.maxQuantity]).toStrictEqual(["fixed", 1, 1, 1]);
    expect([fixed.totalCents, fixed.subtotalCents, fixed.discountPercent]).toStrictEqual([
      product.priceCents,
      product.originalPriceCents,
      product.discountPercent,
    ]);
    expect(fixed.renewPriceCents).toBe(product.periodDays ? product.renewPriceCents || product.priceCents : 0);
    if (product.fiatPriceMinor) {
      const byCard = await quotePurchase({ productId: product.id, provider: "stripe", quantity: 0 });
      expect([byCard.totalCents, byCard.currency, byCard.discountPercent]).toStrictEqual([
        product.fiatPriceMinor,
        "usd",
        0,
      ]);
    }
  }
});

test("dev shop: refusals of the quote, checkout and the preview carry mail's codes, both texts and the numbers", async () => {
  vi.useRealTimers();
  const store = new MockShopStore(() => NOW);
  const client = browser(store);
  const seat = SEAT_PRODUCT.id;
  const fixed = "demoproduct0001";
  const range = {
    error: "Choose between 2 and 50 seats.",
    code: "seat_quantity_out_of_range",
    messages: { zh: "请选择 2 ～ 50 个席位。", en: "Choose between 2 and 50 seats." },
    min: 2,
    max: 50,
  };
  const invalid = {
    error: "Enter a whole number of seats.",
    code: "seat_quantity_invalid",
    messages: { zh: "请填写整数席位数量。", en: "Enter a whole number of seats." },
  };
  const unavailable = {
    error: "This plan is not available for purchase.",
    code: "product_unavailable",
    messages: { zh: "该套餐暂不可购买。", en: "This plan is not available for purchase." },
  };
  const answers = async (route: string, body: object, lang = "en") => {
    const response = await client.send(route, { body, lang });
    return [response.status, await response.json()];
  };
  // The same three answers from the quote, checkout and the preview (both of its forms), with the contract's statuses.
  for (const route of ["quote", "checkout", "coupon"]) {
    const extra = route === "coupon" ? { coupon: "WELCOME" } : {};
    for (const quantity of [undefined, null, 1, 51])
      expect(await answers(route, { productId: seat, quantity, ...extra }), `${route} ${quantity}`).toStrictEqual([
        contract.shop.refusalCodes.seat_quantity_out_of_range!.status,
        range,
      ]);
    for (const quantity of [2.5, "7", -1])
      expect(await answers(route, { productId: seat, quantity, ...extra }), `${route} ${quantity}`).toStrictEqual([
        contract.shop.refusalCodes.seat_quantity_invalid!.status,
        invalid,
      ]);
  }
  expect(
    await answers("coupon", { products: [{ productId: fixed }, { productId: seat, quantity: 99 }], coupon: "WELCOME" }),
  ).toStrictEqual([400, range]);
  // `error` follows the request's language; `messages` always carries both.
  expect(await answers("quote", { productId: seat, quantity: 51 }, "zh")).toStrictEqual([
    400,
    { ...range, error: range.messages.zh },
  ]);
  // A fixed plan takes no quantity: above 1 is refused, by the quote and by checkout.
  for (const route of ["quote", "checkout"])
    expect(await answers(route, { productId: fixed, quantity: 2 })).toStrictEqual([400, invalid]);
  // Not on sale, or not with this way of paying: 409 with its code (the preview answers "can't be used" instead).
  for (const body of [{ productId: "unknownproduct1" }, { productId: fixed, provider: "stripe" }]) {
    expect(await answers("quote", body)).toStrictEqual([409, unavailable]);
    expect(await answers("checkout", body)).toStrictEqual([409, unavailable]);
  }
  expect(await answers("coupon", { productId: fixed, provider: "stripe", coupon: "WELCOME" })).toStrictEqual([
    200,
    { valid: false },
  ]);
  // A malformed request has no code.
  expect(await answers("quote", {})).toStrictEqual([400, { error: "Please choose a valid plan." }]);
  expect(await answers("quote", { productId: seat, provider: "paypal", quantity: 2 })).toStrictEqual([
    400,
    { error: "Choose a valid payment method." },
  ]);
  // Through the page's client and copy: both languages, whatever language the request was in.
  const thrown: unknown = await quotePurchase(
    { productId: seat, provider: "ldc", quantity: 51 },
    undefined,
    "zh",
  ).catch((cause: unknown) => cause);
  expect([shopError(thrown, "zh"), shopError(thrown, "en")]).toStrictEqual([range.messages.zh, range.messages.en]);
  expect(seatRefusal(thrown)).toStrictEqual({ code: "seat_quantity_out_of_range", min: 2, max: 50 });
  const refusedOrder: unknown = await createShopOrder(seat, "en", "", "ldc", "NOPE", 7).catch(
    (cause: unknown) => cause,
  );
  expect(isRefusal(refusedOrder, "coupon_invalid")).toBe(true);
  expect(shopError(refusedOrder, "zh")).toBe("此优惠码不能用于这笔订单。");
});

test("dev shop: a subscription's seats say how long their period is", async () => {
  vi.useRealTimers();
  for (const [store, periodDays] of [
    [new MockShopStore(() => NOW), 30],
    [before(), undefined],
  ] as const) {
    const client = browser(store);
    vi.spyOn(console, "info").mockImplementation(() => {});
    await client.send("account/login", { body: { email: "team@example.com" } });
    const link = vi.mocked(console.info).mock.calls.at(-1)![0] as string;
    await client.send("account/verify", { body: { token: new URL(link.split("：")[1]!).searchParams.get("login") } });
    const orderId = await createShopOrder(SEAT_PRODUCT.id, "en", "", "ldc", "", 3);
    expect((await client.send("pay", { body: { orderId, lang: "en" } })).status).toBe(303);
    const [group] = (await getAccountMailboxes())!.groups;
    expect(group!.seats?.periodDays).toBe(periodDays);
    // The page says the length when mail sends it, and "per period" against a mail that does not.
    expect(shopCopy.en.seatsPriceValue("3.00 LDC", group!.seats?.periodDays)).toBe(
      periodDays ? "3.00 LDC every 30 days" : "3.00 LDC per period",
    );
    expect(shopCopy.zh.seatsPriceValue("3.00 LDC", group!.seats?.periodDays)).toBe(
      periodDays ? "3.00 LDC / 30 天" : "3.00 LDC / 周期",
    );
    expect(shopCopy.en.seatsQuoteAfter(5, "15.00 LDC", group!.seats?.periodDays)).toBe(
      periodDays
        ? "You will then have 5 seats, renewing at 15.00 LDC every 30 days."
        : "You will then have 5 seats, renewing at 15.00 LDC per period.",
    );
    expect(shopCopy.zh.seatsQuoteAfter(5, "15.00 LDC", group!.seats?.periodDays)).toBe(
      periodDays ? "增加后共 5 个席位，之后每 30 天续费 15.00 LDC。" : "增加后共 5 个席位，之后每期续费 15.00 LDC。",
    );
  }
  expect(shopCopy.en.seatsPriceValue("3.00 LDC", 1)).toBe("3.00 LDC every 1 day");
  // A period of no days is no subscription's.
  respond({
    groups: [
      {
        orderId: "abcdefghijklmno",
        productName: "Team",
        code: "ABCD-EFGH-JKLM-NPQR",
        codeStatus: "available",
        usesLeft: 1,
        mailboxLimit: 2,
        codeExpires: null,
        domains: [],
        locked: false,
        seats: {
          seats: 2,
          seatsNext: null,
          min: 2,
          max: 50,
          seatPriceCents: 300,
          provider: "ldc",
          currency: "",
          periodDays: 0,
          periodEnd: "2026-10-22T00:00:00.000Z",
          removing: [],
        },
        mailboxes: [],
      },
    ],
    servers: {},
    webmail: null,
  });
  await expect(getAccountMailboxes()).rejects.toBeInstanceOf(ShopApiError);
});

test("older backend: against a mail before version 3 the pages behave as they did, with nothing new required", async () => {
  vi.useRealTimers();
  const store = before();
  let client = browser(store);

  // The catalog: a seat plan with only the old fields is read into the same plan.
  const raw = (await (await client.send("catalog")).json()) as { seatProducts: Record<string, unknown>[] };
  for (const field of contract.shop.seats.planFields) expect(raw.seatProducts[0], field).not.toHaveProperty(field);
  expect(raw.seatProducts[0]).toMatchObject({ kind: "seat", seatMin: 2, seatMax: 50 });
  const catalog = await getShopCatalog(undefined, "en");
  const plan = catalog.seatProducts![0]!;
  // ...exactly the plan the same catalog reads into from a mail at version 3.
  browser(new MockShopStore(() => NOW));
  expect(plan).toStrictEqual((await getShopCatalog(undefined, "en")).seatProducts![0]);
  client = browser(store);
  expect([plan.minQuantity, plan.maxQuantity, plan.unitPriceCents, plan.unitRenewPriceCents]).toStrictEqual([
    2, 50, 300, 300,
  ]);

  // The quote route does not exist: 404 through the client, exactly what the Worker makes of an old mail's 404 page.
  const missing: unknown = await quotePurchase({ productId: plan.id, provider: "ldc", quantity: 7 }).catch(
    (cause: unknown) => cause,
  );
  expect(missing).toMatchObject({ status: 404, code: null });

  // The board, as the shop page drives it: one 404 and nothing is asked again; the card shows the estimate, which is what
  // checkout then charges.
  vi.useFakeTimers({ now: NOW });
  const fetched = vi.spyOn(store, "fetch");
  const quotes = new QuoteBoard({ lang: "en" });
  quotes.want(`${plan.id}:ldc`, { productId: plan.id, provider: "ldc", quantity: 7 });
  quotes.want(`${plan.id}:stripe`, { productId: plan.id, provider: "stripe", quantity: 7 });
  await vi.advanceTimersByTimeAsync(10);
  expect(quotes.supported).toBe(false);
  expect(quotes.snapshot().views).toStrictEqual({
    [`${plan.id}:ldc`]: { state: "unsupported" },
    [`${plan.id}:stripe`]: { state: "unsupported" },
  });
  const asked = fetched.mock.calls.filter(([route]) => route === "quote").length;
  expect(asked).toBeGreaterThan(0);
  for (const quantity of [8, 9, 10]) quotes.want(`${plan.id}:ldc`, { productId: plan.id, provider: "ldc", quantity });
  await vi.advanceTimersByTimeAsync(QUOTE_DEBOUNCE_MS * 3);
  expect(fetched.mock.calls.filter(([route]) => route === "quote")).toHaveLength(asked);
  vi.useRealTimers();
  const totals = seatTotals(plan, 7, { ldc: true, card: true });
  const ldc = seatFigure(viewOf(quotes.snapshot(), `${plan.id}:ldc`, plan.id, 10), totals.ldc);
  expect(ldc).toStrictEqual({ kind: "estimate", totalCents: 2098, subtotalCents: 2331 });
  const order = (await getShopOrder(await createShopOrder(plan.id, "en", "", "ldc", "", 7))).order;
  expect([order.priceCents, order.originalPriceCents]).toStrictEqual([2098, 2331]);
  const byCard = (await getShopOrder(await createShopOrder(plan.id, "en", "", "stripe", "", 7))).order;
  expect(byCard.priceCents).toBe(totals.card);

  // Refusals have no code: the page shows `error`, in the language the request asked for, as it always did.
  for (const [lang, text] of [
    ["en", "Choose between 2 and 50 seats."],
    ["zh", "请选择 2 ～ 50 个席位。"],
  ] as const) {
    const refused: unknown = await createShopOrder(plan.id, lang, "", "ldc", "", 51).catch((cause: unknown) => cause);
    expect(refused).toMatchObject({ status: 400, code: null, messages: {}, details: {} });
    expect(shopError(refused, lang)).toBe(text);
    expect(seatRefusal(refused)).toBeNull();
    const response = await client.send("checkout", { body: { productId: plan.id, quantity: 51 }, lang });
    expect(await response.json()).toStrictEqual({ error: text });
  }
  const coupon: unknown = await createShopOrder(plan.id, "en", "", "ldc", "NOPE", 7).catch((cause: unknown) => cause);
  expect(shopError(coupon, "en")).toBe("This discount code can't be used for this order.");

  // The discount preview: one request for every plan, as before; an uncoded refusal of a quantity is shown as mail's
  // sentence and is not mistaken for a seat refusal with numbers.
  const asks = [
    { productId: plan.id, provider: "ldc" as const, quantity: 7 },
    { productId: plan.id, provider: "stripe" as const, quantity: 7 },
  ];
  const previewed = await previewCouponPlans(asks, "WELCOME", { lang: "en" });
  expect(previewed.error).toBeUndefined();
  expect(previewed.quotes.map((item) => item?.priceCents)).toStrictEqual([1678, 1114]);
  const single: unknown = await previewCoupon(plan.id, "ldc", "WELCOME", undefined, "en", 51).catch(
    (cause: unknown) => cause,
  );
  expect([shopError(single, "en"), seatRefusal(single)]).toStrictEqual(["Choose between 2 and 50 seats.", null]);
});

/* ---- The Worker's proxy ---- */

function bindings(mail: (request: Request) => Promise<Response>): StorefrontEnv {
  return { MAIL: { fetch: mail }, MAIL_ORIGIN: mailOrigin };
}

function quoteRequest(headers: Record<string, string> = {}, init: RequestInit = {}): Request {
  return new Request(`${siteOrigin}/api/shop/quote`, {
    method: "POST",
    body: '{"productId":"productabcdefgh","quantity":7}',
    headers: { Origin: siteOrigin, "Content-Type": "application/json", ...headers },
    ...init,
  });
}

test("shop proxy: the quote is proxied like the code preview: the buyer's two cookies, the visitor's IP and Origin, never cached", async () => {
  vi.useRealTimers();
  const buyer = `mailhq_shop=${"a".repeat(64)}`;
  const customer = `mailhq_customer=${"c".repeat(43)}`;
  const mail = vi.fn(async (request: Request) => {
    expect(request.url).toBe(`${mailOrigin}/api/shop/quote`);
    expect(request.method).toBe("POST");
    // A quote may carry a code with a per-buyer limit; admin credentials never go along.
    expect(request.headers.get("cookie")).toBe(`${buyer}; ${customer}`);
    expect(request.headers.get("authorization")).toBeNull();
    expect(request.headers.get("origin")).toBe(siteOrigin);
    // mail limits quotes per source IP.
    expect(request.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
    expect(request.headers.get("accept-language")).toBe("en");
    expect(await request.text()).toBe('{"productId":"productabcdefgh","quantity":7}');
    return Response.json(quote, {
      headers: { "Set-Cookie": "session=admin; Path=/", "Cache-Control": "public, max-age=3600" },
    });
  });
  const response = await worker.fetch(
    quoteRequest({
      Cookie: `${buyer}; ${customer}; session=admin`,
      Authorization: "Bearer admin",
      "CF-Connecting-IP": "203.0.113.9",
      "Accept-Language": "en",
    }),
    bindings(mail),
  );
  expect(mail).toHaveBeenCalledOnce();
  expect([response.status, await response.json()]).toStrictEqual([200, quote]);
  expect(response.headers.getSetCookie()).toStrictEqual([]);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
});

test("shop proxy: the quote is a same-origin JSON POST, and nothing about a request is logged", async () => {
  vi.useRealTimers();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const never = bindings(async () => {
    throw new Error("must not reach mail");
  });
  for (const origin of [undefined, "null", "https://attacker.example"]) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (origin) headers.set("Origin", origin);
    expect((await worker.fetch(quoteRequest({}, { headers }), never)).status, String(origin)).toBe(403);
  }
  expect((await worker.fetch(quoteRequest({ "Content-Type": "text/plain" }), never)).status).toBe(415);
  const get = await worker.fetch(new Request(`${siteOrigin}/api/shop/quote`), never);
  expect([get.status, get.headers.get("Allow")]).toStrictEqual([405, "POST"]);
  const down = await worker.fetch(
    quoteRequest({ Cookie: `mailhq_customer=${"c".repeat(43)}` }),
    bindings(async () => {
      throw new Error("productabcdefgh secret");
    }),
  );
  expect(down.status).toBe(503);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/productabcdefgh|secret|mailhq_customer|c{43}/);
});

test("shop proxy: a mail before the quote answers a JSON 404; mail's coded refusals and its rate limit pass through unchanged", async () => {
  vi.useRealTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // An old mail's own 404 page: a JSON 404 in the page language, which the board takes as "no quote endpoint".
  for (const [lang, error] of [
    ["en", "Endpoint not found."],
    ["zh", "接口不存在。"],
  ] as const) {
    const html = await worker.fetch(
      quoteRequest({ "Accept-Language": lang }),
      bindings(
        async () => new Response("<html>Not found</html>", { status: 404, headers: { "Content-Type": "text/html" } }),
      ),
    );
    expect([html.status, await html.json()]).toStrictEqual([404, { error }]);
  }
  // Through the client: no code, so the board stops asking.
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) =>
    worker.fetch(
      new Request(`${siteOrigin}${new URL(url, siteOrigin).pathname}`, {
        method: "POST",
        body: init.body,
        headers: { ...Object.fromEntries(new Headers(init.headers)), Origin: siteOrigin },
      }),
      bindings(async () => new Response("<html>", { status: 404, headers: { "Content-Type": "text/html" } })),
    ),
  );
  await expect(quotePurchase(ask, undefined, "en")).rejects.toMatchObject({ status: 404, code: null });

  // The body of a coded refusal is mail's, byte for byte: code, both texts and the numbers.
  for (const [refusal, status] of [
    [rangeRefusal, 400],
    [totalRefusal, 400],
    [{ error: "x", code: "product_unavailable", messages: { zh: "中", en: "x" } }, 409],
  ] as const) {
    const body = JSON.stringify(refusal);
    const refused = await worker.fetch(
      quoteRequest(),
      bindings(async () => new Response(body, { status, headers: { "Content-Type": "application/json" } })),
    );
    expect([refused.status, await refused.text()]).toStrictEqual([status, body]);
  }
  const limited = await worker.fetch(
    quoteRequest(),
    bindings(async () => Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "380" } })),
  );
  expect([limited.status, limited.headers.get("Retry-After")]).toStrictEqual([429, "380"]);
  const broken = await worker.fetch(
    quoteRequest(),
    bindings(async () => new Response("upstream down", { status: 502, headers: { "Content-Type": "text/plain" } })),
  );
  expect(broken.status).toBe(503);
});
