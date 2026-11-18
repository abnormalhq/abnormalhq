import type { DoppelWaitlistBindings } from "../../waitlist-bindings";

/** Shared request contract. No account creation, invitations, product URLs or mail sending. */
export type WaitlistMode = "closed" | "preview" | "open";

export interface WaitlistServices {
  readonly mode: Exclude<WaitlistMode, "closed">;
  add(email: string, lang: "en" | "zh"): Promise<void>;
  limit(key: string): Promise<{ success: boolean }>;
}

const MAX_BODY = 2048;
const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const reply = (status: number, error: string, extra: Record<string, string> = {}) =>
  Response.json({ error }, { status, headers: { ...HEADERS, ...extra } });

/** Conservative ASCII mailbox syntax, accepting aliases and apostrophes but no controls, display names or SQL syntax. */
export function normalizeWaitlistEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  const [local, domain, extra] = email.split("@");
  if (!local || !domain || extra !== undefined || local.length > 64) return null;
  if (
    !/^[a-z0-9!#$%&'*+/=?^`{|}~.-]+$/.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  )
    return null;
  const labels = domain.split(".");
  if (labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1) ?? "")) return null;
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return email;
}

/** Enforce the cap on the stream as well as Content-Length; a chunked body cannot bypass it. */
async function readBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  let length = 0;
  let body = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return body + decoder.decode();
      length += value.byteLength;
      if (length > MAX_BODY) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function handleWaitlist(
  request: Request,
  services?: WaitlistServices,
  clientKey = "local",
): Promise<Response> {
  // Public availability is safe to read and uses exactly the same runtime gate as submissions.
  if (request.method === "GET") {
    return Response.json({ mode: services?.mode ?? "closed" }, { headers: HEADERS });
  }
  if (request.method !== "POST") return reply(405, "method_not_allowed", { Allow: "GET, POST" });
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return reply(403, "origin_forbidden");
  }
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return reply(415, "unsupported_media_type");
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY) return reply(413, "body_too_large");
  // Missing/disabled bindings fail closed; never acknowledge a request that was not saved.
  if (!services)
    return Response.json({ error: "registration_closed", mode: "closed" }, { status: 503, headers: HEADERS });
  try {
    if (!(await services.limit(clientKey)).success) return reply(429, "rate_limited", { "Retry-After": "60" });
    let payload: unknown;
    try {
      const body = await readBody(request);
      if (body === null) return reply(413, "body_too_large");
      payload = JSON.parse(body);
    } catch {
      return reply(400, "invalid_request");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reply(400, "invalid_request");
    const { email: value, lang } = payload as Record<string, unknown>;
    const email = normalizeWaitlistEmail(value);
    if (!email || (lang !== "en" && lang !== "zh")) return reply(400, "invalid_request");
    if (services.mode === "preview" && !email.endsWith("@example.com")) return reply(400, "invalid_test_email");
    await services.add(email, lang);
    // New and duplicate registrations have exactly the same response, with no echoed email.
    return Response.json({ ok: true, mode: services.mode }, { headers: HEADERS });
  } catch {
    // Never log the request, email, IP, SQL error or exception: those can contain personal data.
    return reply(503, "unavailable");
  }
}

/** Optional deployment adapter, typed from Wrangler's example config. No bindings are added to the live config. */
export function waitlistServices(env: Partial<DoppelWaitlistBindings>): WaitlistServices | undefined {
  const db = env.DOPPEL_WAITLIST_DB;
  const limiter = env.DOPPEL_WAITLIST_LIMITER;
  if (env.DOPPEL_WAITLIST_ENABLED !== "true" || !db || !limiter) return undefined;
  return {
    mode: "open",
    limit: (key) => limiter.limit({ key: `doppel:${key}` }),
    async add(email, lang) {
      const result = await db
        .prepare("INSERT INTO doppel_waitlist (email, locale) VALUES (?, ?) ON CONFLICT(email) DO NOTHING")
        .bind(email, lang)
        .run();
      if (!result.success) throw new Error("waitlist_write_failed");
    },
  };
}
