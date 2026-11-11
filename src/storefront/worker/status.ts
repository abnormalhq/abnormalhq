import { STATUS_MAX_AGE_SECONDS, readStatusSummary, type StatusSummary } from "../../lib/status.ts";
import { localizer, mediaType, unavailableMessage, type StorefrontEnv } from "./proxy";

/**
 * `GET /api/status`: the service status the footer and the home page show (src/components/ServiceStatus.tsx). It is mail's public
 * status page in one line, `GET /api/status/summary`, read over the MAIL binding; "Service status" in docs/storefront-api.md and
 * `status` in docs/onboard-contract.json.
 *
 * Unlike the redeem and shop proxies nothing of the browser's request is sent on (no cookie, no IP, no language, no body): the
 * answer is the same for everyone. For the same reason it may be cached: by browsers for a minute, and here per Worker instance,
 * so that a page view does not cost mail a request each. Only a checked summary is passed on, rebuilt from its four fields; an
 * older mail without the endpoint (its 401), an outage or any other answer is a JSON 503, which the pages take as "show nothing".
 */
const STATUS_PATH = /^\/api\/status\/?$/;
/** mail's route, in docs/onboard-contract.json (`status.route`). */
export const MAIL_STATUS_PATH = "/api/status/summary";

const UNAVAILABLE_HEADERS = { "Cache-Control": "no-store", "Retry-After": String(STATUS_MAX_AGE_SECONDS) };

let cached: { at: number; summary: StatusSummary } | null = null;

/** For tests: forget the summary this instance holds. */
export function forgetStatus(): void {
  cached = null;
}

export function isStatusApi(pathname: string): boolean {
  return STATUS_PATH.test(pathname);
}

async function readFromMail(env: StorefrontEnv): Promise<StatusSummary | null> {
  const upstream = await env.MAIL.fetch(
    new Request(new URL(MAIL_STATUS_PATH, env.MAIL_ORIGIN), {
      headers: { Accept: "application/json" },
      redirect: "manual",
    }),
  );
  if (upstream.status !== 200 || mediaType(upstream.headers) !== "application/json") {
    await upstream.body?.cancel();
    return null;
  }
  return readStatusSummary(await upstream.json());
}

export async function proxyStatus(request: Request, env: StorefrontEnv, now: number = Date.now()): Promise<Response> {
  const localize = localizer(request);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Response.json(
      { error: localize("只接受 GET。", "Only GET is accepted."), kind: "other" },
      { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } },
    );
  }
  const expired = cached;
  if (!cached || now - cached.at >= STATUS_MAX_AGE_SECONDS * 1000) {
    let summary: StatusSummary | null = null;
    try {
      summary = await readFromMail(env);
      if (!summary) console.error({ event: "mail_invalid_response", path: "/api/status" });
    } catch {
      // A misconfigured MAIL_ORIGIN lands here too.
      console.error({ event: "mail_unavailable", path: "/api/status" });
    }
    // A summary that could not be refreshed is not served past its minute: a stale "all systems operational" during an
    // outage of mail itself would be the wrong thing to say.
    // Requests that overlap at expiry each ask mail (a promise is not shared between requests: one awaited from another
    // request is dropped if the request that started it ends first). So a failure here only clears the summary it set out
    // to replace, never a newer one another request has saved meanwhile.
    if (summary) cached = { at: now, summary };
    else if (cached === expired) cached = null;
  }
  if (!cached) {
    return Response.json(
      { error: unavailableMessage(localize), kind: "unavailable" },
      { status: 503, headers: UNAVAILABLE_HEADERS },
    );
  }
  const age = Math.max(0, Math.floor((now - cached.at) / 1000));
  return Response.json(cached.summary, {
    headers: {
      // The browser keeps it for what is left of this instance's minute, so a page never shows it older than two.
      "Cache-Control": `public, max-age=${Math.max(1, STATUS_MAX_AGE_SECONDS - age)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
