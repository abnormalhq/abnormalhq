import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import {
  addAccountDomain,
  checkAccountDomain,
  DNS_RECORD_PURPOSES,
  DNS_RECORD_STATUSES,
  DNS_RECORD_TYPES,
  DOMAIN_CHECK_BUDGET,
  DOMAIN_CHECK_WINDOW_SECONDS,
  DOMAIN_PHASES,
  DOMAIN_POLL_SECONDS,
  DOMAIN_STATUSES,
  domainCheckBudget,
  domainNextCheck,
  domainPollDelay,
  domainSettled,
  getAccountDomains,
  normalizeDomainInput,
  recordHost,
  refreshAccountDomain,
  removeAccountDomain,
  verifyAccountDomain,
} from "@/storefront/lib/domains";
import {
  createShopOrder,
  getAccountMailboxes,
  getShopCatalog,
  isRefusal,
  REFUSAL_CODES,
  ShopApiError,
} from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { MockShopStore, SEAT_PRODUCT } from "@/storefront/mock/shop";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";
import { DOMAIN_ROUTES } from "@/storefront/worker/shop";

/**
 * "Use my own domain" ("Buyer domains" in docs/storefront-api.md, mail's docs/shop.md "Buyer-owned custom domains"): the client
 * of the six account/domains routes, the polling schedule, the Worker's proxy and the dev mock. The samples are shaped after
 * mail's code (apps/console/src/lib/shop/buyer-domains.ts and the routes under api/shop/account/domains).
 */

const ORIGIN = "http://localhost:4321";
const siteOrigin = "https://abnormalhq.com";
const mailOrigin = "https://console.abnormalhq.com";
const NOW = Date.parse("2026-09-22T00:00:00Z");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A reserved domain as mail's publicDomain answers it. */
const pending = {
  id: "domainabcdefghi",
  name: "example.org",
  status: "pending",
  phase: "active",
  ownership: {
    type: "TXT",
    name: "_mailhq-verification.example.org",
    value: "mailhq-verification=0123456789abcdef",
    expiresAt: "2026-09-29T00:00:00.000Z",
  },
  verifiedAt: null,
  created: "2026-09-22T00:00:00.000Z",
};
const review = { ...pending, status: "review", ownership: null, verifiedAt: "2026-09-22T00:10:00.000Z" };
/** A verify / check answer (mail's BuyerDomainCheck): MX with its priority, a conflict with what DNS returned, an optional SRV. */
const checked = {
  domain: review,
  records: [
    {
      type: "MX",
      name: "example.org",
      value: "mail.abnormalhq.com",
      priority: 10,
      purpose: "mx",
      required: true,
      status: "conflict",
      observed: ["10 mx.elsewhere.example."],
    },
    {
      type: "TXT",
      name: "example.org",
      value: "v=spf1 include:spf.abnormalhq.com ~all",
      purpose: "spf",
      required: true,
      status: "matched",
      observed: [],
    },
    {
      type: "SRV",
      name: "_imaps._tcp.example.org",
      value: "0 1 993 mail.abnormalhq.com",
      purpose: "client-discovery",
      required: false,
      status: "missing",
      observed: [],
    },
  ],
  ready: false,
  checkedAt: "2026-09-22T00:11:00.000Z",
};

function respond(body: unknown, status = 200, headers: HeadersInit = {}) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return Response.json(body, { status, headers });
  });
  return calls;
}

/* ---- The client ---- */

test("domains: the list, a reservation and a check are read as mail sends them", async () => {
  let calls = respond({ limit: 2, domains: [pending, review] });
  expect(await getAccountDomains()).toStrictEqual({ limit: 2, domains: [pending, review] });
  expect([calls[0]!.method, calls[0]!.url]).toStrictEqual([
    "GET",
    expect.stringMatching(/\/api\/shop\/account\/domains$/),
  ]);

  calls = respond({ domain: pending }, 201);
  expect(await addAccountDomain("example.org")).toStrictEqual(pending);
  expect(calls[0]).toMatchObject({ method: "POST", body: { domain: "example.org" } });
  expect(calls[0]!.url).toMatch(/\/account\/domains\/add$/);

  calls = respond(checked);
  expect(await verifyAccountDomain("domainabcdefghi")).toStrictEqual(checked);
  expect(calls[0]).toMatchObject({ body: { id: "domainabcdefghi" } });
  expect(calls[0]!.url).toMatch(/\/account\/domains\/verify$/);
  expect(await checkAccountDomain("domainabcdefghi")).toStrictEqual(checked);
  expect(calls[1]!.url).toMatch(/\/account\/domains\/check$/);

  calls = respond({ domain: pending });
  expect(await refreshAccountDomain("domainabcdefghi")).toStrictEqual(pending);
  expect(calls[0]!.url).toMatch(/\/account\/domains\/refresh$/);
  calls = respond({ ok: true });
  await removeAccountDomain("domainabcdefghi");
  expect(calls[0]!.url).toMatch(/\/account\/domains\/remove$/);

  // A purpose mail adds later is still a record to publish: it is kept, and the page names it by its type.
  respond({ ...checked, records: [{ ...checked.records[1], purpose: "bimi" }] });
  expect((await checkAccountDomain("domainabcdefghi")).records[0]!.purpose).toBe("bimi");
});

