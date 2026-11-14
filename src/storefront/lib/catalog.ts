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
   * USDT (TRC-20) price in hundredths of a USDT; 0 or absent (every mail before USDT) means it cannot be bought with USDT. Like a
   * card price it carries no plan discount. Absent from the parsed plan when mail did not send it.
   */
  usdtPriceMinor?: number;
  /**
   * "Use my own domain": how many domains of their own a buyer of this plan may connect from the account page. Absent (old
   * backends, and plans without it) or 0 means none.
   */
  customDomains?: number;
}

/**
 * A plan sold per mailbox (mail's `seatProducts`, docs/storefront-api.md "Seat plans"): the buyer chooses how many, from
 * `minQuantity` to `maxQuantity`, and mail prices the order for the quantity (its quote says the total before checkout).
 *
 * The fields below are what a buyer page needs of a seat plan, as mail says them outright since contract version 3
 * (`shop.seats.planFields` in docs/onboard-contract.json). A mail before them publishes the same facts under the fixed-plan
 * names (`seatMin`, `seatMax`, and the price fields of ShopProduct, which are for ONE seat on a seat plan); parseSeatProduct
 * reads the explicit fields and falls back to those, so the pages only ever read the names here. The ShopProduct price
 * fields of a parsed seat plan carry the same per-seat numbers. `mailboxCount` of a seat plan equals its minimum.
 */
export interface SeatProduct extends ShopProduct {
  /** The range of the quantity field. */
  minQuantity: number;
  maxQuantity: number;
  /** One seat before and after the plan's discount, in hundredths of an LDC. */
  unitOriginalPriceCents: number;
  unitPriceCents: number;
  /** One seat per later period: the plan's renewal price, or its discounted price when it has none; 0 for a one-time plan. */
  unitRenewPriceCents: number;
  /** One seat with a card, in the smallest unit of the shop currency; 0 when the plan cannot be bought with a card. */
  unitFiatPriceMinor: number;
  /**
   * One seat with USDT, in hundredths of a USDT; 0 when the plan cannot be bought with USDT. Absent, like `usdtPriceMinor`, when
   * mail sent neither (a mail before USDT).
   */
  unitUsdtPriceMinor?: number;
}

