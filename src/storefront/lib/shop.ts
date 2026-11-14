/**
 * Browser clients of the shop API that need a purchase or sign-in session: orders, renewals, the buyer account and its mailboxes.
 * The catalog, the response validators and the money formatters live in catalog.ts and are re-exported here.
 */
import type { Lang } from "../i18n.ts";
import {
  compact,
  currencyFits,
  isBoolean,
  isCount,
  isCurrency,
  isFiatCurrency,
  isNullableString,
  isString,
  isStrings,
  oneOf,
  optional,
  parseEntitlements,
  record,
  request,
  ShopApiError,
  TRON_ADDRESS,
  USDT_NETWORKS,
  type ShopPaymentProvider,
  type ShopProduct,
  type SubscriptionState,
  type UsdtNetwork,
} from "./catalog.ts";

export {
  catalogPlans,
  checkAddress,
  clampSeats,
  currencyFits,
  formatAmount,
  formatCredits,
  formatMoney,
  formatUsdt,
  getShopCatalog,
  isRefusal,
  isSeatProduct,
  parseShopCatalog,
  PLAN_KINDS,
  REFUSAL_CODES,
  seatCardPrice,
  seatOrderPrice,
  seatTotals,
  seatUsdtPrice,
  ShopApiError,
  shopApiRoot,
  USDT_CURRENCY,
  type AddressAvailability,
  type PlanKind,
  type RefusalCode,
  type SeatProduct,
  type ShopCatalog,
  type ShopPaymentProvider,
  type ShopProduct,
  type SubscriptionState,
  type UsdtNetwork,
  type UsdtPayment,
} from "./catalog.ts";

export interface PublicShopOrder {
  order: Omit<ShopProduct, "name" | "description"> & {
    trial?: boolean;
    trialUpgrade?: boolean;
    productName: string;
    status: "pending" | "paid";
    created: string;
    paidAt: string | null;
    /** purchase = buy a plan and receive a redeem code; renewal = renew an existing subscription. Old backends that omit it count as purchase. */
    kind?: "purchase" | "renewal";
    /** How many periods a renewal order renews. */
    periods?: number;
    /** Which subscription a renewal order renews. */
    subscriptionId?: string | null;
    provider?: ShopPaymentProvider;
    /** Currency of a Stripe order (priceCents is in its smallest unit), or "usdt" for a USDT order (hundredths of a USDT). */
    currency?: string;
    /**
     * The discount code of the order ("" without one) and what it took off, in the unit of priceCents (0 without one). mail
     * publishes both (mail #221, `publicOrderFields` in docs/onboard-contract.json). Absent on a mail before them: only then
     * does the order page work the discount out from what the shop page remembered at checkout (coupon.ts).
     */
    couponCode?: string;
    couponDiscountCents?: number;
  };
  code: string | null;
  codeStatus: CodeStatus | null;
  onboardUrl: string;
  /**
   * Paid subscription purchase and renewal orders: the subscription's current expiry and the renewal link token. The token can be null (same rule as the account page:
   * Stripe subscriptions, renewal price beyond the payable range), in which case no renewal link is shown; current mail still always issues a token.
   */
  subscription?: {
    currentPeriodEnd: string;
    state: SubscriptionState;
    renewToken: string | null;
    provider?: ShopPaymentProvider;
    autoRenew?: boolean;
  } | null;
}

/** Subscription info read by the renewal page. */
export interface TrialUpgradePlan {
  id: string;
  name: string;
  description: string;
  seatMin: number;
  seatMax: number;
  quotaMb: number;
  customDomains: number;
  periodDays: number;
  priceCents: number;
  originalPriceCents: number;
  discountPercent: number;
  renewPriceCents: number;
  fiatPriceMinor: number;
}

export interface RenewalSummary {
  upgradePlans?: TrialUpgradePlan[];
  upgradePayment?: { ldc: boolean; stripe: { currency: string } | null };
  trial?: boolean;
  fiatRenewMinor?: number;
  currency?: string;
  subscriptionId: string;
  productName: string;
  mailboxCount: number;
  periodDays: number;
  renewPriceCents: number;
  currentPeriodEnd: string;
  state: SubscriptionState;
  mailboxes: string[];
  maxPeriods: number;
  hasContactEmail: boolean;
  /**
   * Stripe subscriptions are charged automatically each period and cannot be renewed manually on the renewal page. A USDT
   * subscription renews with USDT only: `renewPriceCents` is then in hundredths of a USDT and `currency` is "usdt".
   */
  provider?: ShopPaymentProvider;
  autoRenew?: boolean;
}

export const SUBSCRIPTION_STATES: readonly SubscriptionState[] = ["active", "grace", "suspended", "expired"];
export const CODE_STATUSES = ["available", "used", "expired", "disabled"] as const;
export const PAYMENT_PROVIDERS: readonly ShopPaymentProvider[] = ["ldc", "stripe", "usdt"];
export type CodeStatus = (typeof CODE_STATUSES)[number];

const isProvider = oneOf(PAYMENT_PROVIDERS);
const isState = oneOf(SUBSCRIPTION_STATES);
const isCodeStatus = oneOf(CODE_STATUSES);
const isKind = oneOf(["purchase", "renewal"] as const);
const isOrderStatus = oneOf(["pending", "paid"] as const);

function isNullableCodeStatus(value: unknown): value is CodeStatus | null {
  return value === null || isCodeStatus(value);
}

function parseOrder(value: unknown, orderId: string): PublicShopOrder["order"] | null {
  if (
    !record(value) ||
    value.id !== orderId ||
    !optional(value.trial, isBoolean) ||
    !optional(value.trialUpgrade, isBoolean) ||
    !isString(value.productName) ||
    !isOrderStatus(value.status) ||
    !isString(value.created) ||
    !isNullableString(value.paidAt) ||
    !optional(value.kind, isKind) ||
    !optional(value.periods, isCount) ||
    !optional(value.subscriptionId, isNullableString) ||
    !optional(value.provider, isProvider) ||
    !optional(value.currency, isCurrency) ||
    !optional(value.couponCode, isString) ||
    !optional(value.couponDiscountCents, isCount)
  )
    return null;
  const freeTrial =
    value.trial === true && value.status === "paid" && value.kind === "purchase" && value.mailboxCount === 1;
  const entitlements = parseEntitlements(value, value.couponDiscountCents ?? 0, freeTrial);
  if (!entitlements) return null;
  return compact({
    id: orderId,
    trial: value.trial,
    trialUpgrade: value.trialUpgrade,
    productName: value.productName,
    ...entitlements,
    status: value.status,
    created: value.created,
    paidAt: value.paidAt,
    kind: value.kind,
    periods: value.periods,
    subscriptionId: value.subscriptionId,
    provider: value.provider,
    currency: value.currency,
    couponCode: value.couponCode,
    couponDiscountCents: value.couponDiscountCents,
  });
}

