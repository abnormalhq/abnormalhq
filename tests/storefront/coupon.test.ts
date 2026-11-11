import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseShopCatalog, ShopApiError, validPrice } from "@/storefront/lib/catalog";
import {
  COUPON_MAX_LENGTH,
  COUPON_STORAGE_KEY,
  normalizeCoupon,
  couponVerdict,
  orderCoupon,
  recallCoupon,
  rememberCoupon,
} from "@/storefront/lib/coupon";
import {
  catalogPlans,
  COUPON_PREVIEW_PLANS,
  COUPON_PREVIEW_REQUESTS,
  createShopOrder,
  getAccount,
  getShopCatalog,
  getShopOrder,
  isSeatProduct,
  previewCoupon,
  previewCouponPlans,
  previewCoupons,
  type CouponAsk,
} from "@/storefront/lib/shop";
import { shopCopy } from "@/storefront/lib/shop-copy";
import { MockShopStore, MOCK_COUPONS } from "@/storefront/mock/shop";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import { catalogResponse, orderResponse } from "./fixtures/shop-contract";

const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";
const PRODUCT_ID = "productabcdefgh";

afterEach(() => vi.unstubAllGlobals());

/** Records every request and answers the same response. */
function respond(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> | undefined }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init, body: init.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return Response.json(body, { status });
  });
  return calls;
}

/* ---- The clients ---- */

const quote = {
  valid: true,
  code: "WELCOME",
  provider: "ldc",
  currency: "",
  basePriceCents: 750,
  discountCents: 150,
  priceCents: 600,
  firstPeriodOnly: true,
};

test("coupon client: one POST with the plan, the way of paying and the code, with the buyer's cookies", async () => {
  const calls = respond(quote);
  expect(await previewCoupon(PRODUCT_ID, "ldc", "welcome", undefined, "en")).toStrictEqual({
    code: "WELCOME",
    provider: "ldc",
    currency: "",
    basePriceCents: 750,
    discountCents: 150,
    priceCents: 600,
    firstPeriodOnly: true,
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toMatch(/\/api\/shop\/coupon$/);
  // Like checkout: LDC is the default and is not sent; a per-buyer limit needs the purchase and account cookies.
  expect(calls[0]!.body).toStrictEqual({ productId: PRODUCT_ID, coupon: "welcome" });
  expect(calls[0]!.init).toMatchObject({ method: "POST", credentials: "same-origin" });
  expect(new Headers(calls[0]!.init.headers).get("Accept-Language")).toBe("en");

  const card = respond({ ...quote, provider: "stripe", currency: "usd", basePriceCents: 499, priceCents: 349 });
  expect((await previewCoupon(PRODUCT_ID, "stripe", "WELCOME"))?.currency).toBe("usd");
  expect(card[0]!.body).toStrictEqual({ productId: PRODUCT_ID, provider: "stripe", coupon: "WELCOME" });
});

test("coupon client: a code that cannot be used is an answer without a reason, not an error", async () => {
  respond({ valid: false });
  expect(await previewCoupon(PRODUCT_ID, "ldc", "NOPE")).toBeNull();
});

test("coupon client: half-right answers never reach the page, and a backend without the endpoint keeps its status", async () => {
  for (const body of [
    null,
    {},
    { valid: "yes" },
    { ...quote, code: "" },
    // The three amounts must agree: the page shows them side by side.
    { ...quote, priceCents: 700 },
    { ...quote, discountCents: 0, priceCents: 750 },
    { ...quote, priceCents: 0, discountCents: 750 },
    // An answer for the other way of paying, or an LDC answer in a currency, is not the one that was asked for.
    { ...quote, provider: "stripe", currency: "usd" },
    { ...quote, currency: "usd" },
    { ...quote, firstPeriodOnly: undefined },
  ]) {
    respond(body);
    await expect(previewCoupon(PRODUCT_ID, "ldc", "WELCOME"), JSON.stringify(body)).rejects.toBeInstanceOf(
      ShopApiError,
    );
  }
  for (const status of [404, 429, 400]) {
    respond({ error: "x" }, status);
    await expect(previewCoupon(PRODUCT_ID, "ldc", "WELCOME")).rejects.toMatchObject({ status });
  }
});

/* ---- Several plans in one request (mail #221) ---- */

const SEAT_ID = "seatplanabcdefg";
/** One entry of `quotes`: the single form's quote with the plan it is for, without `valid`. */
const entry = (productId: string, patch: Record<string, unknown> = {}) => {
  const { valid: _valid, ...rest } = quote;
  void _valid;
  return { productId, ...rest, ...patch };
};
const cardEntry = (productId: string) =>
  entry(productId, { provider: "stripe", currency: "usd", basePriceCents: 499, discountCents: 100, priceCents: 399 });

test("coupon client: several plans go in one request and come back in the order asked", async () => {
  const asks: CouponAsk[] = [
    { productId: PRODUCT_ID, provider: "ldc" },
    { productId: PRODUCT_ID, provider: "stripe" },
    { productId: SEAT_ID, provider: "ldc", quantity: 7 },
  ];
  const calls = respond({ quotes: [entry(PRODUCT_ID), null, entry(SEAT_ID, { firstPeriodOnly: false })] });
  const quotes = await previewCoupons(asks, "welcome", undefined, "en");
  expect(quotes.map((item) => item?.priceCents)).toStrictEqual([600, undefined, 600]);
  expect(quotes[1]).toBeNull();
  // The plan id is the page's own key: the quote carries what the single form's does.
  expect(quotes[0]).toStrictEqual({
    code: "WELCOME",
    provider: "ldc",
    currency: "",
    basePriceCents: 750,
    discountCents: 150,
    priceCents: 600,
    firstPeriodOnly: true,
  });
  // ONE request: LDC is the default and is not sent, and a quantity goes with a seat plan only.
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toMatch(/\/api\/shop\/coupon$/);
  expect(calls[0]!.body).toStrictEqual({
    products: [
      { productId: PRODUCT_ID },
      { productId: PRODUCT_ID, provider: "stripe" },
      { productId: SEAT_ID, quantity: 7 },
    ],
    coupon: "welcome",
  });
  expect(calls[0]!.init).toMatchObject({ method: "POST", credentials: "same-origin" });

  // An answer that is not one entry per entry asked, for another plan or way of paying, or half right, never reaches the page.
  for (const body of [
    null,
    {},
    { quotes: {} },
    { quotes: [entry(PRODUCT_ID), null] },
    { quotes: [entry(PRODUCT_ID), null, entry(PRODUCT_ID)] },
    { quotes: [entry(PRODUCT_ID), cardEntry(PRODUCT_ID), entry(SEAT_ID, { provider: "stripe", currency: "usd" })] },
    { quotes: [entry(PRODUCT_ID, { priceCents: 700 }), null, null] },
    { quotes: [{ valid: false }, null, null] },
    // The single form's answer is not an answer to the several-plans form.
    quote,
  ]) {
    respond(body);
    await expect(previewCoupons(asks, "WELCOME"), JSON.stringify(body)).rejects.toBeInstanceOf(ShopApiError);
  }
});

/** Answers each request by its form, like a mail with the several-plans form (or, with `legacy`, one before it), and records them. */
function couponBackend(options: { legacy?: boolean; failAt?: number; status?: number } = {}) {
  const calls: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit = {}) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push(body);
    if (calls.length === options.failAt) return Response.json({ error: "later" }, { status: options.status ?? 429 });
    if (Array.isArray(body.products)) {
      if (options.legacy) return Response.json({ error: "Choose a plan." }, { status: 400 });
      return Response.json({
        quotes: (body.products as { productId: string; provider?: string }[]).map((item) =>
          item.provider === "stripe" ? null : entry(item.productId),
        ),
      });
    }
    return Response.json(body.provider === "stripe" ? { valid: false } : quote);
  });
  return calls;
}