/** How a plan is sold, in the public words of the contract (`shop.planKinds`): a set of mailboxes at one price, or by the seat. */
export const PLAN_KINDS = ["fixed", "seats"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

/** The most seats one order or subscription can hold: a redeem code's largest allowance (mail's SEAT_MAX, `shop.seats.maxQuantity`). */
export const SEAT_MAX = 1000;
/**
 * The most one order can charge (mail's SHOP_PRICE_MAX_CENTS, `shop.seats.maxTotalCents`): one number for every way of
 * paying, counted in the unit that way charges in (hundredths of an LDC, or the smallest unit of the card currency).
 */
export const SHOP_PRICE_MAX_CENTS = 100_000_000;

/** ldc = Linux DO Credit; stripe = card (Stripe Checkout); usdt = USDT (TRC-20) on TRON, sent to an address of the order's own. */
export type ShopPaymentProvider = "ldc" | "stripe" | "usdt";

/** The currency string of every USDT amount (`shop.usdt.currency`): amounts are hundredths of a USDT. */
export const USDT_CURRENCY = "usdt";
/** The TRON networks mail takes USDT on (`shop.usdt.networks`): nile is TRON's testnet. */
export const USDT_NETWORKS = ["mainnet", "nile"] as const;
export type UsdtNetwork = (typeof USDT_NETWORKS)[number];
/** A TRON address in base58check: `T` and 33 more characters of the base58 alphabet (no 0, O, I or l). */
export const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

/** USDT as the catalog offers it: the network and the token contract it is paid on. */
export interface UsdtPayment {
  currency: typeof USDT_CURRENCY;
  network: UsdtNetwork;
  contract: string;
}

export type SubscriptionState = "active" | "grace" | "suspended" | "expired";

export interface ShopCatalog {
  trial?: { days: number; quotaMb: number };
  available: boolean;
  /**
   * Whether each payment method is available; old backends that omit it count as LDC only. `usdt` is absent while USDT is not
   * offered (and on every mail before it).
   */
  payment: { ldc: boolean; stripe: { currency: string } | null; usdt?: UsdtPayment };
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

/**
 * The refusals of mail's shop API that carry a stable code, with the status of each (`shop.refusalCodes` in
 * docs/onboard-contract.json, mail's SHOP_REFUSAL_CODES). Such a refusal answers `{ error, code, messages: { zh, en },
 * ...details }`: `code` is what the pages branch on, `messages` the buyer-facing text in both languages, and the details are
 * numbers only (`min` and `max` of a plan's range, `maxTotalCents`, and `index` where the request listed several plans). Every other refusal answers `{ error }` only, as all of
 * them did before contract version 3.
 */
export const REFUSAL_CODES = {
  seat_quantity_invalid: 400,
  seat_quantity_out_of_range: 400,
  seat_total_too_large: 400,
  coupon_invalid: 400,
  product_unavailable: 409,
  domain_not_found: 404,
  domain_ownership_not_found: 409,
  domain_ownership_expired: 409,
  domain_dns_lookup_failed: 409,
  domain_already_verified: 409,
  domain_verification_refused: 409,
  domain_unavailable: 503,
} as const;
export type RefusalCode = keyof typeof REFUSAL_CODES;

/** What a coded refusal carries next to `error`; all empty for a refusal without a code. */
export interface ShopRefusal {
  /** The code as mail sent it. A code this storefront does not know yet is kept: its text is still shown. */
  code: string | null;
  /** The buyer-facing text per page language (`shop.refusalLanguages`); a language mail did not send is absent. */
  messages: Readonly<Partial<Record<Lang, string>>>;
  /** The numbers next to the code, by name. */
  details: Readonly<Record<string, number>>;
}

const NO_REFUSAL: ShopRefusal = { code: null, messages: {}, details: {} };
const REFUSAL_FIELDS = ["error", "code", "messages"];

/**
 * Reads the code, the two texts and the numeric details of a failed answer. A body without a `code` (every refusal of a
 * mail before coded refusals, and most refusals of any mail) reads as no refusal, and the page shows `error` as it always did.
 */
export function parseRefusal(body: unknown): ShopRefusal {
  if (!record(body) || typeof body.code !== "string" || !body.code) return NO_REFUSAL;
  const messages: Partial<Record<Lang, string>> = {};
  if (record(body.messages)) {
    for (const lang of ["zh", "en"] as const) {
      const text = body.messages[lang];
      if (typeof text === "string" && text.trim()) messages[lang] = text;
    }
  }
  const details: Record<string, number> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!REFUSAL_FIELDS.includes(key) && typeof value === "number" && Number.isSafeInteger(value)) details[key] = value;
  }
  return { code: body.code, messages, details };
}

export class ShopApiError extends Error {
  readonly status: number;
  /**
   * A failed response with a JSON body is an answer from this site's Worker or from mail. Cloudflare's own error pages (Worker threw, CPU limit exceeded) are HTML,
   * meaning the request did not get through the Worker's code.
   */
  readonly answered: boolean;
  /** Seconds until the request may be tried again, from the answer's Retry-After (every 429 of mail's shop API carries it); null when absent. */
  readonly retryAfter: number | null;
  /** The stable code of a coded refusal (REFUSAL_CODES); null for every other failure. */
  readonly code: string | null;
  /** A coded refusal's text in both page languages; shopError shows the page's own. */
  readonly messages: Readonly<Partial<Record<Lang, string>>>;
  /** A coded refusal's numbers (`min`, `max`, `maxTotalCents`). */
  readonly details: Readonly<Record<string, number>>;

  constructor(
    message: string,
    status = 0,
    answered = false,
    retryAfter: number | null = null,
    refusal: ShopRefusal = NO_REFUSAL,
  ) {
    super(message);
    this.name = "ShopApiError";
    this.status = status;
    this.answered = answered;
    this.retryAfter = retryAfter;
    this.code = refusal.code;
    this.messages = refusal.messages;
    this.details = refusal.details;
  }
}

