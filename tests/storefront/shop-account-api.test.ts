import { expect, test, vi } from "vitest";
import {
  createRenewalOrder,
  finishGoogleLogin,
  formatMoney,
  getAccount,
  getRenewal,
  getShopCatalog,
  getShopOrder,
  logoutAccount,
  createAccountMailbox,
  deleteAccountMailbox,
  getAccountMailboxes,
  passwordLogin,
  peekLogin,
  peekLoginWithRetry,
  registerAccount,
  requestLogin,
  requestPasswordReset,
  resetPassword,
  setAccountMailboxPassword,
  setAccountMailboxStatus,
  setAccountPassword,
  ShopApiError,
  startGoogleLogin,
  unlinkGoogle,
  verifyLogin,
} from "@/storefront/lib/shop";
import {
  ORDER_ID,
  SUBSCRIPTION_ID,
  accountResponse,
  catalogResponse,
  orderResponse,
  renewalResponse,
} from "./fixtures/shop-contract";

/** Answers every request with the same response and records the requests. */
function respond(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json(body, { status });
  });
  return calls;
}

/** Makes one change to a sample (dotted path, array indexes written as numbers). */
function patched<T>(sample: T, path: string, value: unknown): T {
  const copy = structuredClone(sample) as Record<string, unknown>;
  const keys = path.split(".");
  let target = copy as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  if (value === undefined) delete target[keys.at(-1)!];
  else target[keys.at(-1)!] = value;
  return copy as T;
}

test("shop client: reads plans, orders, renewal and account from mail's response samples, keeping only the fields the pages use", async () => {
  respond(catalogResponse);
  const catalog = await getShopCatalog();
  expect(catalog.payment).toStrictEqual({ ldc: true, stripe: { currency: "usd" } });
  expect(catalog.products[0]).not.toHaveProperty("enabled");
  expect(catalog.products[0]).toMatchObject({ id: "productabcdefgh", fiatPriceMinor: 499, periodDays: 30 });

  respond(orderResponse);
  const order = await getShopOrder(ORDER_ID);
  expect(order.order).toMatchObject({ id: ORDER_ID, provider: "stripe", currency: "usd", status: "paid" });
  expect(order.subscription).toStrictEqual(orderResponse.subscription);
  expect(order.codeStatus).toBe("available");
  // Old mail still returns the whole order: merchant and transaction fields the pages do not use stay out of the client object.
  respond({
    ...orderResponse,
    order: { ...orderResponse.order, productId: "productabcdefgh", merchantId: "stripe", tradeNo: "cs_1", cdkId: "c1" },
  });
  const legacy = await getShopOrder(ORDER_ID);
  for (const key of ["merchantId", "tradeNo", "cdkId", "productId"]) expect(legacy.order).not.toHaveProperty(key);
  expect(legacy.order).toStrictEqual(order.order);
  // The renewal token can be null (same rule as the account page); the order is still read.
  respond({ ...orderResponse, subscription: { ...orderResponse.subscription, renewToken: null } });
  expect((await getShopOrder(ORDER_ID)).subscription?.renewToken).toBeNull();

  const renewalCalls = respond(renewalResponse);
  const renewal = await getRenewal("signed.renewal.token");
  expect(renewal).toStrictEqual(renewalResponse);
  expect(renewal.subscriptionId).toBe(SUBSCRIPTION_ID);
  expect(JSON.parse(String(renewalCalls[0]!.init.body))).toStrictEqual({ token: "signed.renewal.token" });

  respond(accountResponse);
  expect(await getAccount()).toStrictEqual(accountResponse);
});

test("shop client: optional fields an old backend omits may be absent and do not appear in the result", async () => {
  respond(patched(patched(orderResponse, "order.provider", undefined), "subscription", undefined));
  const order = await getShopOrder(ORDER_ID);
  expect(order.order).not.toHaveProperty("provider");
  expect(order.subscription).toBe(null);
  respond(patched(patched(renewalResponse, "provider", undefined), "autoRenew", undefined));
  expect(await getRenewal("t")).not.toHaveProperty("provider");
  respond(patched(accountResponse, "hasPassword", undefined));
  expect(await getAccount()).not.toHaveProperty("hasPassword");
  respond(patched(accountResponse, "google", undefined));
  expect(await getAccount()).not.toHaveProperty("google");
  respond(patched(accountResponse, "google", null));
  expect((await getAccount())!.google).toBeNull();
  respond(patched(accountResponse, "subscriptions.0.fiatRenewMinor", undefined));
  expect((await getAccount())!.subscriptions[0]).not.toHaveProperty("fiatRenewMinor");
  respond({ ...catalogResponse, payment: undefined });
  expect((await getShopCatalog()).payment).toStrictEqual({ ldc: true, stripe: null });
});

