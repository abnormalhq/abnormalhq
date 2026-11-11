import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { en } from "../src/i18n/en.ts";
import { zh } from "../src/i18n/zh.ts";
import { pagePaths } from "../src/lib/pages.ts";
import { decimalAmount, planRows, planRowsFor, planView, planViews } from "../src/lib/pricing.ts";
import { catalogDomains, seatCardPrice, seatOrderPrice } from "../src/storefront/lib/catalog.ts";
import { catalog, seatCatalog, seatPlan } from "./support/catalog.ts";

const [solo, team] = catalog.products as [(typeof catalog.products)[0], (typeof catalog.products)[0]];

test("a plan card shows the backend's amounts as they are: price, discount, card price and renewal", () => {
  const [first, second] = planViews(catalog, "en", en.pricing, "/shop/");
  assert.deepEqual(
    { amount: first!.amount, unit: first!.unit, discount: first!.discount, card: first!.card },
    {
      amount: "7.50",
      unit: "LDC / purchase",
      discount: { label: "25% off", original: "10.00 LDC" },
      card: undefined,
    },
  );
  assert.deepEqual(first!.rows, {
    price: "7.50 LDC / purchase",
    card: "Not offered",
    billing: "One-time purchase; mailboxes never expire",
    renewal: "Nothing to renew",
    mailboxes: "1 mailbox",
    storage: "1 GB per mailbox",
    domains: "@abnormalhq.com",
    ownDomains: "Not included",
    code: "Set up within 30 days of paying",
  });
  assert.equal(first!.offer, undefined);

  assert.deepEqual(
    { amount: second!.amount, unit: second!.unit, discount: second!.discount, card: second!.card },
    {
      amount: "5.00",
      unit: "LDC / 30 days",
      discount: undefined,
      card: "or $2.99 every 30 days by card, renewing automatically",
    },
  );
  assert.deepEqual(second!.rows, {
    price: "5.00 LDC / 30 days",
    card: "$2.99 every 30 days, renewing automatically",
    billing: "Subscription, every 30 days",
    // The renewal price locked in at purchase, not the first period's price.
    renewal: "4.00 LDC every 30 days",
    mailboxes: "5 mailboxes",
    storage: "2.5 GB per mailbox",
    domains: "@abnormalhq.com, @abnormal.bid",
    ownDomains: "Not included",
    code: "Set up whenever you like",
  });
  assert.deepEqual(second!.offer, { price: "2.99", currency: "USD" });
});

test("a plan sold per mailbox says so on every line: the amounts are for one mailbox and the buyer chooses how many", () => {
  const views = planViews(seatCatalog, "en", en.pricing, "/shop/");
  // Fixed plans first, then the seat plans, as the shop lists them.
  assert.deepEqual(
    views.map((view) => view.id),
    ["planonetimeabcd", "planmonthlyabcd", "planseatsabcdef"],
  );
  const seat = views[2]!;
  assert.deepEqual(
    { amount: seat.amount, unit: seat.unit, discount: seat.discount, card: seat.card },
    {
      amount: "3.00",
      unit: "LDC / mailbox / 30 days",
      discount: { label: "10% off", original: "3.33 LDC" },
      card: "or $1.99 per mailbox every 30 days by card, renewing automatically",
    },
  );
  assert.deepEqual(seat.rows, {
    price: "3.00 LDC / mailbox / 30 days",
    card: "$1.99 per mailbox every 30 days, renewing automatically",
    billing: "Subscription, every 30 days",
    renewal: "3.00 LDC per mailbox every 30 days",
    mailboxes: "2 to 50, you choose",
    storage: "2 GB per mailbox",
    domains: "@abnormalhq.com",
    ownDomains: "Up to 2 of your own domains",
    code: "Set up within 30 days of paying",
  });
  // The total is not the per-mailbox price times the count: the page says where it is set.
  assert.equal(
    seat.note,
    "Priced per mailbox: you choose how many in the shop, and the order total is confirmed at checkout. The 10% discount is taken off the order total and rounded once.",
  );
  assert.deepEqual(seat.offer, { price: "1.99", currency: "USD", seats: { unit: "mailbox", min: 2, max: 50 } });
  assert.equal(seat.href, "/shop/?plan=planseatsabcdef");

  const zhSeat = planViews(seatCatalog, "zh", zh.pricing, "/zh/shop/")[2]!;
  assert.equal(zhSeat.unit, "LDC / 邮箱 / 30 天");
  assert.equal(zhSeat.rows.mailboxes, "2 ～ 50 个，数量自选");
  assert.equal(zhSeat.rows.ownDomains, "可接入 2 个自有域名");

  // In a card-only shop the card price leads, per mailbox, and no LDC discount is quoted.
  const cardOnly = planView(seatPlan, { ldc: false, stripe: { currency: "usd" } }, "en", en.pricing, "/shop/");
  assert.deepEqual(
    [cardOnly.amount, cardOnly.unit, cardOnly.discount],
    ["$1.99", "by card / mailbox / 30 days", undefined],
  );
  assert.doesNotMatch(cardOnly.note ?? "", /discount/);
});