/** Whether a failure is the coded refusal `code`. */
export function isRefusal(error: unknown, code: RefusalCode): error is ShopApiError {
  return error instanceof ShopApiError && error.code === code;
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

/** A card currency: a three-letter lower-case ISO 4217 code, as mail stores it. */
export function isFiatCurrency(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]{3}$/.test(value);
}

/**
 * Currency of an amount: a card currency (isFiatCurrency), "usdt" for a USDT amount (hundredths of a USDT; not ISO 4217, hence
 * four letters), or the empty string for LDC.
 */
export function isCurrency(value: unknown): value is string {
  return value === "" || value === USDT_CURRENCY || isFiatCurrency(value);
}

/**
 * Whether an amount's currency is the one its way of paying counts in: none for LDC, a card currency for Stripe, "usdt" for USDT.
 * An amount whose currency says otherwise cannot be shown, so an answer carrying one is not used.
 */
export function currencyFits(provider: ShopPaymentProvider, currency: unknown): currency is string {
  return provider === "ldc"
    ? currency === ""
    : provider === "usdt"
      ? currency === USDT_CURRENCY
      : isFiatCurrency(currency);
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
export function parseEntitlements(value: Fields, couponDiscountCents = 0, freeTrial = false): Entitlements | null {
  const { quotaSupportedByDomain } = value;
  if (
    !(
      validPrice(value, couponDiscountCents) ||
      (freeTrial &&
        value.priceCents === 0 &&
        value.originalPriceCents === 0 &&
        value.discountPercent === 0 &&
        couponDiscountCents === 0)
    ) ||
    !isCount(value.mailboxCount) ||
    !isCount(value.quotaMb) ||
    !isCount(value.codeExpiresDays) ||
    !isStrings(value.domains) ||
    !optional(value.periodDays, isCount) ||
    !optional(value.renewPriceCents, isCount) ||
    !optional(value.fiatPriceMinor, isCount) ||
    !optional(value.usdtPriceMinor, isCount) ||
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
    usdtPriceMinor: value.usdtPriceMinor,
    // 0 says the same as absent: the pages only ever ask "does this plan include own domains".
    customDomains: value.customDomains || undefined,
  };
}

export function parseProduct(value: unknown): ShopProduct | null {
  if (!record(value) || !isString(value.id) || !isString(value.name) || !isString(value.description)) return null;
  const entitlements = parseEntitlements(value);
  return entitlements && compact({ id: value.id, name: value.name, description: value.description, ...entitlements });
}

/**
 * A seat plan. mail says the kind twice: `planKind: "seats"` (the public word, since contract version 3) and `kind: "seat"`
 * (the stored word, which a mail before version 3 sends alone); either marks a seat plan, and a `planKind` that says
 * anything else does not. The range and the prices of one seat are read from the explicit fields (`minQuantity`,
 * `maxQuantity`, `unit…`) and, where a mail before them sends none, from the fields that have always carried the same
 * numbers (`seatMin`, `seatMax` and the plan's own price fields). A field that is present must be usable: a range mail
 * itself would accept (1 to SEAT_MAX, min not above max) and prices that agree like any plan's.
 */
export function parseSeatProduct(value: unknown): SeatProduct | null {
  const product = parseProduct(value);
  if (!product || !record(value)) return null;
  if (value.planKind === undefined ? value.kind !== "seat" : value.planKind !== "seats") return null;
  const minQuantity = value.minQuantity === undefined ? value.seatMin : value.minQuantity;
  const maxQuantity = value.maxQuantity === undefined ? value.seatMax : value.maxQuantity;
  if (
    !isCount(minQuantity) ||
    !isCount(maxQuantity) ||
    minQuantity < 1 ||
    maxQuantity < minQuantity ||
    maxQuantity > SEAT_MAX
  )
    return null;
  const {
    unitOriginalPriceCents = product.originalPriceCents,
    unitPriceCents = product.priceCents,
    // A mail before the field: the plan's renewal price, or its discounted price when it has none; a one-time plan renews at nothing.
    unitRenewPriceCents = product.periodDays ? product.renewPriceCents || product.priceCents : 0,
    unitFiatPriceMinor = product.fiatPriceMinor ?? 0,
    // Absent with `usdtPriceMinor` on a mail before USDT: the plan then has no USDT price at all.
    unitUsdtPriceMinor = product.usdtPriceMinor,
  } = value;
  if (
    !validPrice({
      originalPriceCents: unitOriginalPriceCents,
      discountPercent: product.discountPercent,
      priceCents: unitPriceCents,
    }) ||
    !isCount(unitRenewPriceCents) ||
    !isCount(unitFiatPriceMinor) ||
    !optional(unitUsdtPriceMinor, isCount)
  )
    return null;
  return {
    ...product,
    // The plan's own price fields are for one seat too, and say what the explicit fields say: where the two disagree the
    // explicit ones win, so whatever reads a seat plan as a plan (the price line, the details, the pricing page) shows them.
    originalPriceCents: unitOriginalPriceCents as number,
    priceCents: unitPriceCents as number,
    renewPriceCents: unitRenewPriceCents,
    fiatPriceMinor: unitFiatPriceMinor,
    minQuantity,
    maxQuantity,
    unitOriginalPriceCents: unitOriginalPriceCents as number,
    unitPriceCents: unitPriceCents as number,
    unitRenewPriceCents,
    unitFiatPriceMinor,
    ...(unitUsdtPriceMinor === undefined ? {} : { usdtPriceMinor: unitUsdtPriceMinor, unitUsdtPriceMinor }),
  };
}

/** One seat's prices, as the estimates below read them: a catalog seat plan, or the fixed-plan names an upgrade plan of the renewal page carries. */
type SeatPrices =
  | Pick<SeatProduct, "unitOriginalPriceCents" | "discountPercent">
  | Pick<ShopProduct, "originalPriceCents" | "discountPercent">;

/**
 * What `quantity` seats of a seat plan cost in LDC at purchase, by mail's rule (seatOrderPrice in its pricing.ts): quantity ×
 * the seat's ORIGINAL price, then the plan's discount on the whole order, rounded half up once. Not quantity × the seat's
 * discounted price: 3.33 a seat at 10% off is 20.98 for 7 seats (23.31 × 0.9 = 20.979), not 7 × 3.00.
 *
 * This is the FALLBACK, for a mail before POST /api/shop/quote and for the moments a quote is not there (still loading, the
 * rate limit, a failed request): with a quote the pages show mail's own total and work out no money (quote.ts). What is
 * shown from here is marked as an estimate, and mail prices the order at checkout either way.
 * null when the total is above what one order can charge (`maxTotalCents`: mail refuses that checkout).
 */
export function seatOrderPrice(
  product: SeatPrices,
  quantity: number,
  maxTotalCents: number = SHOP_PRICE_MAX_CENTS,
): { originalPriceCents: number; priceCents: number } | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  const unit = "unitOriginalPriceCents" in product ? product.unitOriginalPriceCents : product.originalPriceCents;
  const originalPriceCents = unit * quantity;
  if (!Number.isSafeInteger(originalPriceCents) || originalPriceCents > maxTotalCents) return null;
  const priceCents = Math.floor((originalPriceCents * (100 - product.discountPercent) + 50) / 100);
  return priceCents < 1 ? null : { originalPriceCents, priceCents };
}