/** `count` plans, each by LDC and by card: 2 × count things to ask about. */
const catalogAsks = (count: number): CouponAsk[] =>
  Array.from({ length: count }, (_, index) => `plan${String(index).padStart(11, "0")}`).flatMap((productId) => [
    { productId, provider: "ldc" as const },
    { productId, provider: "stripe" as const },
  ]);

test("apply: the plans of the page are asked about in one request, and a larger catalog in as few as it takes", async () => {
  expect([COUPON_PREVIEW_PLANS, COUPON_PREVIEW_REQUESTS]).toStrictEqual([8, 4]);
  // Up to eight combinations: one request, one guess against mail's limit.
  for (const plans of [1, 3, 4]) {
    const calls = couponBackend();
    const result = await previewCouponPlans(catalogAsks(plans), "WELCOME");
    expect(calls, String(plans)).toHaveLength(1);
    expect(calls[0]!.products).toHaveLength(plans * 2);
    expect(result).toStrictEqual({
      quotes: catalogAsks(plans).map(({ provider }) => (provider === "stripe" ? null : expect.any(Object))),
      legacy: false,
    });
  }
  // Nine or more: further requests of up to eight, in the order of the page, and no more than there are plans to ask about.
  const five = couponBackend();
  const fiveResult = await previewCouponPlans(catalogAsks(5), "WELCOME");
  expect(five.map((body) => (body.products as unknown[]).length)).toStrictEqual([8, 2]);
  expect(fiveResult.quotes.filter((item) => item === undefined)).toHaveLength(0);
  expect((five[1]!.products as CouponAsk[])[0]!.productId).toBe(catalogAsks(5)[8]!.productId);
  // A press stops at four requests: what is past them was not asked ("checked when you order"), never called unusable.
  const twenty = couponBackend();
  const twentyResult = await previewCouponPlans(catalogAsks(20), "WELCOME");
  expect(twenty).toHaveLength(COUPON_PREVIEW_REQUESTS);
  expect(twentyResult.quotes.slice(0, 32).every((item) => item !== undefined)).toBe(true);
  expect(twentyResult.quotes.slice(32)).toStrictEqual(Array.from({ length: 8 }, () => undefined));
  const keyed = Object.fromEntries(
    twentyResult.quotes.flatMap((item, index) => (item === undefined ? [] : [[String(index), null] as const])),
  );
  expect(couponVerdict(keyed, 40)).toBe("unchecked");

  // A failure part-way keeps what was answered and reports the error instead of throwing.
  couponBackend({ failAt: 2 });
  const partial = await previewCouponPlans(catalogAsks(5), "WELCOME");
  expect(partial.error).toMatchObject({ status: 429 });
  expect(partial.quotes.map((item) => item === undefined)).toStrictEqual([
    ...Array.from({ length: 8 }, () => false),
    true,
    true,
  ]);
  // A backend without discount codes: the 404 reaches the page, which hides the field.
  couponBackend({ failAt: 1, status: 404 });
  const missing = await previewCouponPlans(catalogAsks(2), "WELCOME");
  expect(missing).toMatchObject({ legacy: false, error: { status: 404 } });
  expect(missing.quotes).toStrictEqual([undefined, undefined, undefined, undefined]);
});