test("shop client: any malformed field the account page renders counts as a failed request", async () => {
  for (const [path, value] of [
    ["email", 1],
    ["hasPassword", "yes"],
    ["google", "buyer@gmail.com"],
    ["google.email", 1],
    ["subscriptions.0.periodDays", "30"],
    ["subscriptions.0.renewPriceCents", -1],
    ["subscriptions.0.mailboxCount", 1.5],
    ["subscriptions.0.mailboxes", [1]],
    ["subscriptions.0.state", "paused"],
    ["subscriptions.0.provider", "paypal"],
    ["subscriptions.0.currency", "dollars"],
    ["subscriptions.0.fiatRenewMinor", "499"],
    ["subscriptions.0.autoRenew", "yes"],
    ["subscriptions.0.renewToken", 1],
    ["orders.0.priceCents", "499"],
    ["orders.0.periods", null],
    ["orders.0.periodDays", undefined],
    ["orders.0.created", null],
    ["orders.0.paidAt", 0],
    ["orders.0.codeStatus", "lost"],
    ["orders.0.provider", "paypal"],
    ["orders.0.currency", "USD"],
    ["orders.0.kind", "gift"],
    ["orders.0.status", "refunded"],
    ["orders", {}],
  ] as const) {
    respond(patched(accountResponse, path, value));
    await expect(getAccount(), path).rejects.toBeInstanceOf(ShopApiError);
  }
});

test("shop client: order and renewal info fields are checked one by one too", async () => {
  for (const [path, value] of [
    ["order.id", "otherorder00001"],
    ["order.currency", "us dollar"],
    ["order.provider", "paypal"],
    ["order.periods", "1"],
    ["order.kind", "gift"],
    ["order.fiatPriceMinor", "1"],
    ["order.subscriptionId", 1],
    ["codeStatus", "lost"],
    ["code", 1],
    ["onboardUrl", null],
    ["subscription.state", "paused"],
    ["subscription.autoRenew", "yes"],
    ["subscription.provider", "paypal"],
  ] as const) {
    respond(patched(orderResponse, path, value));
    await expect(getShopOrder(ORDER_ID), path).rejects.toBeInstanceOf(ShopApiError);
  }
  for (const [path, value] of [
    ["maxPeriods", "12"],
    ["mailboxes", ["a", 1]],
    ["state", "paused"],
    ["hasContactEmail", 1],
    ["provider", "paypal"],
    ["autoRenew", "no"],
  ] as const) {
    respond(patched(renewalResponse, path, value));
    await expect(getRenewal("t"), path).rejects.toBeInstanceOf(ShopApiError);
  }
  for (const [path, value] of [
    ["products.0.fiatPriceMinor", "499"],
    ["products.0.periodDays", -30],
    ["products.0.renewPriceCents", 1.5],
  ] as const) {
    respond(patched(catalogResponse, path, value));
    await expect(getShopCatalog(), path).rejects.toBeInstanceOf(ShopApiError);
  }
  // Card payment with a bad currency cannot be priced, so it counts as off; LDC stays buyable.
  respond(patched(catalogResponse, "payment.stripe.currency", "dollars"));
  expect((await getShopCatalog()).payment).toStrictEqual({ ldc: true, stripe: null });
});

test("shop client: reading the account while logged out (401) gives null, other errors are thrown as usual", async () => {
  respond({ error: "请先登录。" }, 401);
  expect(await getAccount()).toBe(null);
  respond({ error: "邮件服务暂时不可用，请稍后再试。" }, 503);
  await expect(getAccount()).rejects.toMatchObject({ status: 503, message: "邮件服务暂时不可用，请稍后再试。" });
});