function parseOrderSubscription(value: unknown): PublicShopOrder["subscription"] | undefined {
  if (value === undefined || value === null) return null;
  if (
    !record(value) ||
    !isString(value.currentPeriodEnd) ||
    !isState(value.state) ||
    !isNullableString(value.renewToken) ||
    !optional(value.provider, isProvider) ||
    !optional(value.autoRenew, isBoolean)
  )
    return undefined;
  return compact({
    currentPeriodEnd: value.currentPeriodEnd,
    state: value.state,
    renewToken: value.renewToken,
    provider: value.provider,
    autoRenew: value.autoRenew,
  });
}

export async function createShopOrder(
  productId: string,
  lang?: Lang,
  /** Contact email for subscription expiry reminders; the field is not sent when empty. */
  email = "",
  /** Not sent for the default ldc (compatible with old backends that only know LDC); sent for every other way of paying. */
  provider: ShopPaymentProvider = "ldc",
  /** Discount code; the field is not sent when empty. mail prices the order with it, or refuses the checkout (400) and creates no order. */
  coupon = "",
  /** Seats of a seat plan (required for one: mail refuses the checkout without a whole number in the plan's range); not sent for a fixed plan. */
  quantity = 0,
): Promise<string> {
  const body = await request(
    "checkout",
    {
      productId,
      ...(email ? { email } : {}),
      ...(provider !== "ldc" ? { provider } : {}),
      ...(coupon ? { coupon } : {}),
      ...(quantity > 0 ? { quantity } : {}),
    },
    undefined,
    lang,
  );
  if (!record(body) || typeof body.orderId !== "string" || !/^[a-z0-9]{15}$/.test(body.orderId))
    throw new ShopApiError("");
  return body.orderId;
}

/**
 * What a plan costs with a discount code, as mail's preview answers it. Amounts are hundredths of an LDC, the smallest unit of
 * `currency` for a card price, or hundredths of a USDT. mail applies a percentage code to a USDT price and never a fixed amount.
 */
export interface CouponQuote {
  /** The code as mail stores it (upper-case). */
  code: string;
  provider: ShopPaymentProvider;
  /** Currency of a card price, "usdt" for a USDT price; the empty string for LDC. */
  currency: string;
  /** The price before the code: the plan's discounted LDC price, or its card or USDT price. */
  basePriceCents: number;
  discountCents: number;
  priceCents: number;
  /** A subscription plan: the code lowers the first period only, renewals are at the full price. */
  firstPeriodOnly: boolean;
}

/**
 * Previews a discount code for one plan and way of paying (POST /api/shop/coupon, the single form; the shop page uses
 * previewCouponPlans below and falls back to this for a mail before the several-plans form). null means the code cannot be used for
 * this purchase; mail gives one answer for every reason, so there is none to show. A seat quantity mail does not sell is
 * not that answer: it is a 400 with a code (`seat_quantity_invalid`, `seat_quantity_out_of_range` with `min` and `max`,
 * `seat_total_too_large` with `maxTotalCents`), thrown like any refusal. It reserves nothing: checkout prices the order again. A backend without the endpoint answers 404 (ShopApiError), and every call counts against mail's limit on
 * code guesses (10 per 10 minutes per IP, shared with checkout), so callers ask on an explicit action, not as the buyer types.
 */
export async function previewCoupon(
  productId: string,
  provider: ShopPaymentProvider,
  coupon: string,
  signal?: AbortSignal,
  lang?: Lang,
  /** Seats of a seat plan: the amounts in the answer are then for that many seats (mail answers 400 without it). Not sent for a fixed plan. */
  quantity = 0,
): Promise<CouponQuote | null> {
  const body = await request(
    "coupon",
    { productId, ...(provider !== "ldc" ? { provider } : {}), coupon, ...(quantity > 0 ? { quantity } : {}) },
    signal,
    lang,
  );
  if (!record(body) || !isBoolean(body.valid)) throw new ShopApiError("");
  return body.valid ? parseCouponQuote(body, provider) : null;
}

/** A quote as either form of the preview carries it. Half-right amounts, or an answer for another way of paying than asked, fail the request. */
function parseCouponQuote(body: Record<string, unknown>, provider: ShopPaymentProvider): CouponQuote {
  const { basePriceCents, discountCents, priceCents } = body;
  if (
    !isString(body.code) ||
    !body.code ||
    body.provider !== provider ||
    // An amount in another unit than the way of paying asked about (a card price without its currency, say) cannot be shown.
    !currencyFits(provider, body.currency) ||
    !isCount(basePriceCents) ||
    !isCount(discountCents) ||
    !isCount(priceCents) ||
    discountCents < 1 ||
    priceCents < 1 ||
    basePriceCents !== priceCents + discountCents ||
    !isBoolean(body.firstPeriodOnly)
  )
    throw new ShopApiError("");
  return {
    code: body.code,
    provider,
    currency: body.currency,
    basePriceCents,
    discountCents,
    priceCents,
    firstPeriodOnly: body.firstPeriodOnly,
  };
}

/** One plan and way of paying a code is previewed for; `quantity` is the seats of a seat plan, 0 for a fixed plan. */
export interface CouponAsk {
  productId: string;
  provider: ShopPaymentProvider;
  quantity?: number;
}

/** The most entries mail takes in one preview for several plans (PREVIEW_MAX_PRODUCTS in its coupon route). */
export const COUPON_PREVIEW_PLANS = 8;
/**
 * The most preview requests one press of "Apply" makes. Each request is one guess against mail's limit (10 per 10 minutes per
 * IP, shared with checkout), whether it asks about one plan or eight.
 */
export const COUPON_PREVIEW_REQUESTS = 4;

/**
 * Previews a discount code for several plans in ONE request, which mail counts as one guess (mail #221): POST
 * `{ products: [{ productId, provider?, quantity? }], coupon }` with 1 to COUPON_PREVIEW_PLANS entries answers
 * `{ quotes: [...] }`, one per entry asked and in that order, a quote or null where the code cannot be used. A mail before
 * this form reads the body as the single form without a plan and answers 400 (ShopApiError), one before discount codes 404.
 */
export async function previewCoupons(
  asks: readonly CouponAsk[],
  coupon: string,
  signal?: AbortSignal,
  lang?: Lang,
): Promise<(CouponQuote | null)[]> {
  const body = await request(
    "coupon",
    {
      products: asks.map(({ productId, provider, quantity = 0 }) => ({
        productId,
        ...(provider !== "ldc" ? { provider } : {}),
        ...(quantity > 0 ? { quantity } : {}),
      })),
      coupon,
    },
    signal,
    lang,
  );
  if (!record(body) || !Array.isArray(body.quotes) || body.quotes.length !== asks.length) throw new ShopApiError("");
  return body.quotes.map((quote: unknown, index) => {
    if (quote === null) return null;
    // An entry for another plan than the one asked at its place is not an answer to the question.
    if (!record(quote) || quote.productId !== asks[index]!.productId) throw new ShopApiError("");
    return parseCouponQuote(quote, asks[index]!.provider);
  });
}

