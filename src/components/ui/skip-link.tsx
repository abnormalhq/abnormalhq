import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The first link on a page, for the keyboard: it waits above the top edge until it takes the focus, then drops into
 * the corner, so Tab and Enter jump past the header and the navigation to the content. `href` is the content's id
 * ("#main"); the element it points at should be `<main id="main">`, or take `tabIndex={-1}` if it is not focusable.
 * The words are the page's ("Skip to content"). Put it first in the body, before the header.
 */
function SkipLink({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="skip-link"
      className={cn(
        "fixed top-3 left-4 z-[70] -translate-y-[calc(100%+1.5rem)] rounded-control bg-foreground px-3.5 py-2 text-sm font-medium text-background shadow-popover transition-transform duration-150 focus:translate-y-0",
        className,
      )}
      {...props}
    />
  );
}

export { SkipLink };
