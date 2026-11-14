import { expect, test, vi } from "vitest";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import {
  createShopOrder,
  getShopCatalog,
  openBillingPortal,
  getShopOrder,
  reconcileShopOrder,
  ShopApiError,
  startStripePayment,
  startUsdtPayment,
  type ShopProduct,
} from "@/storefront/lib/shop";
import { REQUEST_TIMEOUT_MS } from "@/storefront/lib/catalog";

const PRODUCT: ShopProduct = {
  id: "demoproduct0001",
  name: "邮箱套餐",
  description: "",
  originalPriceCents: 1000,
  discountPercent: 25,
  priceCents: 750,
  mailboxCount: 1,
  quotaMb: 1024,
  codeExpiresDays: 30,
  domains: ["abnormal.bid"],
};
const ORDER_ID = "demoorder000001";

test("shop errors: the backend's explanation is used when present, otherwise generic copy by status in the page language, with the 404 wording from the caller", () => {
  expect(shopError(new ShopApiError("This plan is no longer available.", 409), "en")).toBe(
    "This plan is no longer available.",
  );
  expect(shopError(new ShopApiError("此套餐暂不可购买。", 409), "zh")).toBe("此套餐暂不可购买。");
  expect(shopError(new ShopApiError("  ", 503), "en")).toBe(shopCopy.en.requestError);
  // A 404 from the customer portal means "the portal cannot be opened right now", not "order not found".
  const portal = "Auto-renewal can't be managed for this subscription yet.";
  expect(shopError(new ShopApiError(portal, 404), "en", { notFound: shopCopy.en.notFound })).toBe(portal);
  expect(shopError(new ShopApiError("", 404), "en", { notFound: shopCopy.en.notFound })).toBe(shopCopy.en.notFound);
  expect(shopError(new ShopApiError("", 404), "en")).toBe(shopCopy.en.requestError);
  expect(shopError(new ShopApiError("请求太频繁。", 429), "zh")).toBe("请求太频繁。");
  expect(shopError(new ShopApiError("", 429), "en")).toBe(shopCopy.en.rateLimited);
  expect(shopError(new TypeError("Failed to fetch"), "zh")).toBe(shopCopy.zh.requestError);
});

function catalog(product: unknown) {
  return { available: true, products: [product], onboardUrl: "/" };
}

function order(price: Partial<ShopProduct> = {}) {
  return {
    order: {
      ...PRODUCT,
      ...price,
      id: ORDER_ID,
      productName: PRODUCT.name,
      status: "pending",
      created: "2026-09-22T00:00:00Z",
      paidAt: null,
    },
    code: null,
    codeStatus: null,
    onboardUrl: "/",
  };
}

test("shop client: accepts the backend's discounted amount and order snapshot without recomputing the order from new plan prices", async () => {
  const changedProduct = {
    ...PRODUCT,
    originalPriceCents: 2000,
    discountPercent: 10,
    priceCents: 1800,
  };
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json(url.includes("catalog") ? catalog(changedProduct) : order()),
  );
  const current = await getShopCatalog();
  expect(current.products[0]).toStrictEqual(changedProduct);
  const original = await getShopOrder(ORDER_ID);
  expect(original.order.originalPriceCents).toBe(1000);
  expect(original.order.discountPercent).toBe(25);
  expect(original.order.priceCents).toBe(750);
});

test("shop client: reads prices without a discount and prices exact to the cent", async () => {
  let product = { ...PRODUCT, discountPercent: 0, priceCents: 1000 };
  vi.stubGlobal("fetch", async () => Response.json(catalog(product)));
  expect((await getShopCatalog()).products[0]).toStrictEqual(product);
  product = {
    ...PRODUCT,
    originalPriceCents: 1,
    discountPercent: 25,
    priceCents: 1,
  };
  expect((await getShopCatalog()).products[0]).toStrictEqual(product);
});