/**
 * What "Apply" asks: the code for every plan and way of paying on the page, in as few guesses as the backend allows.
 * COUPON_PREVIEW_PLANS entries go in one request; a larger catalog takes further requests, up to COUPON_PREVIEW_REQUESTS a
 * press, and what is past that stays unasked ("checked when you order"). A mail before the several-plans form answers 400
 * to it: the code is then asked plan by plan in the single form, within the same number of requests (the refused one
 * counted), and `legacy` comes back true so that the next press starts with the single form.
 *
 * `quotes` has one entry per ask: a quote, null (the code cannot be used) or undefined (not asked). A failure part-way
 * keeps what was answered before it and comes back as `error` instead of being thrown. `errorAt` is the position in
 * `asks` of the entry a failure is about, when that is known: mail names it in the refusal of a seat quantity it does not
 * sell (`index`, the entry's position in the request's `products`), and the single form asks about one entry at a time.
 */
export async function previewCouponPlans(
  asks: readonly CouponAsk[],
  coupon: string,
  options: { signal?: AbortSignal; lang?: Lang; legacy?: boolean } = {},
): Promise<{ quotes: (CouponQuote | null | undefined)[]; legacy: boolean; error?: unknown; errorAt?: number }> {
  const { signal, lang } = options;
  const quotes: (CouponQuote | null | undefined)[] = asks.map(() => undefined);
  let legacy = options.legacy ?? false;
  let requests = 0;
  /** Where in `asks` the request in flight starts, and how many entries it carries. */
  let sent = { start: 0, length: 0, single: false };
  try {
    for (let start = 0; !legacy && start < asks.length && requests < COUPON_PREVIEW_REQUESTS;) {
      const batch = asks.slice(start, start + COUPON_PREVIEW_PLANS);
      requests += 1;
      sent = { start, length: batch.length, single: false };
      try {
        const answers = await previewCoupons(batch, coupon, signal, lang);
        answers.forEach((quote, index) => (quotes[start + index] = quote));
        start += batch.length;
      } catch (error) {
        // Only the first request decides: a backend that answered the form once has it. A coded refusal (a seat quantity
        // outside the plan's range, a total above what one order can charge) is from a mail that knows the form: it fails
        // the whole request and is the caller's to show, never a reason to ask again plan by plan.
        if (start === 0 && error instanceof ShopApiError && error.status === 400 && !error.code) legacy = true;
        else throw error;
      }
    }
    if (legacy) {
      for (let index = 0; index < asks.length && requests < COUPON_PREVIEW_REQUESTS; index += 1) {
        const { productId, provider, quantity = 0 } = asks[index]!;
        requests += 1;
        sent = { start: index, length: 1, single: true };
        quotes[index] = await previewCoupon(productId, provider, coupon, signal, lang, quantity);
      }
    }
  } catch (error) {
    const index = sent.single ? 0 : error instanceof ShopApiError && error.code ? error.details.index : undefined;
    const known = isCount(index) && index < sent.length;
    return { quotes, legacy, error, ...(known ? { errorAt: sent.start + index } : {}) };
  }
  return { quotes, legacy };
}

export async function getShopOrder(orderId: string, signal?: AbortSignal, lang?: Lang): Promise<PublicShopOrder> {
  const body = await request(`orders?id=${encodeURIComponent(orderId)}`, undefined, signal, lang);
  if (!record(body)) throw new ShopApiError("");
  const order = parseOrder(body.order, orderId);
  const subscription = parseOrderSubscription(body.subscription);
  if (
    !order ||
    subscription === undefined ||
    !isNullableString(body.code) ||
    !isNullableCodeStatus(body.codeStatus) ||
    !isString(body.onboardUrl)
  )
    throw new ShopApiError("");
  return { order, code: body.code, codeStatus: body.codeStatus, onboardUrl: body.onboardUrl, subscription };
}

function parseUpgradePlans(value: unknown): TrialUpgradePlan[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ShopApiError("");
  return value.map((plan) => {
    if (
      !record(plan) ||
      !isString(plan.id) ||
      !/^[a-z0-9]{15}$/.test(plan.id) ||
      !isString(plan.name) ||
      !isString(plan.description) ||
      ![
        plan.seatMin,
        plan.seatMax,
        plan.quotaMb,
        plan.customDomains,
        plan.periodDays,
        plan.priceCents,
        plan.originalPriceCents,
        plan.discountPercent,
        plan.renewPriceCents,
        plan.fiatPriceMinor,
      ].every(isCount) ||
      (plan.seatMin as number) < 1 ||
      (plan.seatMax as number) < (plan.seatMin as number) ||
      (plan.seatMax as number) > 1000 ||
      (plan.periodDays as number) < 1 ||
      (plan.priceCents as number) < 1 ||
      (plan.renewPriceCents as number) < 1 ||
      (plan.discountPercent as number) > 99
    )
      throw new ShopApiError("");
    return plan as unknown as TrialUpgradePlan;
  });
}

/** Reads a subscription's renewal info with the token from the renewal link. */
export async function getRenewal(token: string, signal?: AbortSignal, lang?: Lang): Promise<RenewalSummary> {
  const body = await request("renewal", { token }, signal, lang);
  if (
    !record(body) ||
    !optional(body.trial, isBoolean) ||
    !optional(body.fiatRenewMinor, isCount) ||
    !optional(body.currency, isCurrency) ||
    !isString(body.subscriptionId) ||
    !isString(body.productName) ||
    !isString(body.currentPeriodEnd) ||
    !isState(body.state) ||
    !isCount(body.mailboxCount) ||
    !isCount(body.periodDays) ||
    !isCount(body.renewPriceCents) ||
    !isCount(body.maxPeriods) ||
    !isStrings(body.mailboxes) ||
    !isBoolean(body.hasContactEmail) ||
    !optional(body.provider, isProvider) ||
    !optional(body.autoRenew, isBoolean)
  )
    throw new ShopApiError("");
  const upgradePlans = parseUpgradePlans(body.upgradePlans);
  const payment = body.upgradePayment;
  if (
    payment !== undefined &&
    (!record(payment) ||
      !isBoolean(payment.ldc) ||
      (payment.stripe !== null && (!record(payment.stripe) || !isFiatCurrency(payment.stripe.currency))))
  )
    throw new ShopApiError("");
  return compact({
    upgradePlans,
    upgradePayment: payment as RenewalSummary["upgradePayment"],
    trial: body.trial,
    fiatRenewMinor: body.fiatRenewMinor,
    currency: body.currency,
    subscriptionId: body.subscriptionId,
    productName: body.productName,
    mailboxCount: body.mailboxCount,
    periodDays: body.periodDays,
    renewPriceCents: body.renewPriceCents,
    currentPeriodEnd: body.currentPeriodEnd,
    state: body.state,
    mailboxes: [...body.mailboxes],
    maxPeriods: body.maxPeriods,
    hasContactEmail: body.hasContactEmail,
    provider: body.provider,
    autoRenew: body.autoRenew,
  });
}

/**
 * Places a renewal order for a subscription and returns the order number; payment then happens on the order page as usual. A USDT
 * subscription renews with `provider: "usdt"` only (mail refuses any other way for it), an LDC one with LDC (or, for a trial's
 * upgrade, by card).
 */