test("domains: signed out, or a backend without buyer domains, reads as not offered; anything malformed fails", async () => {
  for (const status of [401, 404]) {
    respond({ error: "x" }, status);
    expect(await getAccountDomains(), String(status)).toBeNull();
  }
  respond({ error: "down" }, 503);
  await expect(getAccountDomains()).rejects.toBeInstanceOf(ShopApiError);

  for (const patch of [
    { status: "verified" },
    { phase: "paused" },
    { name: "" },
    { id: 5 },
    { ownership: { ...pending.ownership, type: "CNAME" } },
    { ownership: { ...pending.ownership, value: "" } },
    { ownership: undefined },
    { verifiedAt: 5 },
  ]) {
    respond({ limit: 1, domains: [{ ...pending, ...patch }] });
    await expect(getAccountDomains(), JSON.stringify(patch)).rejects.toBeInstanceOf(ShopApiError);
  }
  respond({ limit: -1, domains: [] });
  await expect(getAccountDomains()).rejects.toBeInstanceOf(ShopApiError);

  const record = checked.records[0]!;
  for (const patch of [
    { type: "A" },
    { status: "ok" },
    { required: "yes" },
    { observed: "10 mx" },
    { priority: -1 },
    { value: 5 },
  ]) {
    respond({ ...checked, records: [{ ...record, ...patch }] });
    await expect(checkAccountDomain("domainabcdefghi"), JSON.stringify(patch)).rejects.toBeInstanceOf(ShopApiError);
  }
  for (const body of [{ ...checked, ready: "no" }, { ...checked, records: null }, { ...checked, domain: null }, {}]) {
    respond(body);
    await expect(verifyAccountDomain("domainabcdefghi")).rejects.toBeInstanceOf(ShopApiError);
  }
});

test("domains: mail's refusals reach the page in its own words, and a rate limit says how long to wait", async () => {
  // One message for managed, reserved and being onboarded: the page adds nothing to it.
  respond({ error: "That domain is already in use on this mail service." }, 409);
  const taken: unknown = await addAccountDomain("taken.example").catch((cause: unknown) => cause);
  expect(taken).toMatchObject({ status: 409 });
  expect(shopError(taken, "en")).toBe("That domain is already in use on this mail service.");

  respond({ error: "Too many requests. Please try again later." }, 429, { "Retry-After": "1290" });
  const limited: unknown = await verifyAccountDomain("domainabcdefghi").catch((cause: unknown) => cause);
  expect(shopError(limited, "en")).toBe("Too many requests. Try again in 22 minutes.");
  expect(shopError(limited, "zh")).toBe("操作过于频繁，请在 22 分钟后重试。");
});

test("domains: what is typed is tidied before it is sent, and a record's host is the part before the domain", () => {
  expect(
    [
      " Example.ORG ",
      "https://example.org/",
      "http://example.org:8080/path?x=1",
      "me@example.org",
      "example.org.",
      "www.example.org",
      "",
    ].map(normalizeDomainInput),
  ).toStrictEqual(["example.org", "example.org", "example.org", "example.org", "example.org", "www.example.org", ""]);
  expect(recordHost("_mailhq-verification.example.org", "example.org")).toBe("_mailhq-verification");
  expect(recordHost("example.org", "example.org")).toBe("@");
  expect(recordHost("mail._domainkey.Example.org.", "example.org")).toBe("mail._domainkey");
  // A name outside the domain is shown whole rather than cut wrongly.
  expect(recordHost("notexample.org", "example.org")).toBe("notexample.org");
});

test("domains: polling backs off, stays within mail's limits and stops by itself", () => {
  // mail asks for no more than one check every 20 seconds and allows 30 per 10 minutes per account.
  expect(Math.min(...DOMAIN_POLL_SECONDS)).toBeGreaterThanOrEqual(20);
  expect(DOMAIN_POLL_SECONDS.length).toBeLessThan(30);
  for (let index = 1; index < DOMAIN_POLL_SECONDS.length; index += 1)
    expect(DOMAIN_POLL_SECONDS[index]).toBeGreaterThanOrEqual(DOMAIN_POLL_SECONDS[index - 1]!);
  // "A few minutes", then a button.
  const total = DOMAIN_POLL_SECONDS.reduce((sum, value) => sum + value, 0);
  expect(total).toBeGreaterThanOrEqual(180);
  expect(total).toBeLessThanOrEqual(600);
  expect([0, 1, DOMAIN_POLL_SECONDS.length - 1].map(domainPollDelay)).toStrictEqual([20, 30, 60]);
  expect([DOMAIN_POLL_SECONDS.length, 99, -1, 1.5].map(domainPollDelay)).toStrictEqual([null, null, null, null]);

  // Nothing to wait for: a reservation (the buyer's move), a suspended domain (the provider's), a live domain with its records in place.
  expect(domainSettled({ status: "pending" }, false)).toBe(true);
  expect(domainSettled({ status: "suspended" }, false)).toBe(true);
  expect(domainSettled({ status: "live" }, true)).toBe(true);
  expect(domainSettled({ status: "live" }, false)).toBe(false);
  expect(domainSettled({ status: "provisioning" }, false)).toBe(false);
  expect(domainSettled({ status: "review" }, true)).toBe(false);

  // The page stops while it is hidden and never logs or stores a domain.
  const panel = readFileSync("src/storefront/components/ShopDomains.tsx", "utf8");
  expect(panel).toMatch(/document\.hidden/);
  expect(panel).toMatch(/visibilitychange/);
  expect(panel).not.toMatch(/console\.|localStorage|sessionStorage|setInterval/);
});

