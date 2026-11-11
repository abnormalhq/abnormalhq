import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import {
  addSeats,
  catalogPlans,
  clampSeats,
  createShopOrder,
  getAccountMailboxes,
  getShopCatalog,
  getShopOrder,
  keepSeats,
  parseShopCatalog,
  previewCoupon,
  quoteSeats,
  removeSeats,
  seatOrderPrice,
  seatTotals,
  ShopApiError,
} from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import {
  MOCK_SEATS_CARD_DECLINED,
  MOCK_SEATS_PAYMENT_REQUIRED,
  MockShopStore,
  SEAT_PRODUCT,
} from "@/storefront/mock/shop";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import { SEAT_ROUTES } from "@/storefront/worker/shop";
import { catalogResponse } from "./fixtures/shop-contract";

/**
 * Seat plans ("Seat plans" in docs/storefront-api.md, mail's docs/shop.md "Seat-based plans"): the catalog's `seatProducts`, the
 * quantity at checkout and in the code preview, the seats of a subscription on the account page, the Worker's four routes and the
 * dev mock. The samples are shaped after mail's code (apps/console/src/lib/shop/public.ts, seats.ts and the seats routes).
 */

const ORIGIN = "http://localhost:4321";
const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";
const NOW = Date.parse("2026-09-22T00:00:00Z");
const DAY = 86_400_000;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A seat plan as mail's getPublicShop publishes it: every field of a product plus kind, seatMin, seatMax and customDomains. */
const seatProduct = {
  id: "seatplanabcdefg",
  kind: "seat",
  seatMin: 2,
  seatMax: 50,
  customDomains: 2,
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

/** A group of GET account/mailboxes for a seat subscription (mail's customerSeats). */
const seats = {
  seats: 5,
  seatsNext: null,
  min: 2,
  max: 50,
  seatPriceCents: 300,
  provider: "ldc",
  currency: "",
  periodEnd: "2026-10-22T00:00:00.000Z",
  removing: [],
};
const group = {
  orderId: "abcdefghijklmno",
  productName: "团队邮箱",
  code: "ABCD-EFGH-JKLM-NPQR",
  codeStatus: "available",
  usesLeft: 4,
  mailboxLimit: 5,
  codeExpires: null,
  domains: ["abnormal.bid"],
  locked: false,
  seats,
  mailboxes: [
    { id: "mailboxabcdefgh", email: "a@abnormal.bid", status: "active", quotaMb: 2048, usageMb: 1, created: "x" },
  ],
};
const mailboxes = { groups: [group], servers: {}, webmail: null };

function respond(body: unknown, status = 200, headers: HeadersInit = {}) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return Response.json(body, { status, headers });
  });
  return calls;
}

/* ---- The catalog ---- */

test("catalog: seat plans come under seatProducts, and products keeps ignoring them", async () => {
  respond({ ...catalogResponse, seatProducts: [seatProduct] });
  const catalog = await getShopCatalog();
  expect(catalog.products.map((product) => product.id)).toStrictEqual(["productabcdefgh"]);
  expect(catalog.seatProducts).toStrictEqual([
    {
      id: "seatplanabcdefg",
      name: "团队邮箱",
      description: "",
      originalPriceCents: 333,
      discountPercent: 10,
      priceCents: 300,
      mailboxCount: 2,
      quotaMb: 2048,
      quotaSupportedByDomain: { "abnormal.bid": true },
      codeExpiresDays: 30,
      domains: ["abnormal.bid"],
      periodDays: 30,
      // A mail before the explicit fields (contract version 3): the range comes from seatMin and seatMax, and the prices of
      // one seat from the plan's own price fields; a seat renews at its discounted price when the plan names none.
      renewPriceCents: 300,
      fiatPriceMinor: 199,
      customDomains: 2,
      minQuantity: 2,
      maxQuantity: 50,
      unitOriginalPriceCents: 333,
      unitPriceCents: 300,
      unitRenewPriceCents: 300,
      unitFiatPriceMinor: 199,
    },
  ]);
  expect(catalogPlans(catalog).map((product) => product.id)).toStrictEqual(["productabcdefgh", "seatplanabcdefg"]);
  // A backend before seat plans: no key, no seat plans, and the pages show none.
  const before = parseShopCatalog(catalogResponse);
  expect(before).not.toHaveProperty("seatProducts");
  expect(catalogPlans(before)).toHaveLength(1);
  // mail leaves the key out while no seat plan is on sale; an empty list reads the same.
  expect(parseShopCatalog({ ...catalogResponse, seatProducts: [] })).not.toHaveProperty("seatProducts");
  // A seat plan that slipped into `products` is a fixed plan to the parser: its seat fields are dropped, never half-read.
  const [stray] = parseShopCatalog({ ...catalogResponse, products: [seatProduct] }).products;
  expect(stray).not.toHaveProperty("seatMin");
  expect(stray).not.toHaveProperty("minQuantity");
  expect(stray).not.toHaveProperty("kind");
});