export async function createRenewalOrder(
  token: string,
  periods: number,
  lang?: Lang,
  email = "",
  provider: ShopPaymentProvider = "ldc",
  coupon = "",
  upgrade?: { productId: string; quantity: number },
): Promise<string> {
  const body = await request(
    "renew",
    {
      token,
      periods,
      ...(email ? { email } : {}),
      ...(provider !== "ldc" ? { provider } : {}),
      ...(coupon ? { coupon } : {}),
      ...upgrade,
    },
    undefined,
    lang,
  );
  if (!record(body) || typeof body.orderId !== "string" || !/^[a-z0-9]{15}$/.test(body.orderId))
    throw new ShopApiError("");
  return body.orderId;
}

export async function reconcileShopOrder(orderId: string, lang?: Lang): Promise<void> {
  await request("reconcile", { orderId }, undefined, lang);
}

/** Account page: the logged-in buyer's subscriptions and orders (mail's src/lib/shop/customers.ts). */
export interface CustomerAccount {
  email: string;
  /** Whether the account has a login password; old backends without password login omit this field. */
  hasPassword?: boolean;
  /** Linked Google account (the email Google most recently verified), null when none is linked; old backends without Google login omit this field. */
  google?: { email: string } | null;
  subscriptions: {
    trial?: boolean;
    id: string;
    productName: string;
    state: SubscriptionState;
    currentPeriodEnd: string;
    periodDays: number;
    renewPriceCents: number;
    mailboxCount: number;
    mailboxes: string[];
    renewToken: string | null;
    provider?: ShopPaymentProvider;
    autoRenew?: boolean;
    currency?: string;
    fiatRenewMinor?: number;
  }[];
  orders: {
    trialUpgrade?: boolean;
    trial?: boolean;
    id: string;
    kind: "purchase" | "renewal";
    productName: string;
    priceCents: number;
    periods: number;
    periodDays: number;
    status: "pending" | "paid";
    provider?: ShopPaymentProvider;
    currency?: string;
    created: string;
    paidAt: string | null;
    code: string | null;
    codeStatus: CodeStatus | null;
    /** The order's discount code ("" without one) and what it took off priceCents (0 without one); absent on a mail before #221. */
    couponCode?: string;
    couponDiscountCents?: number;
  }[];
}

type AccountSubscription = CustomerAccount["subscriptions"][number];
type AccountOrder = CustomerAccount["orders"][number];

function parseAccountSubscription(item: unknown): AccountSubscription | null {
  if (
    !record(item) ||
    !optional(item.trial, isBoolean) ||
    !isString(item.id) ||
    !isString(item.productName) ||
    !isState(item.state) ||
    !isString(item.currentPeriodEnd) ||
    !isCount(item.periodDays) ||
    !isCount(item.renewPriceCents) ||
    !isCount(item.mailboxCount) ||
    !isStrings(item.mailboxes) ||
    !isNullableString(item.renewToken) ||
    !optional(item.provider, isProvider) ||
    !optional(item.autoRenew, isBoolean) ||
    !optional(item.currency, isCurrency) ||
    !optional(item.fiatRenewMinor, isCount)
  )
    return null;
  return compact({
    trial: item.trial,
    id: item.id,
    productName: item.productName,
    state: item.state,
    currentPeriodEnd: item.currentPeriodEnd,
    periodDays: item.periodDays,
    renewPriceCents: item.renewPriceCents,
    mailboxCount: item.mailboxCount,
    mailboxes: [...item.mailboxes],
    renewToken: item.renewToken,
    provider: item.provider,
    autoRenew: item.autoRenew,
    currency: item.currency,
    fiatRenewMinor: item.fiatRenewMinor,
  });
}

function parseAccountOrder(item: unknown): AccountOrder | null {
  if (
    !record(item) ||
    !optional(item.trial, isBoolean) ||
    !optional(item.trialUpgrade, isBoolean) ||
    !isString(item.id) ||
    !isKind(item.kind) ||
    !isString(item.productName) ||
    !isCount(item.priceCents) ||
    !isCount(item.periods) ||
    !isCount(item.periodDays) ||
    !isOrderStatus(item.status) ||
    !optional(item.provider, isProvider) ||
    !optional(item.currency, isCurrency) ||
    !isString(item.created) ||
    !isNullableString(item.paidAt) ||
    !isNullableString(item.code) ||
    !isNullableCodeStatus(item.codeStatus) ||
    !optional(item.couponCode, isString) ||
    !optional(item.couponDiscountCents, isCount)
  )
    return null;
  return compact({
    trial: item.trial,
    trialUpgrade: item.trialUpgrade,
    id: item.id,
    kind: item.kind,
    productName: item.productName,
    priceCents: item.priceCents,
    periods: item.periods,
    periodDays: item.periodDays,
    status: item.status,
    provider: item.provider,
    currency: item.currency,
    created: item.created,
    paidAt: item.paidAt,
    code: item.code,
    codeStatus: item.codeStatus,
    couponCode: item.couponCode,
    couponDiscountCents: item.couponDiscountCents,
  });
}

function parseAccount(value: unknown): CustomerAccount | null {
  if (
    !record(value) ||
    !isString(value.email) ||
    !optional(value.hasPassword, isBoolean) ||
    !(value.google === undefined || value.google === null || (record(value.google) && isString(value.google.email))) ||
    !Array.isArray(value.subscriptions) ||
    !Array.isArray(value.orders)
  )
    return null;
  const subscriptions = value.subscriptions.map(parseAccountSubscription);
  const orders = value.orders.map(parseAccountOrder);
  if (!subscriptions.every((item) => item !== null) || !orders.every((item) => item !== null)) return null;
  return compact({
    email: value.email,
    hasPassword: value.hasPassword,
    google:
      value.google === undefined ? undefined : value.google === null ? null : { email: value.google.email as string },
    subscriptions: subscriptions as AccountSubscription[],
    orders: orders as AccountOrder[],
  });
}

/** Reads the account; returns null when logged out (401), which makes the page show the login form. */
export async function getAccount(signal?: AbortSignal, lang?: Lang): Promise<CustomerAccount | null> {
  try {
    const account = parseAccount(await request("account", undefined, signal, lang));
    if (!account) throw new ShopApiError("");
    return account;
  } catch (error) {
    if (error instanceof ShopApiError && error.status === 401) return null;
    throw error;
  }
}

/** Turnstile action of the login form: mail only accepts tokens issued for this form (turnstile.actions in docs/onboard-contract.json). */
export const LOGIN_TURNSTILE_ACTION = "shop-login";

/** Sends a login email to this address; when the backend has human verification on it must carry a Turnstile token (action LOGIN_TURNSTILE_ACTION). */
export async function requestLogin(email: string, lang?: Lang, turnstileToken = ""): Promise<void> {
  await request("account/login", { email, ...(turnstileToken ? { turnstileToken } : {}) }, undefined, lang);
}

/** Which mailbox a login link belongs to, and whether it is a registration confirmation link (register); old backends omit register, so it counts as a plain login link. */
export interface PeekedLogin {
  email: string;
  register: boolean;
  /** Password reset link after a forgotten password (?reset=...): can only set a new password, not log in directly. */
  reset: boolean;
}