test("shop client: login, renewal ordering and logout send requests per the contract and check the responses", async () => {
  let calls = respond({ email: "buyer@example.com", claimed: 2 });
  expect(await verifyLogin("token", "en")).toStrictEqual({ email: "buyer@example.com", claimed: 2 });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/verify$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ token: "token" });
  expect(new Headers(calls[0]!.init.headers).get("Accept-Language")).toBe("en");
  for (const body of [{ email: "buyer@example.com" }, { email: 1, claimed: 0 }, { email: "a@b.c", claimed: -1 }]) {
    respond(body);
    await expect(verifyLogin("token")).rejects.toBeInstanceOf(ShopApiError);
  }
  respond({ error: "登录链接无效、已过期或已经用过，请重新获取。" }, 400);
  await expect(verifyLogin("token")).rejects.toMatchObject({ status: 400 });

  calls = respond({ sent: true });
  await requestLogin("buyer@example.com");
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ email: "buyer@example.com" });

  calls = respond({ orderId: "renewal00000001" }, 201);
  expect(await createRenewalOrder("token", 2, "zh", "me@example.com")).toBe("renewal00000001");
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({
    token: "token",
    periods: 2,
    email: "me@example.com",
  });
  await createRenewalOrder("token", 1);
  expect(JSON.parse(String(calls[1]!.init.body))).toStrictEqual({ token: "token", periods: 1 });
  respond({ orderId: "NOT-AN-ORDER" }, 201);
  await expect(createRenewalOrder("token", 1)).rejects.toBeInstanceOf(ShopApiError);

  calls = respond({ ok: true });
  await logoutAccount();
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/logout$/);
  expect(calls[0]!.init.method).toBe("POST");
});

test("shop client: password login and setting a password send requests per the contract and check the responses", async () => {
  let calls = respond({ email: "buyer@example.com", claimed: 1 });
  expect(await passwordLogin("buyer@example.com", "a long password", "en", "tt")).toStrictEqual({
    email: "buyer@example.com",
    claimed: 1,
  });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/password-login$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({
    email: "buyer@example.com",
    password: "a long password",
    turnstileToken: "tt",
  });
  expect(new Headers(calls[0]!.init.headers).get("Accept-Language")).toBe("en");
  respond({ email: "buyer@example.com" });
  await expect(passwordLogin("buyer@example.com", "a long password")).rejects.toBeInstanceOf(ShopApiError);
  respond({ error: "邮箱或密码不正确。" }, 401);
  await expect(passwordLogin("buyer@example.com", "nope")).rejects.toMatchObject({
    status: 401,
    message: "邮箱或密码不正确。",
  });

  calls = respond({ ok: true });
  await setAccountPassword("new password");
  await setAccountPassword("new password", "old password");
  expect(calls.map(({ url }) => new URL(url, "http://x").pathname)).toStrictEqual([
    "/api/shop/account/password",
    "/api/shop/account/password",
  ]);
  expect(calls.map(({ init }) => JSON.parse(String(init.body)))).toStrictEqual([
    { password: "new password" },
    { password: "new password", currentPassword: "old password" },
  ]);
  respond({ error: "请正确输入当前密码。" }, 403);
  await expect(setAccountPassword("new password")).rejects.toMatchObject({ status: 403 });
});

test("shop client: asks read-only which mailbox a link belongs to before login; a mail error on logout still counts as logged out", async () => {
  // Old backends omit register: treated as a plain login link.
  let calls = respond({ email: "buyer@example.com" });
  expect(await peekLogin("token", undefined, "en")).toStrictEqual({
    email: "buyer@example.com",
    register: false,
    reset: false,
  });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/peek$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ token: "token" });
  respond({ email: "buyer@example.com", register: true });
  expect(await peekLogin("token")).toStrictEqual({ email: "buyer@example.com", register: true, reset: false });
  respond({ email: "buyer@example.com", register: false, reset: true });
  expect(await peekLogin("token")).toStrictEqual({ email: "buyer@example.com", register: false, reset: true });
  for (const body of [
    {},
    { email: "" },
    { email: 1 },
    { email: "buyer@example.com", register: "yes" },
    { email: "buyer@example.com", reset: 1 },
  ]) {
    respond(body);
    await expect(peekLogin("token")).rejects.toBeInstanceOf(ShopApiError);
  }
  respond({ error: "登录链接无效、已过期或已经用过，请重新获取。" }, 400);
  await expect(peekLogin("token")).rejects.toMatchObject({ status: 400 });

  // Logout requests forwarded by this site's Worker always clear the session cookie: when mail answers 5xx the browser is logged out too.
  calls = respond({ error: "邮件服务暂时不可用，请稍后再试。" }, 503);
  await expect(logoutAccount()).resolves.toBeUndefined();
  respond({ error: "来源不在允许之列。" }, 403);
  await expect(logoutAccount()).rejects.toMatchObject({ status: 403 });
  // Cloudflare's own error page (Worker threw or hit a limit) skipped the Worker's clearing and the cookie is still there: cannot claim logged out.
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("<!doctype html><title>Worker threw exception</title>", {
        status: 500,
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      }),
  );
  await expect(logoutAccount()).rejects.toMatchObject({ status: 500, answered: false });
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await expect(logoutAccount()).rejects.toBeInstanceOf(TypeError);
  expect(calls).toHaveLength(1);
});