test("shop client: rejects missing, invalid or self-contradictory discount amounts", async () => {
  let body: unknown;
  vi.stubGlobal("fetch", async () => Response.json(body));
  const invalidPrices = [
    { originalPriceCents: undefined },
    { discountPercent: undefined },
    { originalPriceCents: 0 },
    { originalPriceCents: -1000 },
    { originalPriceCents: 999.5 },
    { originalPriceCents: Number.MAX_SAFE_INTEGER + 1 },
    { originalPriceCents: "1000" },
    { priceCents: 0 },
    { priceCents: 750.5 },
    { priceCents: 1001 },
    { priceCents: "750" },
    { discountPercent: -1 },
    { discountPercent: 100 },
    { discountPercent: 25.5 },
    { discountPercent: "25" },
    { discountPercent: 0 },
  ];
  for (const invalid of invalidPrices) {
    body = catalog({ ...PRODUCT, ...invalid });
    await expect(getShopCatalog()).rejects.toThrow(ShopApiError);
    body = {
      ...order(),
      order: { ...order().order, ...invalid },
    };
    await expect(getShopOrder(ORDER_ID)).rejects.toThrow(ShopApiError);
  }
});

test("shop client: ordering sends only the plan ID, the price is always decided by the backend", async () => {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    expect(url).toBe("/api/shop/checkout");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("Accept-Language")).toBe(null);
    expect(JSON.parse(String(init.body))).toStrictEqual({ productId: PRODUCT.id });
    return Response.json({ orderId: ORDER_ID }, { status: 201 });
  });
  expect(await createShopOrder(PRODUCT.id)).toBe(ORDER_ID);
});

test("shop client: the page language is used for catalog, orders, ordering and reconcile, the abort signal position stays compatible", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("catalog")) return Response.json(catalog(PRODUCT));
    if (url.includes("orders")) return Response.json(order());
    if (url.includes("checkout")) return Response.json({ orderId: ORDER_ID });
    return Response.json({ ok: true });
  });

  for (const lang of ["zh", "en"] as const) {
    calls.length = 0;
    const controller = new AbortController();
    const signal = controller.signal;
    await getShopCatalog(signal, lang);
    await getShopOrder(ORDER_ID, signal, lang);
    await createShopOrder(PRODUCT.id, lang);
    await reconcileShopOrder(ORDER_ID, lang);

    expect(calls.length).toBe(4);
    for (const { init } of calls) {
      expect(new Headers(init.headers).get("Accept-Language")).toBe(lang);
      expect(init.credentials).toBe("same-origin");
    }
    // The request's signal follows the caller's (combined with the timeout); a request without one still has the timeout.
    for (const { init } of calls) expect(init.signal?.aborted).toBe(false);
    controller.abort();
    expect(calls[0]!.init.signal?.aborted).toBe(true);
    expect(calls[1]!.init.signal?.aborted).toBe(true);
    expect(calls[2]!.init.signal?.aborted).toBe(false);
    expect(JSON.parse(String(calls[2]!.init.body))).toStrictEqual({
      productId: PRODUCT.id,
    });
    expect(JSON.parse(String(calls[3]!.init.body))).toStrictEqual({
      orderId: ORDER_ID,
    });
  }
});

/** A fetch that never answers, as a request stuck on a dead connection: it ends only when its signal aborts. */
function hangingFetch(sent: RequestInit[]) {
  return (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      sent.push(init);
      const signal = init.signal!;
      if (signal.aborted) reject(signal.reason);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
}

/** AbortSignal.timeout answered by hand: `expire()` ends every timeout handed out so far, as REQUEST_TIMEOUT_MS passing would. */
function manualTimeouts() {
  const pending: AbortController[] = [];
  const asked = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
    const controller = new AbortController();
    pending.push(controller);
    return controller.signal;
  });
  const expire = () => {
    for (const controller of pending) controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
  };
  return { asked, expire };
}

