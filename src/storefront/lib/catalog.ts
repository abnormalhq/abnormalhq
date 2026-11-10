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
}

/** ldc = Linux DO Credit; stripe = card (Stripe Checkout). */
export type ShopPaymentProvider = "ldc" | "stripe";

export type SubscriptionState = "active" | "grace" | "suspended" | "expired";

export interface ShopCatalog {
  available: boolean;
  /** Whether each of the two payment methods is available; old backends that omit it count as LDC only. */
  payment: { ldc: boolean; stripe: { currency: string } | null };
  products: ShopProduct[];
  onboardUrl: string;
  /** Site key when the login form must pass Cloudflare Turnstile; absent means no verification. */
  turnstileSiteKey?: string;
  /**
   * Present (true) when the backend answers POST /api/shop/address, the address check that needs no redeem code (proposed in
   * docs/storefront-api.md). Absent on every backend before it: the pages then do not show the check at all.
   */
  addressCheck?: true;
}

export const shopApiRoot = `${apiBase}/api/shop`;

export class ShopApiError extends Error {
  readonly status: number;
  /**
   * A failed response with a JSON body is an answer from this site's Worker or from mail. Cloudflare's own error pages (Worker threw, CPU limit exceeded) are HTML,
   * meaning the request did not get through the Worker's code.
   */
  readonly answered: boolean;

  constructor(message: string, status = 0, answered = false) {
    super(message);
    this.name = "ShopApiError";
    this.status = status;
    this.answered = answered;
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

export function validPrice(value: Fields): boolean {
  const { originalPriceCents, discountPercent, priceCents } = value;
  return (
    isCount(originalPriceCents) &&
    originalPriceCents > 0 &&
    isCount(priceCents) &&
    priceCents > 0 &&
    originalPriceCents >= priceCents &&
    isCount(discountPercent) &&
    discountPercent <= 99 &&
    (discountPercent > 0 || originalPriceCents === priceCents)
  );
}

export type Entitlements = Omit<ShopProduct, "id" | "name" | "description">;

/** Price and entitlement fields shared by plans and orders. */
export function parseEntitlements(value: Fields): Entitlements | null {
  const { quotaSupportedByDomain } = value;
  if (
    !validPrice(value) ||
    !isCount(value.mailboxCount) ||
    !isCount(value.quotaMb) ||
    !isCount(value.codeExpiresDays) ||
    !isStrings(value.domains) ||
    !optional(value.periodDays, isCount) ||
    !optional(value.renewPriceCents, isCount) ||
    !optional(value.fiatPriceMinor, isCount) ||
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
  };
}

export function parseProduct(value: unknown): ShopProduct | null {
  if (!record(value) || !isString(value.id) || !isString(value.name) || !isString(value.description)) return null;
  const entitlements = parseEntitlements(value);
  return entitlements && compact({ id: value.id, name: value.name, description: value.description, ...entitlements });
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
    onboardUrl: isString(body.onboardUrl) ? body.onboardUrl : "",
    ...(isString(body.turnstileSiteKey) && body.turnstileSiteKey.trim()
      ? { turnstileSiteKey: body.turnstileSiteKey.trim() }
      : {}),
    ...(body.addressCheck === true ? { addressCheck: true } : {}),
  };
}

export async function getShopCatalog(signal?: AbortSignal, lang?: Lang): Promise<ShopCatalog> {
  return parseShopCatalog(await request("catalog", undefined, signal, lang));
}

/** The domains the plans on sale offer, each once, in catalog order: the choices of the address check. */
export function catalogDomains(catalog: Pick<ShopCatalog, "products">): string[] {
  return [...new Set(catalog.products.flatMap((product) => product.domains))];
}

export interface AddressAvailability {
  available: boolean;
  /** The normalised address the answer is about. */
  email: string;
}

/**
 * Asks whether an address is free before buying (POST /api/shop/address, proposed in docs/storefront-api.md). Unlike the redeem
 * page's check it needs no redeem code, so it carries no cookies. A taken address is a normal answer (`available: false`); an
 * invalid username, an unknown domain, the rate limit and a backend without the endpoint (404) throw ShopApiError.
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
