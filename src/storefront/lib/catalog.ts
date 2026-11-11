/**
 * The public catalog and what reads it without a session: the plan and catalog types, the response validators every shop client shares,
 * the request helper, the catalog itself, the address check and the money formatters. The pricing section, the pricing page and the
 * address check import only this file, so the home page's browser bundle does not carry the order, renewal and account clients (shop.ts).
 * shop.ts re-exports everything here, so the shop pages keep importing from one place.
 * This file does not depend on the DOM and must not use TypeScript syntax Node cannot run directly; tests and the Worker run it as is.
 */
import type { Lang } from "../i18n.ts";
import { apiBase } from "../site.ts";

export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  originalPriceCents: number;
  discountPercent: number;
  priceCents: number;
  mailboxCount: number;
  quotaMb: number;
  quotaSupportedByDomain?: Record<string, boolean>;
  codeExpiresDays: number;
  domains: string[];
  /** Subscription period in days; 0 or absent means a one-off purchase and the mailbox never expires. */
  periodDays?: number;
  /** Renewal price per period; 0 means renew at the sale price. */
  renewPriceCents?: number;
  /** Card (Stripe) price in the smallest unit of the shop currency; 0 or absent means it cannot be bought by card. */
  fiatPriceMinor?: number;
  /**
   * "Use my own domain": how many domains of their own a buyer of this plan may connect from the account page. Absent (old
   * backends, and plans without it) or 0 means none.
   */
  customDomains?: number;
}

/**
 * A plan sold per mailbox (mail's `seatProducts`, docs/storefront-api.md "Seat plans"): the buyer chooses how many, from seatMin to
 * seatMax. Every price field is for ONE seat (per period for a subscription) and `mailboxCount` equals seatMin; an order is
 * priced by mail for the quantity sent with checkout (seatOrderPrice below is the same rule, for the estimate the page shows).
 */
export interface SeatProduct extends ShopProduct {
  seatMin: number;
  seatMax: number;
}

/** The most seats one order or subscription can hold: a redeem code's largest allowance (mail's SEAT_MAX, `redeem.code.maxUses`). */
export const SEAT_MAX = 1000;
/** The most one order can charge, in hundredths (mail's SHOP_PRICE_MAX_CENTS). */
export const SHOP_PRICE_MAX_CENTS = 100_000_000;

/** ldc = Linux DO Credit; stripe = card (Stripe Checkout). */
export type ShopPaymentProvider = "ldc" | "stripe";

export type SubscriptionState = "active" | "grace" | "suspended" | "expired";

export interface ShopCatalog {
  available: boolean;
  /** Whether each of the two payment methods is available; old backends that omit it count as LDC only. */
  payment: { ldc: boolean; stripe: { currency: string } | null };
  products: ShopProduct[];
  /**
   * Plans sold per mailbox, present only while one is on sale. mail lists them apart from `products` because their prices are
   * per seat and their checkout needs a quantity; absent on every backend before seat plans, and the pages then show none.
   */
  seatProducts?: SeatProduct[];
  onboardUrl: string;
  /** Site key when the login form must pass Cloudflare Turnstile; absent means no verification. */
  turnstileSiteKey?: string;
  /**
   * Present (true) while the backend answers POST /api/shop/address, the address check that needs no redeem code
   * (docs/storefront-api.md). Absent while it is switched off in mail's sales settings, while nothing is on sale and on every
   * backend before it: the pages then do not show the check at all.
   */
  addressCheck?: true;
  /**
   * Whether the shop offers discount codes (POST /api/shop/coupon). mail always sends it (mail #221): `true` while something
   * is on sale and at least one code can be used right now, `false` otherwise, which hides the field without a request.
   * Absent only on a mail before the flag: unknown, so the shop offers the field and hides it if the preview answers 404.
   */
  coupons?: boolean;
}

export const shopApiRoot = `${apiBase}/api/shop`;

export class ShopApiError extends Error {
  readonly status: number;
  /**
   * A failed response with a JSON body is an answer from this site's Worker or from mail. Cloudflare's own error pages (Worker threw, CPU limit exceeded) are HTML,
   * meaning the request did not get through the Worker's code.
   */
  readonly answered: boolean;
  /** Seconds until the request may be tried again, from the answer's Retry-After (every 429 of mail's shop API carries it); null when absent. */
  readonly retryAfter: number | null;