test("catalog: a seat plan with an unusable range or kind fails the whole answer, like any malformed plan", () => {
  for (const patch of [
    { kind: "fixed" },
    { kind: undefined },
    { seatMin: 0 },
    { seatMin: 3, seatMax: 2 },
    { seatMax: 1001 },
    { seatMax: "50" },
    { seatMin: 1.5 },
    { priceCents: 0 },
    { customDomains: -1 },
  ]) {
    expect(
      () => parseShopCatalog({ ...catalogResponse, seatProducts: [{ ...seatProduct, ...patch }] }),
      JSON.stringify(patch),
    ).toThrow(ShopApiError);
  }
  expect(() => parseShopCatalog({ ...catalogResponse, seatProducts: {} })).toThrow(ShopApiError);
  // customDomains 0 says the same as absent.
  const plain = parseShopCatalog({ ...catalogResponse, seatProducts: [{ ...seatProduct, customDomains: 0 }] });
  expect(plain.seatProducts![0]).not.toHaveProperty("customDomains");
});

test("quantity: typed values are kept inside the plan's range", () => {
  // A catalog seat plan's range, and the old names an upgrade plan of the renewal page carries.
  for (const plan of [
    { minQuantity: 2, maxQuantity: 50 },
    { seatMin: 2, seatMax: 50 },
  ]) {
    expect([1, 2, 7.9, 50, 51, Number.NaN, -3].map((value) => clampSeats(value, plan))).toStrictEqual([
      2, 2, 7, 50, 50, 2, 2,
    ]);
  }
});

/* ---- Checkout and the code preview ---- */

test("quantity: each way of paying has its own limit, so one that can take the quantity stays open", () => {
  const both = { ldc: true, card: true };
  // 1,500.00 LDC a seat is above one order's 1,000,000.00 at 700 seats; 19.99 by card is far below it.
  const dear = { originalPriceCents: 150_000, discountPercent: 0, fiatPriceMinor: 1999 };
  expect(seatTotals(dear, 700, both)).toStrictEqual({
    ldc: null,
    card: 1_399_300,
    ldcTooMany: true,
    cardTooMany: false,
    tooMany: false,
  });
  // The other way round: a card price in a currency with small units passes the limit while the LDC total does not.
  const smallUnits = { originalPriceCents: 333, discountPercent: 10, fiatPriceMinor: 250_000 };
  expect(seatTotals(smallUnits, 500, both)).toStrictEqual({
    ldc: { originalPriceCents: 166_500, priceCents: 149_850 },
    card: null,
    ldcTooMany: false,
    cardTooMany: true,
    tooMany: false,
  });
  // Only when no way on offer can take it is the whole quantity refused; a way that is not offered is never "too many".
  expect(seatTotals({ ...dear, fiatPriceMinor: 250_000 }, 700, both).tooMany).toBe(true);
  expect(seatTotals(dear, 700, { ldc: true, card: false })).toMatchObject({ cardTooMany: false, tooMany: true });
  expect(seatTotals(dear, 700, { ldc: false, card: true })).toMatchObject({ ldcTooMany: false, tooMany: false });
  expect(seatTotals(dear, 2, both)).toMatchObject({ ldcTooMany: false, cardTooMany: false, tooMany: false });

  // The limit is mail's to say: once a refusal named another one (`maxTotalCents`), the estimate follows it.
  expect(seatTotals(dear, 700, both, 200_000_000)).toMatchObject({ ldcTooMany: false, tooMany: false });
  expect(seatTotals(dear, 2, both, 250_000)).toMatchObject({ ldcTooMany: true, cardTooMany: false });

  // The page closes each button by its own way of paying, and says which one in both languages.
  const source = readFileSync("src/storefront/components/Shop.tsx", "utf8");
  expect(source).toMatch(/disabled=\{buying !== null \|\| !open\.ldc\}/);
  expect(source).toMatch(/disabled=\{buying !== null \|\| !open\.card\}/);
  for (const lang of ["en", "zh"] as const) {
    const t = shopCopy[lang];
    expect(new Set([t.seatTooMany, t.seatTooManyLdc, t.seatTooManyCard]).size).toBe(3);
    expect(t.seatTooManyLdc).toContain("LDC");
  }
});

test("checkout and the code preview send the quantity of a seat plan, and nothing new for a fixed plan", async () => {
  let calls = respond({ orderId: "abcdefghijklmno" }, 201);
  await createShopOrder("seatplanabcdefg", "en", "", "stripe", "WELCOME", 7);
  expect(calls[0]!.body).toStrictEqual({
    productId: "seatplanabcdefg",
    provider: "stripe",
    coupon: "WELCOME",
    quantity: 7,
  });
  await createShopOrder("productabcdefgh", "en");
  expect(calls[1]!.body).toStrictEqual({ productId: "productabcdefgh" });

  // The preview's amounts are for that many seats: the base is the whole order's price.
  calls = respond({
    valid: true,
    code: "WELCOME",
    provider: "ldc",
    currency: "",
    basePriceCents: 2098,
    discountCents: 420,
    priceCents: 1678,
    firstPeriodOnly: true,
  });
  const quote = await previewCoupon("seatplanabcdefg", "ldc", "welcome", undefined, "en", 7);
  expect(calls[0]!.body).toStrictEqual({ productId: "seatplanabcdefg", coupon: "welcome", quantity: 7 });
  expect([quote?.basePriceCents, quote?.priceCents]).toStrictEqual([2098, 1678]);
  await previewCoupon("productabcdefgh", "ldc", "welcome").catch(() => null);
  expect(calls[1]!.body).toStrictEqual({ productId: "productabcdefgh", coupon: "welcome" });
});

