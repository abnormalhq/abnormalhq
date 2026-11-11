"use client";

import { useEffect, useState } from "react";
import type { Copy } from "@/i18n/types";
import { fillText } from "@/lib/pricing";
import { formatUptime, sharedStatus, type StatusSummary } from "@/lib/status";
import { cn } from "@/lib/utils";

const DOT = { up: "bg-success", down: "bg-destructive", maintenance: "bg-badge-ink" } as const;

/**
 * The live service status, as one link to the status page: a dot, the state ("All systems operational") and, when there is one,
 * the availability of the last 30 days. In the footer of every page and under the home page's hero; both share one request
 * (src/lib/status.ts), answered by this site's Worker from mail's public status page.
 *
 * Pages are prerendered, so the status is read in the browser and nothing is rendered before it is known: with no answer, a
 * failed one, or no data yet ("pending") this stays empty, and the footer's "Service status" link is still there. The text is
 * never announced as it appears; it is ordinary content, not an alert.
 */
export function ServiceStatus({
  copy,
  href,
  className,
}: {
  copy: Copy["serviceStatus"];
  /** The status page. */
  href: string;
  className?: string;
}) {
  const [summary, setSummary] = useState<StatusSummary | null>(null);

  useEffect(() => {
    let current = true;
    void sharedStatus().then((answer) => current && setSummary(answer));
    return () => {
      current = false;
    };
  }, []);

  if (!summary || summary.status === "pending") return null;
  const state = copy.states[summary.status];
  const uptime =
    summary.uptime === null
      ? null
      : fillText(copy.uptime, { percent: formatUptime(summary.uptime), days: summary.days });

  return (
    <a
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground",
        className,
      )}
      href={href}
    >
      <span className="sr-only">{copy.label}</span>
      <span className="inline-flex items-center gap-2">
        <span className={cn("size-2 shrink-0 rounded-full", DOT[summary.status])} aria-hidden="true" />
        {state}
      </span>
      {uptime && (
        <>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{uptime}</span>
        </>
      )}
    </a>
  );
}