test("apply: a mail before the several-plans form answers 400 to it, and is then asked plan by plan in the single form", async () => {
  const calls = couponBackend({ legacy: true });
  const asks: CouponAsk[] = [
    { productId: PRODUCT_ID, provider: "ldc" },
    { productId: PRODUCT_ID, provider: "stripe" },
    { productId: SEAT_ID, provider: "ldc", quantity: 7 },
    { productId: SEAT_ID, provider: "stripe", quantity: 7 },
    { productId: "anotherplan0001", provider: "ldc" },
  ];
  const first = await previewCouponPlans(asks, "WELCOME", { lang: "en" });
  // The refused request counts as a guess too: three single previews follow, four requests in all.
  expect(calls).toHaveLength(COUPON_PREVIEW_REQUESTS);
  expect(calls[0]).toHaveProperty("products");
  expect(calls.slice(1)).toStrictEqual([
    { productId: PRODUCT_ID, coupon: "WELCOME" },
    { productId: PRODUCT_ID, provider: "stripe", coupon: "WELCOME" },
    { productId: SEAT_ID, coupon: "WELCOME", quantity: 7 },
  ]);
  expect(first.legacy).toBe(true);
  expect(first.error).toBeUndefined();
  expect(first.quotes.map((item) => (item === undefined ? "unasked" : item ? item.priceCents : null))).toStrictEqual([
    600,
    null,
    600,
    "unasked",
    "unasked",
  ]);

  // The page remembers: the next press starts with the single form and spends no guess on the form the backend lacks.
  const again = couponBackend({ legacy: true });
  const second = await previewCouponPlans(asks, "WELCOME", { legacy: true });
  expect(again).toHaveLength(COUPON_PREVIEW_REQUESTS);
  expect(again.every((body) => !("products" in body))).toBe(true);
  expect(second.quotes.filter((item) => item !== undefined)).toHaveLength(4);

  // A 400 to the single form too is a refusal to show, not a reason to ask again.
  vi.stubGlobal("fetch", async () => Response.json({ error: "Enter a discount code." }, { status: 400 }));
  const refused = await previewCouponPlans(asks, "WELCOME");
  expect(refused).toMatchObject({ legacy: true, error: { status: 400, message: "Enter a discount code." } });
});

test("checkout client: the code is sent only when there is one, next to the other optional fields", async () => {
  const calls = respond({ orderId: "abcdefghijklmno" }, 201);
  await createShopOrder(PRODUCT_ID, "en");
  await createShopOrder(PRODUCT_ID, "en", "", "ldc", "WELCOME");
  await createShopOrder(PRODUCT_ID, "en", "me@example.com", "stripe", "welcome");
  expect(calls.map((call) => call.body)).toStrictEqual([
    { productId: PRODUCT_ID },
    { productId: PRODUCT_ID, coupon: "WELCOME" },
    { productId: PRODUCT_ID, email: "me@example.com", provider: "stripe", coupon: "welcome" },
  ]);
});

test("catalog client: the discount code flag is three-state, since a mail before it does not send it", () => {
  // mail always sends it (the fixture is shaped after mail's catalog); only a mail before the flag leaves it out.
  expect(parseShopCatalog(catalogResponse).coupons).toBe(true);
  const { coupons: _flag, ...before } = catalogResponse;
  void _flag;
  expect(parseShopCatalog(before)).not.toHaveProperty("coupons");
  expect(parseShopCatalog({ ...catalogResponse, coupons: false }).coupons).toBe(false);
  expect(parseShopCatalog({ ...catalogResponse, coupons: "yes" })).not.toHaveProperty("coupons");
});

test("order client: an order with a code is accepted as mail publishes it, and as a mail before the code fields did", async () => {
  const pending = { ...orderResponse, code: null, codeStatus: null, subscription: null };
  // A mail before the two code fields publishes neither.
  const { couponCode: _code, couponDiscountCents: _discount, ...before } = orderResponse.order;
  void [_code, _discount];
  const order = { ...before, provider: "ldc", currency: "", status: "pending", paidAt: null };
  const read = async (fields: object) => {
    vi.stubGlobal("fetch", async () => Response.json({ ...pending, order: { ...order, ...fields } }));
    return (await getShopOrder(order.id)).order;
  };
  // Before the fields, without a plan discount: the original price was published as the price paid.
  expect(await read({ originalPriceCents: 400, discountPercent: 0, priceCents: 400 })).not.toHaveProperty("couponCode");
  // With a plan discount: the stored original price and percentage, and the lower price actually paid.
  expect((await read({ originalPriceCents: 1000, discountPercent: 25, priceCents: 600 })).priceCents).toBe(600);
  // Now: the code and what it took off, and the stored original price even without a plan discount.
  const published = await read({
    originalPriceCents: 500,
    discountPercent: 0,
    priceCents: 400,
    couponCode: "WELCOME",
    couponDiscountCents: 100,
  });
  expect(published).toMatchObject({ couponCode: "WELCOME", couponDiscountCents: 100, originalPriceCents: 500 });
  // The original price may only differ from the price paid by exactly what the code took off.
  await expect(
    read({ originalPriceCents: 500, discountPercent: 0, priceCents: 400, couponDiscountCents: 50 }),
  ).rejects.toBeInstanceOf(ShopApiError);
  await expect(read({ originalPriceCents: 500, discountPercent: 0, priceCents: 400 })).rejects.toBeInstanceOf(
    ShopApiError,
  );
  await expect(read({ couponDiscountCents: -1 })).rejects.toBeInstanceOf(ShopApiError);
  await expect(read({ couponCode: 7 })).rejects.toBeInstanceOf(ShopApiError);
  // A plan's price is checked as before: a code is never part of the catalog.
  expect(validPrice({ originalPriceCents: 500, discountPercent: 0, priceCents: 400 })).toBe(false);
});

/* ---- What the order page can say about an order's code ---- */

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

beforeEach(() => vi.stubGlobal("sessionStorage", memoryStorage()));

const ORDER = "abcdefghijklmno";

test("coupon: what was typed is trimmed and bounded like mail reads it", () => {
  expect(normalizeCoupon("  welcome \n")).toBe("welcome");
  expect(normalizeCoupon("   ")).toBe("");
  expect(normalizeCoupon("x".repeat(100))).toHaveLength(COUPON_MAX_LENGTH);
});

test("coupon: the shop remembers the code and the price before it per order, in this tab only", () => {
  expect(recallCoupon(ORDER)).toBeNull();
  rememberCoupon({ orderId: ORDER, code: "WELCOME", baseCents: 750 });
  expect(recallCoupon(ORDER)).toStrictEqual({ orderId: ORDER, code: "WELCOME", baseCents: 750 });
  expect(recallCoupon("zzzzzzzzzzzzzzz")).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(COUPON_STORAGE_KEY)!)).toHaveLength(1);
  // The same order again replaces its entry; only the last few orders are kept.
  rememberCoupon({ orderId: ORDER, code: "LDC1", baseCents: 750 });
  expect(recallCoupon(ORDER)?.code).toBe("LDC1");
  for (let index = 0; index < 6; index += 1)
    rememberCoupon({ orderId: `order${String(index).padStart(10, "0")}`, code: "WELCOME", baseCents: 500 });
  expect(JSON.parse(sessionStorage.getItem(COUPON_STORAGE_KEY)!)).toHaveLength(5);
  expect(recallCoupon(ORDER)).toBeNull();
});

