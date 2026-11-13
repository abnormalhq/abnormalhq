"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/storefront/components/onboard/clipboard";
import { Icon } from "./Icon";

const COPIED_MS = 1500;

/**
 * An install command on the download page (Homebrew, apt) with a button that copies it.
 * The commands are longer than a platform card is wide, so the block scrolls sideways; it takes keyboard focus so it can be
 * scrolled without a pointer. The prerendered HTML already carries the command and the button; only copying needs JavaScript.
 */
export function CommandLine({
  label,
  code,
  copy,
  copied: copiedLabel,
  failed: failedLabel,
}: {
  label: string;
  code: string;
  copy: string;
  copied: string;
  /** Said when the browser refuses the clipboard, so the button never does nothing silently. */
  failed: string;
}) {
  const labelId = useId();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function onCopy(): Promise<void> {
    if (!(await copyText(code))) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <div className="mt-5">
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm/[1.6] text-muted-foreground" id={labelId}>
          {label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="-mb-1 shrink-0 border-0 px-2 font-normal data-copied:text-foreground"
          type="button"
          aria-describedby={labelId}
          data-copied={copied ? "" : undefined}
          onClick={() => void onCopy()}
        >
          <Icon name={copied ? "check" : "copy"} className="size-3.5" />
          {/* Announced when it changes, so a screen reader hears that the copy worked. */}
          <span aria-live="polite">{copied ? copiedLabel : copy}</span>
        </Button>
      </div>
      <pre
        className="mt-2 overflow-x-auto rounded-control border border-border bg-control px-3 py-2 font-mono text-sm/[1.6] focus-visible:outline-2 focus-visible:outline-ring"
        tabIndex={0}
        role="region"
        aria-labelledby={labelId}
      >
        <code>{code}</code>
      </pre>
      {/* Present from the start (empty), so screen readers announce the message when it appears. */}
      <p className={failed ? "mt-2 text-sm/[1.6] text-muted-foreground" : undefined} aria-live="polite">
        {failed ? failedLabel : ""}
      </p>
    </div>
  );
}