/* ---- The account's seats ---- */

test("account: a group's seats are read as mail sends them; null and absent mean no seats to change", async () => {
  respond(mailboxes);
  expect((await getAccountMailboxes())!.groups[0]!.seats).toStrictEqual(seats);
  respond({ ...mailboxes, groups: [{ ...group, seats: null }] });
  expect((await getAccountMailboxes())!.groups[0]!.seats).toBeNull();
  // A backend before seat plans sends no key.
  const old: Record<string, unknown> = { ...group };
  delete old.seats;
  respond({ ...mailboxes, groups: [old] });
  expect((await getAccountMailboxes())!.groups[0]).not.toHaveProperty("seats");

  const card = { ...seats, provider: "stripe", currency: "usd", seatsNext: 3, removing: ["mailboxabcdefgh"] };
  respond({ ...mailboxes, groups: [{ ...group, seats: card }] });
  expect((await getAccountMailboxes())!.groups[0]!.seats).toStrictEqual(card);

  for (const patch of [
    { seats: 0 },
    { seats: 1001 },
    { seatsNext: 0 },
    { min: 0 },
    { min: 9, max: 3 },
    { seatPriceCents: -1 },
    { provider: "paypal" },
    // A card amount without its currency, or an LDC amount with one, cannot be shown.
    { provider: "stripe", currency: "" },
    { currency: "usd" },
    { periodEnd: 5 },
    { removing: [1] },
    { removing: null },
  ]) {
    respond({ ...mailboxes, groups: [{ ...group, seats: { ...seats, ...patch } }] });
    await expect(getAccountMailboxes(), JSON.stringify(patch)).rejects.toBeInstanceOf(ShopApiError);
  }
});

test("account: the quote, adding, removing and keeping are read strictly, each from its own route", async () => {
  const quote = {
    add: 2,
    seats: 7,
    provider: "ldc",
    currency: "",
    priceCents: 412,
    exact: true,
    periodEnd: "2026-10-22T00:00:00.000Z",
  };
  let calls = respond(quote);
  expect(await quoteSeats("abcdefghijklmno", 2, undefined, "en")).toStrictEqual(quote);
  expect(calls[0]).toMatchObject({ body: { orderId: "abcdefghijklmno", add: 2 } });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/seats\/quote$/);
  for (const patch of [
    // A quote for another count than the one asked about is not shown as this one's price.
    { add: 3 },
    { priceCents: 0 },
    { exact: "yes" },
    { provider: "stripe" },
    { seats: 0 },
  ]) {
    respond({ ...quote, ...patch });
    await expect(quoteSeats("abcdefghijklmno", 2), JSON.stringify(patch)).rejects.toBeInstanceOf(ShopApiError);
  }

  // LDC: an order to pay.
  calls = respond({ orderId: "seatorderabcdef" }, 201);
  expect(await addSeats("abcdefghijklmno", 2)).toStrictEqual({ kind: "order", orderId: "seatorderabcdef" });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/seats\/add$/);
  // Card: charged at once, or waiting for the buyer at the bank with Stripe's invoice page.
  respond({ status: "applied", seats: 7, invoiceUrl: null });
  expect(await addSeats("abcdefghijklmno", 2)).toStrictEqual({ kind: "applied", seats: 7 });
  respond({ status: "payment_required", seats: 5, invoiceUrl: "https://invoice.stripe.com/i/acct_1/test_abc" });
  expect(await addSeats("abcdefghijklmno", 2)).toStrictEqual({
    kind: "payment_required",
    seats: 5,
    invoiceUrl: "https://invoice.stripe.com/i/acct_1/test_abc",
  });
  // Stripe gave no page, or the address is not Stripe's: the buyer is never sent elsewhere to pay.
  for (const invoiceUrl of [
    null,
    "https://invoice.stripe.com.attacker.example/i/x",
    "http://invoice.stripe.com/i/x",
    "https://user@invoice.stripe.com/i/x",
    "javascript:alert(1)",
    7,
  ]) {
    respond({ status: "payment_required", seats: 5, invoiceUrl });
    expect(await addSeats("abcdefghijklmno", 2), String(invoiceUrl)).toStrictEqual({
      kind: "payment_required",
      seats: 5,
      invoiceUrl: null,
    });
  }
  for (const body of [{}, { status: "done", seats: 7 }, { status: "applied" }, { orderId: "short" }]) {
    respond(body);
    await expect(addSeats("abcdefghijklmno", 2), JSON.stringify(body)).rejects.toBeInstanceOf(ShopApiError);
  }

  const removal = { seats: 5, seatsNext: 3, effective: "2026-10-22T00:00:00.000Z", removing: ["mailboxabcdefgh"] };
  calls = respond(removal);
  expect(await removeSeats("abcdefghijklmno", 2, ["mailboxabcdefgh"])).toStrictEqual(removal);
  expect(calls[0]).toMatchObject({ body: { orderId: "abcdefghijklmno", remove: 2, mailboxIds: ["mailboxabcdefgh"] } });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/seats\/remove$/);
  calls = respond({ ...removal, seatsNext: null, removing: [] });
  expect((await keepSeats("abcdefghijklmno")).seatsNext).toBeNull();
  expect(calls[0]).toMatchObject({ body: { orderId: "abcdefghijklmno" } });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/seats\/keep$/);
  respond({ seats: 5, seatsNext: 3, removing: [] });
  await expect(keepSeats("abcdefghijklmno")).rejects.toBeInstanceOf(ShopApiError);
});