test("coupon: tampered or malformed storage, and blocked storage, mean no breakdown rather than a wrong one", () => {
  for (const bad of [
    "not json",
    "{}",
    JSON.stringify([{ orderId: "../x", code: "A", baseCents: 1 }]),
    JSON.stringify([{ orderId: ORDER, code: "", baseCents: 750 }]),
    JSON.stringify([{ orderId: ORDER, code: "WELCOME", baseCents: -5 }]),
    JSON.stringify([{ orderId: ORDER, code: "WELCOME", baseCents: 7.5 }]),
  ]) {
    sessionStorage.setItem(COUPON_STORAGE_KEY, bad);
    expect(recallCoupon(ORDER), bad).toBeNull();
  }
  rememberCoupon({ orderId: "nope", code: "WELCOME", baseCents: 750 });
  expect(recallCoupon("nope")).toBeNull();
  vi.stubGlobal("sessionStorage", undefined);
  expect(() => rememberCoupon({ orderId: ORDER, code: "WELCOME", baseCents: 750 })).not.toThrow();
  expect(recallCoupon(ORDER)).toBeNull();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  expect(recallCoupon(ORDER)).toBeNull();
});

test("order page: the discount of an order with a code is visible although mail publishes its original price as the price paid", () => {
  const hint = { orderId: ORDER, code: "WELCOME", baseCents: 500 };
  const order = {
    id: ORDER,
    kind: "purchase" as const,
    provider: "ldc" as const,
    originalPriceCents: 400,
    discountPercent: 0,
    priceCents: 400,
  };
  // mail's quirk: no plan discount, so original = paid. The price before the code comes from what the shop remembered.
  expect(orderCoupon(order, hint)).toStrictEqual({ code: "WELCOME", discountCents: 100, baseCents: 500 });
  // With a plan discount the three fields stay as stored: 10.00, 25% off, and 6.00 paid instead of 7.50.
  const discounted = { ...order, originalPriceCents: 1000, discountPercent: 25, priceCents: 600 };
  expect(orderCoupon(discounted, { ...hint, baseCents: 750 })).toStrictEqual({
    code: "WELCOME",
    discountCents: 150,
    baseCents: 750,
  });
  // A card order is priced in the currency's smallest unit; the same arithmetic applies.
  expect(
    orderCoupon(
      { ...order, provider: "stripe", originalPriceCents: 239, priceCents: 239 },
      { ...hint, baseCents: 299 },
    ),
  ).toStrictEqual({ code: "WELCOME", discountCents: 60, baseCents: 299 });

  // Nothing remembered (another browser, a new tab): the page shows the price as mail gives it.
  expect(orderCoupon(order, null)).toBeNull();
  // Remembered for another order, or the order costs what it would without a code: no code was applied.
  expect(orderCoupon(order, { ...hint, orderId: "zzzzzzzzzzzzzzz" })).toBeNull();
  expect(orderCoupon(order, { ...hint, baseCents: 400 })).toBeNull();
  expect(orderCoupon(order, { ...hint, baseCents: 300 })).toBeNull();
  // A remembered price above the plan's original price is not a price after the plan discount.
  expect(orderCoupon(discounted, { ...hint, baseCents: 1001 })).toBeNull();
  // It can equal it: 1% off 0.50 rounds back to 0.50, and a code that takes 0.05 off that still shows.
  expect(
    orderCoupon({ ...order, originalPriceCents: 50, discountPercent: 1, priceCents: 45 }, { ...hint, baseCents: 50 }),
  ).toStrictEqual({ code: "WELCOME", discountCents: 5, baseCents: 50 });
  // A code never applies to a renewal order.
  expect(orderCoupon({ ...order, kind: "renewal" }, hint)).toBeNull();
});

test("order page: once mail publishes the code with the order, its fields win over what the browser remembered", () => {
  const order = {
    id: ORDER,
    kind: "purchase" as const,
    originalPriceCents: 500,
    discountPercent: 0,
    priceCents: 400,
    couponCode: "SPRING",
    couponDiscountCents: 100,
  };
  expect(orderCoupon(order, { orderId: ORDER, code: "WELCOME", baseCents: 900 })).toStrictEqual({
    code: "SPRING",
    discountCents: 100,
    baseCents: 500,
  });
  expect(orderCoupon({ ...order, couponCode: undefined }, null)).toStrictEqual({
    code: "",
    discountCents: 100,
    baseCents: 500,
  });
  // "" and 0 are mail's "no code".
  expect(orderCoupon({ ...order, couponCode: "", couponDiscountCents: 0, originalPriceCents: 400 }, null)).toBeNull();
});

test("copy: both languages say that a code cannot be used without giving a reason, and name the code on the order", () => {
  for (const lang of ["zh", "en"] as const) {
    const t = shopCopy[lang];
    expect(t.couponInvalid).not.toMatch(/expired|used up|过期|用完|不存在|unknown/i);
    expect(t.couponUnchecked).not.toMatch(/expired|used up|过期|用完|不存在|unknown/i);
    expect(t.couponUnchecked).not.toBe(t.couponInvalid);
    expect(t.orderCoupon("WELCOME")).toContain("WELCOME");
    expect(t.orderCoupon("")).not.toMatch(/\s$/);
    expect(t.couponWith("WELCOME", t.couponPriceLdc("6.00"))).toContain("6.00 LDC");
  }
});