test("shop client: a request that hangs fails with a TimeoutError after REQUEST_TIMEOUT_MS, and the caller's signal stays unaborted", async () => {
  const sent: RequestInit[] = [];
  vi.stubGlobal("fetch", hangingFetch(sent));
  const { asked, expire } = manualTimeouts();

  // The order page's polling: its own signal tells an unmount from a timeout, so it asks again after this one.
  const controller = new AbortController();
  const order = getShopOrder(ORDER_ID, controller.signal, "en");
  const usdt = startUsdtPayment(ORDER_ID, "en", controller.signal);
  // A request made without a signal (reconcile) has the timeout all the same.
  const reconcile = reconcileShopOrder(ORDER_ID, "en");
  expect(sent).toHaveLength(3);
  expect(asked).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
  expect(REQUEST_TIMEOUT_MS).toBe(15_000);

  expire();
  for (const pending of [order, usdt, reconcile]) await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
  expect(controller.signal.aborted).toBe(false);
});

test("shop client: the caller's abort still ends a request at once, also where AbortSignal.any is missing (Safari before 17.4)", async () => {
  for (const withoutAny of [false, true]) {
    const sent: RequestInit[] = [];
    vi.stubGlobal("fetch", hangingFetch(sent));
    const any = AbortSignal.any;
    if (withoutAny) Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true, writable: true });
    try {
      const controller = new AbortController();
      const order = getShopOrder(ORDER_ID, controller.signal, "en");
      controller.abort();
      await expect(order).rejects.toMatchObject({ name: "AbortError" });
      expect(sent[0]!.signal?.aborted).toBe(true);

      // The timeout ends it too, without aborting the caller's signal.
      const { expire } = manualTimeouts();
      const later = new AbortController();
      const again = getShopOrder(ORDER_ID, later.signal, "en");
      expire();
      await expect(again).rejects.toMatchObject({ name: "TimeoutError" });
      expect(later.signal.aborted).toBe(false);
      vi.mocked(AbortSignal.timeout).mockRestore();
    } finally {
      Object.defineProperty(AbortSignal, "any", { value: any, configurable: true, writable: true });
    }
  }
});

test("shop client: a body that stalls after the headers fails with the timeout, not as an empty answer", async () => {
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const signal = init.signal!;
    // Headers now; the body never finishes, and errors with the signal's reason when it aborts (as fetch's body reading does).
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"status":'));
        signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
      },
    });
    return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const { expire } = manualTimeouts();
  const controller = new AbortController();
  const order = getShopOrder(ORDER_ID, controller.signal, "en");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expire();
  await expect(order).rejects.toMatchObject({ name: "TimeoutError" });
  expect(controller.signal.aborted).toBe(false);
  vi.mocked(AbortSignal.timeout).mockRestore();
});

test("shop client: without AbortSignal.any, a finished request leaves no listener on the caller's signal", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ error: "not found" }, { status: 404 }));
  const any = AbortSignal.any;
  Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true, writable: true });
  try {
    const controller = new AbortController();
    const added = vi.spyOn(controller.signal, "addEventListener");
    const removed = vi.spyOn(controller.signal, "removeEventListener");
    for (let round = 0; round < 3; round++)
      await expect(getShopOrder(ORDER_ID, controller.signal, "en")).rejects.toMatchObject({ status: 404 });
    expect(added).toHaveBeenCalledTimes(3);
    expect(removed).toHaveBeenCalledTimes(3);
    for (const [index, call] of added.mock.calls.entries()) expect(removed.mock.calls[index]![1]).toBe(call[1]);
  } finally {
    Object.defineProperty(AbortSignal, "any", { value: any, configurable: true, writable: true });
  }
});

test("shop client: keeps the domain quota capability and rejects non-boolean capability values", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json(
      catalog({
        ...PRODUCT,
        quotaSupportedByDomain: { "abnormal.bid": false },
      }),
    ),
  );
  expect((await getShopCatalog()).products[0].quotaSupportedByDomain).toStrictEqual({ "abnormal.bid": false });
  vi.stubGlobal("fetch", async () =>
    Response.json(
      catalog({
        ...PRODUCT,
        quotaSupportedByDomain: { "abnormal.bid": "false" },
      }),
    ),
  );
  await expect(getShopCatalog()).rejects.toThrow(ShopApiError);
});