/**
 * The checks of `count` domain cards on one page, each following its own schedule (one check as the page opens, then the
 * backed-off rounds) and all drawing from one budget, like DomainCard does: the times, in seconds, of the checks that were made.
 */
function pollTogether(count: number, budget = domainCheckBudget()): number[] {
  const made: number[] = [];
  const cards = Array.from({ length: count }, () => ({ at: 0, done: 0, stopped: false }));
  for (;;) {
    const next = cards.filter((card) => !card.stopped).sort((a, b) => a.at - b.at)[0];
    if (!next) return made;
    if (!budget.take(next.at * 1000, true)) {
      next.stopped = true;
      continue;
    }
    made.push(next.at);
    const delay = domainPollDelay(next.done);
    if (delay === null) next.stopped = true;
    else {
      next.at += delay;
      next.done += 1;
    }
  }
}

test("domains: the cards of one page share the account's check limit, however many domains are waiting", () => {
  const MAIL_LIMIT = 30;
  const rounds = 1 + DOMAIN_POLL_SECONDS.length;
  expect(DOMAIN_CHECK_BUDGET).toBeLessThan(MAIL_LIMIT);
  expect(DOMAIN_CHECK_WINDOW_SECONDS).toBe(600);
  // Five domains in review, each on its own allowance, would make 35 checks in under five minutes: over mail's 30 per 10 minutes.
  expect(pollTogether(5, domainCheckBudget(Number.POSITIVE_INFINITY))).toHaveLength(5 * rounds);
  expect(5 * rounds).toBeGreaterThan(MAIL_LIMIT);
  // On the shared budget the page stays under the limit for any number of domains (a plan allows up to 20).
  for (const count of [1, 2, 3, 5, 8, 20]) {
    const made = pollTogether(count);
    expect(made.length, String(count)).toBe(Math.min(count * rounds, DOMAIN_CHECK_BUDGET));
    for (const start of made) {
      const inWindow = made.filter((at) => at >= start && at < start + DOMAIN_CHECK_WINDOW_SECONDS);
      expect(inWindow.length, String(count)).toBeLessThanOrEqual(DOMAIN_CHECK_BUDGET);
    }
  }
  // Every one of five domains still gets its check as the page opens and several rounds; a few domains keep the whole schedule.
  expect(pollTogether(5).filter((at) => at === 0)).toHaveLength(5);
  expect(pollTogether(3)).toHaveLength(3 * rounds);

  // "Check again" is the buyer's: never refused by the page (mail decides), but counted, and the window slides.
  const budget = domainCheckBudget(2, 600);
  expect([budget.take(0, true), budget.take(1000, true), budget.take(2000, true)]).toStrictEqual([true, true, false]);
  expect(budget.take(3000, false)).toBe(true);
  expect(budget.take(600_000, true)).toBe(false);
  expect(budget.take(603_000, true)).toBe(true);

  // One budget per panel, handed to every card, and every check a card makes goes through it.
  const panel = readFileSync("src/storefront/components/ShopDomains.tsx", "utf8");
  expect(panel.match(/useState\(domainCheckBudget\)/g)).toHaveLength(1);
  expect(panel).toMatch(/<DomainCard[^>]*budget=\{budget\}/s);
  expect(panel).toMatch(/if \(!budget\.take\(Date\.now\(\), timed\)\) \{\s*setAuto\(false\);/);
  expect(panel.match(/checkAccountDomain\(/g)).toHaveLength(1);
});

test("domains: a domain verified elsewhere is read at once, even when the other cards used up the shared checks", () => {
  // Four other domains in review have polled the page's whole allowance.
  const budget = domainCheckBudget();
  expect(pollTogether(4, budget)).toHaveLength(DOMAIN_CHECK_BUDGET);
  const now = 300_000;
  expect(budget.take(now, true)).toBe(false);

  // This card still shows the reservation: "Verify" was refused with `domain_already_verified`.
  const card = {
    status: "pending",
    checked: false,
    ready: false,
    recheck: true,
    auto: true,
    busy: false,
    done: 0,
  } as const;
  const recovery = domainNextCheck(card);
  // It is the end of the buyer's action: made at once, not a round, and not refused by the page's budget. A refused
  // one would leave the card on the ownership screen, which has no "Check again", until a reload.
  expect(recovery).toStrictEqual({ kind: "recovery", delay: 0, automatic: false, timed: false });
  expect(budget.take(now, recovery!.timed)).toBe(true);
  // Also when this card's automatic checks had stopped (an earlier recovery failed, and the buyer pressed Verify again).
  expect(domainNextCheck({ ...card, auto: false })).toStrictEqual(recovery);
  // Never on top of a request that is running; a reservation that was not refused that way waits for the buyer.
  expect(domainNextCheck({ ...card, busy: true })).toBeNull();
  expect(domainNextCheck({ ...card, recheck: false })).toBeNull();

  // The checks the page starts by itself are unchanged: one as the page opens for a domain past its reservation and the
  // backed-off rounds, both drawn from the budget as automatic ones, until there is nothing to wait for or they stopped.
  const review = {
    status: "review",
    checked: false,
    ready: false,
    recheck: false,
    auto: true,
    busy: false,
    done: 0,
  } as const;
  expect(domainNextCheck(review)).toStrictEqual({ kind: "opening", delay: 0, automatic: false, timed: true });
  expect(budget.take(now, domainNextCheck(review)!.timed)).toBe(false);
  expect(domainNextCheck({ ...review, checked: true, done: 1 })).toStrictEqual({
    kind: "round",
    delay: 30,
    automatic: true,
    timed: true,
  });
  expect(domainNextCheck({ ...review, checked: true, done: DOMAIN_POLL_SECONDS.length })).toBeNull();
  expect(domainNextCheck({ ...review, auto: false })).toBeNull();
  expect(domainNextCheck({ ...review, status: "live", checked: true, ready: true })).toBeNull();
  expect(domainNextCheck({ ...review, status: "suspended", checked: true })).toBeNull();

  // The card takes its next check from this decision and hands the budget what it says.
  const panel = readFileSync("src/storefront/components/ShopDomains.tsx", "utf8");
  expect(panel).toMatch(/const next = domainNextCheck\(/);
  expect(panel).toMatch(/latestCheck\.current\(automatic, timed\)/);
  expect(panel).toMatch(/isRefusal\(cause, "domain_already_verified"\)\) setRecheck\(true\)/);
});

test("domains: every status, phase, record status and purpose mail names has wording in both languages", () => {
  for (const lang of ["en", "zh"] as const) {
    const t = shopCopy[lang];
    expect(Object.keys(t.domainStatuses).sort()).toStrictEqual([...DOMAIN_STATUSES].sort());
    for (const status of DOMAIN_STATUSES) expect(t.domainStatusNotes[status], status).toBeTruthy();
    expect(Object.keys(t.domainPhaseNotes).sort()).toStrictEqual(["expired", "grace", "suspended"]);
    expect(Object.keys(t.domainRecordStatuses).sort()).toStrictEqual([...DNS_RECORD_STATUSES].sort());
    expect(Object.keys(t.domainPurposes).sort()).toStrictEqual([...DNS_RECORD_PURPOSES].sort());
  }
  // "Awaiting approval" says plainly that the provider reviews new domains, and promises no time.
  expect(shopCopy.en.domainStatusNotes.review).toMatch(/provider reviews every newly connected domain/);
  expect(shopCopy.en.domainStatusNotes.review).toMatch(/no fixed time/);
  expect(shopCopy.zh.domainStatusNotes.review).toMatch(/服务方人工审核/);
  expect(shopCopy.zh.domainStatusNotes.review).toMatch(/没有固定时限/);
});

/* ---- The dev mock ---- */

function request(route: string, options: { cookie?: string; body?: unknown; lang?: string } = {}): Request {
  const get = ["catalog", "account", "account/mailboxes", "account/domains"].includes(route);
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

function browser(store: MockShopStore) {
  const jar = new Map<string, string>();
  const send = async (route: string, options: { body?: unknown; lang?: string } = {}) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await store.fetch(route, request(route, { ...options, cookie }));
    for (const line of response.headers.getSetCookie()) {
      const [name, value] = line.split(";")[0]!.split("=");
      if (value) jar.set(name!, value);
      else jar.delete(name!);
    }
    return response;
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
    send(String(url).split("/api/shop/")[1]!, {
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      lang: new Headers(init?.headers).get("Accept-Language") ?? undefined,
    }),
  );
  return { send };
}

async function signedIn(store: MockShopStore, email = "owner@example.com") {
  const client = browser(store);
  vi.spyOn(console, "info").mockImplementation(() => {});
  await client.send("account/login", { body: { email } });
  const link = vi.mocked(console.info).mock.calls.at(-1)![0] as string;
  await client.send("account/verify", { body: { token: new URL(link.split("：")[1]!).searchParams.get("login") } });
  return client;
}

/** A signed-in buyer who paid for the demo seat plan, which allows two own domains. */
async function buyer(store: MockShopStore, email?: string) {
  const client = await signedIn(store, email);
  const orderId = await createShopOrder(SEAT_PRODUCT.id, "en", "", "ldc", "", 2);
  await client.send("pay", { body: { orderId, lang: "en" } });
  return { ...client, orderId };
}

test("dev shop: plans say how many own domains they allow, and an account gets what its paid plans allow", async () => {
  const store = new MockShopStore(() => NOW);
  const client = await signedIn(store);
  const catalog = await getShopCatalog();
  expect(catalog.products.map((product) => product.customDomains)).toStrictEqual([undefined, 1]);
  expect(catalog.seatProducts![0]!.customDomains).toBe(2);

  // No paid plan that includes it: limit 0, and adding is refused with 403.
  expect(await getAccountDomains()).toStrictEqual({ limit: 0, domains: [] });
  await expect(addAccountDomain("example.org", "en")).rejects.toMatchObject({
    status: 403,
    message: "Your plan doesn't include using your own domain.",
  });
  // The one-time demo plan allows none either; the seat plan allows two.
  await client.send("pay", { body: { orderId: await createShopOrder(catalog.products[0]!.id), lang: "en" } });
  expect((await getAccountDomains())!.limit).toBe(0);
  await client.send("pay", { body: { orderId: await createShopOrder(SEAT_PRODUCT.id, "en", "", "ldc", "", 2) } });
  expect((await getAccountDomains())!.limit).toBe(2);
  // Signed out: 401, read as "not offered".
  browser(store);
  expect(await getAccountDomains()).toBeNull();
});

test("dev shop: a domain is reserved, verified, checked until its records are in place, reviewed and then offered for mailboxes", async () => {
  const store = new MockShopStore(() => NOW);
  const client = await buyer(store);
  const reserved = await addAccountDomain("Example.org", "en");
  expect(reserved).toMatchObject({ name: "example.org", status: "pending", phase: "active", verifiedAt: null });
  expect(reserved.ownership).toMatchObject({ type: "TXT", name: "_mailhq-verification.example.org" });
  expect(reserved.ownership!.value).toMatch(/^mailhq-verification=[a-f0-9]{32}$/);
  expect(Date.parse(reserved.ownership!.expiresAt) - NOW).toBe(7 * 86_400_000);

  // Checking a reservation submits nothing and lists no records.
  expect(await checkAccountDomain(reserved.id)).toMatchObject({ records: [], ready: false });

  // Verified: the records to publish, none in place yet, and the domain waits for the provider's review.
  const verified = await verifyAccountDomain(reserved.id, "en");
  expect(verified.domain).toMatchObject({ status: "review", ownership: null });
  expect(verified.domain.verifiedAt).not.toBeNull();
  expect(verified.records.map((item) => [item.purpose, item.type, item.required])).toStrictEqual([
    ["mx", "MX", true],
    ["spf", "TXT", true],
    ["dkim", "TXT", true],
    ["dmarc", "TXT", false],
    ["autoconfig-host", "CNAME", false],
    ["client-discovery", "SRV", false],
    ["client-discovery", "SRV", false],
  ]);
  expect(verified.records[0]).toMatchObject({ priority: 10, status: "missing" });
  expect(verified.ready).toBe(false);
  // Not live yet: mailboxes cannot go on it.
  expect((await getAccountMailboxes())!.groups[0]!.domains).toStrictEqual(["abnormalhq.com"]);

  // Two checks later every required record matches; the optional ones do not have to.
  expect((await checkAccountDomain(reserved.id)).ready).toBe(false);
  const ready = await checkAccountDomain(reserved.id);
  expect([ready.ready, ready.domain.status]).toStrictEqual([true, "review"]);
  expect(ready.records.filter((item) => !item.required).some((item) => item.status === "missing")).toBe(true);
  // The approval arrives a little later; the domain is then offered to the orders whose plan allows own domains.
  await checkAccountDomain(reserved.id);
  expect((await checkAccountDomain(reserved.id)).domain.status).toBe("live");
  const group = (await getAccountMailboxes())!.groups[0]!;
  expect(group.domains).toStrictEqual(["abnormalhq.com", "example.org"]);
  const created = await client.send("account/mailboxes/create", {
    body: { orderId: client.orderId, domain: "example.org", username: "team", password: "Correct-horse-9" },
  });
  expect([created.status, (await created.json()).email]).toStrictEqual([201, "team@example.org"]);

  // Once verified, a domain cannot be given up or get a new ownership value from the account page.
  await expect(removeAccountDomain(reserved.id, "en")).rejects.toMatchObject({ status: 409 });
  await expect(refreshAccountDomain(reserved.id, "en")).rejects.toMatchObject({ status: 409 });
});

test("dev shop: refused domains get mail's reasons and reveal nothing about who has a name", async () => {
  const store = new MockShopStore(() => NOW);
  await buyer(store);
  const refused = async (domain: unknown) =>
    addAccountDomain(domain as string, "en").then(
      () => expect.unreachable(String(domain)),
      (cause: ShopApiError) => [cause.status, cause.message],
    );
  for (const domain of ["not a domain", "localhost", "", "-bad-.example", 5])
    expect(await refused(domain)).toStrictEqual([400, "Enter a domain name, for example example.com."]);
  for (const domain of ["co.uk", "github.io"])
    expect(await refused(domain)).toStrictEqual([
      400,
      "That is a public suffix, not a domain of your own. Enter the domain you registered under it.",
    ]);
  for (const domain of ["abnormalhq.com", "mail.abnormalhq.com", "abnormal.bid"])
    expect(await refused(domain)).toStrictEqual([
      409,
      "That domain belongs to this mail service. Enter a domain of your own.",
    ]);

  // Reserved by this buyer, then asked for by another: the same answer as a domain the service already manages.
  await addAccountDomain("mine.example", "en");
  const taken = "That domain is already in use on this mail service.";
  expect(await refused("taken.example")).toStrictEqual([409, taken]);
  expect(await refused("mine.example")).toStrictEqual([409, taken]);
  await addAccountDomain("second.example", "en");
  expect(await refused("third.example")).toStrictEqual([
    409,
    "Your plan allows 2 domains of your own, and you have that many.",
  ]);

  const other = await buyer(store, "other@example.com");
  expect(await refused("mine.example")).toStrictEqual([409, taken]);
  // Another account's domain is "not found", whether or not it exists.
  const mine = "0".repeat(15);
  for (const route of ["verify", "check", "refresh", "remove"]) {
    const response = await other.send(`account/domains/${route}`, { body: { id: mine }, lang: "en" });
    // Since contract version 3 with its code and both texts; `error` stays in the request's language.
    expect([route, response.status, await response.json()]).toStrictEqual([
      route,
      404,
      {
        error: "Domain not found.",
        code: "domain_not_found",
        messages: { zh: "域名不存在。", en: "Domain not found." },
      },
    ]);
  }
});

test("dev shop: each state of a domain can be simulated by its name", async () => {
  let now = NOW;
  const store = new MockShopStore(() => now);
  await buyer(store);
  const fresh = async (name: string) => {
    for (const domain of (await getAccountDomains())!.domains)
      if (domain.status === "pending") await removeAccountDomain(domain.id);
    return addAccountDomain(name, "en");
  };

  // The TXT record is not visible yet: 409 with the reason, and the reservation can still be given up.
  const unseen = await fresh("pending-dns.example");
  const notVisible: unknown = await verifyAccountDomain(unseen.id, "en").catch((cause: unknown) => cause);
  expect(notVisible).toMatchObject({ status: 409, code: "domain_ownership_not_found" });
  // The refusal carries its text in both languages; the page shows its own, whatever language the request asked for.
  expect(shopError(notVisible, "en")).toBe(
    "The verification TXT record isn't visible yet. Check its name and value at your DNS host, wait for the change to spread, then verify again.",
  );
  expect(shopError(notVisible, "zh")).toBe(
    "暂时查不到验证用的 TXT 记录。请在 DNS 服务商处核对记录的名称和值，等待解析生效后再验证。",
  );

  // The value expired: 409 until a new one is requested, which replaces the old one.
  const expired = await fresh("expired-value.example");
  expect(Date.parse(expired.ownership!.expiresAt)).toBeLessThan(NOW);
  const ranOut: unknown = await verifyAccountDomain(expired.id, "zh").catch((cause: unknown) => cause);
  // The code, not the wording, is what tells the card to lead with "Get a new value".
  expect(isRefusal(ranOut, "domain_ownership_expired")).toBe(true);
  expect(ranOut).toMatchObject({
    status: 409,
    message: "验证值已过期。请获取新的验证值并更新 TXT 记录，然后重新验证。",
  });
  const renewed = await refreshAccountDomain(expired.id, "en");
  expect(renewed.ownership!.value).not.toBe(expired.ownership!.value);
  expect(Date.parse(renewed.ownership!.expiresAt)).toBeGreaterThan(NOW);
  expect((await verifyAccountDomain(expired.id, "en")).domain.status).toBe("review");
  // Past its reservation there is no value to replace: the card reads where the domain stands instead.
  const verified: unknown = await refreshAccountDomain(expired.id, "en").catch((cause: unknown) => cause);
  expect(verified).toMatchObject({ status: 409, code: "domain_already_verified" });

  // Rate limited with Retry-After, and the mail server not answering.
  const store2 = new MockShopStore(() => now);
  await buyer(store2);
  const busy = await addAccountDomain("busy-day.example", "en");
  await expect(verifyAccountDomain(busy.id, "en")).rejects.toMatchObject({ status: 429, retryAfter: 300 });
  const down = await addAccountDomain("down-server.example", "en");
  await expect(verifyAccountDomain(down.id, "en")).rejects.toMatchObject({ status: 503, code: "domain_unavailable" });

  // Still being set up for two checks, then waiting for review; never approved; suspended; a conflict; a failed lookup; a lapsed plan.
  const store3 = new MockShopStore(() => now);
  await buyer(store3);
  const slow = await addAccountDomain("slow-setup.example", "en");
  expect(await verifyAccountDomain(slow.id)).toMatchObject({ domain: { status: "provisioning" }, records: [] });
  expect((await checkAccountDomain(slow.id)).domain.status).toBe("provisioning");
  expect((await checkAccountDomain(slow.id)).domain.status).toBe("review");
  const held = await addAccountDomain("review-forever.example", "en");
  await verifyAccountDomain(held.id);
  for (let index = 0; index < 8; index += 1) await checkAccountDomain(held.id);
  expect((await checkAccountDomain(held.id)).domain.status).toBe("review");

  const store4 = new MockShopStore(() => now);
  await buyer(store4);
  const suspended = await addAccountDomain("suspended-abuse.example", "en");
  expect((await verifyAccountDomain(suspended.id)).domain.status).toBe("suspended");
  const conflict = await addAccountDomain("conflict-mx.example", "en");
  await verifyAccountDomain(conflict.id);
  await checkAccountDomain(conflict.id);
  const stuck = await checkAccountDomain(conflict.id);
  expect(stuck.records[0]).toMatchObject({ status: "conflict", observed: ["10 mx.other-host.example."] });
  expect(stuck.ready).toBe(false);

  const store5 = new MockShopStore(() => now);
  await buyer(store5);
  const failing = await addAccountDomain("error-lookup.example", "en");
  await verifyAccountDomain(failing.id);
  expect((await checkAccountDomain(failing.id)).records[1]!.status).toBe("error");
  expect((await addAccountDomain("grace-period.example", "en")).phase).toBe("grace");
  now += 1;
});

test("dev shop: without approval a verified domain goes live at once; MOCK_DOMAINS=off behaves like a backend before buyer domains", async () => {
  const open = new MockShopStore(() => NOW, true, true, true, true, false);
  await buyer(open);
  const domain = await addAccountDomain("fast.example", "en");
  expect((await verifyAccountDomain(domain.id)).domain.status).toBe("live");

  const before = new MockShopStore(() => NOW, true, true, true, false);
  const client = await buyer(before);
  const catalog = await getShopCatalog();
  expect(JSON.stringify(catalog)).not.toMatch(/customDomains/);
  for (const route of DOMAIN_ROUTES) {
    const response = await client.send(route, { body: { id: "abcdefghijklmno", domain: "example.org" } });
    expect([route, response.status]).toStrictEqual([route, 404]);
  }
  // The account page reads that as "not offered" and shows nothing.
  expect(await getAccountDomains()).toBeNull();
});

/* ---- The Worker's proxy ---- */

function bindings(mail: (request: Request) => Promise<Response>): StorefrontEnv {
  return { MAIL: { fetch: mail }, MAIL_ORIGIN: mailOrigin };
}

const customer = `mailhq_customer=${"c".repeat(43)}`;
const buyerCookie = `mailhq_shop=${"a".repeat(64)}`;
const writes = DOMAIN_ROUTES.filter((route) => route !== "account/domains");

function domainRequest(route: string, headers: Record<string, string> = {}, init: RequestInit = {}): Request {
  const get = route === "account/domains";
  return new Request(`${siteOrigin}/api/shop/${route}`, {
    method: get ? "GET" : "POST",
    ...(get ? {} : { body: '{"domain":"secret-project.example"}' }),
    headers: {
      Cookie: customer,
      ...(get ? {} : { Origin: siteOrigin, "Content-Type": "application/json" }),
      ...headers,
    },
    ...init,
  });
}

test("shop proxy: the domain routes forward only the account session, keep the visitor's IP and Origin, and are never cached", async () => {
  for (const route of DOMAIN_ROUTES) {
    const mail = vi.fn(async (request: Request) => {
      expect(request.url).toBe(`${mailOrigin}/api/shop/${route}`);
      expect(request.method).toBe(route === "account/domains" ? "GET" : "POST");
      // A domain belongs to an account, never to a purchase session: mail's document names the account cookie alone.
      expect(request.headers.get("cookie")).toBe(customer);
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("cf-connecting-ip")).toBe("203.0.113.9");
      if (route !== "account/domains") {
        expect(request.headers.get("origin")).toBe(siteOrigin);
        expect(await request.text()).toBe('{"domain":"secret-project.example"}');
      }
      return Response.json(
        { limit: 1, domains: [] },
        { headers: { "Set-Cookie": "session=admin; Path=/", "Cache-Control": "public, max-age=3600", ETag: '"x"' } },
      );
    });
    const response = await worker.fetch(
      domainRequest(route, {
        Cookie: `${buyerCookie}; ${customer}; session=admin`,
        Authorization: "Bearer admin",
        "CF-Connecting-IP": "203.0.113.9",
      }),
      bindings(mail),
    );
    expect(mail, route).toHaveBeenCalledOnce();
    expect(response.status, route).toBe(200);
    // The ownership value is for the reserving account only: nothing may cache an answer, and no cookie is set.
    expect(response.headers.get("Cache-Control"), route).toBe("private, no-store, max-age=0");
    expect(response.headers.get("ETag")).toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.getSetCookie(), route).toStrictEqual([]);
  }
});