test("shop page: a typed code always goes with checkout, and the page never previews as the buyer types", () => {
  const source = readFileSync("src/storefront/components/Shop.tsx", "utf8");
  // Whatever is in the field is sent: a code that was typed but not previewed is refused or applied by mail, never dropped.
  expect(source).toMatch(/createShopOrder\(productId, lang, email\.trim\(\), provider, typedCoupon, seats\)/);
  // Each request is a code guess against mail's limit of 10 per 10 minutes: only "Apply" asks, through the one client that
  // puts the plans of the page into as few requests as the backend allows; the page itself never asks plan by plan.
  expect(source.match(/previewCouponPlans\(/g)).toHaveLength(1);
  expect(source).not.toMatch(/previewCoupons?\(/);
  // A backend that refused the several-plans form is asked plan by plan from the next press on.
  expect(source).toMatch(/legacy: couponLegacy\.current/);
  expect(source).toMatch(/couponLegacy\.current = result\.legacy;/);
  expect(source).not.toMatch(/onChange=\{[^}]*applyCoupon/);
  // A backend without discount codes, or a catalog that says so, hides the field.
  expect(source).toMatch(/catalog\?\.coupons !== false && !couponsMissing/);
  expect(source).toMatch(/error\.status === 404\) \{\s*setCouponsMissing\(true\)/);
});

test("shop page: a code is only called unusable once every plan and way of paying on offer was asked about", () => {
  const quote = { code: "WELCOME", priceCents: 400 };
  expect(couponVerdict({ "a:ldc": null, "a:stripe": quote }, 2)).toBe("applied");
  expect(couponVerdict({ "a:ldc": null, "a:stripe": null }, 2)).toBe("refused");
  // Six on offer, four previewed and refused: one of the other two may take the code, so checkout decides.
  const four = { "a:ldc": null, "a:stripe": null, "b:ldc": null, "b:stripe": null };
  expect(couponVerdict(four, 6)).toBe("unchecked");
  expect(couponVerdict(four, 4)).toBe("refused");
  // A preview that failed part-way leaves plans unasked too.
  expect(couponVerdict({ "a:ldc": null }, 2)).toBe("unchecked");
  const source = readFileSync("src/storefront/components/Shop.tsx", "utf8");
  // What is on offer is counted whatever was asked; a plan that was not asked about gets no entry.
  expect(source).toMatch(/if \(quote === undefined\) return;/);
  expect(source).toMatch(/setApplied\(\{ code, quotes, offered: offered\.length \}\)/);
  expect(source).toMatch(/\[couponVerdict\(applied\.quotes, applied\.offered\)\]/);
});

/* ---- The mock API of next dev ---- */

const NOW = Date.parse("2026-11-10T00:00:00.000Z");
const ONE_TIME = "demoproduct0001";
const MONTHLY = "demoproduct0002";

function mockPost(route: string, body: unknown, headers: HeadersInit = {}): Request {
  return new Request(`http://localhost:4320/api/shop/${route}`, {
    method: "POST",
    headers: { Origin: "http://localhost:4320", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("dev shop: the preview prices a code like mail, with one answer for every reason it cannot be used", async () => {
  const store = new MockShopStore(() => NOW);
  const ask = async (body: unknown, headers?: HeadersInit) => {
    const response = await store.fetch("coupon", mockPost("coupon", body, headers));
    return [response.status, await response.json()] as const;
  };
  expect(Object.keys(MOCK_COUPONS)).toStrictEqual(["WELCOME", "LDC1", "MONTHLY"]);
  // 20% off the plan's discounted price, in any case as typed.
  expect(await ask({ productId: ONE_TIME, coupon: " welcome " })).toStrictEqual([
    200,
    {
      valid: true,
      code: "WELCOME",
      provider: "ldc",
      currency: "",
      basePriceCents: 750,
      discountCents: 150,
      priceCents: 600,
      firstPeriodOnly: false,
    },
  ]);
  // A card price is in the currency's smallest unit, rounded half up; a subscription says first period only.
  expect(await ask({ productId: MONTHLY, provider: "stripe", coupon: "WELCOME" })).toStrictEqual([
    200,
    {
      valid: true,
      code: "WELCOME",
      provider: "stripe",
      currency: "usd",
      basePriceCents: 299,
      discountCents: 60,
      priceCents: 239,
      firstPeriodOnly: true,
    },
  ]);
  const unusable = [200, { valid: false }];
  // Unknown code, a code for another plan, a code with no card amount, a plan without a card price, an unknown plan: all the same.
  expect(await ask({ productId: ONE_TIME, coupon: "NOPE" })).toStrictEqual(unusable);
  expect(await ask({ productId: ONE_TIME, coupon: "MONTHLY" })).toStrictEqual(unusable);
  expect(await ask({ productId: MONTHLY, provider: "stripe", coupon: "LDC1" })).toStrictEqual(unusable);
  expect(await ask({ productId: ONE_TIME, provider: "stripe", coupon: "WELCOME" })).toStrictEqual(unusable);
  expect(await ask({ productId: "unknownproduct1", coupon: "WELCOME" })).toStrictEqual(unusable);
  expect(await ask({ productId: ONE_TIME, coupon: "constructor" })).toStrictEqual(unusable);
  // A malformed request is a 400, in the request's language.
  expect((await ask({ coupon: "WELCOME" }))[0]).toBe(400);
  expect((await ask({ productId: ONE_TIME, provider: "paypal", coupon: "WELCOME" }))[0]).toBe(400);
  expect(await ask({ productId: ONE_TIME, coupon: "  " }, { "Accept-Language": "en" })).toStrictEqual([
    400,
    { error: "Enter a discount code." },
  ]);
  const crossSite = await store.fetch(
    "coupon",
    mockPost("coupon", { productId: ONE_TIME, coupon: "WELCOME" }, { Origin: "https://attacker.example" }),
  );
  expect(crossSite.status).toBe(403);
  const get = await store.fetch("coupon", new Request("http://localhost:4320/api/shop/coupon"));
  expect([get.status, get.headers.get("Allow")]).toStrictEqual([405, "POST"]);

  // Every valid answer passes the client parser the page uses.
  const viaClient = async (productId: string, provider: "ldc" | "stripe", code: string) => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) =>
      store.fetch(
        "coupon",
        new Request("http://localhost:4320/api/shop/coupon", {
          ...init,
          headers: { ...Object.fromEntries(new Headers(init.headers)), Origin: "http://localhost:4320" },
        }),
      ),
    );
    return previewCoupon(productId, provider, code);
  };
  expect((await viaClient(MONTHLY, "ldc", "monthly"))?.priceCents).toBe(250);
  expect(await viaClient(ONE_TIME, "ldc", "MONTHLY")).toBeNull();
});

test("dev shop: checkout prices the order with the code or creates none, and publishes the order with its code as mail does", async () => {
  const store = new MockShopStore(() => NOW);
  const checkout = (body: unknown, headers?: HeadersInit) =>
    store.fetch("checkout", mockPost("checkout", body, headers));
  const order = async (response: Response) => {
    const { orderId } = (await response.json()) as { orderId: string };
    const cookie = response.headers.get("Set-Cookie")!.split(";")[0]!;
    const read = await store.fetch(
      "orders",
      new Request(`http://localhost:4320/api/shop/orders?id=${orderId}`, { headers: { Cookie: cookie } }),
    );
    return ((await read.json()) as { order: Record<string, unknown> }).order;
  };

  // No plan discount (the monthly plan): the stored original price, the code and what it took off; renewals stay at the full price.
  const monthly = await order(await checkout({ productId: MONTHLY, coupon: "monthly" }));
  expect(monthly).toMatchObject({
    originalPriceCents: 500,
    discountPercent: 0,
    priceCents: 250,
    renewPriceCents: 400,
    couponCode: "MONTHLY",
    couponDiscountCents: 250,
  });
  // A plan discount stays as stored, with the lower price actually paid.
  const oneTime = await order(await checkout({ productId: ONE_TIME, coupon: "LDC1" }));
  expect(oneTime).toMatchObject({
    originalPriceCents: 1000,
    discountPercent: 25,
    priceCents: 650,
    couponCode: "LDC1",
    couponDiscountCents: 100,
  });
  // A card order: the fiat price with the code, and the full price for every later period.
  const card = await order(await checkout({ productId: MONTHLY, provider: "stripe", coupon: "WELCOME" }));
  expect(card).toMatchObject({
    originalPriceCents: 299,
    priceCents: 239,
    renewPriceCents: 299,
    currency: "usd",
    couponCode: "WELCOME",
    couponDiscountCents: 60,
  });
  // Published with the order since mail's contract took the two fields; an order without a code carries "" and 0.
  const plain = await order(await checkout({ productId: MONTHLY }));
  expect(plain).toMatchObject({ couponCode: "", couponDiscountCents: 0, originalPriceCents: 500, priceCents: 500 });
  for (const published of [monthly, oneTime, card, plain]) expect(published).not.toHaveProperty("coupon");

  // A code that cannot be used fails the checkout with one message and sets no purchase cookie: the buyer is never charged the full price silently.
  for (const body of [
    { productId: ONE_TIME, coupon: "NOPE" },
    { productId: ONE_TIME, coupon: "MONTHLY" },
    { productId: MONTHLY, provider: "stripe", coupon: "LDC1" },
    { productId: ONE_TIME, coupon: 7 },
  ]) {
    const refused = await checkout(body, { "Accept-Language": "en" });
    // Since contract version 3 the refusal carries its code and the text in both languages next to `error`.
    expect([refused.status, await refused.json()], JSON.stringify(body)).toStrictEqual([
      400,
      {
        error: "This discount code can't be used for this order.",
        code: "coupon_invalid",
        messages: { zh: "此优惠码不能用于这笔订单。", en: "This discount code can't be used for this order." },
      },
    ]);
    expect(refused.headers.get("Set-Cookie")).toBeNull();
  }
  // No code, null or blank is an ordinary order.
  for (const coupon of [undefined, null, "  "]) {
    expect((await order(await checkout({ productId: ONE_TIME, coupon }))).priceCents).toBe(750);
  }
});

/** The clients of the page against the demo backend. */
function throughMock(store: MockShopStore) {
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    const route = new URL(url, "http://localhost:4320").pathname.replace(/^\/api\/shop\//, "");
    return store.fetch(
      route.split("?")[0]!,
      new Request(new URL(url, "http://localhost:4320"), {
        ...init,
        headers: { ...Object.fromEntries(new Headers(init.headers)), Origin: "http://localhost:4320" },
      }),
    );
  });
}

test("dev shop: several plans are previewed in one request, like mail, and the catalog says codes are offered", async () => {
  const store = new MockShopStore(() => NOW);
  const ask = async (body: unknown) => {
    const response = await store.fetch("coupon", mockPost("coupon", body));
    return [response.status, await response.json()] as const;
  };
  // One entry per entry asked, in that order: a quote with its plan, or null where the single form says `valid: false`.
  expect(
    await ask({
      products: [
        { productId: ONE_TIME },
        { productId: ONE_TIME, provider: "stripe" },
        { productId: MONTHLY, provider: "stripe" },
        { productId: "unknownproduct1" },
      ],
      coupon: "welcome",
    }),
  ).toStrictEqual([
    200,
    {
      quotes: [
        {
          productId: ONE_TIME,
          code: "WELCOME",
          provider: "ldc",
          currency: "",
          basePriceCents: 750,
          discountCents: 150,
          priceCents: 600,
          firstPeriodOnly: false,
        },
        null,
        {
          productId: MONTHLY,
          code: "WELCOME",
          provider: "stripe",
          currency: "usd",
          basePriceCents: 299,
          discountCents: 60,
          priceCents: 239,
          firstPeriodOnly: true,
        },
        null,
      ],
    },
  ]);
  // `products` wins when both forms are sent; a seat plan's entry needs its quantity.
  const both = await ask({ productId: MONTHLY, products: [{ productId: ONE_TIME }], coupon: "WELCOME" });
  expect(both[1]).toMatchObject({ quotes: [{ productId: ONE_TIME }] });
  // An empty list, more than eight entries or one malformed entry is a 400 for the whole request, with no partial answer.
  const nine = Array.from({ length: 9 }, () => ({ productId: ONE_TIME }));
  for (const products of [
    [],
    nine,
    {},
    [{ productId: ONE_TIME }, {}],
    [{ productId: ONE_TIME, provider: "paypal" }],
    [7],
  ])
    expect((await ask({ products, coupon: "WELCOME" }))[0], JSON.stringify(products)).toBe(400);
  expect((await ask({ products: [{ productId: ONE_TIME }], coupon: " " }))[0]).toBe(400);
  expect((await ask({ products: nine.slice(0, 8), coupon: "WELCOME" }))[0]).toBe(200);

  // Through the page's clients: the catalog offers the field, and one request answers for every plan and way of paying.
  throughMock(store);
  const catalog = await getShopCatalog();
  expect(catalog.coupons).toBe(true);
  const asks = catalogPlans(catalog).flatMap((product) => {
    const quantity = isSeatProduct(product) ? product.minQuantity : 0;
    return [
      { productId: product.id, provider: "ldc" as const, quantity },
      ...(product.fiatPriceMinor ? [{ productId: product.id, provider: "stripe" as const, quantity }] : []),
    ];
  });
  const fetched = vi.spyOn(store, "fetch");
  const result = await previewCouponPlans(asks, "WELCOME");
  expect(fetched).toHaveBeenCalledTimes(1);
  expect(result.legacy).toBe(false);
  expect(result.error).toBeUndefined();
  expect(result.quotes.every(Boolean)).toBe(true);
  expect(result.quotes.map((item) => item?.provider)).toStrictEqual(asks.map((item) => item.provider));
});

test("dev shop: MOCK_COUPONS=legacy behaves like a mail with discount codes before the flag, the several-plans form and the order fields", async () => {
  const store = new MockShopStore(() => NOW, true, "legacy");
  throughMock(store);
  // No flag: the page offers the field and would hide it on a 404.
  const catalog = await getShopCatalog();
  expect(catalog).not.toHaveProperty("coupons");
  // The several-plans form is read as the single form without a plan: 400, and the page asks plan by plan.
  const refused = await store.fetch(
    "coupon",
    mockPost("coupon", { products: [{ productId: ONE_TIME }], coupon: "WELCOME" }),
  );
  expect(refused.status).toBe(400);
  const fetched = vi.spyOn(store, "fetch");
  const result = await previewCouponPlans(
    [
      { productId: ONE_TIME, provider: "ldc" },
      { productId: MONTHLY, provider: "ldc" },
      { productId: MONTHLY, provider: "stripe" },
    ],
    "WELCOME",
  );
  expect(fetched).toHaveBeenCalledTimes(4);
  expect(result.legacy).toBe(true);
  expect(result.quotes.map((item) => item?.priceCents)).toStrictEqual([600, 400, 239]);

  // An order with a code is published without the two fields, and without a plan discount at the price paid: the order page
  // then has only what the tab remembered. The account's order list carries no code either.
  const response = await store.fetch("checkout", mockPost("checkout", { productId: MONTHLY, coupon: "MONTHLY" }));
  const { orderId } = (await response.json()) as { orderId: string };
  const cookie = response.headers.get("Set-Cookie")!.split(";")[0]!;
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) =>
    store.fetch(
      "orders",
      new Request(new URL(url, "http://localhost:4320"), { ...init, headers: { ...init.headers, Cookie: cookie } }),
    ),
  );
  const { order } = await getShopOrder(orderId);
  expect(order).toMatchObject({ originalPriceCents: 250, discountPercent: 0, priceCents: 250 });
  expect(order).not.toHaveProperty("couponCode");
  expect(order).not.toHaveProperty("couponDiscountCents");
  expect(orderCoupon(order, { orderId, code: "MONTHLY", baseCents: 500 })).toStrictEqual({
    code: "MONTHLY",
    discountCents: 250,
    baseCents: 500,
  });
});

