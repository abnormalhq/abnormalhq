/**
 * What the two mail proxies share: the redeem API (index.ts) and the shop (shop.ts). Both reach mail through the MAIL
 * binding, forward only a fixed set of request headers, never follow mail's redirects, and answer the browser with
 * headers they build themselves rather than with whatever mail sent.
 */

/**
 * The Worker bindings the storefront needs (wrangler.jsonc): the MAIL Service Binding to abnormalhq-mailhq, and mail's
 * production origin, used only as the URL of internal requests so mail's OpenNext recognises its own origin.
 */
export interface StorefrontEnv {
  MAIL: { fetch(request: Request): Promise<Response> };
  MAIL_ORIGIN: string;
}

/** Request headers mail needs: body type, page language, the browser Origin and the trusted client IP. */
const FORWARDED_HEADERS = ["content-type", "accept", "accept-language", "origin", "cf-connecting-ip", "cf-ray"];

export type Localize = (zh: string, en: string) => string;

/** Whether the page asked for English: the pages send their language explicitly as zh or en. */
export function prefersEnglish(request: Request): boolean {
  return /^en(?:-|;|,|$)/i.test(request.headers.get("accept-language")?.trim() ?? "");
}

/** Pick the message for the page's language; anything other than English gets Chinese. */
export function localizer(request: Request): Localize {
  const english = prefersEnglish(request);
  return (zh, en) => (english ? en : zh);
}

export function unavailableMessage(localize: Localize): string {
  return localize(
    "邮件服务暂时不可用，请稍后再试。",
    "The mail service is temporarily unavailable. Please try again shortly.",
  );
}

export function mediaType(headers: Headers): string | undefined {
  return headers.get("content-type")?.split(";")[0].trim().toLowerCase();
}

/** Only the allowlisted request headers; cookies are added by the caller where a route needs them. */
export function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

/**
 * The internal request to mail. The URL uses mail's own origin (MAIL_ORIGIN) so its OpenNext initializes with it; the
 * binding, not the hostname, decides where the request goes. Redirects are never followed. A body that was already read
 * (`body`) is sent as is; otherwise the browser's body is streamed through once.
 */
export function mailRequest(request: Request, target: URL, headers: Headers, body?: string): Request {
  if (body !== undefined) return new Request(target, { method: request.method, headers, body, redirect: "manual" });
  return new Request(new Request(target, request), { headers, redirect: "manual" });
}

/**
 * The response headers the browser gets: a fixed base plus mail's Content-Type and Retry-After. Nothing else from mail
 * passes (cookies, CORS, CSP, framework or timing headers), so new upstream headers never leak to the public origin.
 */
export function responseHeaders(upstream: Response, base: HeadersInit): Headers {
  const headers = new Headers(base);
  const type = upstream.headers.get("content-type");
  if (type) headers.set("Content-Type", type);
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return headers;
}

/** Read a small request body, or null when it is larger than `limit` bytes (the rest is not read). */
export async function readBoundedText(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}
