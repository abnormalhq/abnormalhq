import { expect, test, vi } from "vitest";
import {
  createRenewalOrder,
  createShopOrder,
  getAccount,
  getAccountMailboxes,
  getRenewal,
  getShopCatalog,
  getShopOrder,
  peekLogin,
  requestLogin,
  verifyLogin,
} from "@/storefront/lib/shop";
import { MockShopStore } from "@/storefront/mock/shop";

const ORIGIN = "http://localhost:4321";
const NOW = Date.parse("2026-09-22T00:00:00Z");

function request(
  route: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
    origin?: string;
    headers?: HeadersInit;
    base?: string;
  } = {},
): Request {
  const post = [
    "checkout",
    "pay",
    "pay/stripe",
    "reconcile",
    "renewal",
    "renew",
    "account/login",
    "account/peek",
    "account/verify",
    "account/logout",
    "account/portal",
    "account/password-login",
    "account/password",
    "account/register",
    "account/forgot",
    "account/reset",
    "account/google/start",
    "account/google",
    "account/google/unlink",
    "account/mailboxes/create",
    "account/mailboxes/password",
    "account/mailboxes/status",
    "account/mailboxes/delete",
  ].includes(route.split("?")[0]);
  const headers = new Headers(options.headers);
  if (options.cookie) headers.set("Cookie", options.cookie);
  if (post) {
    headers.set("Origin", options.origin ?? ORIGIN);
    headers.set("Content-Type", route === "pay" ? "application/x-www-form-urlencoded" : "application/json");
  }
  return new Request(`${ORIGIN}${options.base ?? ""}/api/shop/${route}`, {
    method: options.method ?? (post ? "POST" : "GET"),
    headers,
    ...(post
      ? {
          body:
            route === "pay"
              ? new URLSearchParams(options.body as Record<string, string>).toString()
              : JSON.stringify(options.body ?? {}),
        }
      : {}),
  });
}

async function checkout(store: MockShopStore, cookie?: string, base?: string) {
  const catalog = await (await store.fetch("catalog", request("catalog", { base }))).json();
  const response = await store.fetch(
    "checkout",
    request("checkout", {
      cookie,
      base,
      body: { productId: catalog.products[0].id },
    }),
  );
  expect(response.status).toBe(201);
  const { orderId } = await response.json();
  expect(orderId).toMatch(/^[a-z0-9]{15}$/);
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toMatch(/^mailhq_shop=[a-f0-9]{64}; Path=\/; Max-Age=31536000; HttpOnly; SameSite=Lax$/);
  return { orderId: orderId as string, cookie: setCookie!.split(";")[0] };
}

async function getOrder(store: MockShopStore, orderId: string, cookie?: string) {
  return store.fetch("orders", request(`orders?id=${orderId}`, { cookie }));
}

test("dev shop: demo plans expose no private config, checkout leaks no buyer credentials in the body or URL", async () => {
  const store = new MockShopStore(() => NOW);
  const response = await store.fetch("catalog", request("catalog"));
  expect(response.status).toBe(200);
  const catalog = await response.json();
  expect(catalog.available).toBe(true);
  expect(catalog.onboardUrl).toBe(`${ORIGIN}/`);
  expect(catalog.products.length).toBe(2);
  expect(catalog.products[1].periodDays).toBe(30);
  expect(catalog.products[0].originalPriceCents).toBe(1000);
  expect(catalog.products[0].discountPercent).toBe(25);
  expect(catalog.products[0].priceCents).toBe(750);
  expect(catalog.products[0].name).toMatch(/演示套餐/);
  expect(catalog.products[0].description).toMatch(/不会扣除真实 Credit/);
  expect(Object.keys(catalog).sort()).toStrictEqual(["available", "onboardUrl", "payment", "products"]);
  expect(JSON.stringify(catalog)).not.toMatch(/clientSecret|clientId|buyerHash|buyerToken|ABCD-EFGH-JKLM-NPQR/);
  const { cookie, orderId } = await checkout(store);
  const orderResponse = await getOrder(store, orderId, cookie);
  const order = await orderResponse.json();
  expect(order.order.status).toBe("pending");
  expect(order.order.originalPriceCents).toBe(1000);
  expect(order.order.discountPercent).toBe(25);
  expect(order.order.priceCents).toBe(750);
  expect(order.code).toBe(null);
  expect(order.codeStatus).toBe(null);
  expect(order.order.created).toBe(new Date(NOW).toISOString());
  expect(JSON.stringify(order)).not.toMatch(/buyerHash|buyerToken|mailhq_shop|clientSecret/);
  expect(orderResponse.headers.get("Cache-Control") ?? "").toMatch(/no-store/);
  expect(orderResponse.headers.get("Referrer-Policy")).toBe("same-origin");
});