test("dev shop: the account's order list carries each order's code and what it took off, like mail", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const listed = async (store: MockShopStore) => {
    const email = "buyer@example.test";
    await store.fetch("checkout", mockPost("checkout", { productId: MONTHLY, coupon: "monthly", email }));
    await store.fetch("checkout", mockPost("checkout", { productId: ONE_TIME, email }));
    await store.fetch("account/login", mockPost("account/login", { email }));
    const token = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0]))![1];
    const verified = await store.fetch("account/verify", mockPost("account/verify", { token }));
    const session = verified.headers.get("Set-Cookie")!.split(";")[0]!;
    vi.stubGlobal("fetch", (url: string) =>
      store.fetch("account", new Request(new URL(url, "http://localhost:4320"), { headers: { Cookie: session } })),
    );
    // Through the client the account page uses.
    return (await getAccount())!.orders.toSorted((a, b) => a.priceCents - b.priceCents);
  };
  const [withCode, plain] = await listed(new MockShopStore(() => NOW));
  expect(withCode).toMatchObject({ priceCents: 250, couponCode: "MONTHLY", couponDiscountCents: 250 });
  expect(plain).toMatchObject({ priceCents: 750, couponCode: "", couponDiscountCents: 0 });
  // A mail before the fields lists the same orders without them, and the page shows no code.
  for (const order of await listed(new MockShopStore(() => NOW, true, "legacy"))) {
    expect(order).not.toHaveProperty("couponCode");
    expect(order).not.toHaveProperty("couponDiscountCents");
  }
  info.mockRestore();
  // The list shows the code and the amount off only for an order that has one, labelled in both languages.
  const page = readFileSync("src/storefront/components/ShopAccount.tsx", "utf8");
  expect(page).toMatch(/Boolean\(order\.couponDiscountCents\) &&/);
  expect(page).toMatch(/<ShopMetaRow label=\{t\.orderCoupon\(""\)\}>/);
  expect(page).not.toMatch(/recallCoupon|sessionStorage/);
  for (const lang of ["en", "zh"] as const) expect(shopCopy[lang].orderCoupon("")).not.toBe("");
});