test("a rate limit says how long to wait, from Retry-After, in the page language", async () => {
  respond({ error: "Too many requests. Please try again later." }, 429, { "Retry-After": "540" });
  const limited: unknown = await quoteSeats("abcdefghijklmno", 2).catch((cause: unknown) => cause);
  expect(limited).toMatchObject({ status: 429, retryAfter: 540 });
  expect(shopError(limited, "en")).toBe("Too many requests. Try again in 9 minutes.");
  expect(shopError(limited, "zh")).toBe("操作过于频繁，请在 9 分钟后重试。");
  expect(shopCopy.en.rateLimitedWait(1)).toBe("Too many requests. Try again in 1 second.");
  expect(shopCopy.en.rateLimitedWait(7200)).toBe("Too many requests. Try again in 2 hours.");
  // Without the header mail's own sentence stands.
  respond({ error: "Too many requests. Please try again later." }, 429);
  const plain: unknown = await quoteSeats("abcdefghijklmno", 2).catch((cause: unknown) => cause);
  expect(shopError(plain, "en")).toBe("Too many requests. Please try again later.");
});

/* ---- The dev mock ---- */

function request(route: string, options: { cookie?: string; body?: unknown; lang?: string } = {}): Request {
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
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  const send = async (route: string, options: { body?: unknown; lang?: string } = {}) => {
    const response = await store.fetch(route.split("?")[0]!, request(route, { ...options, cookie: cookie() }));
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const [name, value] = pair!.split("=");
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
  return { send, cookie };
}

/** A signed-in buyer with a paid seat subscription of `quantity` seats. */
async function seatSubscription(store: MockShopStore, quantity: number, provider: "ldc" | "stripe" = "ldc") {
  const client = browser(store);
  vi.spyOn(console, "info").mockImplementation(() => {});
  await client.send("account/login", { body: { email: "team@example.com" } });
  const link = vi.mocked(console.info).mock.calls.at(-1)![0] as string;
  await client.send("account/verify", { body: { token: new URL(link.split("：")[1]!).searchParams.get("login") } });
  const orderId = await createShopOrder(SEAT_PRODUCT.id, "en", "", provider, "", quantity);
  expect((await client.send("pay", { body: { orderId, lang: "en" } })).status).toBe(303);
  return { ...client, orderId };
}

async function createMailboxes(client: ReturnType<typeof browser>, orderId: string, names: string[]) {
  for (const username of names) {
    const response = await client.send("account/mailboxes/create", {
      body: { orderId, domain: "abnormalhq.com", username, password: "Correct-horse-9" },
    });
    expect(response.status, username).toBe(201);
  }
  return (await getAccountMailboxes())!.groups.find((item) => item.orderId === orderId)!;
}

test("dev shop: a seat plan is ordered by the seat and priced for the whole order, like mail", async () => {
  const store = new MockShopStore(() => NOW);
  const client = browser(store);
  const catalog = await getShopCatalog(undefined, "en");
  expect(catalog.seatProducts).toHaveLength(1);
  const plan = catalog.seatProducts![0]!;
  expect([plan.minQuantity, plan.maxQuantity, plan.customDomains, plan.name]).toStrictEqual([
    2,
    50,
    2,
    "Demo plan · Team mailboxes (per mailbox)",
  ]);

  // 7 seats of 3.33 at 10% off: 20.98, the figure the shop page estimated by the same rule.
  const orderId = await createShopOrder(plan.id, "en", "", "ldc", "", 7);
  const { order } = await getShopOrder(orderId);
  expect([order.originalPriceCents, order.discountPercent, order.priceCents, order.mailboxCount]).toStrictEqual([
    2331, 10, 2098, 7,
  ]);
  expect(order.priceCents).toBe(seatOrderPrice(plan, 7)!.priceCents);
  // A period renews at seats × the seat's renewal price (its discounted price when the plan names none).
  expect(order.renewPriceCents).toBe(7 * 300);

  // By card: quantity × the seat's card price, which is also what each period costs.
  const card = await getShopOrder(await createShopOrder(plan.id, "en", "", "stripe", "", 3));
  expect([card.order.priceCents, card.order.renewPriceCents, card.order.currency]).toStrictEqual([597, 597, "usd"]);

  // A discount code applies to the order's total, and the preview needs the same quantity.
  const quote = await previewCoupon(plan.id, "ldc", "WELCOME", undefined, "en", 7);
  expect([quote!.basePriceCents, quote!.priceCents]).toStrictEqual([2098, 1678]);
  const coded = await getShopOrder(await createShopOrder(plan.id, "en", "", "ldc", "WELCOME", 7));
  expect(coded.order.priceCents).toBe(1678);
  expect((await client.send("coupon", { body: { productId: plan.id, coupon: "WELCOME" } })).status).toBe(400);

  // Refused: no quantity, outside the range, not a whole number; and a quantity above 1 for a fixed plan.
  for (const quantity of [undefined, null, 1, 51, 2.5, "7", -1]) {
    const refused = await client.send("checkout", {
      lang: "en",
      body: { productId: plan.id, ...(quantity === undefined ? {} : { quantity }) },
    });
    expect([refused.status, String(quantity)]).toStrictEqual([400, String(quantity)]);
    expect((await refused.json()).error).toMatch(/Choose between 2 and 50 seats\.|Enter a whole number of seats\./);
  }
  const fixed = catalog.products[0]!.id;
  expect((await client.send("checkout", { body: { productId: fixed, quantity: 2 } })).status).toBe(400);
  expect((await client.send("checkout", { body: { productId: fixed, quantity: 1 } })).status).toBe(201);
});

test("dev shop: seats are added to an LDC subscription through an order for the rest of the period", async () => {
  let now = NOW;
  const store = new MockShopStore(() => now);
  const client = await seatSubscription(store, 3);
  const [first] = (await getAccountMailboxes())!.groups;
  expect(first!.seats).toStrictEqual({
    seats: 3,
    seatsNext: null,
    min: 2,
    max: 50,
    seatPriceCents: 300,
    provider: "ldc",
    currency: "",
    periodDays: 30,
    periodEnd: new Date(NOW + 30 * DAY).toISOString(),
    removing: [],
  });
  expect([first!.mailboxLimit, first!.usesLeft]).toStrictEqual([3, 3]);

  // Half the period left: 2 seats × 3.00 × 15 / 30 = 3.00, exact for LDC, and nothing changes by asking.
  now = NOW + 15 * DAY;
  const quote = await quoteSeats(client.orderId, 2, undefined, "en");
  expect(quote).toMatchObject({ add: 2, seats: 5, provider: "ldc", priceCents: 300, exact: true });
  expect((await getAccountMailboxes())!.groups[0]!.seats!.seats).toBe(3);

  const added = await addSeats(client.orderId, 2, "en");
  expect(added.kind).toBe("order");
  const seatOrderId = (added as { orderId: string }).orderId;
  // mail publishes an order that adds seats as a renewal of one period, its mailbox count the seats added.
  const { order } = await getShopOrder(seatOrderId);
  expect([order.kind, order.periods, order.mailboxCount, order.priceCents, order.subscriptionId]).toStrictEqual([
    "renewal",
    1,
    2,
    300,
    client.orderId,
  ]);
  // Unpaid, nothing has changed; paying raises the seats and the code's allowance, and leaves the period where it was.
  expect((await getAccountMailboxes())!.groups[0]!.seats!.seats).toBe(3);
  expect((await client.send("pay", { body: { orderId: seatOrderId, lang: "en" } })).headers.get("location")).toBe(
    `/shop/orders/?id=${seatOrderId}`,
  );
  const after = (await getAccountMailboxes())!.groups[0]!;
  expect([after.seats!.seats, after.mailboxLimit, after.usesLeft, after.seats!.periodEnd]).toStrictEqual([
    5,
    5,
    5,
    new Date(NOW + 30 * DAY).toISOString(),
  ]);

  // Refusals, as mail words them: above the plan's most, and after the period ended.
  await expect(quoteSeats(client.orderId, 46, undefined, "en")).rejects.toMatchObject({
    status: 409,
    message: "This plan allows at most 50 seats.",
  });
  await expect(addSeats("nosuchorder0001", 1, "en")).rejects.toMatchObject({ status: 404 });
  await expect(quoteSeats(client.orderId, 0)).rejects.toMatchObject({ status: 400 });
  now = NOW + 31 * DAY;
  await expect(addSeats(client.orderId, 1, "en")).rejects.toMatchObject({
    status: 409,
    message: "The current period has ended. Renew the subscription before adding seats.",
  });
});

test("dev shop: seats priced before a renewal can no longer be paid; the pay form returns with the payment error", async () => {
  const store = new MockShopStore(() => NOW);
  const client = await seatSubscription(store, 3);
  const added = (await addSeats(client.orderId, 1, "en")) as { orderId: string };
  // A renewal is paid in between: the period end the seats were priced to has moved.
  const renewal = await client.send("renew", { body: { token: `demo-${client.orderId}`, periods: 1 } });
  await client.send("pay", { body: { orderId: (await renewal.json()).orderId, lang: "en" } });
  const stale = await client.send("pay", { body: { orderId: added.orderId, lang: "zh" } });
  expect([stale.status, stale.headers.get("location")]).toStrictEqual([
    303,
    `/zh/shop/orders/?id=${added.orderId}&error=payment`,
  ]);
  expect((await getShopOrder(added.orderId)).order.status).toBe("pending");
  expect((await getAccountMailboxes())!.groups[0]!.seats!.seats).toBe(3);
});

test("dev shop: a card subscription is charged at once, and seats rise only after Stripe confirms when the bank wants the buyer", async () => {
  const store = new MockShopStore(() => NOW);
  const client = await seatSubscription(store, 3, "stripe");
  const initial = (await getAccountMailboxes())!.groups[0]!.seats!;
  expect([initial.provider, initial.currency, initial.seatPriceCents]).toStrictEqual(["stripe", "usd", 199]);

  // The quote is an estimate for a card subscription: Stripe's invoice has the final amount.
  expect(await quoteSeats(client.orderId, 2, undefined, "en")).toMatchObject({
    provider: "stripe",
    currency: "usd",
    priceCents: 398,
    exact: false,
  });
  expect(await addSeats(client.orderId, 2, "en")).toStrictEqual({ kind: "applied", seats: 5 });
  expect((await getAccountMailboxes())!.groups[0]!.seats!.seats).toBe(5);

  // The bank wants the buyer: nothing changed, the invoice page is given, and the seats follow once Stripe reports the payment.
  const waiting = await addSeats(client.orderId, MOCK_SEATS_PAYMENT_REQUIRED, "en");
  expect(waiting).toStrictEqual({
    kind: "payment_required",
    seats: 5,
    invoiceUrl: "https://invoice.stripe.com/i/demo",
  });
  expect((await getAccountMailboxes())!.groups[0]!.seats!.seats).toBe(5);
  expect((await getAccountMailboxes())!.groups[0]!.seats!.seats).toBe(12);

  // A card that cannot be charged is the buyer's answer, in the page language.
  await expect(addSeats(client.orderId, MOCK_SEATS_CARD_DECLINED, "zh")).rejects.toMatchObject({ status: 409 });
  expect((await getAccountMailboxes())!.groups[0]!.seats!.seats).toBe(12);
});

test("dev shop: seats are removed at the next renewal with the chosen mailboxes, and the removal can be taken back", async () => {
  const store = new MockShopStore(() => NOW);
  const client = await seatSubscription(store, 4);
  const filled = await createMailboxes(client, client.orderId, ["anna", "ben", "cleo"]);
  const [anna, ben, cleo] = filled.mailboxes.map((mailbox) => mailbox.id) as [string, string, string];

  // 4 seats, 3 mailboxes, down to 2: one mailbox has to go, and mail says how many more to choose.
  await expect(removeSeats(client.orderId, 2, [], "en")).rejects.toMatchObject({
    status: 400,
    message: "Choose 1 more mailbox to remove: the rest must fit the seats that stay.",
  });
  // Not below the plan's fewest, not more mailboxes than seats, and only this subscription's mailboxes.
  await expect(removeSeats(client.orderId, 3, [anna, ben], "en")).rejects.toMatchObject({ status: 409 });
  await expect(removeSeats(client.orderId, 1, [anna, ben], "en")).rejects.toMatchObject({ status: 400 });
  await expect(removeSeats(client.orderId, 2, ["someoneelses001"], "en")).rejects.toMatchObject({ status: 400 });
  await expect(removeSeats(client.orderId, 2, [anna, anna], "en")).rejects.toMatchObject({ status: 400 });

  const removal = await removeSeats(client.orderId, 2, [cleo], "en");
  expect(removal).toStrictEqual({
    seats: 4,
    seatsNext: 2,
    effective: new Date(NOW + 30 * DAY).toISOString(),
    removing: [cleo],
  });
  // Until the renewal the seats and the mailboxes stay; the code only stops offering seats beyond the new count.
  const scheduled = (await getAccountMailboxes())!.groups[0]!;
  expect([scheduled.seats!.seats, scheduled.seats!.seatsNext, scheduled.seats!.removing]).toStrictEqual([4, 2, [cleo]]);
  expect([scheduled.mailboxes.length, scheduled.usesLeft]).toStrictEqual([3, 0]);
  // No seats are added while a removal is scheduled.
  await expect(addSeats(client.orderId, 1, "en")).rejects.toMatchObject({
    status: 409,
    message: "Seats are being removed at the next renewal. Take that back before adding seats.",
  });

  // Taken back: all seats stay and the free seat is offered again; there is nothing to take back twice.
  expect(await keepSeats(client.orderId, "en")).toMatchObject({ seats: 4, seatsNext: null, removing: [] });
  expect((await getAccountMailboxes())!.groups[0]!.usesLeft).toBe(1);
  await expect(keepSeats(client.orderId, "en")).rejects.toMatchObject({ status: 409 });

  // Scheduled again, the renewal is priced for the new count and paying it applies the removal.
  await removeSeats(client.orderId, 2, [cleo], "en");
  const renewal = await client.send("renew", { body: { token: `demo-${client.orderId}`, periods: 1 } });
  const renewalId = (await renewal.json()).orderId as string;
  const renewalOrder = (await getShopOrder(renewalId)).order;
  expect([renewalOrder.mailboxCount, renewalOrder.priceCents]).toStrictEqual([2, 600]);
  await client.send("pay", { body: { orderId: renewalId, lang: "en" } });
  const applied = (await getAccountMailboxes())!.groups[0]!;
  expect([applied.seats!.seats, applied.seats!.seatsNext, applied.mailboxLimit]).toStrictEqual([2, null, 2]);
  expect(applied.mailboxes.map((mailbox) => mailbox.id)).toStrictEqual([anna, ben]);
});

test("dev shop: every seat answer passes the client parser, and the seat routes need a signed-in buyer", async () => {
  const store = new MockShopStore(() => NOW);
  const anonymous = browser(store);
  for (const route of SEAT_ROUTES) {
    const response = await anonymous.send(route, { body: { orderId: "abcdefghijklmno", add: 1, remove: 1 } });
    expect([route, response.status]).toStrictEqual([route, 401]);
  }
  // A one-time or fixed order has no seats to change: the same 404 whether or not the order exists.
  const client = await seatSubscription(store, 2);
  const fixed = await createShopOrder("demoproduct0002", "en");
  await client.send("pay", { body: { orderId: fixed, lang: "en" } });
  const groups = (await getAccountMailboxes())!.groups;
  expect(groups.find((item) => item.orderId === fixed)!.seats).toBeNull();
  await expect(quoteSeats(fixed, 1, undefined, "en")).rejects.toMatchObject({
    status: 404,
    message: "This subscription has no seats to change.",
  });
});

test("dev shop: MOCK_SEATS=off behaves like a backend before seat plans", async () => {
  const store = new MockShopStore(() => NOW, true, true, false);
  const client = browser(store);
  const catalog = await getShopCatalog();
  expect(catalog).not.toHaveProperty("seatProducts");
  for (const route of SEAT_ROUTES) expect((await client.send(route, { body: {} })).status, route).toBe(404);
  expect((await client.send("checkout", { body: { productId: SEAT_PRODUCT.id, quantity: 3 } })).status).toBe(409);
  // The mailbox groups carry no `seats` at all.
  vi.spyOn(console, "info").mockImplementation(() => {});
  await client.send("account/login", { body: { email: "old@example.com" } });
  const link = vi.mocked(console.info).mock.calls.at(-1)![0] as string;
  await client.send("account/verify", { body: { token: new URL(link.split("：")[1]!).searchParams.get("login") } });
  const orderId = await createShopOrder("demoproduct0002");
  await client.send("pay", { body: { orderId } });
  expect((await getAccountMailboxes())!.groups[0]).not.toHaveProperty("seats");
});

/* ---- The Worker's proxy ---- */

function bindings(mail: (request: Request) => Promise<Response>): StorefrontEnv {
  return { MAIL: { fetch: mail }, MAIL_ORIGIN: mailOrigin };
}

function seatRequest(route: string, headers: Record<string, string> = {}, init: RequestInit = {}): Request {
  return new Request(`${siteOrigin}/api/shop/${route}`, {
    method: "POST",
    body: '{"orderId":"abcdefghijklmno","add":2}',
    headers: { Origin: siteOrigin, "Content-Type": "application/json", ...headers },
    ...init,
  });
}

test("shop proxy: the seat routes are proxied like the mailbox routes: the two shop cookies, the visitor's IP and Origin, never cached", async () => {
  const buyer = `mailhq_shop=${"a".repeat(64)}`;
  const customer = `mailhq_customer=${"c".repeat(43)}`;
  for (const route of SEAT_ROUTES) {
    const mail = vi.fn(async (request: Request) => {
      expect(request.url).toBe(`${mailOrigin}/api/shop/${route}`);
      expect(request.method).toBe("POST");
      expect(request.headers.get("cookie")).toBe(`${buyer}; ${customer}`);
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("origin")).toBe(siteOrigin);
      expect(request.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
      expect(await request.text()).toBe('{"orderId":"abcdefghijklmno","add":2}');
      return Response.json(
        { ok: true },
        { headers: { "Set-Cookie": "session=admin; Path=/", "Cache-Control": "public, max-age=3600" } },
      );
    });
    const response = await worker.fetch(
      seatRequest(route, {
        Cookie: `${buyer}; ${customer}; session=admin`,
        Authorization: "Bearer admin",
        "CF-Connecting-IP": "203.0.113.9",
      }),
      bindings(mail),
    );
    expect(mail, route).toHaveBeenCalledOnce();
    expect(response.status, route).toBe(200);
    expect(response.headers.getSetCookie(), route).toStrictEqual([]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  }
});

test("shop proxy: the seat routes are same-origin JSON POSTs, and nothing about a request is logged", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const never = bindings(async () => {
    throw new Error("must not reach mail");
  });
  for (const route of SEAT_ROUTES) {
    for (const origin of [undefined, "null", "https://attacker.example"]) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (origin) headers.set("Origin", origin);
      expect((await worker.fetch(seatRequest(route, {}, { headers }), never)).status, route).toBe(403);
    }
    expect((await worker.fetch(seatRequest(route, { "Content-Type": "text/plain" }), never)).status).toBe(415);
    const get = await worker.fetch(new Request(`${siteOrigin}/api/shop/${route}`), never);
    expect([get.status, get.headers.get("Allow")]).toStrictEqual([405, "POST"]);
  }
  for (const route of ["account/seats", "account/seats/list", "account/seats/add/now", "seats/add"]) {
    expect((await worker.fetch(seatRequest(route), never)).status, route).toBe(404);
  }
  // mail is down: a JSON 503, and the log names the route only, never the body, the order or a cookie.
  const down = await worker.fetch(
    seatRequest("account/seats/add", { Cookie: `mailhq_customer=${"c".repeat(43)}` }),
    bindings(async () => {
      throw new Error("abcdefghijklmno secret");
    }),
  );
  expect(down.status).toBe(503);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/abcdefghijklmno|secret|mailhq_customer|c{43}/);
});