/** What `quantity` seats cost by card: quantity × the seat's card price, per period for a subscription. null above the payable limit or without a card price. The fallback, like seatOrderPrice. */
export function seatCardPrice(
  product: Pick<SeatProduct, "unitFiatPriceMinor"> | Pick<ShopProduct, "fiatPriceMinor">,
  quantity: number,
  maxTotalCents: number = SHOP_PRICE_MAX_CENTS,
): number | null {
  const unit = "unitFiatPriceMinor" in product ? product.unitFiatPriceMinor : (product.fiatPriceMinor ?? 0);
  const total = unit * quantity;
  return Number.isSafeInteger(quantity) && quantity >= 1 && total >= 1 && total <= maxTotalCents ? total : null;
}

/**
 * What `quantity` seats cost with USDT: quantity × the seat's USDT price (hundredths of a USDT, per period for a subscription; no
 * plan discount, like a card). null above the payable limit or without a USDT price. The fallback, like seatOrderPrice.
 */
export function seatUsdtPrice(
  product: Pick<SeatProduct, "unitUsdtPriceMinor"> | Pick<ShopProduct, "usdtPriceMinor">,
  quantity: number,
  maxTotalCents: number = SHOP_PRICE_MAX_CENTS,
): number | null {
  const unit =
    ("unitUsdtPriceMinor" in product ? product.unitUsdtPriceMinor : undefined) ??
    ("usdtPriceMinor" in product ? product.usdtPriceMinor : undefined) ??
    0;
  const total = unit * quantity;
  return Number.isSafeInteger(quantity) && quantity >= 1 && total >= 1 && total <= maxTotalCents ? total : null;
}

