"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LabelTooltip } from "@/components/ui/tooltip";

type Feedback = "idle" | "copied" | "failed";

/** Where the bubble points: the middle of the button's top edge, or of its bottom edge when the top is too close to the viewport edge. */
type Anchor = { x: number; y: number; below: boolean };

/** The bubble needs about this much room above the button; with less, it opens below. */
const BUBBLE_ROOM = 32;

/**
 * Copies a value and shows how it went. The icon turns into a check or a cross for 1.5 seconds, and an icon-only
 * button also pops a small bubble, since it has no text to change. The bubble is attached to body and placed by
 * viewport coordinates, so a clipping container (a scrolling table, a floating window) cannot cut it off.
 * The button keeps its name throughout; a status region announces the outcome once, so a screen reader does not
 * hear it a second time as a name change. With children it is a text button ("Copy address") and shows no bubble.
 * Without `write` it uses the Clipboard API, and where there is none (a page served over plain HTTP, such as an
 * internal address) or it refuses, the older way: the text is selected in a hidden textarea next to the button and
 * copied with execCommand, then the focus goes back to the button. `write` replaces both; it throws to fail.
 * `onCopied` and `onCopyFailed` hear the outcome, for a page that also says it in a sentence of its own.
 * Without `text` it copies the code shown next to it: the text of the first <code> (else <pre>) in the button's parent, read when
 * pressed, with line breaks kept. A code block rendered on the server then sends its source once, as the highlighted markup,
 * instead of a second time as a prop of this button.
 */
/** Text as it reads on screen: a <br> (how highlighters often end a line) counts as a line break, which textContent drops. */
function readText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
  if (node.nodeName === "BR") return "\n";
  return Array.from(node.childNodes, readText).join("");
}

/** The code beside the button: the first <code>, else <pre>, in its parent. Throws when there is none, which shows as a failed copy. */
function adjacentCode(button: HTMLElement): string {
  const code = button.parentElement?.querySelector("code") ?? button.parentElement?.querySelector("pre");
  if (!code) throw new Error("No code next to the copy button");
  return readText(code);
}

/**
 * Copies with execCommand, for a page without the Clipboard API. The textarea goes next to the button rather than at
 * the end of the body, so a dialog's focus trap lets the selection happen; it is gone before the next frame.
 */
function copyBySelection(text: string, button: HTMLElement) {
  if (typeof document.execCommand !== "function") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.tabIndex = -1;
  area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;";
  (button.parentElement ?? document.body).appendChild(area);
  area.focus({ preventScroll: true });
  area.select();
  area.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    button.focus({ preventScroll: true });
  }
}

async function copyText(text: string, button: HTMLElement) {
  if (navigator.clipboard && window.isSecureContext !== false) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Refused, such as without permission or focus: the selection may still work.
    }
  }
  if (!copyBySelection(text, button)) throw new Error("Copy failed");
}

function CopyButton({
  text,
  label,
  copiedLabel,
  failedLabel,
  write,
  onCopied,
  onCopyFailed,
  children,
  variant = "ghost",
  size,
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "asChild" | "loading"> & {
  /** What is copied; leave it out to copy the <code> or <pre> beside the button. */
  text?: string;
  /** The button's accessible name, such as "Copy address"; its tooltip too when it shows only the icon. */
  label: string;
  /** Announced and shown after a copy, such as "Copied". */
  copiedLabel: string;
  /** Announced and shown when the clipboard refused, such as "Copy failed". */
  failedLabel: string;
  /** How to copy, instead of navigator.clipboard; reject or throw when it could not. */
  write?: (text: string) => void | Promise<void>;
  /** After a copy went through, with the text copied: for a page that also says so in its own words. */
  onCopied?: (text: string) => void;
  /** After a copy failed, with what went wrong. */
  onCopyFailed?: (error: unknown) => void;
}) {
  const [feedback, setFeedback] = React.useState<Feedback>("idle");
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const reset = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(reset.current);
    };
  }, []);

  const show = (next: Feedback) => {
    // writeText can settle after the button has gone, such as on a page change.
    if (!mounted.current) return;
    setFeedback(next);
    clearTimeout(reset.current);
    reset.current = setTimeout(() => setFeedback("idle"), 1500);
  };

  const Icon = feedback === "copied" ? CheckIcon : feedback === "failed" ? XIcon : CopyIcon;
  const outcome = feedback === "copied" ? copiedLabel : feedback === "failed" ? failedLabel : "";
  const iconOnly = children === undefined || children === null || children === false;

  return (
    <>
      <LabelTooltip label={iconOnly ? label : undefined}>
        <Button
          type="button"
          variant={variant}
          size={size ?? (iconOnly ? "icon-xs" : "xs")}
          aria-label={iconOnly ? label : undefined}
          data-feedback={feedback === "idle" ? undefined : feedback}
          className={cn(
            "relative",
            feedback === "copied" && "text-success",
            feedback === "failed" && "text-destructive",
            className,
          )}
          onClick={async (event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const below = rect.top < BUBBLE_ROOM;
            setAnchor({ x: rect.left + rect.width / 2, y: below ? rect.bottom : rect.top, below });
            const button = event.currentTarget;
            try {
              const value = text ?? adjacentCode(button);
              if (write) await write(value);
              else await copyText(value, button);
              // A copy that settles after the button has gone tells nobody, as it shows nothing.
              if (!mounted.current) return;
              show("copied");
              onCopied?.(value);
            } catch (error) {
              if (!mounted.current) return;
              show("failed");
              onCopyFailed?.(error);
            }
          }}
          {...props}
        >
          {/* The key changes with the outcome, so the pop plays again when the icon changes. */}
          <Icon key={feedback} className={feedback === "idle" ? undefined : "animate-pop"} />
          {children}
        </Button>
      </LabelTooltip>
      {iconOnly &&
        feedback !== "idle" &&
        anchor &&
        createPortal(
          <span
            aria-hidden="true"
            data-slot="copy-button-bubble"
            style={{ left: anchor.x, top: anchor.y }}
            className={cn(
              "pointer-events-none fixed z-floating -translate-x-1/2 rounded-control bg-foreground px-2 py-1 text-xs leading-none font-medium whitespace-nowrap text-background",
              anchor.below ? "mt-1.5" : "-mt-1.5 -translate-y-full",
            )}
          >
            <span className="block animate-pop">{outcome}</span>
          </span>,
          document.body,
        )}
      <span role="status" className="sr-only">
        {outcome}
      </span>
    </>
  );
}

export { CopyButton };