test("shop proxy: an LDC order that adds seats starts a purchase session like renew; the other seat routes never set a cookie", async () => {
  const token = "b".repeat(64);
  const upstream = async () =>
    Response.json(
      { orderId: "seatorderabcdef" },
      {
        status: 201,
        headers: { "Set-Cookie": `mailhq_shop=${token}; Path=/; Domain=console.abnormalhq.com; HttpOnly` },
      },
    );
  const added = await worker.fetch(seatRequest("account/seats/add"), bindings(upstream));
  expect(added.status).toBe(201);
  expect(added.headers.getSetCookie()).toStrictEqual([
    `mailhq_shop=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`,
  ]);
  for (const route of SEAT_ROUTES.filter((item) => item !== "account/seats/add")) {
    const response = await worker.fetch(seatRequest(route), bindings(upstream));
    expect(response.headers.getSetCookie(), route).toStrictEqual([]);
  }
});

test("shop proxy: a mail before seat plans answers a JSON 404; mail's own refusals and rate limits pass through", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const html = await worker.fetch(
    seatRequest("account/seats/quote", { "Accept-Language": "en" }),
    bindings(
      async () => new Response("<html>Not found</html>", { status: 404, headers: { "Content-Type": "text/html" } }),
    ),
  );
  expect([html.status, await html.json()]).toStrictEqual([404, { error: "Endpoint not found." }]);
  // "Not a seat subscription of this account" is mail's answer and keeps its wording.
  const refused = await worker.fetch(
    seatRequest("account/seats/quote"),
    bindings(async () => Response.json({ error: "This subscription has no seats to change." }, { status: 404 })),
  );
  expect([refused.status, await refused.json()]).toStrictEqual([
    404,
    { error: "This subscription has no seats to change." },
  ]);
  const limited = await worker.fetch(
    seatRequest("account/seats/add"),
    bindings(async () => Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "380" } })),
  );
  expect([limited.status, limited.headers.get("Retry-After")]).toStrictEqual([429, "380"]);
  const broken = await worker.fetch(
    seatRequest("account/seats/add"),
    bindings(async () => new Response("upstream down", { status: 502, headers: { "Content-Type": "text/plain" } })),
  );
  expect(broken.status).toBe(503);
});

