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
/** Seconds a successful summary stays fresh in the Worker and browser caches. */
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

/**
 * "100" only when no check failed, otherwise two decimals. mail's figure already has two, so it is shown as it is (multiplying
 * to cut the rest off would turn 0.29 into 0.28); only a value that would round up to 100 is held at "99.99".
 */
export function formatUptime(uptime: number): string {
  if (uptime >= 100) return "100";
  const text = uptime.toFixed(2);
  return text === "100.00" ? "99.99" : text;
}
