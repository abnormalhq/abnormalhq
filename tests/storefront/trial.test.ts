import { afterEach, expect, test, vi } from "vitest";
import { claimTrial, getTrial } from "@/storefront/lib/trial";
import { getShopOrder, createRenewalOrder } from "@/storefront/lib/shop";
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