  constructor(message: string, status = 0, answered = false, retryAfter: number | null = null) {
    super(message);
    this.name = "ShopApiError";
    this.status = status;
    this.answered = answered;
    this.retryAfter = retryAfter;
  }
}

/*
 * Response validation: every field the components render is checked here one by one and assembled into a new typed object; any unknown shape counts as a failed request,
 * so half-right data never reaches the page (e.g. an unknown currency makes Intl.NumberFormat throw during render and blanks the whole page).
 */

export type Fields = Record<string, unknown>;

export function record(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function oneOf<T extends string>(values: readonly T[]) {
  return (value: unknown): value is T => (values as readonly unknown[]).includes(value);
}

/** Currency of a Stripe amount: a three-letter lower-case ISO 4217 code (as mail stores it); the empty string for LDC orders. */
export function isCurrency(value: unknown): value is string {
  return value === "" || (typeof value === "string" && /^[a-z]{3}$/.test(value));
}

/** A field an old backend may omit: absent, or of the right shape. */
export function optional<T>(value: unknown, check: (value: unknown) => value is T): value is T | undefined {
  return value === undefined || check(value);
}

/** Drops keys whose value is undefined: optional fields an old backend did not return do not appear in the result either. */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

/**
 * The three price fields agree: without a plan discount the original price is the price paid. `couponDiscountCents` is what a
 * discount code took off an order (0 for a plan, and for an order without one): an order without a plan discount may then
 * also carry the price before the code as its original price.
 */
export function validPrice(value: Fields, couponDiscountCents = 0): boolean {
  const { originalPriceCents, discountPercent, priceCents } = value;
  return (
    isCount(originalPriceCents) &&
    originalPriceCents > 0 &&
    isCount(priceCents) &&
    priceCents > 0 &&
    originalPriceCents >= priceCents &&
    isCount(discountPercent) &&
    discountPercent <= 99 &&
    (discountPercent > 0 ||
      originalPriceCents === priceCents ||
      (couponDiscountCents > 0 && originalPriceCents === priceCents + couponDiscountCents))
  );
}

export type Entitlements = Omit<ShopProduct, "id" | "name" | "description">;

/** Price and entitlement fields shared by plans and orders. */
export function parseEntitlements(value: Fields, couponDiscountCents = 0): Entitlements | null {
  const { quotaSupportedByDomain } = value;
  if (
    !validPrice(value, couponDiscountCents) ||
    !isCount(value.mailboxCount) ||
    !isCount(value.quotaMb) ||
    !isCount(value.codeExpiresDays) ||
    !isStrings(value.domains) ||
    !optional(value.periodDays, isCount) ||
    !optional(value.renewPriceCents, isCount) ||
    !optional(value.fiatPriceMinor, isCount) ||
    !optional(value.customDomains, isCount) ||
    !(
      quotaSupportedByDomain === undefined ||
      (record(quotaSupportedByDomain) && Object.values(quotaSupportedByDomain).every(isBoolean))
    )
  )
    return null;
  return {
    originalPriceCents: value.originalPriceCents as number,
    discountPercent: value.discountPercent as number,
    priceCents: value.priceCents as number,
    mailboxCount: value.mailboxCount,
    quotaMb: value.quotaMb,
    quotaSupportedByDomain: quotaSupportedByDomain as Record<string, boolean> | undefined,
    codeExpiresDays: value.codeExpiresDays,
    domains: [...value.domains],
    periodDays: value.periodDays,
    renewPriceCents: value.renewPriceCents,
    fiatPriceMinor: value.fiatPriceMinor,
    // 0 says the same as absent: the pages only ever ask "does this plan include own domains".
    customDomains: value.customDomains || undefined,
  };
}

export function parseProduct(value: unknown): ShopProduct | null {
  if (!record(value) || !isString(value.id) || !isString(value.name) || !isString(value.description)) return null;
  const entitlements = parseEntitlements(value);
  return entitlements && compact({ id: value.id, name: value.name, description: value.description, ...entitlements });
}

/** A seat plan: a product with `kind: "seat"` and a seat range mail itself would accept (1 to SEAT_MAX, min not above max). */
export function parseSeatProduct(value: unknown): SeatProduct | null {
  const product = parseProduct(value);
  if (!product || !record(value) || value.kind !== "seat") return null;
  const { seatMin, seatMax } = value;
  if (!isCount(seatMin) || !isCount(seatMax) || seatMin < 1 || seatMax < seatMin || seatMax > SEAT_MAX) return null;
  return { ...product, seatMin, seatMax };
}

/**
 * What `quantity` seats of a seat plan cost in LDC at purchase, by mail's rule (seatOrderPrice in its pricing.ts): quantity ×
 * the seat's ORIGINAL price, then the plan's discount on the whole order, rounded half up once. Not quantity × the seat's
 * discounted price: 3.33 a seat at 10% off is 20.98 for 7 seats (23.31 × 0.9 = 20.979), not 7 × 3.00.
 * mail prices the order at checkout; this is only the figure the page shows before that, marked as an estimate.
 * null when the total is above what one order can charge (mail refuses that checkout).
 */
export function seatOrderPrice(
  product: Pick<ShopProduct, "originalPriceCents" | "discountPercent">,
  quantity: number,
): { originalPriceCents: number; priceCents: number } | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  const originalPriceCents = product.originalPriceCents * quantity;
  if (!Number.isSafeInteger(originalPriceCents) || originalPriceCents > SHOP_PRICE_MAX_CENTS) return null;
  const priceCents = Math.floor((originalPriceCents * (100 - product.discountPercent) + 50) / 100);
  return priceCents < 1 ? null : { originalPriceCents, priceCents };
}