/**
 * What `quantity` seats cost by each way of paying the shop offers, each judged on its own: mail refuses an order above what one
 * order can charge per way of paying (the LDC, card and USDT totals are different amounts in different units), so a quantity
 * that is too many for one can still be bought with another. `ldcTooMany` / `cardTooMany` / `usdtTooMany` are true only for a
 * way that is offered and cannot take the quantity; `tooMany` when no offered way can. The fallback, like seatOrderPrice.
 */
export function seatTotals(
  product: SeatPrices &
    (Pick<SeatProduct, "unitFiatPriceMinor"> | Pick<ShopProduct, "fiatPriceMinor">) &
    Partial<Pick<SeatProduct, "unitUsdtPriceMinor" | "usdtPriceMinor">>,
  quantity: number,
  offered: { ldc: boolean; card: boolean; usdt?: boolean },
  maxTotalCents: number = SHOP_PRICE_MAX_CENTS,
): {
  ldc: { originalPriceCents: number; priceCents: number } | null;
  card: number | null;
  usdt: number | null;
  ldcTooMany: boolean;
  cardTooMany: boolean;
  usdtTooMany: boolean;
  tooMany: boolean;
} {
  const ldc = offered.ldc ? seatOrderPrice(product, quantity, maxTotalCents) : null;
  const card = offered.card ? seatCardPrice(product, quantity, maxTotalCents) : null;
  const usdt = offered.usdt ? seatUsdtPrice(product, quantity, maxTotalCents) : null;
  const ldcTooMany = offered.ldc && !ldc;
  const cardTooMany = offered.card && !card;
  const usdtTooMany = Boolean(offered.usdt) && !usdt;
  return { ldc, card, usdt, ldcTooMany, cardTooMany, usdtTooMany, tooMany: !ldc && !card && !usdt };
}

/** The range of a quantity field: a catalog seat plan's, or the old names an upgrade plan of the renewal page carries. */
type SeatRange = Pick<SeatProduct, "minQuantity" | "maxQuantity"> | { seatMin: number; seatMax: number };