/**
 * Which mailbox a login link belongs to (read-only, does not spend the link): the account page uses it to ask "Log in as ...?" or "Confirm registration for ...?", and hands it to verifyLogin only after the buyer confirms.
 * An invalid, expired or used link is a 400; old backends without this endpoint answer other errors.
 */
export async function peekLogin(token: string, signal?: AbortSignal, lang?: Lang): Promise<PeekedLogin> {
  const body = await request("account/peek", { token }, signal, lang);
  if (
    !record(body) ||
    !isString(body.email) ||
    !body.email ||
    !optional(body.register, isBoolean) ||
    !optional(body.reset, isBoolean)
  )
    throw new ShopApiError("");
  return { email: body.email, register: body.register === true, reset: body.reset === true };
}

/**
 * peekLogin for the confirmation dialog: temporary failures (offline, rate limit, backend 5xx, and old backends without peek) are asked again after a moment,
 * because the mailbox in the dialog is the main clue for spotting a login link planted by someone else. A 400 (invalid link) and malformed answers are final and not retried.
 */
export async function peekLoginWithRetry(
  token: string,
  signal?: AbortSignal,
  lang?: Lang,
  pauseMs = 1000,
): Promise<PeekedLogin> {
  try {
    return await peekLogin(token, signal, lang);
  } catch (error) {
    if (signal?.aborted || !transientFailure(error)) throw error;
    await pause(pauseMs, signal);
    return peekLogin(token, signal, lang);
  }
}

/** A failure that may succeed on retry: the request never arrived (fetch TypeError) or timed out, rate limited or a server fault. */
function transientFailure(error: unknown): boolean {
  if (error instanceof ShopApiError) return error.status === 429 || error.status >= 500;
  return error instanceof TypeError || (error instanceof Error && error.name === "TimeoutError");
}

/** Waits ms milliseconds; ends at once with the abort reason when signal aborts. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Exchanges the token from a login link for a session cookie; returns the logged-in email and how many orders were attached to the account this time. */
export async function verifyLogin(token: string, lang?: Lang): Promise<{ email: string; claimed: number }> {
  const body = await request("account/verify", { token }, undefined, lang);
  if (!record(body) || !isString(body.email) || !isCount(body.claimed)) throw new ShopApiError("");
  return { email: body.email, claimed: body.claimed };
}

/**
 * Registers with email and password: mail sends a confirmation email to this address, and the account exists and the password takes effect only after the buyer opens the link inside (the same confirmation page as login links).
 * The answer is the same when the email is already registered (so who has an account is not revealed), and confirming then amounts to a password reset. Shares the Turnstile widget and action with the login form.
 */
export async function registerAccount(
  email: string,
  password: string,
  lang?: Lang,
  turnstileToken = "",
): Promise<void> {
  await request(
    "account/register",
    { email, password, ...(turnstileToken ? { turnstileToken } : {}) },
    undefined,
    lang,
  );
}

/**
 * Forgot password: sends a password reset email to this address (if it is registered; otherwise mail sends nothing but answers the same, so who has an account is not revealed).
 * Shares the Turnstile widget and action with the login form.
 */
export async function requestPasswordReset(email: string, lang?: Lang, turnstileToken = ""): Promise<void> {
  await request("account/forgot", { email, ...(turnstileToken ? { turnstileToken } : {}) }, undefined, lang);
}

/**
 * Sets a new password with the token from a reset link: on success this account is logged out in every browser and the current browser gets a new login (the Worker rebuilds the session cookie).
 * An invalid, expired or used link is a 400.
 */
export async function resetPassword(
  token: string,
  password: string,
  lang?: Lang,
): Promise<{ email: string; claimed: number }> {
  const body = await request("account/reset", { token, password }, undefined, lang);
  if (!record(body) || !isString(body.email) || !isCount(body.claimed)) throw new ShopApiError("");
  return { email: body.email, claimed: body.claimed };
}

/**
 * Starts Google login: mail sets a 10-minute signed cookie on this browser (sent only to account/google) and returns the address of Google's consent page, which the page jumps to.
 * link: linking Google from the account page while logged in; on return that Google account is linked to the current account instead of logging in with it.
 * Only Google's consent page is accepted (the development mock gives this site's address); any other address counts as a bad response, so the buyer is never sent elsewhere.
 */
export async function startGoogleLogin(lang: Lang, link = false): Promise<string> {
  const body = await request("account/google/start", link ? { lang, link: true } : { lang }, undefined, lang);
  if (!record(body) || !isString(body.url)) throw new ShopApiError("");
  let target: URL;
  try {
    target = new URL(body.url, window.location.origin);
  } catch {
    throw new ShopApiError("");
  }
  const google = target.origin === "https://accounts.google.com" && target.pathname.startsWith("/o/oauth2/");
  if (!google && target.origin !== window.location.origin) throw new ShopApiError("");
  return target.href;
}

/**
 * After Google sends the browser back to the account page (?code=...&state=...), hands both to mail: it matches this browser's cookie, verifies the Google identity and logs in,
 * and the Worker installs the account session cookie. lang is the page language when login started (Google knows one callback address, always the Chinese page); created means a new account was opened,
 * linked that Google was linked this time (an existing account linked automatically on login, or linked from the account page).
 */
export async function finishGoogleLogin(
  code: string,
  state: string,
  lang?: Lang,
): Promise<{ email: string; claimed: number; created: boolean; linked: boolean; lang: Lang }> {
  const body = await request("account/google", { code, state }, undefined, lang);
  if (
    !record(body) ||
    !isString(body.email) ||
    !isCount(body.claimed) ||
    !isBoolean(body.created) ||
    !optional(body.linked, isBoolean) ||
    (body.lang !== "zh" && body.lang !== "en")
  )
    throw new ShopApiError("");
  return {
    email: body.email,
    claimed: body.claimed,
    created: body.created,
    linked: body.linked === true,
    lang: body.lang,
  };
}

/** Unlinks Google; password and email link login keep working. */
export async function unlinkGoogle(lang?: Lang): Promise<void> {
  await request("account/google/unlink", {}, undefined, lang);
}

/** Login password length (in characters), the same as mail's CUSTOMER_PASSWORD_MIN / MAX. */
export const ACCOUNT_PASSWORD_MIN = 8;
export const ACCOUNT_PASSWORD_MAX = 128;

/**
 * Logs in with email and password; on success the Worker installs the account session cookie. Returns the logged-in email and how many orders were attached to the account this time.
 * No such account, no password set and wrong password are all the same 401. Uses the same Turnstile action as the login link form (LOGIN_TURNSTILE_ACTION).
 */
export async function passwordLogin(
  email: string,
  password: string,
  lang?: Lang,
  turnstileToken = "",
): Promise<{ email: string; claimed: number }> {
  const body = await request(
    "account/password-login",
    { email, password, ...(turnstileToken ? { turnstileToken } : {}) },
    undefined,
    lang,
  );
  if (!record(body) || !isString(body.email) || !isCount(body.claimed)) throw new ShopApiError("");
  return { email: body.email, claimed: body.claimed };
}