test("shop client: when the confirmation dialog asks for the link's mailbox, temporary failures are asked again, final answers are not", async () => {
  /** Answers these responses in order (Error means the request never arrived) and counts the requests. */
  const sequence = (...answers: (Response | Error)[]) => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      const answer = answers[Math.min(calls++, answers.length - 1)]!;
      if (answer instanceof Error) throw answer;
      return answer;
    });
    return () => calls;
  };
  const busy = () => Response.json({ error: "邮件服务暂时不可用，请稍后再试。" }, { status: 503 });
  const email = () => Response.json({ email: "buyer@example.com" });

  for (const first of [
    busy(),
    Response.json({ error: "请求太频繁" }, { status: 429 }),
    new TypeError("Failed to fetch"),
  ]) {
    const calls = sequence(first, email());
    expect(await peekLoginWithRetry("token", undefined, "zh", 0)).toStrictEqual({
      email: "buyer@example.com",
      register: false,
      reset: false,
    });
    expect(calls()).toBe(2);
  }
  // Asked once more only: an old backend (no peek, Worker answers 503) fails both times, and the page confirms without showing the mailbox.
  let calls = sequence(busy(), busy(), email());
  await expect(peekLoginWithRetry("token", undefined, "zh", 0)).rejects.toMatchObject({ status: 503 });
  expect(calls()).toBe(2);
  // An invalid link (400) and malformed answers are final.
  calls = sequence(Response.json({ error: "登录链接无效" }, { status: 400 }), email());
  await expect(peekLoginWithRetry("token", undefined, "zh", 0)).rejects.toMatchObject({ status: 400 });
  expect(calls()).toBe(1);
  calls = sequence(Response.json({ email: "" }), email());
  await expect(peekLoginWithRetry("token", undefined, "zh", 0)).rejects.toBeInstanceOf(ShopApiError);
  expect(calls()).toBe(1);
  // When the page is left (abort) it neither waits nor asks again.
  const controller = new AbortController();
  calls = sequence(busy(), email());
  const pending = peekLoginWithRetry("token", controller.signal, "zh", 60_000);
  await vi.waitFor(() => expect(calls()).toBe(1));
  controller.abort();
  await expect(pending).rejects.toBeDefined();
  expect(calls()).toBe(1);
});

test("shop amounts: an unknown currency falls back to amount plus code instead of throwing at render time", () => {
  expect(formatMoney(499, "usd", "en")).toBe("$4.99");
  expect(formatMoney(499, "not-a-currency", "en")).toBe("4.99 NOT-A-CURRENCY");
  expect(formatMoney(499, "", "zh")).toBe("4.99");
});

test("shop amounts: the smallest unit follows the currency's own decimals, none for the yen and three for the Kuwaiti dinar", () => {
  expect(formatMoney(500, "jpy", "en")).toBe("¥500");
  expect(formatMoney(500, "krw", "en")).toBe("₩500");
  expect(formatMoney(1500, "kwd", "en")).toBe("KWD\u00a01.500");
  expect(formatMoney(499, "eur", "en")).toBe("€4.99");
});

