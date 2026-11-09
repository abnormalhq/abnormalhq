import {
  forwardedHeaders,
  type StorefrontEnv,
  localizer,
  mailRequest,
  mediaType,
  responseHeaders,
  unavailableMessage,
} from "./proxy";
import { proxyShop } from "./shop";

const ONBOARD_PATH = /^\/api\/onboard\/(cdk|username|redeem)\/?$/;
const ONBOARD_HEADERS = { "Cache-Control": "no-store" };

function failure(status: number, error: string, kind = "other", headers: Record<string, string> = {}): Response {
  return Response.json({ error, kind }, { status, headers: { ...headers, ...ONBOARD_HEADERS } });
}

export type { StorefrontEnv } from "./proxy";

/** Whether the path belongs to the storefront API (/api and everything under it); pages never live there. */
export function isStorefrontApi(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * The storefront API, called by worker.ts before OpenNext for every /api request: the shop goes to shop.ts, the three
 * redeem endpoints are handled here, anything else under /api is a JSON 404.
 */
export const storefrontApi = {
  async fetch(request: Request, env: StorefrontEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/shop" || url.pathname.startsWith("/api/shop/")) {
      return proxyShop(request, env);
    }

    const localize = localizer(request);
    const route = ONBOARD_PATH.exec(url.pathname)?.[1];
    if (!route) return failure(404, localize("接口不存在。", "Endpoint not found."));
    if (request.method !== "POST") {
      return failure(405, localize("只接受 POST。", "Only POST is accepted."), "other", { Allow: "POST" });
    }
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) {
      return failure(403, localize("来源不在允许之列。", "Origin is not allowed."));
    }
    if (mediaType(request.headers) !== "application/json") {
      return failure(415, localize("请求必须使用 application/json。", "Requests must use application/json."));
    }
    const unavailable = unavailableMessage(localize);

    try {
      // Only the three redeem endpoints are exposed; the trusted client IP is kept for mail's rate limiting and Turnstile token check, cookies and admin credentials are not forwarded.
      // Requests and responses are streamed through; bodies holding redeem codes and passwords are neither parsed nor logged, and activation requests are never retried.
      const upstream = await env.MAIL.fetch(
        mailRequest(request, new URL(`/api/onboard/${route}`, env.MAIL_ORIGIN), forwardedHeaders(request)),
      );
      if (upstream.status >= 300 && upstream.status < 400) {
        await upstream.body?.cancel();
        console.error({ event: "mail_unexpected_redirect", path: url.pathname });
        return failure(503, unavailable, "unavailable");
      }
      if (mediaType(upstream.headers) !== "application/json") {
        await upstream.body?.cancel();
        console.error({ event: "mail_invalid_response", path: url.pathname });
        return failure(503, unavailable, "unavailable");
      }
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders(upstream, ONBOARD_HEADERS),
      });
    } catch {
      // The exception text may contain request data; log only the endpoint path and leave diagnosis to the invocation logs and traces.
      // A misconfigured MAIL_ORIGIN lands here too, answered with a JSON 503 instead of an uncaught exception.
      console.error({ event: "mail_unavailable", path: url.pathname });
      return failure(503, unavailable, "unavailable");
    }
  },
};