/** What `quantity` seats cost by card: quantity × the seat's card price, per period for a subscription. null above the payable limit or without a card price. */
export function seatCardPrice(product: Pick<ShopProduct, "fiatPriceMinor">, quantity: number): number | null {
  const total = (product.fiatPriceMinor ?? 0) * quantity;
  return Number.isSafeInteger(quantity) && quantity >= 1 && total >= 1 && total <= SHOP_PRICE_MAX_CENTS ? total : null;
}

/**
 * What `quantity` seats cost by each way of paying the shop offers, each judged on its own: mail refuses an order above what one
 * order can charge per way of paying (the LDC total and the card total are different amounts in different units), so a quantity
 * that is too many for one can still be bought with the other. `ldcTooMany` / `cardTooMany` are true only for a way that is
 * offered and cannot take the quantity; `tooMany` when no offered way can.
 */
export function seatTotals(
  product: Pick<ShopProduct, "originalPriceCents" | "discountPercent" | "fiatPriceMinor">,
  quantity: number,
  offered: { ldc: boolean; card: boolean },
): {
  ldc: { originalPriceCents: number; priceCents: number } | null;
  card: number | null;
  ldcTooMany: boolean;
  cardTooMany: boolean;
  tooMany: boolean;
} {
  const ldc = offered.ldc ? seatOrderPrice(product, quantity) : null;
  const card = offered.card ? seatCardPrice(product, quantity) : null;
  const ldcTooMany = offered.ldc && !ldc;
  const cardTooMany = offered.card && !card;
  return { ldc, card, ldcTooMany, cardTooMany, tooMany: !ldc && !card };
}

/** A quantity typed or stepped to, kept inside the plan's range; anything that is no whole number becomes the minimum. */
export function clampSeats(value: number, plan: Pick<SeatProduct, "seatMin" | "seatMax">): number {
  if (!Number.isFinite(value)) return plan.seatMin;
  return Math.min(plan.seatMax, Math.max(plan.seatMin, Math.trunc(value)));
}