test("shop client: with human verification on the catalog carries the site key, login requests carry the token, and a rejection reads the backend's explanation", async () => {
  respond({ ...catalogResponse, turnstileSiteKey: " 0x4AAAsite " });
  expect((await getShopCatalog()).turnstileSiteKey).toBe("0x4AAAsite");
  // The empty string and non-strings count as off: no Turnstile widget, submit as usual.
  for (const value of ["", "  ", 1, null]) {
    respond({ ...catalogResponse, turnstileSiteKey: value });
    expect(await getShopCatalog()).not.toHaveProperty("turnstileSiteKey");
  }
  respond(catalogResponse);
  expect(await getShopCatalog()).not.toHaveProperty("turnstileSiteKey");

  let calls = respond({ sent: true });
  await requestLogin("buyer@example.com", "en", "token");
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({
    email: "buyer@example.com",
    turnstileToken: "token",
  });
  // Without a token (verification off or script not loaded) the field is omitted and the backend decides.
  calls = respond({ sent: true });
  await requestLogin("buyer@example.com", "en", "");
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ email: "buyer@example.com" });

  respond({ error: "The human check did not pass." }, 403);
  await expect(requestLogin("buyer@example.com", "en", "spent")).rejects.toMatchObject({
    status: 403,
    message: "The human check did not pass.",
  });
});

const mailboxesResponse = {
  groups: [
    {
      orderId: ORDER_ID,
      productName: "月付三邮箱",
      code: "ABCD-EFGH-JKLM-NPQR",
      codeStatus: "available",
      usesLeft: 1,
      mailboxLimit: 3,
      codeExpires: null,
      domains: ["abnormal.bid"],
      locked: false,
      mailboxes: [
        {
          id: "mailbox00000001",
          email: "alice@abnormal.bid",
          status: "active",
          quotaMb: 2048,
          usageMb: 12.5,
          created: "2026-11-01T00:00:00.000Z",
        },
        {
          id: "mailbox00000002",
          email: "bob@abnormal.bid",
          status: "disabled",
          quotaMb: null,
          usageMb: null,
          created: "2026-11-02T00:00:00.000Z",
        },
      ],
    },
  ],
  servers: {
    "abnormal.bid": {
      imap: { host: "mail.abnormal.bid", port: 993, security: "tls" },
      smtp: null,
    },
  },
  webmail: "https://webmail.abnormalhq.com/",
};

test("shop client: registration sends the request per the contract with the Turnstile token", async () => {
  const calls = respond({ sent: true });
  await registerAccount("buyer@example.com", "a long password", "en", "tt");
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/register$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({
    email: "buyer@example.com",
    password: "a long password",
    turnstileToken: "tt",
  });
  await registerAccount("buyer@example.com", "a long password");
  expect(JSON.parse(String(calls[1]!.init.body))).toStrictEqual({
    email: "buyer@example.com",
    password: "a long password",
  });
});

test("shop client: mailbox management is read from mail's samples, malformed shapes fail; logged out is null", async () => {
  respond(mailboxesResponse);
  expect(await getAccountMailboxes()).toStrictEqual(mailboxesResponse);
  for (const [path, value] of [
    ["groups.0.usesLeft", -1],
    ["groups.0.codeStatus", "lost"],
    ["groups.0.locked", "no"],
    ["groups.0.domains", [1]],
    ["groups.0.mailboxes.0.status", "pending"],
    ["groups.0.mailboxes.0.usageMb", -1],
    ["groups.0.mailboxes.0.email", 1],
    ["webmail", 1],
    ["groups", {}],
  ] as const) {
    respond(patched(mailboxesResponse, path, value));
    await expect(getAccountMailboxes(), path).rejects.toBeInstanceOf(ShopApiError);
  }
  respond({ ...mailboxesResponse, servers: { "abnormal.bid": { imap: { host: 1 }, smtp: null } } });
  await expect(getAccountMailboxes()).rejects.toBeInstanceOf(ShopApiError);
  respond({ error: "请先登录。" }, 401);
  expect(await getAccountMailboxes()).toBeNull();
});

