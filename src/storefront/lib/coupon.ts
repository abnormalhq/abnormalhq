/**
 * Discount codes on the shop pages, apart from the API clients (shop.ts): what was typed as mail will read it, and what an
 * order page can say about the code of an order.
 *
 * mail prices an order with its code but does not publish the code or what it took off with the order yet (see "Proposed"
 * in docs/storefront-api.md): an order with a code and no plan discount even comes back with its original price equal to the
 * price paid. So that the order page can still show the discount, the shop page remembers, per order it creates with a code,
 * the code and the price before it, in this tab's sessionStorage: paying leaves the site and comes back (Credit or Stripe),
 * which page state does not survive. The order page compares that price with what the order actually costs; the difference
 * is what the code took off. It is only ever shown, never sent anywhere, and ends with the tab. Once mail publishes
 * `couponCode` and `couponDiscountCents`, those win and nothing needs to be remembered.
 * This file must not use TypeScript syntax Node cannot run directly; tests run it as is.
 */

/** mail reads at most this much of a code (couponFrom in its route.ts); real codes are 3 to 32 characters. */
export const COUPON_MAX_LENGTH = 64;
export const COUPON_STORAGE_KEY = "abnormal-coupon";
/** Orders remembered at once: a buyer rarely has more than one unpaid order with a code open in a tab. */
const REMEMBERED_ORDERS = 5;
const ORDER_ID = /^[a-z0-9]{15}$/;

/** A code as typed, ready to send: trimmed; "" when there is none. mail upper-cases it itself. */
export function normalizeCoupon(raw: string): string {
  return raw.trim().slice(0, COUPON_MAX_LENGTH);
}

export interface CouponHint {
  orderId: string;
  /** The code as shown: upper-case, like mail stores it. */
  code: string;
  /** What the order would have cost without the code, in the unit of the order's priceCents. */
  baseCents: number;
}

/** What the order page shows about an order's code. */
export interface OrderCoupon {
  /** "" when mail says a code was used without naming it. */
  code: string;
  discountCents: number;
  /** The price before the code. */
  baseCents: number;
}

function isHint(value: unknown): value is CouponHint {
  if (typeof value !== "object" || value === null) return false;
  const { orderId, code, baseCents } = value as Record<string, unknown>;
  return (
    typeof orderId === "string" &&
    ORDER_ID.test(orderId) &&
    typeof code === "string" &&
    code.length > 0 &&
    code.length <= COUPON_MAX_LENGTH &&
    typeof baseCents === "number" &&
    Number.isSafeInteger(baseCents) &&
    baseCents > 0
  );
}

/** Storage can be blocked (private modes, embedded contexts): the order page then shows the price without the breakdown. */
function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readHints(): CouponHint[] {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(COUPON_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isHint) : [];
  } catch {
    return [];
  }
}

/** Called by the shop page once checkout accepted an order with a code. */
export function rememberCoupon(hint: CouponHint): void {
  if (!isHint(hint)) return;
  try {
    const others = readHints().filter((item) => item.orderId !== hint.orderId);
    storage()?.setItem(COUPON_STORAGE_KEY, JSON.stringify([...others, hint].slice(-REMEMBERED_ORDERS)));
  } catch {
    // A full or blocked storage only means the order page shows no breakdown.
  }
}

export function recallCoupon(orderId: string): CouponHint | null {
  return readHints().find((item) => item.orderId === orderId) ?? null;
}

/**
 * The code of a purchase order and what it took off, or null when there is nothing to show. mail's own fields win; without
 * them the remembered price before the code is compared with the price of the order, and counts only when the order really is
 * cheaper (an order mail priced at or above it had no code applied, whatever was typed).
 */
export function orderCoupon(
  order: {
    id: string;
    kind?: "purchase" | "renewal";
    priceCents: number;
    originalPriceCents: number;
    discountPercent: number;
    provider?: "ldc" | "stripe";
    couponCode?: string;
    couponDiscountCents?: number;
  },
  hint: CouponHint | null,
): OrderCoupon | null {
  // A code never applies to a renewal order.
  if (order.kind === "renewal") return null;
  if (order.couponDiscountCents && order.couponDiscountCents > 0) {
    return {
      code: order.couponCode ?? "",
      discountCents: order.couponDiscountCents,
      baseCents: order.priceCents + order.couponDiscountCents,
    };
  }
  if (!hint || hint.orderId !== order.id || hint.baseCents <= order.priceCents) return null;
  // An LDC order with a plan discount still carries its original price: the price before the code cannot be above it.
  if (order.provider !== "stripe" && order.discountPercent > 0 && hint.baseCents >= order.originalPriceCents)
    return null;
  return { code: hint.code, discountCents: hint.baseCents - order.priceCents, baseCents: hint.baseCents };
}