test("dev shop: demo payment goes nowhere near the network, the same browser collects the code after confirming, repeated payment keeps the same order", async () => {
  vi.stubGlobal("fetch", async () => {
    expect.unreachable("the dev shop must not reach a real payment network");
  });
  let now = NOW;
  const store = new MockShopStore(() => now);
  const { orderId, cookie } = await checkout(store);
  const pending = await store.fetch("reconcile", request("reconcile", { cookie, body: { orderId } }));
  expect((await pending.json()).order.status).toBe("pending");
  const pay = await store.fetch("pay", request("pay", { cookie, body: { orderId } }));
  expect(pay.status).toBe(303);
  expect(pay.headers.get("Location")).toBe(`/zh/shop/orders/?id=${orderId}`);
  expect(pay.headers.get("Location")!).not.toMatch(/mailhq_shop|ABCD|token|credit\.linux\.do/);
  const paid = await (await getOrder(store, orderId, cookie)).json();
  expect(paid.order.status).toBe("paid");
  expect(paid.order.originalPriceCents).toBe(1000);
  expect(paid.order.discountPercent).toBe(25);
  expect(paid.order.priceCents).toBe(750);
  expect(paid.code).toBe("ABCD-EFGH-JKLM-NPQR");
  expect(paid.codeStatus).toBe("available");
  expect(paid.order.paidAt).toBe(new Date(NOW).toISOString());
  now += 60_000;
  const repeated = await store.fetch("pay", request("pay", { cookie, body: { orderId } }));
  expect(repeated.status).toBe(303);
  const stillPaid = await (await getOrder(store, orderId, cookie)).json();
  expect(stillPaid).toStrictEqual(paid);
  const refreshed = await store.fetch("reconcile", request("reconcile", { cookie, body: { orderId } }));
  expect(await refreshed.json()).toStrictEqual(paid);
});

test("dev shop: an amount sent by the client cannot override the backend's discount snapshot", async () => {
  const store = new MockShopStore(() => NOW);
  const response = await store.fetch(
    "checkout",
    request("checkout", {
      body: {
        productId: "demoproduct0001",
        originalPriceCents: 100,
        discountPercent: 99,
        priceCents: 1,
      },
    }),
  );
  expect(response.status).toBe(201);
  const { orderId } = await response.json();
  const cookie = response.headers.get("Set-Cookie")!.split(";")[0];
  const { order } = await (await getOrder(store, orderId, cookie)).json();
  expect(order.originalPriceCents).toBe(1000);
  expect(order.discountPercent).toBe(25);
  expect(order.priceCents).toBe(750);
});

test("dev shop: an unknown or missing session cannot read, pay or refresh an order; the order number is not a credential", async () => {
  const store = new MockShopStore(() => NOW);
  const owner = await checkout(store);
  const stranger = await checkout(store);
  expect(owner.cookie).not.toBe(stranger.cookie);
  expect(owner.orderId).not.toBe(stranger.orderId);
  for (const cookie of [
    undefined,
    stranger.cookie,
    "mailhq_shop=invalid",
    `${owner.cookie}; ${stranger.cookie}`,
    owner.cookie.toUpperCase(),
  ]) {
    const read = await getOrder(store, owner.orderId, cookie);
    expect(read.status).toBe(404);
    for (const route of ["pay", "reconcile"]) {
      const response = await store.fetch(route, request(route, { cookie, body: { orderId: owner.orderId } }));
      expect(response.status).toBe(404);
      expect(response.headers.get("Location")).toBe(null);
    }
  }
  const pending = await (await getOrder(store, owner.orderId, owner.cookie)).json();
  expect(pending.order.status).toBe("pending");
  const another = await checkout(store, owner.cookie);
  expect(another.cookie, "repeated orders in the same browser keep the session").toBe(owner.cookie);
});

test("dev shop: every write checks Origin strictly and ignores forged forwarding headers", async () => {
  const store = new MockShopStore();
  const { orderId, cookie } = await checkout(store);
  for (const route of ["checkout", "pay", "reconcile"]) {
    for (const origin of ["null", "https://attacker.example", "http://localhost:9999"]) {
      const response = await store.fetch(
        route,
        request(route, {
          cookie,
          origin,
          body: { orderId, productId: "demoproduct0001" },
          headers: { "X-Forwarded-Host": "localhost:4321" },
        }),
      );
      expect(response.status).toBe(403);
    }
    const missingOrigin = new Request(`${ORIGIN}/api/shop/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: "{}",
    });
    expect((await store.fetch(route, missingOrigin)).status).toBe(403);
  }
  expect((await (await getOrder(store, orderId, cookie)).json()).order.status).toBe("pending");
});

test("dev shop: bad request format, method and unknown plan are rejected properly, notify does not simulate a real callback", async () => {
  const store = new MockShopStore();
  expect((await store.fetch("notify", request("notify"))).status).toBe(404);
  expect((await store.fetch("settings", request("settings"))).status).toBe(404);
  for (const route of ["catalog", "orders"]) {
    const response = await store.fetch(route, request(route, { method: "POST" }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  }
  for (const route of ["checkout", "pay", "reconcile"]) {
    const response = await store.fetch(route, new Request(`${ORIGIN}/api/shop/${route}`));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  }
  expect((await store.fetch("checkout", request("checkout", { body: { productId: "unknown" } }))).status).toBe(409);
  for (const [contentType, body, expected] of [
    ["text/plain", "{}", 415],
    ["application/jsonp", "{}", 415],
    ["application/json", "[]", 400],
    ["application/json", "not-json", 400],
    ["application/json", "x".repeat(4097), 413],
  ] as const) {
    const response = await store.fetch(
      "checkout",
      new Request(`${ORIGIN}/api/shop/checkout`, {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": contentType },
        body,
      }),
    );
    expect(response.status).toBe(expected);
    expect(response.headers.get("Cache-Control") ?? "").toMatch(/no-store/);
  }
});

test("dev shop: local 127.0.0.1 Host, HTTPS cookies and subpaths are handled correctly", async () => {
  const store = new MockShopStore();
  const headers = {
    Host: "127.0.0.1:4321",
    Origin: "http://127.0.0.1:4321",
    "Content-Type": "application/json",
  };
  const localhost = await store.fetch(
    "checkout",
    new Request(`${ORIGIN}/api/shop/checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ productId: "demoproduct0001" }),
    }),
  );
  expect(localhost.status).toBe(201);
  const secure = await store.fetch(
    "checkout",
    new Request("https://localhost/api/shop/checkout", {
      method: "POST",
      headers: {
        Origin: "https://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId: "demoproduct0001" }),
    }),
  );
  expect(secure.status).toBe(201);
  expect(secure.headers.get("set-cookie")!).toMatch(/; Secure$/);
  const { orderId, cookie } = await checkout(store, undefined, "/demo");
  const pay = await store.fetch("pay", request("pay", { cookie, base: "/demo", body: { orderId } }));
  expect(pay.headers.get("Location")).toBe(`/demo/zh/shop/orders/?id=${orderId}`);
});

