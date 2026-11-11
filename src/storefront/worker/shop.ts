import {
  forwardedHeaders,
  localizer,
  mailRequest,
  mediaType,
  prefersEnglish,
  readBoundedText,
  responseHeaders,
  unavailableMessage,
  type StorefrontEnv,
} from "./proxy";

const SHOP_PATH =
  /^\/api\/shop\/(catalog|address|coupon|orders|notify|checkout|reconcile|pay(?:\/stripe)?|renewal|renew|account(?:\/(?:login|peek|verify|logout|portal|password-login|password|register|forgot|reset|google(?:\/(?:start|unlink))?|mailboxes(?:\/(?:create|password|status|delete))?|seats\/(?:quote|add|remove|keep)))?)\/?$/;
const GET_ROUTES = ["catalog", "orders", "notify", "account", "account/mailboxes"];
/**
 * The address check before buying (POST address: is this username free on this domain?), in docs/storefront-api.md and
 * docs/onboard-contract.json. It needs no session, so no cookie is forwarded to it. mail answers 404 while the check is switched
 * off in the sales settings, and a mail before the endpoint answers its own 404 page; either is passed on as a JSON 404, which
 * the pages take as "no address check" and hide it.
 */
export const ADDRESS_ROUTE = "address";
/**
 * The preview of a discount code (POST coupon: what would this plan cost with this code?). mail implements it, but the
 * storefront side of discount codes is still "Proposed" in docs/storefront-api.md and mail's docs/shop.md, so the route is not
 * in docs/onboard-contract.json yet (both copies must stay equal, and mail's has not taken it). It is proxied like checkout:
 * same-origin Origin, the client IP kept, and the purchase and account cookies forwarded, so that a per-buyer limit is known
 * to the preview. A mail before discount codes answers its own 404 page, which is passed on as a JSON 404: the shop page
 * takes that as "no discount codes" and hides the field.
 */
export const COUPON_ROUTE = "coupon";
/**
 * Seats of a seat subscription on the account page (POST account/seats/quote, add, remove, keep; "Seat plans" in
 * docs/storefront-api.md). mail implements them, but like the code preview they are "Proposed" in mail's docs/shop.md and not in
 * docs/onboard-contract.json yet. They are proxied like account/mailboxes/create: same-origin Origin, the client IP kept, the
 * purchase and account cookies forwarded; `add` may start a purchase session like `renew` (an LDC order to pay). A mail before
 * seat plans answers its own 404 page, passed on as a JSON 404 rather than as an outage.
 */
export const SEAT_ROUTES = ["account/seats/quote", "account/seats/add", "account/seats/remove", "account/seats/keep"];
/** Routes of features an older mail does not have: its 404 page becomes a JSON 404, which the pages take as "not offered". */
function optionalRoute(route: string): boolean {
  return route === ADDRESS_ROUTE || route === COUPON_ROUTE || SEAT_ROUTES.includes(route);
}
// The cookie names, shapes and lifetimes are mail's (src/lib/shop/session.ts, customers.ts); tests/worker.test.ts checks
// them against docs/onboard-contract.json.
export const BUYER_COOKIE = "mailhq_shop";
export const BUYER_TOKEN = /^[a-f0-9]{64}$/;
export const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
// Login session of a shop account (mail's src/lib/shop/customers.ts): 30 days.
export const CUSTOMER_COOKIE = "mailhq_customer";
export const CUSTOMER_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const CUSTOMER_MAX_AGE = 30 * 24 * 60 * 60;
// State cookie issued by mail during Google login (src/lib/shop/google.ts): 10 minutes, sent only to account/google.
export const GOOGLE_COOKIE = "mailhq_shop_google";
export const GOOGLE_TOKEN = /^[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{1,1024}\.[A-Za-z0-9_-]{43}$/;
export const GOOGLE_MAX_AGE = 10 * 60;
export const GOOGLE_COOKIE_PATH = "/api/shop/account/google";
export const ORDER_ID = /^[a-z0-9]{15}$/;
/**
 * The order page in either language: /shop/orders/ (English, the site's default) or /zh/shop/orders/. /en/shop/orders/ is
 * the English address of the standalone onboard site; it stays allowed while mail may still build it, and next.config.ts
 * 301s it to /shop/orders/.
 */
export const ORDER_PAGE = /^\/(?:zh\/|en\/)?shop\/orders\/?$/;
/** The pay form carries an order id and the page language; mail accepts no more than this either. */
const PAY_BODY_LIMIT = 4096;
const SHOP_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow",
};

