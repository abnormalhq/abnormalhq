import { afterEach, expect, test, vi } from "vitest";
import { orderCoupon } from "@/storefront/lib/coupon";
import { claimTrial, getTrial, paidPeriodLimit } from "@/storefront/lib/trial";
import { getShopOrder, createRenewalOrder, getRenewal } from "@/storefront/lib/shop";
import { renewalResponse } from "./fixtures/shop-contract";
import { parseShopCatalog } from "@/storefront/lib/catalog";
import { storefrontApi as worker, type StorefrontEnv } from "@/storefront/worker/index";

afterEach(() => vi.unstubAllGlobals());

test("a free trial order is accepted only with the explicit paid single-mailbox grant marker", async () => {
  const order = {
    id: "trialorder00001",
    trial: true,
    productName: "Free trial",
    originalPriceCents: 0,
    discountPercent: 0,
    priceCents: 0,
    mailboxCount: 1,
    quotaMb: 1024,
    codeExpiresDays: 7,
    domains: ["example.com"],
    kind: "purchase",
    periodDays: 7,
    status: "paid",
    created: "2026-11-11",
    paidAt: "2026-11-11",
  };
  vi.stubGlobal("fetch", async () => Response.json({ order, code: null, codeStatus: null, onboardUrl: "/" }));
  expect((await getShopOrder(order.id)).order.trial).toBe(true);
  order.trial = false;
  await expect(getShopOrder(order.id)).rejects.toThrow();
  order.trial = true;
  order.status = "pending";
  await expect(getShopOrder(order.id)).rejects.toThrow();
  expect(() =>
    parseShopCatalog({ available: true, products: [{ ...order, name: "Free", description: "" }] }),
  ).toThrow();
});

test("trial reads and claims use the account endpoint, without collecting payment information", async () => {
  const fetcher = vi.fn(async (_url, options) =>
    Response.json(
      options?.method === "POST"
        ? { orderId: "trialorder00001" }
        : { trial: { claimed: false, days: 7, quotaMb: 1024, domains: ["example.com"], productName: "Single" } },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(await getTrial(new AbortController().signal, "en")).toMatchObject({ claimed: false, days: 7 });
  expect(await claimTrial("en")).toBe("trialorder00001");
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "POST", body: "{}", credentials: "same-origin" });
});

test("a backend without the trial route offers no trial: the Worker answers a JSON 404 and the page shows nothing", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const env: StorefrontEnv = {
    // A mail before free trials answers its own 404 page.
    MAIL: {
      fetch: async () =>
        new Response("<html>Not found</html>", { status: 404, headers: { "Content-Type": "text/html" } }),
    },
    MAIL_ORIGIN: "https://console.abnormalhq.com",
  };
  const url = "https://abnormalhq.com/api/shop/account/trial";
  for (const [lang, error] of [
    ["en", "Endpoint not found."],
    ["zh", "接口不存在。"],
  ] as const) {
    const response = await worker.fetch(
      new Request(url, { headers: { Cookie: `mailhq_customer=${"c".repeat(43)}`, "Accept-Language": lang } }),
      env,
    );
    expect([response.status, await response.json()]).toStrictEqual([404, { error }]);
  }
  // Through the client: no offer, not a failure. Any other failure is still one.
  vi.stubGlobal("fetch", async () => Response.json({ error: "Endpoint not found." }, { status: 404 }));
  expect(await getTrial(new AbortController().signal, "en")).toBeNull();
  vi.stubGlobal("fetch", async () => Response.json({ error: "unavailable" }, { status: 503 }));
  await expect(getTrial(new AbortController().signal, "en")).rejects.toMatchObject({ status: 503 });
  vi.restoreAllMocks();
});

test("card upgrades select Stripe explicitly on the existing renewal endpoint", async () => {
  const fetcher = vi.fn(async () => Response.json({ orderId: "trialorder00001" }));
  vi.stubGlobal("fetch", fetcher);
  await createRenewalOrder("signed-token", 1, "en", "", "stripe");
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining("/renew"),
    expect.objectContaining({ body: JSON.stringify({ token: "signed-token", periods: 1, provider: "stripe" }) }),
  );
});