test("shop proxy: domain writes are same-origin JSON POSTs, the list is a GET, and signed-out reads never reach mail", async () => {
  const never = bindings(async () => {
    throw new Error("must not reach mail");
  });
  for (const route of writes) {
    for (const origin of [undefined, "null", "https://attacker.example"]) {
      const headers = new Headers({ "Content-Type": "application/json", Cookie: customer });
      if (origin) headers.set("Origin", origin);
      expect((await worker.fetch(domainRequest(route, {}, { headers }), never)).status, route).toBe(403);
    }
    expect((await worker.fetch(domainRequest(route, { "Content-Type": "text/plain" }), never)).status).toBe(415);
    const get = await worker.fetch(new Request(`${siteOrigin}/api/shop/${route}`), never);
    expect([get.status, get.headers.get("Allow")], route).toStrictEqual([405, "POST"]);
  }
  const post = await worker.fetch(
    new Request(`${siteOrigin}/api/shop/account/domains`, { method: "POST", headers: { Origin: siteOrigin } }),
    never,
  );
  expect([post.status, post.headers.get("Allow")]).toStrictEqual([405, "GET"]);
  for (const route of ["account/domains/list", "account/domains/approve", "account/domains/add/x", "domains"]) {
    expect((await worker.fetch(domainRequest(route), never)).status, route).toBe(404);
  }
  // Without the account session all mail could say is "not signed in": the Worker says it, in the page language.
  for (const cookie of [undefined, buyerCookie, "mailhq_customer=short"]) {
    const response = await worker.fetch(
      new Request(`${siteOrigin}/api/shop/account/domains`, {
        headers: { "Accept-Language": "en", ...(cookie ? { Cookie: cookie } : {}) },
      }),
      never,
    );
    expect([response.status, await response.json()]).toStrictEqual([401, { error: "Please sign in first." }]);
  }
});