function failure(status: number, error: string, notify = false, headers: Record<string, string> = {}): Response {
  if (notify) {
    return new Response("fail", {
      status,
      headers: {
        ...headers,
        ...SHOP_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  return Response.json({ error }, { status, headers: { ...headers, ...SHOP_HEADERS } });
}

/** Ignore other cookies and ambiguous duplicates of the one we look for. */
function requestCookie(request: Request, name: string, pattern: RegExp): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return values.length === 1 && pattern.test(values[0]) ? `${name}=${values[0]}` : null;
}

/** Only the purchase session and account session cookies are forwarded (plus the Google state cookie when completing Google login); admin credentials etc. never are. */
function shopCookies(request: Request, route: string): string | null {
  if (route === ADDRESS_ROUTE) return null;
  const cookies = [
    requestCookie(request, BUYER_COOKIE, BUYER_TOKEN),
    requestCookie(request, CUSTOMER_COOKIE, CUSTOMER_TOKEN),
    route === "account/google" ? requestCookie(request, GOOGLE_COOKIE, GOOGLE_TOKEN) : null,
  ].filter(Boolean);
  return cookies.length ? cookies.join("; ") : null;
}

/** Rebuild the one browser credential we accept; never inherit Domain or Path. */
function checkoutCookie(headers: Headers, secure: boolean): string | null {
  const values = headers
    .getSetCookie()
    .filter((cookie) => cookie.startsWith(`${BUYER_COOKIE}=`))
    .map((cookie) => cookie.split(";")[0].slice(BUYER_COOKIE.length + 1));
  if (values.length !== 1 || !BUYER_TOKEN.test(values[0])) return null;
  return `${BUYER_COOKIE}=${values[0]}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Rebuilds the account session cookie on successful login, again without inheriting the upstream Domain or Path. */
function customerCookie(headers: Headers, secure: boolean): string | null {
  const values = headers
    .getSetCookie()
    .filter((cookie) => cookie.startsWith(`${CUSTOMER_COOKIE}=`))
    .map((cookie) => cookie.split(";")[0].slice(CUSTOMER_COOKIE.length + 1));
  if (values.length !== 1 || !CUSTOMER_TOKEN.test(values[0])) return null;
  return `${CUSTOMER_COOKIE}=${values[0]}; Path=/; Max-Age=${CUSTOMER_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Rebuilds the state cookie when Google login starts: sent only to account/google, 10 minutes, again without inheriting the upstream Domain or Path. */
function googleCookie(headers: Headers, secure: boolean): string | null {
  const values = headers
    .getSetCookie()
    .filter((cookie) => cookie.startsWith(`${GOOGLE_COOKIE}=`))
    .map((cookie) => cookie.split(";")[0].slice(GOOGLE_COOKIE.length + 1));
  if (values.length !== 1 || !GOOGLE_TOKEN.test(values[0])) return null;
  return `${GOOGLE_COOKIE}=${values[0]}; Path=${GOOGLE_COOKIE_PATH}; Max-Age=${GOOGLE_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * Where a pay redirect may send the buyer: the Credit payment page, a Stripe Checkout page or this site's order page.
 * Stripe's URL comes from its API through the trusted mail backend; its pathname is not a stable API contract.
 * Stripe Checkout URLs carry the page's state in the fragment (`#fid…`) and do not load without it, so the fragment is
 * kept along with the query; anywhere else a fragment is refused like any other unexpected shape.
 */
export function paymentLocation(location: string | null, origin: string): string | null {
  if (!location) return null;
  try {
    const target = new URL(location, origin);
    if (target.username || target.password) return null;
    if (target.origin === "https://checkout.stripe.com") return target.href;
    if (target.hash) return null;
    if (
      (target.origin === "https://credit.linux.do" && target.pathname === "/paying") ||
      (target.origin === origin && ORDER_PAGE.test(target.pathname))
    ) {
      return target.href;
    }
  } catch {
    // Invalid redirects are handled in the same way as unexpected upstream HTML.
  }
  return null;
}

/** Only the origin of a refused redirect is logged: the path and query can carry payment session or trade numbers. */
function redirectTarget(location: string | null, origin: string): string {
  if (!location) return "none";
  try {
    return new URL(location, origin).origin;
  } catch {
    return "invalid";
  }
}

/**
 * The pay form is a top-level navigation, so a failure must land on a page, not on a bare JSON body: back to the order
 * page in the form's language with the payment error shown (mail does the same once it has read the order id).
 */
function paymentFailed(fields: URLSearchParams | null, origin: string, english: boolean): Response {
  const ids = fields?.getAll("orderId") ?? [];
  const id = ids.length === 1 && ORDER_ID.test(ids[0]) ? ids[0] : null;
  const lang = fields?.get("lang");
  const prefix = lang === "zh" || (lang !== "en" && !english) ? "/zh" : "";
  const location = new URL(`${prefix}/shop/orders/${id ? `?id=${id}&error=payment` : "?error=payment"}`, origin);
  return new Response(null, { status: 303, headers: { ...SHOP_HEADERS, Location: location.href } });
}

export async function proxyShop(request: Request, env: StorefrontEnv): Promise<Response> {
  const url = new URL(request.url);
  const localize = localizer(request);
  const unavailable = unavailableMessage(localize);
  const route = SHOP_PATH.exec(url.pathname)?.[1];
  if (!route) return failure(404, localize("接口不存在。", "Endpoint not found."));
  const notify = route === "notify";
  const method = GET_ROUTES.includes(route) ? "GET" : "POST";
  if (request.method !== method) {
    return failure(405, localize(`只接受 ${method}。`, `Only ${method} is accepted.`), notify, { Allow: method });
  }
  const secure = url.protocol === "https:";
  // Without a session cookie that the Worker would forward, all mail can answer is "not signed in": answer that here, so
  // that the signed-in bar on every shop page costs signed-out buyers (most visitors) no call to mail.
  if (
    (route === "account" || route === "account/mailboxes") &&
    !requestCookie(request, CUSTOMER_COOKIE, CUSTOMER_TOKEN)
  ) {
    return failure(401, localize("请先登录。", "Please sign in first."));
  }

  // The pay form is read up front (it is a few bytes) so that every failure can return to its order page.
  let payBody: string | undefined;
  let payFields: URLSearchParams | null = null;
  if (route === "pay") {
    const text = await readBoundedText(request, PAY_BODY_LIMIT).catch(() => null);
    if (text === null) return paymentFailed(null, url.origin, prefersEnglish(request));
    payBody = text;
    payFields = new URLSearchParams(text);
  }
  const payFailed = () => paymentFailed(payFields, url.origin, prefersEnglish(request));

  if (method === "POST") {
    // Browser mutations must originate on this storefront, including HTML forms.
    if (request.headers.get("origin") !== url.origin) {
      return route === "pay" ? payFailed() : failure(403, localize("来源不在允许之列。", "Origin is not allowed."));
    }
    const expected = route === "pay" ? "application/x-www-form-urlencoded" : "application/json";
    if (mediaType(request.headers) !== expected) {
      return route === "pay"
        ? payFailed()
        : failure(415, localize(`请求必须使用 ${expected}。`, `Requests must use ${expected}.`));
    }
  }

  const response = await forward(request, env, url, route, unavailable, payBody);
  if (route === "pay" && response.status !== 303) {
    await response.body?.cancel();
    return payFailed();
  }
  // Signing out always clears this browser's session cookie, whatever mail answered: ending the server-side session is
  // mail's business, but the browser must not stay signed in because mail failed (on a shared computer, for one).
  // Google's answer can only be handed over once: whatever mail replies (including an error, a redirect or something else, or the Worker's own 503), this browser's state cookie is cleared.
  if (route === "account/google") {
    const headers = new Headers(response.headers);
    headers.append(
      "Set-Cookie",
      `${GOOGLE_COOKIE}=; Path=${GOOGLE_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
    );
    return new Response(response.body, { status: response.status, headers });
  }
  if (route === "account/logout") {
    const headers = new Headers(response.headers);
    headers.set(
      "Set-Cookie",
      `${CUSTOMER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
    );
    return new Response(response.body, { status: response.status, headers });
  }
  return response;
}

async function forward(
  request: Request,
  env: StorefrontEnv,
  url: URL,
  route: string,
  unavailable: string,
  body: string | undefined,
): Promise<Response> {
  const notify = route === "notify";
  try {
    const headers = forwardedHeaders(request);
    const cookie = shopCookies(request, route);
    if (cookie && !notify) headers.set("cookie", cookie);
    // Keep mail's own origin for OpenNext, while preserving the browser Origin
    // for the backend's configured storefront-origin check.
    const upstreamUrl = new URL(`/api/shop/${route}`, env.MAIL_ORIGIN);
    if (notify) {
      // Preserve the signed query verbatim, including ordering and encoding.
      upstreamUrl.search = url.search;
    } else if (route === "orders") {
      for (const id of url.searchParams.getAll("id")) {
        upstreamUrl.searchParams.append("id", id);
      }
    }
    // Forward the body once. Never retry or log buyer/payment data.
    const upstream = await env.MAIL.fetch(mailRequest(request, upstreamUrl, headers, body));
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      const allowed = route === "pay" && upstream.status === 303 ? paymentLocation(location, url.origin) : null;
      await upstream.body?.cancel();
      if (!allowed) {
        console.error({
          event: "mail_shop_unexpected_redirect",
          route,
          status: upstream.status,
          target: redirectTarget(location, url.origin),
        });
        return failure(503, unavailable, notify);
      }
      return new Response(null, { status: 303, headers: { ...SHOP_HEADERS, Location: allowed } });
    }
    if ((route === ADDRESS_ROUTE || route === COUPON_ROUTE) && upstream.status === 404) {
      // The check is switched off (mail's JSON 404), or mail is from before it (its 404 page): say so in JSON rather than "unavailable", so the pages hide the check. The same for the discount code preview of a mail before discount codes.
      await upstream.body?.cancel();
      return failure(404, localizer(request)("接口不存在。", "Endpoint not found."));
    }
    if (optionalRoute(route) && upstream.status === 404 && mediaType(upstream.headers) !== "application/json") {
      // A mail before the feature answers its own 404 page. mail's JSON 404 ("not a seat subscription of this account") is an answer and passes below.
      await upstream.body?.cancel();
      return failure(404, localizer(request)("接口不存在。", "Endpoint not found."));
    }
    if (mediaType(upstream.headers) !== (notify ? "text/plain" : "application/json")) {
      await upstream.body?.cancel();
      console.error({ event: "mail_shop_invalid_response", route, status: upstream.status });
      return failure(503, unavailable, notify);
    }
    const out = responseHeaders(upstream, SHOP_HEADERS);
    const secure = url.protocol === "https:";
    // Renewal orders hang off this browser's purchase session, like purchase orders.
    // So does an LDC order that adds seats (account/seats/add).
    if ((route === "checkout" || route === "renew" || route === "account/seats/add") && upstream.ok) {
      const cookie = checkoutCookie(upstream.headers, secure);
      if (cookie) out.set("Set-Cookie", cookie);
    }
    // A successful login through a login link, password or Google always installs a new account session.
    if (
      (route === "account/verify" ||
        route === "account/password-login" ||
        route === "account/reset" ||
        route === "account/google") &&
      upstream.ok
    ) {
      const cookie = customerCookie(upstream.headers, secure);
      if (cookie) out.set("Set-Cookie", cookie);
    }
    if (route === "account/google/start" && upstream.ok) {
      const cookie = googleCookie(upstream.headers, secure);
      if (cookie) out.set("Set-Cookie", cookie);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch {
    console.error({ event: "mail_shop_unavailable", route });
    return failure(503, unavailable, notify);
  }
}