test("dev shop: with discount codes off it behaves like a mail before them: a 404 preview, and checkout ignores the field", async () => {
  const store = new MockShopStore(() => NOW, true, false);
  const preview = await store.fetch("coupon", mockPost("coupon", { productId: ONE_TIME, coupon: "WELCOME" }));
  expect(preview.status).toBe(404);
  const response = await store.fetch("checkout", mockPost("checkout", { productId: ONE_TIME, coupon: "NOPE" }));
  expect(response.status).toBe(201);
});

/* ---- The Worker's proxy ---- */

function bindings(mail: (request: Request) => Promise<Response>): StorefrontEnv {
  return { MAIL: { fetch: mail }, MAIL_ORIGIN: mailOrigin };
}

function couponRequest(init: RequestInit = {}, headers: Record<string, string> = {}): Request {
  return new Request(`${siteOrigin}/api/shop/coupon`, {
    method: "POST",
    body: '{"productId":"productabcdefgh","coupon":"WELCOME"}',
    headers: { Origin: siteOrigin, "Content-Type": "application/json", ...headers },
    ...init,
  });
}

test("shop proxy: the code preview is proxied like checkout: the buyer's two cookies, the visitor's IP and Origin, never cached", async () => {
  const buyer = `mailhq_shop=${"a".repeat(64)}`;
  const customer = `mailhq_customer=${"c".repeat(43)}`;
  const mail = vi.fn(async (request: Request) => {
    expect(request.url).toBe(`${mailOrigin}/api/shop/coupon`);
    expect(request.method).toBe("POST");
    // A per-buyer limit is known to the preview only with the purchase session and the account; nothing else is forwarded.
    expect(request.headers.get("cookie")).toBe(`${buyer}; ${customer}`);
    expect(request.headers.get("authorization")).toBeNull();
    expect(request.headers.get("origin")).toBe(siteOrigin);
    // mail limits code guesses by this address.
    expect(request.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
    expect(await request.text()).toBe('{"productId":"productabcdefgh","coupon":"WELCOME"}');
    return Response.json(
      { valid: false },
      { headers: { "Set-Cookie": "mailhq_shop=x", "Cache-Control": "public, max-age=3600" } },
    );
  });
  const response = await worker.fetch(
    couponRequest(
      {},
      {
        Cookie: `${buyer}; ${customer}; session=admin`,
        Authorization: "Bearer admin",
        "CF-Connecting-IP": "203.0.113.9",
      },
    ),
    bindings(mail),
  );
  expect(mail).toHaveBeenCalledOnce();
  expect([response.status, await response.json()]).toStrictEqual([200, { valid: false }]);
  // A preview sets no session, and its answer depends on the buyer.
  expect(response.headers.getSetCookie()).toStrictEqual([]);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
});

test("shop proxy: the code preview is a same-origin JSON POST like every other shop write", async () => {
  const never = bindings(async () => {
    throw new Error("must not reach mail");
  });
  for (const origin of [undefined, "null", "https://attacker.example", "https://abnormalhq.com.attacker.example"]) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (origin) headers.set("Origin", origin);
    expect((await worker.fetch(couponRequest({ headers }), never)).status, String(origin)).toBe(403);
  }
  expect((await worker.fetch(couponRequest({}, { "Content-Type": "text/plain" }), never)).status).toBe(415);
  const get = await worker.fetch(new Request(`${siteOrigin}/api/shop/coupon`), never);
  expect([get.status, get.headers.get("Allow")]).toStrictEqual([405, "POST"]);
  expect((await worker.fetch(new Request(`${siteOrigin}/api/shop/coupons`), never)).status).toBe(404);
});