test("shop proxy: a domain is never logged, whatever goes wrong", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const upstream of [
    async () => {
      throw new Error("secret-project.example unreachable");
    },
    async () =>
      new Response("<html>secret-project.example</html>", { status: 500, headers: { "Content-Type": "text/html" } }),
    async () => new Response(null, { status: 302, headers: { Location: "/login?next=secret-project.example" } }),
  ]) {
    const response = await worker.fetch(domainRequest("account/domains/add"), bindings(upstream));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/secret-project/);
  }
  expect(log).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-project|mailhq_customer|c{43}/);
});

test("shop proxy: a mail before buyer domains answers a JSON 404; mail's own answers keep their status, wording and Retry-After", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const page = async () =>
    new Response("<html>Not found</html>", { status: 404, headers: { "Content-Type": "text/html" } });
  for (const route of DOMAIN_ROUTES) {
    const response = await worker.fetch(domainRequest(route, { "Accept-Language": "en" }), bindings(page));
    expect([route, response.status, await response.json()]).toStrictEqual([
      route,
      404,
      { error: "Endpoint not found." },
    ]);
  }
  for (const [status, error, headers] of [
    [404, "Domain not found.", {}],
    [409, "That domain is already in use on this mail service.", {}],
    [403, "Your plan doesn't include using your own domain.", {}],
    [429, "Too many requests. Please try again later.", { "Retry-After": "3200" }],
    [503, "Domains can't be set up right now. Please try again later.", {}],
  ] as const) {
    const response = await worker.fetch(
      domainRequest("account/domains/verify"),
      bindings(async () => Response.json({ error }, { status, headers })),
    );
    expect([response.status, await response.json()]).toStrictEqual([status, { error }]);
    expect(response.headers.get("Retry-After")).toBe(status === 429 ? "3200" : null);
  }
});