test("the trial proxy forwards the account session and blocks cross-origin claims", async () => {
  const fetcher = vi.fn(async (request: Request) => {
    expect(request.headers.get("cookie")).toBe(`mailhq_customer=${"a".repeat(43)}`);
    return Response.json({ trial: null });
  });
  const env: StorefrontEnv = { MAIL: { fetch: fetcher }, MAIL_ORIGIN: "https://console.abnormalhq.com" };
  const url = "https://abnormalhq.com/api/shop/account/trial";
  expect(
    (await worker.fetch(new Request(url, { headers: { cookie: `mailhq_customer=${"a".repeat(43)}` } }), env))?.status,
  ).toBe(200);
  expect(
    (
      await worker.fetch(
        new Request(url, {
          method: "POST",
          headers: { origin: "https://evil.example", "content-type": "application/json" },
          body: "{}",
        }),
        env,
      )
    )?.status,
  ).toBe(403);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each(["ldc", "stripe"] as const)(
  "upgrade requests carry the code with %s and server-priced renewal discounts are displayed",
  async (provider) => {
    const fetcher = vi.fn(async () => Response.json({ orderId: "trialorder00001" }));
    vi.stubGlobal("fetch", fetcher);
    await createRenewalOrder("signed-token", 3, "zh", "", provider, "WELCOME10");
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/renew"),
      expect.objectContaining({
        body: JSON.stringify({
          token: "signed-token",
          periods: 3,
          ...(provider === "stripe" ? { provider } : {}),
          coupon: "WELCOME10",
        }),
      }),
    );
    expect(
      orderCoupon(
        {
          id: "trialorder00001",
          kind: "renewal",
          provider,
          priceCents: 4350,
          originalPriceCents: 4500,
          discountPercent: 0,
          couponCode: "WELCOME10",
          couponDiscountCents: 150,
        },
        null,
      ),
    ).toEqual({ code: "WELCOME10", discountCents: 150, baseCents: 4500 });
  },
);

const teamPlan = {
  id: "teamproduct0001",
  name: "Team",
  description: "Team mailboxes",
  seatMin: 2,
  seatMax: 50,
  quotaMb: 1024,
  customDomains: 1,
  periodDays: 30,
  priceCents: 1500,
  originalPriceCents: 1500,
  discountPercent: 0,
  renewPriceCents: 1500,
  fiatPriceMinor: 199,
};
test("trial summary offers bilingual server-priced Team plans without losing existing mailboxes", async () => {
  const payload = {
    ...renewalResponse,
    trial: true,
    mailboxes: ["existing@example.com"],
    upgradePlans: [teamPlan],
    upgradePayment: { ldc: true, stripe: { currency: "usd" } },
  };
  vi.stubGlobal("fetch", async () => Response.json(payload));
  expect(await getRenewal("signed-token")).toEqual(payload);
  payload.upgradePlans[0] = { ...teamPlan, seatMax: 1 };
  await expect(getRenewal("signed-token")).rejects.toThrow();
});
test.each(["ldc", "stripe"] as const)(
  "Team upgrade sends the chosen plan, seats and coupon without client prices (%s)",
  async (provider) => {
    const fetcher = vi.fn(async () => Response.json({ orderId: "teamupgrade0001" }));
    vi.stubGlobal("fetch", fetcher);
    await createRenewalOrder("signed-token", 2, "en", "", provider, "WELCOME10", {
      productId: teamPlan.id,
      quantity: 3,
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/renew"),
      expect.objectContaining({
        body: JSON.stringify({
          token: "signed-token",
          periods: 2,
          ...(provider === "stripe" ? { provider } : {}),
          coupon: "WELCOME10",
          productId: teamPlan.id,
          quantity: 3,
        }),
      }),
    );
  },
);

test("each payment method has its own period cap and allows the first-period price to differ", () => {
  expect(paidPeriodLimit(100_000_001, 100_000_001)).toBe(0);
  expect(paidPeriodLimit(199, 199)).toBe(12);
  expect(paidPeriodLimit(1, 50_000_000)).toBe(2);
  expect(paidPeriodLimit(100_000_000, 1)).toBe(1);
  expect(paidPeriodLimit(0, 199)).toBe(0);
});