test("the comparison only has a row for own domains when a plan on sale includes it", () => {
  const without = planViews(catalog, "en", en.pricing, "/shop/");
  assert.ok(!planRowsFor(without).includes("ownDomains"));
  assert.ok(planRowsFor(planViews(seatCatalog, "en", en.pricing, "/shop/")).includes("ownDomains"));
  // The address check offers the seat plans' domains too, as mail's check answers for every plan on sale.
  assert.deepEqual(catalogDomains(seatCatalog), ["abnormalhq.com", "abnormal.bid"]);
});

test("a seat order's estimate follows mail's rounding: the discount on the whole order, rounded half up once", () => {
  // mail's docs/shop.md: 3.33 a seat at 10% off is 20.98 for 7 seats (23.31 × 0.9 = 20.979), not 7 × 3.00.
  assert.deepEqual(seatOrderPrice(seatPlan, 7), { originalPriceCents: 2331, priceCents: 2098 });
  assert.notEqual(seatOrderPrice(seatPlan, 7)!.priceCents, 7 * seatPlan.priceCents);
  // Half up: 0.05 at 50% off is 0.03, not 0.02.
  assert.equal(seatOrderPrice({ originalPriceCents: 5, discountPercent: 50 }, 1)!.priceCents, 3);
  assert.equal(seatOrderPrice({ originalPriceCents: 333, discountPercent: 0 }, 3)!.priceCents, 999);
  // Above what one order can charge (1,000,000.00), and nonsense quantities, there is no figure to show.
  assert.equal(seatOrderPrice({ originalPriceCents: 100_000_00, discountPercent: 0 }, 11), null);
  for (const quantity of [0, -1, 1.5, Number.NaN]) assert.equal(seatOrderPrice(seatPlan, quantity), null);
  assert.equal(seatCardPrice(seatPlan, 7), 1393);
  assert.equal(seatCardPrice({ fiatPriceMinor: 0 }, 7), null);
});

test("the Chinese cards say the same in Chinese", () => {
  const [first, second] = planViews(catalog, "zh", zh.pricing, "/zh/shop/");
  assert.equal(first!.unit, "LDC / 次");
  assert.equal(first!.discount?.label, "优惠 25%");
  assert.equal(second!.rows.billing, "订阅，每 30 天续费");
  assert.equal(second!.rows.mailboxes, "5 个邮箱");
  assert.equal(second!.href, "/zh/shop/?plan=planmonthlyabcd");
});

test("each card links to the shop with its plan pointed out, and names the plan for screen readers", () => {
  const view = planView(solo, catalog.payment, "en", en.pricing, "/shop/");
  assert.equal(view.href, "/shop/?plan=planonetimeabcd");
  assert.equal(view.chooseLabel, "Choose this plan: Solo");
});

test("a card-only shop leads with the card price and quotes no LDC", () => {
  const view = planView(team, { ldc: false, stripe: { currency: "usd" } }, "en", en.pricing, "/shop/");
  assert.deepEqual(
    [view.amount, view.unit, view.card, view.discount],
    ["$2.99", "by card / 30 days", undefined, undefined],
  );
  assert.equal(view.rows.price, "Not offered");
  assert.equal(view.rows.renewal, "$2.99 every 30 days, renewing automatically");
});