test("dev shop: after paying for a subscription plan the order carries a renewal token, renewal orders issue no code and extend the expiry", async () => {
  let now = NOW;
  const store = new MockShopStore(() => now);
  const bought = await store.fetch("checkout", request("checkout", { body: { productId: "demoproduct0002" } }));
  const { orderId } = await bought.json();
  const cookie = bought.headers.get("set-cookie")!.split(";")[0];
  await store.fetch("pay", request("pay", { cookie, body: { orderId } }));
  const paid = await (await getOrder(store, orderId, cookie)).json();
  expect(paid.code).toBe("ABCD-EFGH-JKLM-NPQR");
  expect(paid.subscription.state).toBe("active");
  expect(paid.subscription.currentPeriodEnd).toBe(new Date(NOW + 30 * 86_400_000).toISOString());
  const token = paid.subscription.renewToken;

  const summary = await (await store.fetch("renewal", request("renewal", { body: { token } }))).json();
  expect(summary.renewPriceCents).toBe(400);
  expect((await store.fetch("renewal", request("renewal", { body: { token: "demo-unknown" } }))).status).toBe(404);

  now += 86_400_000;
  const renewed = await store.fetch("renew", request("renew", { cookie, body: { token, periods: 2 } }));
  expect(renewed.status).toBe(201);
  const renewalId = (await renewed.json()).orderId;
  const pending = await (await getOrder(store, renewalId, cookie)).json();
  expect(pending.order.kind).toBe("renewal");
  expect(pending.order.priceCents).toBe(800);
  await store.fetch("pay", request("pay", { cookie, body: { orderId: renewalId } }));
  const done = await (await getOrder(store, renewalId, cookie)).json();
  expect(done.code).toBe(null);
  expect(done.subscription.currentPeriodEnd).toBe(new Date(NOW + 90 * 86_400_000).toISOString());
});

test("dev shop: after login the account lists this browser's orders and subscriptions, logout returns to logged out", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MockShopStore(() => NOW);
  const bought = await store.fetch("checkout", request("checkout", { body: { productId: "demoproduct0002" } }));
  const { orderId } = await bought.json();
  const buyer = bought.headers.get("set-cookie")!.split(";")[0];
  await store.fetch("pay", request("pay", { cookie: buyer, body: { orderId } }));
  expect((await store.fetch("account", request("account", { cookie: buyer }))).status).toBe(401);

  expect((await store.fetch("account/login", request("account/login", { body: { email: "bad" } }))).status).toBe(400);
  await store.fetch(
    "account/login",
    request("account/login", { cookie: buyer, body: { email: "Buyer@Example.test" } }),
  );
  const link = String(info.mock.calls.at(-1)?.[0] ?? "");
  const token = /login=([A-Za-z0-9_-]{43})/.exec(link)![1];
  // The account page first asks which mailbox the link is for: read-only, no session change, the link still works afterwards.
  for (let i = 0; i < 2; i++) {
    const peek = await store.fetch("account/peek", request("account/peek", { cookie: buyer, body: { token } }));
    expect(await peek.json()).toStrictEqual({ email: "buyer@example.test", register: false, reset: false });
    expect(peek.headers.get("set-cookie")).toBe(null);
  }
  const verified = await store.fetch("account/verify", request("account/verify", { cookie: buyer, body: { token } }));
  expect(await verified.json()).toStrictEqual({ email: "buyer@example.test", claimed: 1 });
  expect((await store.fetch("account/peek", request("account/peek", { body: { token } }))).status).toBe(400);
  const session = verified.headers.get("set-cookie")!.split(";")[0];
  expect((await store.fetch("account/verify", request("account/verify", { body: { token } }))).status).toBe(400);

  const account = await (await store.fetch("account", request("account", { cookie: session }))).json();
  expect(account.email).toBe("buyer@example.test");
  expect(account.orders).toHaveLength(1);
  expect(account.orders[0].code).toBe("ABCD-EFGH-JKLM-NPQR");
  expect(account.subscriptions[0].renewToken).toBe(`demo-${orderId}`);

  const out = await store.fetch("account/logout", request("account/logout", { cookie: session }));
  expect(out.headers.get("set-cookie")).toMatch(/^mailhq_customer=; Path=\/; Max-Age=0/);
  expect((await store.fetch("account", request("account", { cookie: session }))).status).toBe(401);
  info.mockRestore();
});