/** Retry-After as whole seconds (mail sends the seconds left in the counter's window); null when absent or not a number. */
function retryAfterSeconds(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

export async function request(
  path: string,
  payload?: unknown,
  signal?: AbortSignal,
  lang?: Lang,
  credentials: RequestCredentials = "same-origin",
): Promise<unknown> {
  const response = await fetch(`${shopApiRoot}/${path}`, {
    method: payload === undefined ? "GET" : "POST",
    mode: "same-origin",
    credentials,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(lang ? { "Accept-Language": lang } : {}),
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ShopApiError(
      record(body) && typeof body.error === "string" ? body.error : "",
      response.status,
      record(body),
      retryAfterSeconds(response),
    );
  }
  return body;
}

/**
 * Checks a catalog response and builds the typed catalog; throws ShopApiError on any unknown shape. The browser client and the pricing
 * page's server-side read (catalog-server.ts) both go through it.
 */
export function parseShopCatalog(body: unknown): ShopCatalog {
  if (!record(body) || !isBoolean(body.available) || !Array.isArray(body.products)) throw new ShopApiError("");
  const products = body.products.map(parseProduct);
  if (!products.every((product): product is ShopProduct => product !== null)) throw new ShopApiError("");
  // Seat plans: absent on a backend without them. Present, they are checked like the fixed plans.
  const seatProducts = body.seatProducts === undefined ? [] : body.seatProducts;
  if (!Array.isArray(seatProducts)) throw new ShopApiError("");
  const seats = seatProducts.map(parseSeatProduct);
  if (!seats.every((product): product is SeatProduct => product !== null)) throw new ShopApiError("");
  const payment = record(body.payment) ? body.payment : null;
  // Card payment with a bad currency cannot show a price, so it counts as off.
  const stripe =
    payment && record(payment.stripe) && isCurrency(payment.stripe.currency) && payment.stripe.currency
      ? { currency: payment.stripe.currency }
      : null;
  return {
    available: body.available,
    payment: {
      ldc: payment ? payment.ldc === true : body.available,
      stripe,
    },
    products,
    ...(seats.length > 0 ? { seatProducts: seats } : {}),
    onboardUrl: isString(body.onboardUrl) ? body.onboardUrl : "",
    ...(isString(body.turnstileSiteKey) && body.turnstileSiteKey.trim()
      ? { turnstileSiteKey: body.turnstileSiteKey.trim() }
      : {}),
    ...(body.addressCheck === true ? { addressCheck: true } : {}),
    ...(isBoolean(body.coupons) ? { coupons: body.coupons } : {}),
  };
}

export async function getShopCatalog(signal?: AbortSignal, lang?: Lang): Promise<ShopCatalog> {
  return parseShopCatalog(await request("catalog", undefined, signal, lang));
}

/** The domains the plans on sale offer, each once, in catalog order: the choices of the address check. */
export function catalogDomains(catalog: Pick<ShopCatalog, "products" | "seatProducts">): string[] {
  return [...new Set(catalogPlans(catalog).flatMap((product) => product.domains))];
}

/** Every plan on sale, fixed plans first and seat plans after them, in catalog order. */
export function catalogPlans(catalog: Pick<ShopCatalog, "products" | "seatProducts">): (ShopProduct | SeatProduct)[] {
  return [...catalog.products, ...(catalog.seatProducts ?? [])];
}

export function isSeatProduct(product: ShopProduct | SeatProduct): product is SeatProduct {
  return "seatMax" in product;
}

export interface AddressAvailability {
  available: boolean;
  /** The normalised address the answer is about. */
  email: string;
}

/**
 * Asks whether an address is free before buying (POST /api/shop/address, docs/storefront-api.md). Unlike the redeem
 * page's check it needs no redeem code, so it carries no cookies. A taken address is a normal answer (`available: false`); an
 * invalid username, an unknown domain, the rate limit and a backend with the check off or without the endpoint (404) throw ShopApiError.
 */
export async function checkAddress(
  domain: string,
  username: string,
  signal?: AbortSignal,
  lang?: Lang,
): Promise<AddressAvailability> {
  const body = await request("address", { domain, username }, signal, lang, "omit");
  if (!record(body) || !isBoolean(body.available) || !isString(body.email)) throw new ShopApiError("");
  return { available: body.available, email: body.email };
}

/**
 * Card amount: the smallest unit written with the currency symbol; an unknown currency falls back to "amount + code" so rendering does not throw.
 * How many decimals the smallest unit stands for comes from the currency itself (2 for USD, 0 for JPY, 3 for KWD), as Intl formats it.
 */
export function formatMoney(minor: number, currency: string, lang?: Lang): string {
  try {
    const format = new Intl.NumberFormat(lang === "en" ? "en" : "zh-CN", {
      style: "currency",
      currency: currency.toUpperCase(),
    });
    return format.format(minor / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2));
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`.trim();
  }
}

export function formatCredits(cents: number): string {
  return (cents / 100).toFixed(2);
}
