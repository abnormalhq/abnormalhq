/**
 * The /api/status endpoint inside next dev: a fixed summary, so the footer and the hero show the service status without mail.
 * The file name ends in .dev.ts (see next.config.ts): at build time it is an ordinary file, and in production /api/status is
 * answered by the Worker from mail (src/storefront/worker/status.ts). Change `status` here to see the other states.
 */
import type { StatusSummary } from "@/lib/status";

export function GET(): Response {
  const summary: StatusSummary = { status: "up", days: 30, uptime: 99.98, updatedAt: new Date().toISOString() };
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}