test("contract: the domain routes, fields, enums and refusal codes are the contract file's, as in mail's copy", async () => {
  const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
    shop: {
      routes: Record<string, string[]>;
      subscriptionStates: string[];
      buyerDomains: {
        routes: Record<string, string[]>;
        statuses: string[];
        phases: string[];
        domainFields: string[];
        ownershipFields: string[];
        recordFields: string[];
        recordStatuses: string[];
        recordTypes: string[];
        recordPurposes: string[];
      };
      refusalCodes: Record<string, { status: number; details: string[] }>;
    };
  };
  const { buyerDomains } = contract.shop;
  // Contract version 3 lists the routes apart from `shop.routes` (a storefront may proxy them later than the rest); this
  // Worker proxies every one, and tests/storefront/worker.test.ts checks the methods of all four lists.
  expect(Object.keys(buyerDomains.routes)).toStrictEqual(DOMAIN_ROUTES);
  for (const route of DOMAIN_ROUTES) expect(contract.shop.routes, route).not.toHaveProperty(route);

  // The enums the parsers accept and the types are derived from are exactly mail's.
  expect([...DOMAIN_STATUSES]).toStrictEqual(buyerDomains.statuses);
  expect([...DOMAIN_PHASES]).toStrictEqual(buyerDomains.phases);
  expect(buyerDomains.phases).toStrictEqual(contract.shop.subscriptionStates);
  expect([...DNS_RECORD_STATUSES]).toStrictEqual(buyerDomains.recordStatuses);
  expect([...DNS_RECORD_TYPES]).toStrictEqual(buyerDomains.recordTypes);
  expect([...DNS_RECORD_PURPOSES]).toStrictEqual(buyerDomains.recordPurposes);
  // Every value of every enum is read, and one mail does not name fails the answer rather than reach the page.
  for (const status of buyerDomains.statuses) {
    respond({ limit: 1, domains: [{ ...pending, status, ownership: null }] });
    expect((await getAccountDomains())!.domains[0]!.status).toBe(status);
  }
  for (const phase of buyerDomains.phases) {
    respond({ limit: 1, domains: [{ ...pending, phase }] });
    expect((await getAccountDomains())!.domains[0]!.phase).toBe(phase);
  }
  for (const [field, value] of [
    ["status", "verified"],
    ["phase", "lapsed"],
  ] as const) {
    respond({ limit: 1, domains: [{ ...pending, [field]: value }] });
    await expect(getAccountDomains(), field).rejects.toBeInstanceOf(ShopApiError);
  }
  for (const status of buyerDomains.recordStatuses) {
    for (const type of buyerDomains.recordTypes) {
      respond({ ...checked, records: [{ ...checked.records[0], type, status }] });
      expect((await checkAccountDomain(pending.id)).records[0]).toMatchObject({ type, status });
    }
  }
  for (const patch of [{ status: "ok" }, { type: "A" }]) {
    respond({ ...checked, records: [{ ...checked.records[0], ...patch }] });
    await expect(checkAccountDomain(pending.id), JSON.stringify(patch)).rejects.toBeInstanceOf(ShopApiError);
  }

  // The fields the client reads off a domain, its ownership record and a DNS record are the ones mail publishes.
  respond({ limit: 1, domains: [pending] });
  const [read] = (await getAccountDomains())!.domains;
  expect(Object.keys(read!).toSorted()).toStrictEqual(buyerDomains.domainFields.toSorted());
  expect(Object.keys(read!.ownership!).toSorted()).toStrictEqual(buyerDomains.ownershipFields.toSorted());
  respond({ ...checked, records: [{ ...checked.records[0], priority: 10 }] });
  const [record] = (await checkAccountDomain(pending.id)).records;
  expect(Object.keys(record!).toSorted()).toStrictEqual(buyerDomains.recordFields.toSorted());

  // The refusals of a buyer's domain carry a code: the ones the storefront knows are the contract's, with their statuses.
  const domainCodes = Object.entries(contract.shop.refusalCodes).filter(([code]) => code.startsWith("domain_"));
  expect(domainCodes.length).toBeGreaterThan(0);
  for (const [code, { status, details }] of domainCodes) {
    expect(REFUSAL_CODES[code as keyof typeof REFUSAL_CODES], code).toBe(status);
    expect(details, code).toStrictEqual([]);
  }
  expect(readFileSync("docs/storefront-api.md", "utf8")).not.toMatch(/^- \*\*Buyer domains\*\*: add/m);
});