test("with card payment off no card price is shown, even for a plan that has one", () => {
  const view = planView(team, { ldc: true, stripe: null }, "en", en.pricing, "/shop/");
  assert.equal(view.card, undefined);
  assert.equal(view.rows.card, "Not offered");
  assert.equal(view.offer, undefined);
});

test("storage is never read as unlimited: a default quota, a domain without quotas and a mix each say what they are", () => {
  const storage = (patch: object) =>
    planView({ ...team, ...patch }, catalog.payment, "en", en.pricing, "/shop/").rows.storage;
  assert.equal(storage({ quotaMb: 512 }), "512 MB per mailbox");
  assert.equal(storage({ quotaMb: 0 }), "Server default storage");
  assert.equal(
    storage({ quotaSupportedByDomain: { "abnormalhq.com": false, "abnormal.bid": false } }),
    "No per-mailbox quota",
  );
  assert.equal(
    storage({ quotaSupportedByDomain: { "abnormalhq.com": true, "abnormal.bid": false } }),
    "Storage follows the domain you pick",
  );
});

test("a period of one day reads as a day, and a closed shop has no plans", () => {
  const daily = planView({ ...team, periodDays: 1 }, catalog.payment, "en", en.pricing, "/shop/");
  assert.equal(daily.unit, "LDC / day");
  assert.equal(daily.rows.billing, "Subscription, every day");
  assert.deepEqual(planViews({ ...catalog, available: false }, "en", en.pricing, "/shop/"), []);
});

test("card amounts become decimals in the currency's own precision", () => {
  assert.equal(decimalAmount(299, "usd"), "2.99");
  assert.equal(decimalAmount(500, "jpy"), "500");
  assert.equal(decimalAmount(299, "not-a-currency"), null);
});

test("the comparison table has a label for every row, in both languages", () => {
  for (const copy of [en, zh]) {
    assert.deepEqual([...planRows].sort(), Object.keys(copy.pricing.compare.rows).sort());
  }
});

test("the pricing page is rendered per request, HTML and Markdown alike, and the home page stays prerendered", () => {
  assert.ok(pagePaths.includes("/pricing/"));
  for (const file of [
    "src/app/(en)/pricing/page.tsx",
    "src/app/(zh)/zh/pricing/page.tsx",
    "src/app/md/pricing/route.ts",
    "src/app/md/zh/pricing/route.ts",
  ]) {
    assert.match(readFileSync(file, "utf8"), /export const dynamic = "force-dynamic";/, file);
  }
  // The home page's plans load in the browser; nothing in its server tree may read the catalog and bake a price into the build.
  for (const file of ["src/components/Home.tsx", "src/components/PricingSection.tsx", "src/components/Hero.tsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /catalog-live|liveCatalog|readCatalog/, file);
  }
  assert.ok(readFileSync("src/components/HomePricing.tsx", "utf8").startsWith('"use client"'));
  assert.ok(readFileSync("src/components/AddressCheck.tsx", "utf8").startsWith('"use client"'));
});

test("the pricing section and the address check take their copy through props, not from the copy module", () => {
  for (const file of ["HomePricing", "AddressCheck", "PlanCards"]) {
    const source = readFileSync(`src/components/${file}.tsx`, "utf8");
    assert.doesNotMatch(source, /from "@\/i18n"|i18n\/(en|zh)|shop-copy|storefront\/lib\/shop"/, file);
  }
});

test("the limits stated for every mailbox match mail's rules", () => {
  // GRACE_DAYS = 7 and RETENTION_DAYS = 30 in mail's subscription-rules.ts; 64 is the username limit of docs/onboard-contract.json.
  const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8")) as {
    redeem: { username: { maxLength: number } };
  };
  for (const copy of [en, zh]) {
    const text = copy.pricing.included.items.map((item) => item.description).join(" ");
    assert.match(text, /7[- ]/);
    assert.match(text, /30/);
    assert.ok(text.includes(String(contract.redeem.username.maxLength)));
    assert.match(text, /IMAP/);
    assert.match(text, /SMTP/);
  }
});