/**
 * Sets or changes the login password. Within 10 minutes of logging in through a login link the current password can be left out (first-time setup and forgotten passwords rely on this);
 * otherwise the current password is required and a wrong one is a 403. On success this account is logged out in other browsers while the current browser stays logged in.
 */
export async function setAccountPassword(password: string, currentPassword = "", lang?: Lang): Promise<void> {
  await request("account/password", { password, ...(currentPassword ? { currentPassword } : {}) }, undefined, lang);
}

/**
 * Logs out. Every logout request this site's Worker forwards to mail clears the session cookie, even when mail fails (5xx),
 * so a 5xx answered by the Worker (JSON body) also counts as logged out; a request that never arrived (offline), a rejection (4xx), or Cloudflare's own error page
 * (the Worker did not finish, the cookie is still there) report an error as usual.
 */
export async function logoutAccount(lang?: Lang): Promise<void> {
  try {
    await request("account/logout", {}, undefined, lang);
  } catch (error) {
    if (!(error instanceof ShopApiError && error.status >= 500 && error.answered)) throw error;
  }
}

/**
 * Paying a card order on the order page with Stripe Elements (mail's pay/stripe):
 * - open: initialize Stripe.js with clientSecret and publishableKey and embed the payment form in the page;
 * - hosted: no publishable key is configured (or the backend is too old, or the Worker does not know this endpoint): use the "Pay" form that goes to Stripe's hosted page;
 * - paid: already paid (possibly completed in this very step); processing: the buyer already paid and the bank debit is on its way, nothing more to pay.
 */
export type StripePaymentStart =
  { status: "open"; clientSecret: string; publishableKey: string } | { status: "hosted" | "paid" | "processing" };

/**
 * A Checkout Session's client secret: the session id, `_secret_`, then an opaque part Stripe percent-encodes (live secrets
 * carry `%2F`, `%3F` and the like), so the opaque part takes the URL-safe and percent-encoding characters too.
 */
const CHECKOUT_CLIENT_SECRET = /^cs_(?:test|live)_[A-Za-z0-9]{1,250}_secret_[A-Za-z0-9%_+/=-]{1,1000}$/;

export async function startStripePayment(orderId: string, lang?: Lang): Promise<StripePaymentStart> {
  let body: unknown;
  try {
    body = await request("pay/stripe", { orderId, ...(lang ? { lang } : {}) }, undefined, lang);
  } catch (error) {
    // An old Worker or mail without this endpoint: the hosted page as before. Other errors (order not found, rate limited) are thrown as usual.
    if (error instanceof ShopApiError && error.status === 404 && !error.message.trim()) return { status: "hosted" };
    throw error;
  }
  if (!record(body)) throw new ShopApiError("");
  if (body.status === "hosted" || body.status === "paid" || body.status === "processing")
    return { status: body.status };
  if (
    body.status === "open" &&
    isString(body.clientSecret) &&
    CHECKOUT_CLIENT_SECRET.test(body.clientSecret) &&
    isString(body.publishableKey) &&
    /^pk_(test|live)_[A-Za-z0-9]{10,250}$/.test(body.publishableKey)
  )
    return { status: "open", clientSecret: body.clientSecret, publishableKey: body.publishableKey };
  throw new ShopApiError("");
}

/**
 * Paying a USDT order on the order page (mail's pay/usdt, `shop.usdt` in docs/onboard-contract.json):
 * - open: the order is waiting for USDT on TRON (TRC-20). `address` belongs to this order alone, `amount` is exactly what to send
 *   (a decimal string, what the buyer copies; `amountMinor` the same in hundredths of a USDT), `received` what has been confirmed
 *   on chain to the address so far and `confirming` what has been seen there but is not confirmed yet (decimal strings, up to six
 *   decimals). The order is paid once the confirmed total reaches the amount, so a buyer who sent too little sends the rest.
 * - paid: already paid (possibly just now): the order page reads the order again and shows the code.
 * Every call has mail look at the chain (mail throttles it itself), so the page may call it every few seconds while it is shown.
 * Failures are ShopApiError: 404 (no such order for this buyer, or a backend without USDT, whose 404 page the Worker passes on
 * as a JSON 404), 409 (not a USDT order, USDT switched off, or an order that can no longer be paid), 429 with `retryAfter`,
 * 503 (USDT not configured).
 */
export type UsdtPaymentStart =
  | {
      status: "open";
      network: UsdtNetwork;
      token: "USDT";
      contract: string;
      address: string;
      amount: string;
      amountMinor: number;
      received: string;
      confirming: string;
    }
  | { status: "paid" };

/** A USDT amount as mail writes it: whole USDT and up to six decimals (the token's base unit), no sign, no exponent. */
const USDT_DECIMAL = /^(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,6}))?$/;

/**
 * A USDT decimal string in the token's base units (millionths of a USDT), as a whole number the page can compare and subtract
 * exactly; null for anything that is not such an amount. 10^12 USDT in base units is still a safe integer.
 */
export function usdtUnits(value: unknown): number | null {
  if (!isString(value)) return null;
  const match = USDT_DECIMAL.exec(value);
  if (!match) return null;
  return Number(match[1]) * 1_000_000 + Number((match[2] ?? "").padEnd(6, "0"));
}

/** Base units of USDT as a decimal string with at least two decimals and no trailing zeros past them: 12340000 → "12.34", 1 → "0.000001". */
export function usdtDecimal(units: number): string {
  const whole = Math.floor(units / 1_000_000);
  const fraction = String(units % 1_000_000)
    .padStart(6, "0")
    .replace(/0{1,4}$/, "");
  return `${whole}.${fraction}`;
}

export async function startUsdtPayment(orderId: string, lang?: Lang, signal?: AbortSignal): Promise<UsdtPaymentStart> {
  const body = await request("pay/usdt", { orderId }, signal, lang);
  if (!record(body)) throw new ShopApiError("");
  if (body.status === "paid") return { status: "paid" };
  const amount = usdtUnits(body.amount);
  if (
    body.status !== "open" ||
    !(USDT_NETWORKS as readonly unknown[]).includes(body.network) ||
    body.token !== "USDT" ||
    !isString(body.contract) ||
    !TRON_ADDRESS.test(body.contract) ||
    !isString(body.address) ||
    !TRON_ADDRESS.test(body.address) ||
    amount === null ||
    !isCount(body.amountMinor) ||
    body.amountMinor < 1 ||
    // The amount to send and its hundredths say the same: a QR code or a copy button never carries a different amount.
    amount !== body.amountMinor * 10_000 ||
    usdtUnits(body.received) === null ||
    usdtUnits(body.confirming) === null
  )
    throw new ShopApiError("");
  return {
    status: "open",
    network: body.network as UsdtNetwork,
    token: "USDT",
    contract: body.contract,
    address: body.address,
    amount: body.amount as string,
    amountMinor: body.amountMinor,
    received: body.received as string,
    confirming: body.confirming as string,
  };
}

