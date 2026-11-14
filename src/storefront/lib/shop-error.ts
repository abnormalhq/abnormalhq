import type { Lang } from "../i18n.ts";
import type { ShopCopy } from "./shop-copy.zh.ts";
import { ShopApiError } from "./shop.ts";

/**
 * The human-readable sentence for a failed shop request. The backend's explanation in the page language is the most accurate, so it is used when present: the same 404 means different things
 * for a missing order, an expired renewal link or a customer portal that cannot open. Only without an explanation is generic copy chosen by status; the generic 404 wording varies per call and comes from the caller (notFound),
 * defaulting to "request failed".
 * t is the page language's shop copy, passed in so client components need only their own language (shopError in shop-copy.ts looks it up).
 */
export function describeShopError(
  error: unknown,
  lang: Lang,
  t: ShopCopy,
  fallback: { notFound?: string } = {},
): string {
  if (error instanceof ShopApiError) {
    // A rate limit that says how long: mail's own sentence only says "later", so the wait is spelled out (every 429 of the shop API carries Retry-After).
    if (error.status === 429 && error.retryAfter) return t.rateLimitedWait(error.retryAfter);
    // A coded refusal says its text in both languages (`messages`): the page's own wins over `error`, which is in whatever
    // language the request asked for. A refusal without a code, or without text for this language, shows `error` as before.
    const coded = error.code ? error.messages[lang]?.trim() : "";
    if (coded) return coded;
    if (error.message.trim()) return error.message;
    if (error.status === 404 && fallback.notFound) return fallback.notFound;
    if (error.status === 429) return t.rateLimited;
  }
  return t.requestError;
}