test("shop proxy: a mail before discount codes answers a JSON 404, so the shop hides the field instead of reporting an outage", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const html = await worker.fetch(
    couponRequest({}, { "Accept-Language": "en" }),
    bindings(
      async () => new Response("<html>Not found</html>", { status: 404, headers: { "Content-Type": "text/html" } }),
    ),
  );
  expect(html.status).toBe(404);
  expect(html.headers.get("Content-Type")).toMatch(/application\/json/);
  expect(await html.json()).toStrictEqual({ error: "Endpoint not found." });

  // Anything else that is not JSON is still "unavailable"; the limit on code guesses passes through with its Retry-After.
  const broken = await worker.fetch(
    couponRequest(),
    bindings(async () => new Response("upstream down", { status: 502, headers: { "Content-Type": "text/plain" } })),
  );
  expect(broken.status).toBe(503);
  const limited = await worker.fetch(
    couponRequest(),
    bindings(async () => Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "540" } })),
  );
  expect([limited.status, limited.headers.get("Retry-After")]).toStrictEqual([429, "540"]);
});

test("contract: the code preview and the order's code fields are in the contract file, as in mail's copy", () => {
  const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
    shop: { routes: Record<string, string>; publicOrderFields: string[] };
  };
  // mail's copy took the route and the two order fields (mail #221); both copies must stay byte for byte equal. The Worker's
  // contract test (tests/storefront/worker.test.ts) now covers the route like every other, and the order fixture carries the fields.
  expect(contract.shop.routes.coupon).toBe("POST");
  expect(contract.shop.publicOrderFields).toEqual(expect.arrayContaining(["couponCode", "couponDiscountCents"]));
  // The prose follows: nothing about discount codes is described as missing from mail or unused by the storefront any more.
  // (What is still open between the two repositories, seat plans and buyer domains, has its own tests.)
  const docs = readFileSync("docs/storefront-api.md", "utf8");
  expect(docs).not.toMatch(/Not used by the storefront yet/);
  expect(docs).toMatch(/\{ products: \[\{ productId, provider\?, quantity\? \}\], coupon \}/);
  for (const source of ["src/storefront/lib/catalog.ts", "src/storefront/lib/coupon.ts", "src/storefront/lib/shop.ts"])
    expect(readFileSync(source, "utf8"), source).not.toMatch(/does not (send|publish)[^.]*yet/);
});
