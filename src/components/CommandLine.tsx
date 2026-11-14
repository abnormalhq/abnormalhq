"use client";

import { useId, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { writeClipboard } from "@/lib/clipboard";

/**
 * An install command on the download page (Homebrew, apt) with a button that copies it.
 * The button has no `text`: it copies the <code> beside it, in the same box, so the command is in the page once.
 * The commands are longer than a platform card is wide, so the block scrolls sideways; it takes keyboard focus so it can be
 * scrolled without a pointer. The prerendered HTML already carries the command and the button; only copying needs JavaScript.
 */
export function CommandLine({
  label,
  code,
  copy,
  copied,
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
  const [failed, setFailed] = useState(false);

  return (
    <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3">
      <p className="text-sm/[1.6] text-muted-foreground" id={labelId}>
        {label}
      </p>
      <CopyButton
        size="sm"
        className="-mb-1 shrink-0 border-0 px-2 font-normal [&_svg]:size-3.5"
        label={copy}
        copiedLabel={copied}
        failedLabel={failedLabel}
        aria-describedby={labelId}
        // The button announces the outcome; a failure also stays on the page, with what to do instead.
        write={async (text) => {
          try {
            await writeClipboard(text);
          } catch (error) {
            setFailed(true);
            throw error;
          }
          setFailed(false);
        }}
      >
        {copy}
      </CopyButton>
      <pre
        className="col-span-2 mt-2 overflow-x-auto rounded-control border border-border bg-control px-3 py-2 font-mono text-sm/[1.6] focus-visible:outline-2 focus-visible:outline-ring"
        tabIndex={0}
        role="region"
        aria-labelledby={labelId}
      >
        <code>{code}</code>
      </pre>
      {failed && <p className="col-span-2 mt-2 text-sm/[1.6] text-muted-foreground">{failedLabel}</p>}
    </div>
  );
}
