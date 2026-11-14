import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Code to read and copy: an install command, a request, a configuration file. A `pre` that scrolls sideways for long
 * lines and takes keyboard focus so it can be scrolled without a pointer, with an optional header line naming it
 * (`title`, such as "Terminal" or a file name) and a button in its corner.
 * The button is `action`, usually a CopyButton without `text`: it sits right inside the block, beside the code, so it
 * copies that code when pressed, and the code reaches the page once, even when it arrives highlighted from the server
 * as markup. The block itself imports no button, so a page that shows code without one ships no script for it.
 * Children are the code, plain text or highlighted spans.
 * With a title, the block is a region named by it; without one, name it with `aria-label`. Keep `<code>` out of the
 * title: a CopyButton copies the first one in the block.
 */
function CodeBlock({
  title,
  language,
  action,
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  /** The header line: what the code is, such as "Terminal" or "components.json". */
  title?: React.ReactNode;
  /** The code's language, written to `data-language` for a highlighter or a style. */
  language?: string;
  /** The button in the corner, such as `<CopyButton label="Copy" copiedLabel="Copied" failedLabel="Copy failed" />`. */
  action?: React.ReactNode;
}) {
  const titleId = React.useId();
  const hasAction = action !== undefined && action !== null && action !== false;
  const named = title !== undefined || ariaLabel !== undefined;
  return (
    <div
      data-slot="code-block"
      className={cn(
        "relative min-w-0 overflow-hidden rounded-control border border-border bg-surface",
        // The action is a direct child, so a CopyButton finds the code beside it; this puts it in the corner.
        "[&>button]:absolute [&>button]:right-2 [&>button]:bg-surface",
        title === undefined ? "[&>button]:top-2" : "[&>button]:top-1.5",
        className,
      )}
      {...props}
    >
      {title !== undefined && (
        <div
          id={titleId}
          data-slot="code-block-title"
          className={cn(
            "border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground",
            hasAction && "pr-11",
          )}
        >
          {title}
        </div>
      )}
      <pre
        data-slot="code-block-pre"
        data-language={language}
        tabIndex={0}
        role={named ? "region" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={title !== undefined && ariaLabel === undefined ? titleId : undefined}
        className={cn(
          "overflow-x-auto p-3 font-mono text-sm/relaxed text-foreground focus-visible:-outline-offset-2",
          hasAction && title === undefined && "pr-11",
        )}
      >
        <code>{children}</code>
      </pre>
      {action}
    </div>
  );
}

export { CodeBlock };