test("dev shop: like mail, a password can be set within 10 minutes of a login link login, afterwards the current password is needed; password login attaches this browser's orders", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  let now = NOW;
  const store = new MockShopStore(() => now);
  const signInByLink = async (cookie?: string) => {
    await store.fetch("account/login", request("account/login", { cookie, body: { email: "buyer@example.test" } }));
    const token = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
    const verified = await store.fetch("account/verify", request("account/verify", { cookie, body: { token } }));
    return verified.headers.get("set-cookie")!.split(";")[0];
  };
  const login = (password: string, cookie?: string) =>
    store.fetch(
      "account/password-login",
      request("account/password-login", { cookie, body: { email: "Buyer@Example.test", password } }),
    );
  const setPassword = (cookie: string, body: object) =>
    store.fetch("account/password", request("account/password", { cookie, body }));

  expect((await login("whatever-1")).status).toBe(401);
  const first = await signInByLink();
  const other = await signInByLink();
  expect((await (await store.fetch("account", request("account", { cookie: first }))).json()).hasPassword).toBe(false);
  expect((await setPassword(first, { password: "short" })).status).toBe(400);
  expect((await setPassword(first, { password: "first password" })).status).toBe(200);
  expect((await (await store.fetch("account", request("account", { cookie: first }))).json()).hasPassword).toBe(true);
  // The other browser is logged out, this one stays.
  expect((await store.fetch("account", request("account", { cookie: other }))).status).toBe(401);
  expect((await store.fetch("account", request("account", { cookie: first }))).status).toBe(200);

  now += 11 * 60_000;
  expect((await setPassword(first, { password: "second password" })).status).toBe(403);
  expect((await setPassword(first, { password: "second password", currentPassword: "nope" })).status).toBe(403);
  expect((await setPassword(first, { password: "second password", currentPassword: "first password" })).status).toBe(
    200,
  );
  expect((await login("first password")).status).toBe(401);

  const bought = await store.fetch("checkout", request("checkout", { body: { productId: "demoproduct0002" } }));
  const buyer = bought.headers.get("set-cookie")!.split(";")[0];
  const signedIn = await login("second password", buyer);
  expect(await signedIn.json()).toStrictEqual({ email: "buyer@example.test", claimed: 1 });
  const session = signedIn.headers.get("set-cookie")!.split(";")[0];
  expect(session).toMatch(/^mailhq_customer=[A-Za-z0-9_-]{43}$/);
  // A session that logged in with a password always needs the current password to change it.
  expect((await setPassword(session, { password: "third password" })).status).toBe(403);
  info.mockRestore();
});

test("dev shop: card orders are recorded as Stripe orders at the fiat price, the subscription has auto-renewal on after payment, the portal is only for the logged in", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MockShopStore(() => NOW);
  const catalog = await (await store.fetch("catalog", request("catalog"))).json();
  expect(catalog.payment).toStrictEqual({ ldc: true, stripe: { currency: "usd" } });
  const bought = await store.fetch(
    "checkout",
    request("checkout", { body: { productId: "demoproduct0002", provider: "stripe" } }),
  );
  const { orderId } = await bought.json();
  const buyer = bought.headers.get("set-cookie")!.split(";")[0];
  const pending = await (await getOrder(store, orderId, buyer)).json();
  expect(pending.order).toMatchObject({ provider: "stripe", currency: "usd", priceCents: 299, discountPercent: 0 });
  await store.fetch("pay", request("pay", { cookie: buyer, body: { orderId } }));
  const paid = await (await getOrder(store, orderId, buyer)).json();
  expect(paid.subscription).toMatchObject({ provider: "stripe", autoRenew: true });
  // Like mail: Stripe charges the subscription itself, so the renewal page offers no periods and renew is refused.
  const renewToken = paid.subscription.renewToken;
  const summary = await (await store.fetch("renewal", request("renewal", { body: { token: renewToken } }))).json();
  expect(summary).toMatchObject({ provider: "stripe", maxPeriods: 0 });
  const renewed = await store.fetch(
    "renew",
    request("renew", { cookie: buyer, body: { token: renewToken, periods: 1 } }),
  );
  expect(renewed.status).toBe(409);

  expect(
    (await store.fetch("account/portal", request("account/portal", { body: { subscriptionId: orderId } }))).status,
  ).toBe(401);
  await store.fetch(
    "account/login",
    request("account/login", { cookie: buyer, body: { email: "buyer@example.test" } }),
  );
  const token = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0]))![1];
  const verified = await store.fetch("account/verify", request("account/verify", { cookie: buyer, body: { token } }));
  const session = verified.headers.get("set-cookie")!.split(";")[0];
  const account = await (await store.fetch("account", request("account", { cookie: session }))).json();
  expect(account.subscriptions[0]).toMatchObject({ provider: "stripe", autoRenew: true, renewToken: null });
  const portal = await store.fetch(
    "account/portal",
    request("account/portal", { cookie: session, body: { subscriptionId: orderId } }),
  );
  expect((await portal.json()).url).toMatch(/^https:\/\/billing\.stripe\.com\//);
  info.mockRestore();
});