/** Opens the customer portal for the buyer's own Stripe subscription (change card, cancel or resume auto-renewal) and returns Stripe's page address. */
export async function openBillingPortal(subscriptionId: string, lang?: Lang): Promise<string> {
  const body = await request("account/portal", { subscriptionId }, undefined, lang);
  if (!record(body) || typeof body.url !== "string" || !/^https:\/\/billing\.stripe\.com\//.test(body.url))
    throw new ShopApiError("");
  return body.url;
}

/** Date and time of an order or subscription in the page language; a value that is no date is shown as it came. */
export function formatDateTime(value: string, lang: Lang): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed);
}

/* ---------------------------------------------------------------------------
 * Mailbox management (mail's src/lib/shop/customer-mailboxes.ts): the mailboxes activated with the redeem codes of the buyer's paid orders.
 * ------------------------------------------------------------------------- */

export type AccountMailboxStatus = "active" | "disabled";

export interface MailServer {
  host: string;
  port: number;
  security: string;
}

export interface AccountMailbox {
  id: string;
  email: string;
  status: AccountMailboxStatus;
  /** MB; 0 means unlimited; null when never synced. */
  quotaMb: number | null;
  usageMb: number | null;
  created: string;
}

/** One paid purchase order and the mailboxes activated with its redeem code. */
export interface AccountMailboxGroup {
  orderId: string;
  productName: string;
  code: string;
  codeStatus: CodeStatus;
  usesLeft: number;
  mailboxLimit: number;
  codeExpires: string | null;
  /** Domains a new mailbox can be activated on now; empty when none can (used up, expired, disabled, subscription suspended). */
  domains: string[];
  /** The subscription is suspended or pending reclamation: read-only until renewed. */
  locked: boolean;
  /**
   * The seats of a seat subscription; null (or absent, on a backend before seat plans) for every other order. mail also
   * answers null for a one-time order of a seat plan: its seats cannot be changed afterwards.
   */
  seats?: AccountSeats | null;
  mailboxes: AccountMailbox[];
}

/** A seat subscription as the account page shows it (mail's CustomerSeats, src/lib/shop/seats.ts). */
export interface AccountSeats {
  /** Seats paid for in the current period. */
  seats: number;
  /** The count from the next renewal on while a removal is scheduled; otherwise null. */
  seatsNext: number | null;
  /** The plan's range: seats can be added up to max and removed down to min. */
  min: number;
  max: number;
  /** One seat for one period: hundredths of an LDC, the smallest unit of `currency` for a card subscription, or hundredths of a USDT. */
  seatPriceCents: number;
  provider: ShopPaymentProvider;
  /** Currency of a card subscription, "usdt" for a USDT one; the empty string for LDC. */
  currency: string;
  /**
   * The length of the period `seatPriceCents` is for, in days (`shop.seats.accountFields` since contract version 3). Absent
   * on a mail before the field: the page then says "per period" without the length.
   */
  periodDays?: number;
  periodEnd: string;
  /** Ids of the mailboxes that go with the scheduled removal. */
  removing: string[];
}

const SEAT_LIMIT = 1000;

function isSeatCount(value: unknown): value is number {
  return isCount(value) && value >= 1 && value <= SEAT_LIMIT;
}

function parseAccountSeats(value: unknown): AccountSeats | null | undefined {
  if (value === undefined || value === null) return null;
  if (
    !record(value) ||
    !isSeatCount(value.seats) ||
    !(value.seatsNext === null || isSeatCount(value.seatsNext)) ||
    !isSeatCount(value.min) ||
    !isSeatCount(value.max) ||
    value.max < value.min ||
    !isCount(value.seatPriceCents) ||
    !isProvider(value.provider) ||
    // A card amount without its currency (or any amount in another unit than its way of paying) cannot be shown.
    !currencyFits(value.provider, value.currency) ||
    // Seats are only ever those of a subscription, so a period that is there is at least a day.
    !(value.periodDays === undefined || (isCount(value.periodDays) && value.periodDays >= 1)) ||
    !isString(value.periodEnd) ||
    !isStrings(value.removing)
  )
    return undefined;
  return {
    seats: value.seats,
    seatsNext: value.seatsNext,
    min: value.min,
    max: value.max,
    seatPriceCents: value.seatPriceCents,
    provider: value.provider,
    currency: value.currency,
    ...(value.periodDays === undefined ? {} : { periodDays: value.periodDays }),
    periodEnd: value.periodEnd,
    removing: [...value.removing],
  };
}

export interface AccountMailboxes {
  groups: AccountMailboxGroup[];
  servers: Record<string, { imap: MailServer | null; smtp: MailServer | null }>;
  webmail: string | null;
}