test("shop client: activating, resetting the password, suspending and deleting a mailbox send requests per the contract", async () => {
  let calls = respond(
    { email: "dave@abnormal.bid", imap: mailboxesResponse.servers["abnormal.bid"].imap, smtp: null, webmail: null },
    201,
  );
  const input = { orderId: ORDER_ID, domain: "abnormal.bid", username: "dave", password: "Mailbox-pass-1" };
  expect(await createAccountMailbox(input, "en")).toStrictEqual({
    email: "dave@abnormal.bid",
    imap: { host: "mail.abnormal.bid", port: 993, security: "tls" },
    smtp: null,
    webmail: null,
  });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/mailboxes\/create$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual(input);
  respond({ email: 1 }, 201);
  await expect(createAccountMailbox(input)).rejects.toBeInstanceOf(ShopApiError);
  respond({ error: "这个用户名已被占用。" }, 409);
  await expect(createAccountMailbox(input)).rejects.toMatchObject({ status: 409, message: "这个用户名已被占用。" });

  calls = respond({ ok: true });
  await setAccountMailboxPassword("mailbox00000001", "Another-pass-1");
  await setAccountMailboxStatus("mailbox00000001", "disabled");
  await deleteAccountMailbox("mailbox00000001", "alice@abnormal.bid");
  expect(calls.map(({ url }) => new URL(url, "http://x").pathname)).toStrictEqual([
    "/api/shop/account/mailboxes/password",
    "/api/shop/account/mailboxes/status",
    "/api/shop/account/mailboxes/delete",
  ]);
  expect(calls.map(({ init }) => JSON.parse(String(init.body)))).toStrictEqual([
    { mailboxId: "mailbox00000001", password: "Another-pass-1" },
    { mailboxId: "mailbox00000001", status: "disabled" },
    { mailboxId: "mailbox00000001", confirm: "alice@abnormal.bid" },
  ]);
});

test("shop client: forgot password and reset password send requests per the contract and check the responses", async () => {
  let calls = respond({ sent: true });
  await requestPasswordReset("buyer@example.com", "en", "tt");
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/forgot$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ email: "buyer@example.com", turnstileToken: "tt" });

  calls = respond({ email: "buyer@example.com", claimed: 0 });
  expect(await resetPassword("token", "a new password", "zh")).toStrictEqual({
    email: "buyer@example.com",
    claimed: 0,
  });
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/reset$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ token: "token", password: "a new password" });
  respond({ email: "buyer@example.com" });
  await expect(resetPassword("token", "a new password")).rejects.toBeInstanceOf(ShopApiError);
  respond({ error: "重设密码的链接无效、已过期或已经用过，请重新申请。" }, 400);
  await expect(resetPassword("token", "a new password")).rejects.toMatchObject({ status: 400 });
});

test("shop client: Google login sends requests per the contract, only jumps to Google's consent page (or this site), and checks the login completion response", async () => {
  vi.stubGlobal("window", { location: { origin: "https://onboard.abnormalhq.com" } });
  const authorize = "https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=s";
  let calls = respond({ url: authorize });
  expect(await startGoogleLogin("en")).toBe(authorize);
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/google\/start$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ lang: "en" });
  calls = respond({ url: authorize });
  await startGoogleLogin("zh", true);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ lang: "zh", link: true });
  respond({ url: "/shop/account/?code=mock-google&state=s" });
  expect(await startGoogleLogin("zh")).toBe("https://onboard.abnormalhq.com/shop/account/?code=mock-google&state=s");
  for (const url of [
    "https://evil.example/o/oauth2/v2/auth",
    "https://accounts.google.com/logout",
    "javascript:alert(1)",
    1,
  ])
    await expect((respond({ url }), startGoogleLogin("zh"))).rejects.toBeInstanceOf(ShopApiError);

  calls = respond({ email: "buyer@gmail.com", claimed: 2, created: true, linked: false, lang: "en" });
  expect(await finishGoogleLogin("code", "state", "zh")).toStrictEqual({
    email: "buyer@gmail.com",
    claimed: 2,
    created: true,
    linked: false,
    lang: "en",
  });
  // An older backend leaves linked out.
  respond({ email: "buyer@gmail.com", claimed: 0, created: false, lang: "zh" });
  expect((await finishGoogleLogin("code", "state")).linked).toBe(false);
  respond({ email: "buyer@gmail.com", claimed: 0, created: false, linked: "yes", lang: "zh" });
  await expect(finishGoogleLogin("code", "state")).rejects.toBeInstanceOf(ShopApiError);
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/google$/);
  expect(JSON.parse(String(calls[0]!.init.body))).toStrictEqual({ code: "code", state: "state" });
  respond({ email: "buyer@gmail.com", claimed: 2, created: true, lang: "fr" });
  await expect(finishGoogleLogin("code", "state")).rejects.toBeInstanceOf(ShopApiError);
  respond({ error: "Google 登录没有完成" }, 400);
  await expect(finishGoogleLogin("code", "state")).rejects.toMatchObject({ status: 400 });

  calls = respond({ ok: true });
  await unlinkGoogle("zh");
  expect(calls[0]!.url).toMatch(/\/api\/shop\/account\/google\/unlink$/);
  vi.unstubAllGlobals();
});