/** Requests a login link and exchanges it for a session cookie; requester is the browser requesting the link, user the browser opening it. */
async function signIn(store: MockShopStore, email: string, requester?: string, user?: string) {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  await store.fetch("account/login", request("account/login", { cookie: requester, body: { email } }));
  const token = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0]))![1];
  info.mockRestore();
  const verified = await store.fetch("account/verify", request("account/verify", { cookie: user, body: { token } }));
  return {
    claimed: ((await verified.json()) as { claimed: number }).claimed,
    session: verified.headers.get("set-cookie")!.split(";")[0],
  };
}

test("dev shop: like mail, a login link requested by another browser does not take this browser's orders; orders with the contact email are still attached", async () => {
  const store = new MockShopStore(() => NOW);
  const victim = await checkout(store);
  const own = await store.fetch(
    "checkout",
    request("checkout", { body: { productId: "demoproduct0002", email: "attacker@example.test" } }),
  );
  const ownId = ((await own.json()) as { orderId: string }).orderId;
  // The link was requested by another browser (no purchase session) but opened in the victim's browser.
  const attacker = await signIn(store, "attacker@example.test", undefined, victim.cookie);
  expect(attacker.claimed, "only the order whose contact email is theirs").toBe(1);
  expect((await getOrder(store, victim.orderId, attacker.session)).status).toBe(404);
  expect((await getOrder(store, ownId, attacker.session)).status).toBe(200);
  // A link the victim requested in this browser still collects their own orders.
  expect((await signIn(store, "victim@example.test", victim.cookie, victim.cookie)).claimed).toBe(1);
});

test("dev shop: an order is visible through the purchase session or the account, orders placed while logged in belong to the account directly", async () => {
  const store = new MockShopStore(() => NOW);
  const { session } = await signIn(store, "buyer@example.test");
  const bought = await store.fetch(
    "checkout",
    request("checkout", { cookie: session, body: { productId: "demoproduct0001" } }),
  );
  const { orderId } = (await bought.json()) as { orderId: string };
  // Another browser (account session only, no purchase session for this order) can also view and pay.
  expect((await getOrder(store, orderId, session)).status).toBe(200);
  const account = await (await store.fetch("account", request("account", { cookie: session }))).json();
  expect(account.orders.map((order: { id: string }) => order.id)).toStrictEqual([orderId]);
  const paid = await store.fetch("pay", request("pay", { cookie: session, body: { orderId } }));
  expect(paid.status).toBe(303);
  expect((await getOrder(store, orderId)).status, "invisible without any credential").toBe(404);
});

test("dev shop: payment returns to the order page in the form's language (the order-time language when absent), error messages follow the request language", async () => {
  const store = new MockShopStore(() => NOW);
  const { orderId, cookie } = await checkout(store);
  const paid = await store.fetch("pay", request("pay", { cookie, body: { orderId, lang: "en" } }));
  expect(paid.headers.get("location")).toBe(`/shop/orders/?id=${orderId}`);
  const zh = await store.fetch("pay", request("pay", { cookie, body: { orderId, lang: "zh" } }));
  expect(zh.headers.get("location")).toBe(`/zh/shop/orders/?id=${orderId}`);
  // An old page's form sends no lang: like mail's payment return address, go back to the order-time language rather than this request's language.
  const bought = await store.fetch(
    "checkout",
    request("checkout", { headers: { "Accept-Language": "en" }, body: { productId: "demoproduct0001" } }),
  );
  const englishOrder = ((await bought.json()) as { orderId: string }).orderId;
  const englishCookie = bought.headers.get("set-cookie")!.split(";")[0];
  const legacy = await store.fetch("pay", request("pay", { cookie: englishCookie, body: { orderId: englishOrder } }));
  expect(legacy.headers.get("location")).toBe(`/shop/orders/?id=${englishOrder}`);
  const legacyChinese = await store.fetch(
    "pay",
    request("pay", { cookie, headers: { "Accept-Language": "en" }, body: { orderId } }),
  );
  expect(legacyChinese.headers.get("location")).toBe(`/zh/shop/orders/?id=${orderId}`);
  const english = await store.fetch(
    "orders",
    request("orders?id=abcdefghijklmno", { headers: { "Accept-Language": "en" } }),
  );
  expect(await english.json()).toStrictEqual({ error: "Order not found. Use the browser you ordered in." });
  const chinese = await store.fetch("orders", request("orders?id=abcdefghijklmno"));
  expect(((await chinese.json()) as { error: string }).error).toMatch(/未找到订单/);
});