function isSize(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function parseServer(value: unknown): MailServer | null | undefined {
  if (value === null) return null;
  if (!record(value) || !isString(value.host) || !isCount(value.port) || !isString(value.security)) return undefined;
  return { host: value.host, port: value.port, security: value.security };
}

function parseAccountMailbox(value: unknown): AccountMailbox | null {
  if (
    !record(value) ||
    !isString(value.id) ||
    !isString(value.email) ||
    (value.status !== "active" && value.status !== "disabled") ||
    !isSize(value.quotaMb) ||
    !isSize(value.usageMb) ||
    !isString(value.created)
  )
    return null;
  return {
    id: value.id,
    email: value.email,
    status: value.status,
    quotaMb: value.quotaMb,
    usageMb: value.usageMb,
    created: value.created,
  };
}

function parseMailboxGroup(value: unknown): AccountMailboxGroup | null {
  if (
    !record(value) ||
    !isString(value.orderId) ||
    !isString(value.productName) ||
    !isString(value.code) ||
    !isCodeStatus(value.codeStatus) ||
    !isCount(value.usesLeft) ||
    !isCount(value.mailboxLimit) ||
    !isNullableString(value.codeExpires) ||
    !isStrings(value.domains) ||
    !isBoolean(value.locked) ||
    !Array.isArray(value.mailboxes)
  )
    return null;
  const mailboxes = value.mailboxes.map(parseAccountMailbox);
  const seats = parseAccountSeats(value.seats);
  if (!mailboxes.every((item) => item !== null) || seats === undefined) return null;
  return {
    orderId: value.orderId,
    productName: value.productName,
    code: value.code,
    codeStatus: value.codeStatus,
    usesLeft: value.usesLeft,
    mailboxLimit: value.mailboxLimit,
    codeExpires: value.codeExpires,
    domains: [...value.domains],
    locked: value.locked,
    // Absent on a backend before seat plans, and then absent here too.
    ...(value.seats === undefined ? {} : { seats }),
    mailboxes: mailboxes as AccountMailbox[],
  };
}

function parseAccountMailboxes(value: unknown): AccountMailboxes | null {
  if (!record(value) || !Array.isArray(value.groups) || !record(value.servers) || !isNullableString(value.webmail))
    return null;
  const groups = value.groups.map(parseMailboxGroup);
  if (!groups.every((item) => item !== null)) return null;
  const servers: AccountMailboxes["servers"] = {};
  for (const [domain, entry] of Object.entries(value.servers)) {
    if (!record(entry)) return null;
    const imap = parseServer(entry.imap);
    const smtp = parseServer(entry.smtp);
    if (imap === undefined || smtp === undefined) return null;
    servers[domain] = { imap, smtp };
  }
  return { groups: groups as AccountMailboxGroup[], servers, webmail: value.webmail };
}

/** Reads mailbox management; returns null when logged out (401). */
export async function getAccountMailboxes(signal?: AbortSignal, lang?: Lang): Promise<AccountMailboxes | null> {
  try {
    const mailboxes = parseAccountMailboxes(await request("account/mailboxes", undefined, signal, lang));
    if (!mailboxes) throw new ShopApiError("");
    return mailboxes;
  } catch (error) {
    if (error instanceof ShopApiError && error.status === 401) return null;
    throw error;
  }
}

/** Activates a mailbox directly with an order's redeem code: same rules as the redeem page; returns the address and the mail servers. */
export async function createAccountMailbox(
  input: { orderId: string; domain: string; username: string; password: string },
  lang?: Lang,
): Promise<{ email: string; imap: MailServer | null; smtp: MailServer | null; webmail: string | null }> {
  const body = await request("account/mailboxes/create", input, undefined, lang);
  if (!record(body) || !isString(body.email) || !isNullableString(body.webmail)) throw new ShopApiError("");
  const imap = parseServer(body.imap);
  const smtp = parseServer(body.smtp);
  if (imap === undefined || smtp === undefined) throw new ShopApiError("");
  return { email: body.email, imap, smtp, webmail: body.webmail };
}

/** Sets a new password on one of the buyer's mailboxes: webmail and client logins using the old password stop working. */
export async function setAccountMailboxPassword(mailboxId: string, password: string, lang?: Lang): Promise<void> {
  await request("account/mailboxes/password", { mailboxId, password }, undefined, lang);
}

/** Suspends or resumes one of the buyer's mailboxes. */
export async function setAccountMailboxStatus(
  mailboxId: string,
  status: AccountMailboxStatus,
  lang?: Lang,
): Promise<void> {
  await request("account/mailboxes/status", { mailboxId, status }, undefined, lang);
}

/** Deletes one of the buyer's mailboxes with all its mail (irreversible); confirm must repeat the address; the quota goes back to the redeem code. */
export async function deleteAccountMailbox(mailboxId: string, confirm: string, lang?: Lang): Promise<void> {
  await request("account/mailboxes/delete", { mailboxId, confirm }, undefined, lang);
}

/* ---------------------------------------------------------------------------
 * Seats of a seat subscription (mail's src/lib/shop/seats.ts; "Seat plans" in docs/storefront-api.md). `orderId` is always the
 * subscription's purchase order, the one its group in "My mailboxes" is listed under.
 * ------------------------------------------------------------------------- */

/** What adding seats would cost for the rest of the current period, as mail quotes it. Reserves nothing. */
export interface SeatQuote {
  add: number;
  /** The seat count after adding. */
  seats: number;
  provider: ShopPaymentProvider;
  currency: string;
  priceCents: number;
  /**
   * true for LDC and USDT: the price of the order if it is placed at once (it falls as the period runs down). false for a card
   * subscription: mail's estimate by the same rule, while Stripe works out the final amount itself when the change is made.
   */
  exact: boolean;
  periodEnd: string;
}

export async function quoteSeats(orderId: string, add: number, signal?: AbortSignal, lang?: Lang): Promise<SeatQuote> {
  const body = await request("account/seats/quote", { orderId, add }, signal, lang);
  if (
    !record(body) ||
    body.add !== add ||
    !isSeatCount(body.seats) ||
    !isProvider(body.provider) ||
    !currencyFits(body.provider, body.currency) ||
    !isCount(body.priceCents) ||
    body.priceCents < 1 ||
    !isBoolean(body.exact) ||
    !isString(body.periodEnd)
  )
    throw new ShopApiError("");
  return {
    add,
    seats: body.seats,
    provider: body.provider,
    currency: body.currency,
    priceCents: body.priceCents,
    exact: body.exact,
    periodEnd: body.periodEnd,
  };
}

/**
 * The outcome of adding seats:
 * - order: an LDC or USDT subscription got an order for the prorated amount, paid on the order page like a renewal order; the
 *   seats rise when it is paid;
 * - applied: a card subscription's card was charged and `seats` is the new count;
 * - payment_required: the bank wants the buyer (authentication, or a declined card). Nothing changed: `seats` is still the
 *   old count, and the seats rise only once Stripe confirms the payment made on `invoiceUrl` (Stripe's hosted invoice page;
 *   null when Stripe gave none).
 */
export type SeatAddition =
  | { kind: "order"; orderId: string }
  | { kind: "applied"; seats: number }
  | { kind: "payment_required"; seats: number; invoiceUrl: string | null };

/** Stripe's hosted invoice page. Any other address counts as none, so the buyer is never sent elsewhere to pay. */
function invoicePage(value: unknown): string | null {
  if (!isString(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)stripe\.com$/.test(url.hostname) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function addSeats(orderId: string, add: number, lang?: Lang): Promise<SeatAddition> {
  const body = await request("account/seats/add", { orderId, add }, undefined, lang);
  if (!record(body)) throw new ShopApiError("");
  if (typeof body.orderId === "string" && /^[a-z0-9]{15}$/.test(body.orderId))
    return { kind: "order", orderId: body.orderId };
  if (body.status === "applied" && isSeatCount(body.seats)) return { kind: "applied", seats: body.seats };
  if (body.status === "payment_required" && isSeatCount(body.seats))
    return { kind: "payment_required", seats: body.seats, invoiceUrl: invoicePage(body.invoiceUrl) };
  throw new ShopApiError("");
}

/** A removal scheduled for the next renewal, or what is left after taking one back. */
export interface SeatRemoval {
  seats: number;
  seatsNext: number | null;
  /** When the removal takes effect: the end of the current period. */
  effective: string;
  removing: string[];
}

function parseSeatRemoval(body: unknown): SeatRemoval {
  if (
    !record(body) ||
    !isSeatCount(body.seats) ||
    !(body.seatsNext === null || isSeatCount(body.seatsNext)) ||
    !isString(body.effective) ||
    !isStrings(body.removing)
  )
    throw new ShopApiError("");
  return { seats: body.seats, seatsNext: body.seatsNext, effective: body.effective, removing: [...body.removing] };
}

/**
 * Removes `remove` seats at the next renewal, never before; `mailboxIds` are the mailboxes that go with them (enough for the
 * rest to fit the new count; they keep working until then). Scheduling again replaces an earlier removal.
 */
export async function removeSeats(
  orderId: string,
  remove: number,
  mailboxIds: readonly string[],
  lang?: Lang,
): Promise<SeatRemoval> {
  return parseSeatRemoval(
    await request("account/seats/remove", { orderId, remove, mailboxIds: [...mailboxIds] }, undefined, lang),
  );
}

/** Takes a scheduled removal back: the subscription keeps all its seats. */
export async function keepSeats(orderId: string, lang?: Lang): Promise<SeatRemoval> {
  return parseSeatRemoval(await request("account/seats/keep", { orderId }, undefined, lang));
}