/** A quantity typed or stepped to, kept inside the plan's range; anything that is no whole number becomes the minimum. */
export function clampSeats(value: number, plan: SeatRange): number {
  const [min, max] = "minQuantity" in plan ? [plan.minQuantity, plan.maxQuantity] : [plan.seatMin, plan.seatMax];
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Retry-After as whole seconds (mail sends the seconds left in the counter's window); null when absent or not a number. */
function retryAfterSeconds(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

/** The fetch options of a shop API request; the shop page's early catalog request (earlyCatalogScript) sends the same. */
function requestInit(payload: unknown, lang: Lang | undefined, credentials: RequestCredentials): RequestInit {
  return {
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
  };
}

/**
 * The body of a shop API answer; a refusal throws ShopApiError. `signal`: the request's own. A body cut off by it (the timeout,
 * or the caller's abort) throws that reason rather than passing for an empty answer, so a timeout mid-body is still a timeout to
 * the callers that ask again after one.
 */
async function readAnswer(response: Response, lang?: Lang, signal?: AbortSignal): Promise<unknown> {
  const body: unknown = await response.json().catch((error: unknown) => {
    if (signal?.aborted) throw signal.reason ?? error;
    return null;
  });
  if (!response.ok) {
    const refusal = parseRefusal(body);
    throw new ShopApiError(
      // A coded refusal says its text in both languages: the page's own is the one to show, whatever language `error` came in.
      (lang && refusal.messages[lang]) || (record(body) && typeof body.error === "string" ? body.error : ""),
      response.status,
      record(body),
      retryAfterSeconds(response),
      refusal,
    );
  }
  return body;
}

/**
 * How long a shop API request may take, answer included, before it fails with a TimeoutError. The order page's polling only asks
 * again once a request has settled, so one request that never ends would otherwise stop it for good.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The caller's signal and the timeout as one signal. A timeout is not the caller's abort: the caller's own signal stays unaborted,
 * so pollers that tell an unmount by it count a timeout as one more failed request and ask again.
 */
function withTimeout(signal?: AbortSignal): { signal: AbortSignal; release: () => void } {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal) return { signal: timeout, release: () => {} };
  if (typeof AbortSignal.any === "function") return { signal: AbortSignal.any([signal, timeout]), release: () => {} };
  // Safari before 17.4 (the supported browsers go back to 16.4) has no AbortSignal.any: one controller follows both. Its
  // listeners are taken off again once the request is over: a poller passes the same signal to every request of a round.
  const both = new AbortController();
  const links = [signal, timeout].map((source) => ({ source, forward: () => both.abort(source.reason) }));
  const release = () => {
    for (const { source, forward } of links) source.removeEventListener("abort", forward);
  };
  for (const { source, forward } of links) {
    if (source.aborted) both.abort(source.reason);
    else source.addEventListener("abort", forward, { once: true });
  }
  return { signal: both.signal, release };
}

export async function request(
  path: string,
  payload?: unknown,
  signal?: AbortSignal,
  lang?: Lang,
  credentials: RequestCredentials = "same-origin",
): Promise<unknown> {
  // The timeout covers the body as well: it is released only once the answer has been read.
  const limit = withTimeout(signal);
  try {
    const response = await fetch(`${shopApiRoot}/${path}`, {
      ...requestInit(payload, lang, credentials),
      signal: limit.signal,
    });
    return await readAnswer(response, lang, limit.signal);
  } finally {
    limit.release();
  }
}

/**
 * Checks a catalog response and builds the typed catalog; throws ShopApiError on any unknown shape. The browser client and the pricing
 * page's server-side read (catalog-server.ts) both go through it.
 */
export function parseShopCatalog(body: unknown): ShopCatalog {
  if (!record(body) || !isBoolean(body.available) || !Array.isArray(body.products)) throw new ShopApiError("");
  // A fixed plan says how it is sold since contract version 3 (`planKind: "fixed"`; a mail before it sends none). An entry
  // that says anything else is not one this list can show: its prices would be read as a whole plan's.
  const products = body.products.map((product: unknown) =>
    record(product) && product.planKind !== undefined && product.planKind !== "fixed" ? null : parseProduct(product),
  );
  if (!products.every((product): product is ShopProduct => product !== null)) throw new ShopApiError("");
  // Seat plans: absent on a backend without them. Present, they are checked like the fixed plans.
  const seatProducts = body.seatProducts === undefined ? [] : body.seatProducts;
  if (!Array.isArray(seatProducts)) throw new ShopApiError("");
  const seats = seatProducts.map(parseSeatProduct);
  if (!seats.every((product): product is SeatProduct => product !== null)) throw new ShopApiError("");
  const payment = record(body.payment) ? body.payment : null;
  // Card payment with a bad currency cannot show a price, so it counts as off.
  const stripe =
    payment && record(payment.stripe) && isFiatCurrency(payment.stripe.currency)
      ? { currency: payment.stripe.currency }
      : null;
  const usdt = payment ? parseUsdtPayment(payment.usdt) : null;
  return {
    available: body.available,
    payment: {
      ldc: payment ? payment.ldc === true : body.available,
      stripe,
      ...(usdt ? { usdt } : {}),
    },
    products,
    ...(seats.length > 0 ? { seatProducts: seats } : {}),
    onboardUrl: isString(body.onboardUrl) ? body.onboardUrl : "",
    ...(isString(body.turnstileSiteKey) && body.turnstileSiteKey.trim()
      ? { turnstileSiteKey: body.turnstileSiteKey.trim() }
      : {}),
    ...(body.addressCheck === true ? { addressCheck: true } : {}),
    ...(isBoolean(body.coupons) ? { coupons: body.coupons } : {}),
    ...(record(body.trial) &&
    isCount(body.trial.days) &&
    body.trial.days >= 1 &&
    body.trial.days <= 30 &&
    isCount(body.trial.quotaMb)
      ? { trial: { days: body.trial.days, quotaMb: body.trial.quotaMb } }
      : {}),
  };
}

/**
 * The catalog's `payment.usdt` (`shop.usdt.catalogFields`): null when absent or null (USDT off, or a mail before it), and when it
 * is not usable (an unknown network, a contract that is no TRON address), which counts as off like a card with a bad currency.
 */
function parseUsdtPayment(value: unknown): UsdtPayment | null {
  if (
    !record(value) ||
    value.currency !== USDT_CURRENCY ||
    !(USDT_NETWORKS as readonly unknown[]).includes(value.network) ||
    !isString(value.contract) ||
    !TRON_ADDRESS.test(value.contract)
  )
    return null;
  return { currency: USDT_CURRENCY, network: value.network as UsdtNetwork, contract: value.contract };
}

export async function getShopCatalog(signal?: AbortSignal, lang?: Lang): Promise<ShopCatalog> {
  return parseShopCatalog(await request("catalog", undefined, signal, lang));
}

/** Where earlyCatalogScript leaves its request: the language it asked in and the answer (null when the request failed). */
const earlyCatalogKey = "__abnormalShopCatalog";
type EarlyCatalog = { lang: string; response: Promise<Response | null> };

/**
 * An inline script for the shop page's HTML that starts the catalog request while the page is still being parsed: the plans
 * would otherwise wait for every script of the page to download and for React to hydrate before the request even starts.
 * The request is the one getShopCatalog sends (same address and options); takeEarlyCatalog hands its answer to the page.
 */
export function earlyCatalogScript(lang: Lang): string {
  const { method, mode, credentials, cache, headers } = requestInit(undefined, lang, "same-origin");
  const init = JSON.stringify({ method, mode, credentials, cache, headers });
  const early = `{lang:${JSON.stringify(lang)},response:fetch(${JSON.stringify(`${shopApiRoot}/catalog`)},${init}).catch(function(){return null})}`;
  return `window.${earlyCatalogKey}=${early};`;
}

/**
 * The catalog the early request (earlyCatalogScript) fetched for this language, once: a retry, another language or a page
 * without the script gets null and asks itself. When the early request failed to reach the server, it is asked again here.
 */
export function takeEarlyCatalog(lang: Lang, signal?: AbortSignal): Promise<ShopCatalog> | null {
  const scope = globalThis as { [earlyCatalogKey]?: EarlyCatalog };
  const early = scope[earlyCatalogKey];
  if (!early || early.lang !== lang) return null;
  delete scope[earlyCatalogKey];
  return early.response.then(async (response) =>
    response ? parseShopCatalog(await readAnswer(response, lang)) : getShopCatalog(signal, lang),
  );
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
  return "maxQuantity" in product;
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

/** A USDT amount from hundredths of a USDT: "12.34 USDT". Two decimals and the token's name, never Intl's currency style (USDT is not ISO 4217). */
export function formatUsdt(cents: number): string {
  return `${(cents / 100).toFixed(2)} USDT`;
}

/**
 * An amount in the unit its way of paying counts in: "7.50 LDC", the card currency as Intl writes it, or "12.34 USDT". A card
 * amount without its currency cannot be read and gives "" (the pages then show none rather than a guessed one).
 */
export function formatAmount(
  cents: number,
  provider: ShopPaymentProvider | undefined,
  currency: string | undefined,
  lang?: Lang,
): string {
  if (provider === "usdt") return formatUsdt(cents);
  if (provider === "stripe") return currency ? formatMoney(cents, currency, lang) : "";
  return `${formatCredits(cents)} LDC`;
}