test("dev shop: every mock API response passes the client parser the pages use (same contract as mail)", async () => {
  const store = new MockShopStore(() => NOW);
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const jar = new Map<string, string>();
  // The page's fetch goes straight to the mock shop, carrying and recording cookies like a browser.
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const target = new URL(url, ORIGIN);
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("Cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    if (init.method === "POST") headers.set("Origin", ORIGIN);
    const response = await store.fetch(
      target.pathname.replace(/^\/api\/shop\//, ""),
      new Request(target, { ...init, headers }),
    );
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (cookie) jar.set(cookie.slice(0, cookie.indexOf("=")), cookie.slice(cookie.indexOf("=") + 1));
    return response;
  });

  const catalog = await getShopCatalog(undefined, "en");
  const product = catalog.products.find((item) => item.periodDays)!;
  const orderId = await createShopOrder(product.id, "en", "", "stripe");
  expect((await getShopOrder(orderId)).order.status).toBe("pending");
  await store.fetch("pay", request("pay", { cookie: `mailhq_shop=${jar.get("mailhq_shop")}`, body: { orderId } }));
  const paid = await getShopOrder(orderId);
  expect(paid.subscription?.provider).toBe("stripe");

  const ldcId = await createShopOrder(product.id, "zh");
  await store.fetch(
    "pay",
    request("pay", { cookie: `mailhq_shop=${jar.get("mailhq_shop")}`, body: { orderId: ldcId } }),
  );
  const renewToken = (await getShopOrder(ldcId)).subscription!.renewToken!;
  expect((await getRenewal(renewToken)).subscriptionId).toBe(ldcId);
  expect(await createRenewalOrder(renewToken, 2)).toMatch(/^[a-z0-9]{15}$/);

  await requestLogin("buyer@example.test");
  const token = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0]))![1]!;
  expect(await peekLogin(token)).toStrictEqual({ email: "buyer@example.test", register: false, reset: false });
  expect(await verifyLogin(token)).toStrictEqual({ email: "buyer@example.test", claimed: 3 });
  const account = await getAccount();
  expect(account!.orders).toHaveLength(3);
  expect(account!.subscriptions.map((item) => item.provider).sort()).toStrictEqual(["ldc", "stripe"]);
  info.mockRestore();
});

test("dev shop: registration takes effect only after the confirmation link is used, then password login works", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MockShopStore(() => NOW);
  const register = (body: object) => store.fetch("account/register", request("account/register", { body }));
  expect((await register({ email: "bad", password: "a long password" })).status).toBe(400);
  expect((await register({ email: "new@example.test", password: "short" })).status).toBe(400);
  expect(await (await register({ email: "New@Example.test", password: "a long password" })).json()).toStrictEqual({
    sent: true,
  });
  const token = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
  const login = () =>
    store.fetch(
      "account/password-login",
      request("account/password-login", { body: { email: "new@example.test", password: "a long password" } }),
    );
  expect((await login()).status).toBe(401);
  const peek = await store.fetch("account/peek", request("account/peek", { body: { token } }));
  expect(await peek.json()).toStrictEqual({ email: "new@example.test", register: true, reset: false });
  expect((await store.fetch("account/verify", request("account/verify", { body: { token } }))).status).toBe(200);
  expect((await login()).status).toBe(200);
  info.mockRestore();
});

test("dev shop: mailbox management covers only the mailboxes of the account's own orders; activate, reset password, suspend and delete follow mail's rules", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MockShopStore(() => NOW);
  const signIn = async (email: string, cookie?: string) => {
    await store.fetch("account/login", request("account/login", { cookie, body: { email } }));
    const token = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
    const verified = await store.fetch("account/verify", request("account/verify", { cookie, body: { token } }));
    return verified.headers.get("set-cookie")!.split(";")[0]!;
  };
  const { orderId, cookie: buyer } = await checkout(store);
  await store.fetch("pay", request("pay", { cookie: buyer, body: { orderId } }));
  const session = await signIn("buyer@example.test", buyer);
  const stranger = await signIn("other@example.test");
  const list = async (cookie: string) =>
    (await store.fetch("account/mailboxes", request("account/mailboxes", { cookie }))).json();
  const write = (action: string, cookie: string, body: object) =>
    store.fetch(`account/mailboxes/${action}`, request(`account/mailboxes/${action}`, { cookie, body }));

  expect((await store.fetch("account/mailboxes", request("account/mailboxes"))).status).toBe(401);
  const before = await list(session);
  expect(before.groups).toHaveLength(1);
  expect(before.groups[0]).toMatchObject({ orderId, usesLeft: 1, mailboxLimit: 1, mailboxes: [] });
  expect((await list(stranger)).groups).toStrictEqual([]);

  const create = { orderId, domain: "abnormalhq.com", username: "dave", password: "Mailbox-pass-1" };
  expect((await write("create", stranger, create)).status).toBe(404);
  expect((await write("create", session, { ...create, username: "admin" })).status).toBe(409);
  expect((await write("create", session, { ...create, username: "Not Valid" })).status).toBe(400);
  const created = await write("create", session, create);
  expect(created.status).toBe(201);
  expect((await created.json()).email).toBe("dave@abnormalhq.com");
  expect((await write("create", session, { ...create, username: "erin" })).status).toBe(409);

  const after = await list(session);
  const mailbox = after.groups[0].mailboxes[0];
  expect(after.groups[0]).toMatchObject({ usesLeft: 0, codeStatus: "used", domains: [] });
  expect(mailbox).toMatchObject({ email: "dave@abnormalhq.com", status: "active" });
  expect((await write("password", stranger, { mailboxId: mailbox.id, password: "Another-pass-1" })).status).toBe(404);
  expect((await write("password", session, { mailboxId: mailbox.id, password: "short" })).status).toBe(400);
  expect((await write("password", session, { mailboxId: mailbox.id, password: "Another-pass-1" })).status).toBe(200);
  expect((await write("status", session, { mailboxId: mailbox.id, status: "disabled" })).status).toBe(200);
  expect((await list(session)).groups[0].mailboxes[0].status).toBe("disabled");
  expect((await write("delete", session, { mailboxId: mailbox.id, confirm: "erin@abnormalhq.com" })).status).toBe(400);
  expect((await write("delete", session, { mailboxId: mailbox.id, confirm: "Dave@abnormalhq.com" })).status).toBe(200);
  // After deleting, the quota is back and another can be activated.
  expect((await list(session)).groups[0]).toMatchObject({ usesLeft: 1, mailboxes: [] });

  // The client the pages use still understands the mock API's answers.
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) =>
    store.fetch(
      "account/mailboxes",
      new Request(`${ORIGIN}${url}`, { ...init, headers: { ...init.headers, Cookie: session } }),
    ),
  );
  expect((await getAccountMailboxes())!.groups[0]!.orderId).toBe(orderId);
  vi.unstubAllGlobals();
  info.mockRestore();
});