test("contract: the account's seat routes and fields are the contract file's; the order fields mail still proposes stay out", async () => {
  const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
    shop: {
      routes: Record<string, string[]>;
      publicOrderFields: string[];
      seats: { routes: Record<string, string[]>; accountFields: string[]; maxQuantity: number };
    };
  };
  // Contract version 3 lists the seat routes apart from `shop.routes` (the order quote has its own place, `shop.quote`;
  // tests/storefront/quote.test.ts); this Worker proxies every one of them.
  expect(Object.keys(contract.shop.seats.routes)).toStrictEqual(SEAT_ROUTES);
  for (const route of SEAT_ROUTES) {
    expect(contract.shop.seats.routes[route], route).toStrictEqual(["POST"]);
    expect(contract.shop.routes, route).not.toHaveProperty(route);
  }
  // The seats of a mailbox group, read field by field as mail lists them (`periodDays` since version 3).
  respond({ ...mailboxes, groups: [{ ...group, seats: { ...seats, periodDays: 30 } }] });
  const [read] = (await getAccountMailboxes())!.groups;
  expect(Object.keys(read!.seats!).toSorted()).toStrictEqual(contract.shop.seats.accountFields.toSorted());
  // A count above the contract's most is no seat count on any seat route.
  respond({ ...mailboxes, groups: [{ ...group, seats: { ...seats, max: contract.shop.seats.maxQuantity + 1 } }] });
  await expect(getAccountMailboxes()).rejects.toBeInstanceOf(ShopApiError);
  // Still proposed in mail's docs/shop.md, and not in the file: `quantity` and `seatPriceCents` on an order and the order
  // kind "seats". When mail's copy gains them this fails, as the reminder to read them (see "Proposed" in docs/storefront-api.md).
  for (const field of ["quantity", "seatPriceCents"]) expect(contract.shop.publicOrderFields).not.toContain(field);
  expect(readFileSync("docs/storefront-api.md", "utf8")).toMatch(/^- \*\*Seat orders\*\*/m);
});
