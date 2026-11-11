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
import { createShopOrder, getShopOrder, previewCoupon } from "@/storefront/lib/shop";
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
  expect(parseShopCatalog(catalogResponse)).not.toHaveProperty("coupons");
  expect(parseShopCatalog({ ...catalogResponse, coupons: true }).coupons).toBe(true);
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
  // Each preview is a code guess against mail's limit of 10 per 10 minutes: only "Apply" asks, and for a bounded number of plans.
  expect(source.match(/previewCoupon\(/g)).toHaveLength(1);
  expect(source).toMatch(/offered\.slice\(0, COUPON_PREVIEWS\)/);
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
  // What is on offer is counted before the preview limit cuts the list.
  expect(source).toMatch(/const asks = offered\.slice\(0, COUPON_PREVIEWS\);/);
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
    expect([refused.status, await refused.json()], JSON.stringify(body)).toStrictEqual([
      400,
      { error: "This discount code can't be used for this order." },
    ]);
    expect(refused.headers.get("Set-Cookie")).toBeNull();
  }
  // No code, null or blank is an ordinary order.
  for (const coupon of [undefined, null, "  "]) {
    expect((await order(await checkout({ productId: ONE_TIME, coupon }))).priceCents).toBe(750);
  }
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
  // What is still open between the two repositories (seat plans, buyer domains, a code on the order page) stays under "Proposed".
  expect(readFileSync("docs/storefront-api.md", "utf8").includes("\n## Proposed\n")).toBe(true);
});