test("dev shop: like mail, login and reset links expire after 15 minutes", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  let now = NOW;
  const store = new MockShopStore(() => now);
  await store.fetch("account/login", request("account/login", { body: { email: "buyer@example.test" } }));
  const loginToken = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
  await store.fetch("account/verify", request("account/verify", { body: { token: loginToken } }));
  await store.fetch("account/forgot", request("account/forgot", { body: { email: "buyer@example.test" } }));
  const resetToken = /reset=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
  await store.fetch("account/login", request("account/login", { body: { email: "buyer@example.test" } }));
  const lateLogin = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
  now += 16 * 60_000;
  expect((await store.fetch("account/peek", request("account/peek", { body: { token: resetToken } }))).status).toBe(
    400,
  );
  expect(
    (
      await store.fetch(
        "account/reset",
        request("account/reset", { body: { token: resetToken, password: "a new password" } }),
      )
    ).status,
  ).toBe(400);
  expect((await store.fetch("account/verify", request("account/verify", { body: { token: lateLogin } }))).status).toBe(
    400,
  );
  info.mockRestore();
});

test("dev shop: forgot password sends a reset link only to emails with an account, a reset link cannot log in directly, setting a new password logs in and logs out elsewhere", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MockShopStore(() => NOW);
  const forgot = (email: string) => store.fetch("account/forgot", request("account/forgot", { body: { email } }));
  expect(await (await forgot("nobody@example.test")).json()).toStrictEqual({ sent: true });
  expect(info).not.toHaveBeenCalled();

  await store.fetch("account/login", request("account/login", { body: { email: "buyer@example.test" } }));
  const loginToken = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
  const first = await store.fetch("account/verify", request("account/verify", { body: { token: loginToken } }));
  const oldSession = first.headers.get("set-cookie")!.split(";")[0]!;

  expect(await (await forgot("Buyer@Example.test")).json()).toStrictEqual({ sent: true });
  const resetToken = /reset=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
  const peek = await store.fetch("account/peek", request("account/peek", { body: { token: resetToken } }));
  expect(await peek.json()).toStrictEqual({ email: "buyer@example.test", register: false, reset: true });
  expect((await store.fetch("account/verify", request("account/verify", { body: { token: resetToken } }))).status).toBe(
    400,
  );

  const reset = (body: object) => store.fetch("account/reset", request("account/reset", { body }));
  expect((await reset({ token: resetToken, password: "short" })).status).toBe(400);
  const done = await reset({ token: resetToken, password: "a new password" });
  expect(await done.json()).toStrictEqual({ email: "buyer@example.test", claimed: 0 });
  expect(done.headers.get("set-cookie")).toMatch(/^mailhq_customer=[A-Za-z0-9_-]{43};/);
  expect((await store.fetch("account", request("account", { cookie: oldSession }))).status).toBe(401);
  expect((await reset({ token: resetToken, password: "a new password" })).status).toBe(400);
  const signedIn = await store.fetch(
    "account/password-login",
    request("account/password-login", { body: { email: "buyer@example.test", password: "a new password" } }),
  );
  expect(signedIn.status).toBe(200);
  info.mockRestore();
});

