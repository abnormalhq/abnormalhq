"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Interactive masked-address specimen inside the privacy chapter: clicking switches the sample address off and back
 * on so visitors immediately feel how a leaked alias is muted in one click.
 */
export function MaskedAddressSample({
  address,
  turnOff,
  restore,
}: {
  address: string;
  turnOff: string;
  restore: string;
}) {
  const [disabled, setDisabled] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-mark border border-border bg-background px-3 py-2.5 text-xs">
      <code
        className={cn(
          "min-w-0 truncate font-mono transition-opacity duration-150",
          disabled && "line-through opacity-45",
        )}
        lang="en"
      >
        {address}
      </code>
      <button
        type="button"
        aria-pressed={disabled}
        onClick={() => setDisabled((value) => !value)}
        className="shrink-0 font-medium text-clay underline underline-offset-4 transition-opacity duration-150 hover:opacity-80"
      >
        {disabled ? restore : turnOff}
      </button>
    </div>
  );
}
