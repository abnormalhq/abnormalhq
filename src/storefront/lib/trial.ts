import { SHOP_PRICE_MAX_CENTS, isCount, isString, isStrings, record, request, ShopApiError } from "./catalog.ts";
import type { Lang } from "../i18n.ts";

export type TrialOffer =
  | { claimed: true; orderId: string }
  | { claimed: false; days: number; quotaMb: number; domains: string[]; productName: string };

/**
 * The account's free trial offer; null when there is none. A backend without the route (a mail before free trials, and the
 * dev mock) answers 404, which reads the same: the account page then shows nothing about a trial rather than an error.
 */
export async function getTrial(signal: AbortSignal, lang: Lang): Promise<TrialOffer | null> {
  let body: unknown;
  try {
    body = await request("account/trial", undefined, signal, lang);
  } catch (error) {
    if (error instanceof ShopApiError && error.status === 404) return null;
    throw error;
  }
  if (!record(body)) throw new ShopApiError("");
  const value = body.trial;
  if (value === null) return null;
  if (!record(value)) throw new ShopApiError("");
  if (value.claimed === true && isString(value.orderId) && /^[a-z0-9]{15}$/.test(value.orderId))
    return { claimed: true, orderId: value.orderId };
  if (
    value.claimed === false &&
    isCount(value.days) &&
    value.days >= 1 &&
    value.days <= 30 &&
    isCount(value.quotaMb) &&
    isStrings(value.domains) &&
    isString(value.productName)
  )
    return {
      claimed: false,
      days: value.days,
      quotaMb: value.quotaMb,
      domains: value.domains,
      productName: value.productName,
    };
  throw new ShopApiError("");
}

export async function claimTrial(lang: Lang): Promise<string> {
  const body = await request("account/trial", {}, undefined, lang);
  if (!record(body) || !isString(body.orderId) || !/^[a-z0-9]{15}$/.test(body.orderId)) throw new ShopApiError("");
  return body.orderId;
}

/** Maximum payable periods for one payment method, before any first-period discount. */
export function paidPeriodLimit(first: number, renewal: number): number {
  if (
    !Number.isSafeInteger(first) ||
    !Number.isSafeInteger(renewal) ||
    first < 1 ||
    renewal < 1 ||
    first > SHOP_PRICE_MAX_CENTS
  )
    return 0;
  return Math.min(12, 1 + Math.floor((SHOP_PRICE_MAX_CENTS - first) / renewal));
}