test("dev shop: Google login accepts only the browser that started it and only once, opens an account the first time, and can be unlinked afterwards", async () => {
  const store = new MockShopStore(() => NOW);
  const started = await store.fetch("account/google/start", request("account/google/start", { body: { lang: "en" } }));
  const { url } = (await started.json()) as { url: string };
  const state = new URL(url).searchParams.get("state")!;
  expect(new URL(url).pathname).toBe("/shop/account");
  const stateCookie = started.headers.get("set-cookie")!.split(";")[0]!;
  expect(stateCookie).toMatch(/^mailhq_shop_google=/);
  const finish = (cookie: string | undefined, body: object) =>
    store.fetch("account/google", request("account/google", { cookie, body }));

  // Without this browser's state cookie, or with another state: refused.
  expect((await finish(undefined, { code: "mock-google", state })).status).toBe(400);
  const again = await store.fetch("account/google/start", request("account/google/start", { body: { lang: "zh" } }));
  const otherState = new URL(((await again.json()) as { url: string }).url).searchParams.get("state")!;
  const otherCookie = again.headers.get("set-cookie")!.split(";")[0]!;
  expect((await finish(otherCookie, { code: "mock-google", state })).status).toBe(400);
  // The refused attempt used up that flow too.
  expect((await finish(otherCookie, { code: "mock-google", state: otherState })).status).toBe(400);

  const done = await finish(stateCookie, { code: "mock-google", state });
  expect(await done.json()).toStrictEqual({
    email: "google.buyer@gmail.com",
    claimed: 0,
    created: true,
    linked: false,
    lang: "en",
  });
  const cookies = done.headers.getSetCookie();
  expect(cookies[0]).toMatch(/^mailhq_shop_google=; Path=\/api\/shop\/account\/google; Max-Age=0/);
  const session = cookies[1]!.split(";")[0]!;
  expect((await finish(stateCookie, { code: "mock-google", state })).status).toBe(400);

  const account = async () => (await store.fetch("account", request("account", { cookie: session }))).json();
  expect(await account()).toMatchObject({
    email: "google.buyer@gmail.com",
    hasPassword: false,
    google: { email: "google.buyer@gmail.com" },
  });
  // Fresh from Google, a first password needs no current one, as after an emailed link.
  const password = await store.fetch(
    "account/password",
    request("account/password", { cookie: session, body: { password: "a new password" } }),
  );
  expect(password.status).toBe(200);
  const unlink = () =>
    store.fetch("account/google/unlink", request("account/google/unlink", { cookie: session, body: {} }));
  expect((await unlink()).status).toBe(200);
  expect((await unlink()).status).toBe(404);
  expect(await account()).toMatchObject({ google: null, hasPassword: true });
});

test("dev shop: a logged-in account links Google from the account page, and only the session of the account that started it can finish", async () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const store = new MockShopStore(() => NOW);
  await store.fetch("account/login", request("account/login", { body: { email: "buyer@example.test" } }));
  const loginToken = /login=([A-Za-z0-9_-]{43})/.exec(String(info.mock.calls.at(-1)?.[0] ?? ""))![1];
  const verified = await store.fetch("account/verify", request("account/verify", { body: { token: loginToken } }));
  const session = verified.headers.get("set-cookie")!.split(";")[0]!;
  const start = (cookie?: string) =>
    store.fetch("account/google/start", request("account/google/start", { cookie, body: { link: true } }));
  expect((await start()).status).toBe(401);

  const started = await start(session);
  const state = new URL(((await started.json()) as { url: string }).url).searchParams.get("state")!;
  const stateCookie = started.headers.get("set-cookie")!.split(";")[0]!;
  const finish = (cookie: string) =>
    store.fetch("account/google", request("account/google", { cookie, body: { code: "mock-google", state } }));
  expect((await finish(stateCookie)).status).toBe(401);

  const again = await start(session);
  const nextState = new URL(((await again.json()) as { url: string }).url).searchParams.get("state")!;
  const nextCookie = again.headers.get("set-cookie")!.split(";")[0]!;
  const linked = await store.fetch(
    "account/google",
    request("account/google", { cookie: `${nextCookie}; ${session}`, body: { code: "mock-google", state: nextState } }),
  );
  expect(await linked.json()).toStrictEqual({
    email: "buyer@example.test",
    claimed: 0,
    created: false,
    linked: true,
    lang: "zh",
  });
  // No new session: the account stays signed in as it was.
  expect(linked.headers.getSetCookie().some((cookie) => cookie.startsWith("mailhq_customer="))).toBe(false);
  const account = await (await store.fetch("account", request("account", { cookie: session }))).json();
  expect(account).toMatchObject({ email: "buyer@example.test", google: { email: "google.buyer@gmail.com" } });
  info.mockRestore();
});

test("dev shop: when the site is mounted under a subpath, the Google login state cookie carries the subpath too", async () => {
  const store = new MockShopStore(() => NOW);
  const started = await store.fetch(
    "account/google/start",
    request("account/google/start", { body: { lang: "zh" }, base: "/demo" }),
  );
  const { url } = (await started.json()) as { url: string };
  expect(new URL(url).pathname).toBe("/demo/shop/account");
  expect(started.headers.get("set-cookie")).toMatch(/; Path=\/demo\/api\/shop\/account\/google;/);
  const state = new URL(url).searchParams.get("state")!;
  const done = await store.fetch(
    "account/google",
    request("account/google", {
      cookie: started.headers.get("set-cookie")!.split(";")[0]!,
      body: { code: "mock-google", state },
      base: "/demo",
    }),
  );
  expect(done.status).toBe(200);
  expect(done.headers.getSetCookie()[0]).toMatch(/^mailhq_shop_google=; Path=\/demo\/api\/shop\/account\/google;/);
});
