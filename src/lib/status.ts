/**
 * The service status the site shows in its footer and on its home page: an overall state and the availability of the last 30 days.
 * The numbers are mail's (abnormalhq/mail): its public status page in one line, `GET /api/status/summary`, which this site's Worker
 * reads over the MAIL binding and serves same-origin as `GET /api/status` (src/storefront/worker/status.ts; the mock under next dev is
 * src/app/api/status/route.dev.ts). The shape is in docs/onboard-contract.json (`status`) and docs/storefront-api.md.
 * This file does not depend on the DOM and must not use TypeScript syntax Node cannot run directly; tests and the Worker run it as is.
 */

/** "pending" is no data yet (a new server, or a service not checked so far): the pages show nothing for it. */
export const STATUS_STATES = ["up", "down", "maintenance", "pending"] as const;
export type StatusState = (typeof STATUS_STATES)[number];

export const STATUS_FIELDS = ["status", "days", "uptime", "updatedAt"] as const;

export interface StatusSummary {
  status: StatusState;
  /** How many days `uptime` covers, today included. */
  days: number;
  /** Successful checks out of all checks, as a percentage with at most two decimals; null before the first check. */
  uptime: number | null;
  /** When mail read the data (ISO). */
  updatedAt: string;
}

/** The path the pages request, on this site's own origin. */
export const STATUS_API_PATH = "/api/status";
/** Seconds a summary is reused: by the Worker, by the browser's cache, and by one tab across its pages. */
export const STATUS_MAX_AGE_SECONDS = 60;

/**
 * A summary from an answer's JSON, or null when anything is off. Only the four fields are taken, each checked, so whatever else
 * an answer carries never reaches a page, and a figure that is not a percentage is never shown as one.
 */
export function readStatusSummary(value: unknown): StatusSummary | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { status, days, uptime, updatedAt } = value as Record<string, unknown>;
  if (typeof status !== "string" || !(STATUS_STATES as readonly string[]).includes(status)) return null;
  if (typeof days !== "number" || !Number.isSafeInteger(days) || days < 1 || days > 366) return null;
  if (uptime !== null && (typeof uptime !== "number" || !Number.isFinite(uptime) || uptime < 0 || uptime > 100))
    return null;
  if (typeof updatedAt !== "string" || updatedAt.length > 40 || Number.isNaN(Date.parse(updatedAt))) return null;
  return { status: status as StatusState, days, uptime, updatedAt };
}

/** "100" only when no check failed, otherwise two decimals, never rounded up to 100: 99.999 reads "99.99". */
export function formatUptime(uptime: number): string {
  return uptime >= 100 ? "100" : (Math.floor(uptime * 100) / 100).toFixed(2);
}

let shared: { request: Promise<StatusSummary | null>; at: number } | null = null;

/**
 * One status request per page view, shared by the footer and the home page's hero, and reused for a minute across client-side
 * navigation. It never rejects: no answer, a failed one, or one in an unknown shape is null, and the pages then show nothing.
 * A failure is forgotten, so the next page asks again.
 */
export function sharedStatus(
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<StatusSummary | null> {
  if (shared && now() - shared.at < STATUS_MAX_AGE_SECONDS * 1000) return shared.request;
  const request = fetcher(STATUS_API_PATH, { headers: { Accept: "application/json" }, credentials: "omit" })
    .then(async (response) => (response.ok ? readStatusSummary(await response.json()) : null))
    .catch(() => null);
  const entry = { request, at: now() };
  shared = entry;
  void request.then((summary) => {
    if (!summary && shared === entry) shared = null;
  });
  return request;
}

/** For tests: forget the shared request. */
export function forgetSharedStatus(): void {
  shared = null;
}
