"use client";

import { useState } from "react";
import type { Copy } from "@/i18n/types";
import { cn } from "@/lib/utils";

type DoppelCopy = Copy["hero"]["doppel"];
type Tone = DoppelCopy["topology"]["profiles"][number]["tone"];

const TONE_STYLES: Record<Tone, { badge: string; activeCard: string; dot: string }> = {
  indigo: {
    badge: "bg-indigo-soft text-indigo-ink",
    activeCard: "border-indigo shadow-sheet",
    dot: "bg-indigo",
  },
  clay: {
    badge: "bg-clay-soft text-clay-ink",
    activeCard: "border-clay shadow-sheet",
    dot: "bg-clay",
  },
  sage: {
    badge: "bg-sage-soft text-sage-ink",
    activeCard: "border-sage shadow-sheet",
    dot: "bg-sage",
  },
};

/**
 * Interactive architectural specimen for Doppel in the home hero: three isolated browser workspaces rendered with the
 * family's supporting hues (indigo, clay, sage) so the tab communicates isolation visually without repeating identical
 * placeholder lists.
 */
export function DoppelStage({ keeps, topology }: Pick<DoppelCopy, "keeps" | "topology">) {
  const [selected, setSelected] = useState(0);
  const current = topology.profiles[selected] ?? topology.profiles[0]!;

  return (
    <div className="rounded-dialog border border-border bg-surface/55 p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-mono tracking-caps text-muted-foreground uppercase" lang="en">
          {topology.eyebrow}
        </span>
        <span className="text-muted-foreground">{topology.hint}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {topology.profiles.map((profile, index) => {
          const isSelected = index === selected;
          const style = TONE_STYLES[profile.tone];
          return (
            <button
              key={profile.number}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(index)}
              className={cn(
                "flex min-w-0 flex-col rounded-panel border bg-popover p-5 text-left transition-[border-color,box-shadow] duration-150",
                isSelected ? style.activeCard : "border-border hover:border-border-strong",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("rounded-chip px-2 py-0.5 font-mono text-2xs font-medium", style.badge)} lang="en">
                  workspace / {profile.number}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
                  <span
                    className={cn(
                      "inline-block size-1.5 rounded-full",
                      profile.active ? style.dot : "bg-border-strong",
                    )}
                    aria-hidden="true"
                  />
                  {profile.status}
                </span>
              </div>

              <p className="mt-4 text-md/body font-semibold tracking-title text-foreground" lang="en">
                {profile.name}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground" lang="en">
                {profile.hosts}
              </p>

              <dl className="mt-5 grid gap-2 border-t border-border pt-4 text-xs">
                {keeps.map((label, rowIndex) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 truncate font-mono text-foreground">{profile.values[rowIndex]}</dd>
                  </div>
                ))}
              </dl>
            </button>
          );
        })}
      </div>

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-mark border border-border bg-card px-4 py-3 text-xs"
        role="status"
      >
        <span className="text-foreground">{current.inspect}</span>
        <span className="shrink-0 font-mono text-sage">{topology.inspectorBadge}</span>
      </div>
    </div>
  );
}