test("shop client: provider is sent in the order request whenever it is not LDC (card or USDT), never for LDC", async () => {
  const bodies: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    bodies.push(JSON.parse(String((init as RequestInit).body)));
    return Response.json({ orderId: ORDER_ID }, { status: 201 });
  });
  await createShopOrder(PRODUCT.id);
  await createShopOrder(PRODUCT.id, "zh", "", "ldc");
  await createShopOrder(PRODUCT.id, "zh", "buyer@example.test", "stripe");
  await createShopOrder(PRODUCT.id, "en", "", "usdt");
  expect(bodies).toStrictEqual([
    { productId: PRODUCT.id },
    // A mail that only knows LDC never sees the field.
    { productId: PRODUCT.id },
    { productId: PRODUCT.id, email: "buyer@example.test", provider: "stripe" },
    { productId: PRODUCT.id, provider: "usdt" },
  ]);
  vi.restoreAllMocks();
});

test("shop client: paying by card on the page gets the two keys that initialize Stripe.js, or goes to the hosted page as told", async () => {
  const calls: { url: string; body: unknown }[] = [];
  const answer = (status: number, body: unknown) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) });
      return Response.json(body, { status });
    });
  answer(200, { status: "open", clientSecret: "cs_test_a1_secret_b2", publishableKey: "pk_test_0123456789" });
  await expect(startStripePayment(ORDER_ID, "en")).resolves.toStrictEqual({
    status: "open",
    clientSecret: "cs_test_a1_secret_b2",
    publishableKey: "pk_test_0123456789",
  });
  expect(calls).toStrictEqual([{ url: "/api/shop/pay/stripe", body: { orderId: ORDER_ID, lang: "en" } }]);
  vi.restoreAllMocks();
  // Live client secrets percent-encode their opaque part (the shape of a real ui_mode elements session, values made up).
  const liveSecret = "cs_live_a1B2c3D4e5F6g7H8_secret_fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSd2cGd2ZndsdXFs%3D%3D";
  answer(200, { status: "open", clientSecret: liveSecret, publishableKey: "pk_live_0123456789" });
  await expect(startStripePayment(ORDER_ID)).resolves.toStrictEqual({
    status: "open",
    clientSecret: liveSecret,
    publishableKey: "pk_live_0123456789",
  });
  vi.restoreAllMocks();
  for (const status of ["hosted", "paid", "processing"] as const) {
    answer(200, { status });
    await expect(startStripePayment(ORDER_ID)).resolves.toStrictEqual({ status });
    vi.restoreAllMocks();
  }
  // An old Worker or mail does not know this endpoint: the hosted page as before; other errors are thrown as usual.
  answer(404, { error: "" });
  await expect(startStripePayment(ORDER_ID)).resolves.toStrictEqual({ status: "hosted" });
  vi.restoreAllMocks();
  answer(404, { error: "Order not found." });
  await expect(startStripePayment(ORDER_ID)).rejects.toMatchObject({ status: 404, message: "Order not found." });
  vi.restoreAllMocks();
  // Keys of the wrong shape (say a secret key sent as the publishable key) never initialize Stripe.js.
  for (const body of [
    { status: "open", clientSecret: "cs_test_a1_secret_b2", publishableKey: "sk_test_0123456789" },
    { status: "open", clientSecret: "https://attacker.example", publishableKey: "pk_test_0123456789" },
    { status: "open", clientSecret: "cs_test_a1", publishableKey: "pk_test_0123456789" },
    { status: "open", clientSecret: "cs_test_a1_secret_b2 <script>", publishableKey: "pk_test_0123456789" },
    { status: "open", publishableKey: "pk_test_0123456789" },
    { status: "later" },
  ]) {
    answer(200, body);
    await expect(startStripePayment(ORDER_ID)).rejects.toBeInstanceOf(ShopApiError);
    vi.restoreAllMocks();
  }
});

test("shop client: the customer portal accepts only Stripe addresses", async () => {
  const urls = ["https://billing.stripe.com/p/session/x", "https://attacker.example/p/session/x"];
  for (const url of urls) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ url }));
    if (url.startsWith("https://billing.stripe.com/"))
      await expect(openBillingPortal("sub0000000000001")).resolves.toBe(url);
    else await expect(openBillingPortal("sub0000000000001")).rejects.toBeInstanceOf(ShopApiError);
    vi.restoreAllMocks();
  }
});
