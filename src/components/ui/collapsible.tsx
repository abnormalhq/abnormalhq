"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";

/**
 * A region a button shows and hides: the advanced options of a form, the quoted text of a reply, a folder group in
 * a sidebar. It has no look of its own. The trigger is whatever the page puts there (`asChild` on a Button), it can
 * sit anywhere inside, and the page can hold the state with `open` and `onOpenChange`.
 * That is what Disclosure cannot do: it is a native <details>, so it needs no JavaScript, but its summary row is
 * the only trigger and the browser owns its state. Use Disclosure for a list of questions on a page, Accordion for a
 * group of sections where arrow keys move between the headers, and this for one region wired to the page's own state.
 * The trigger carries aria-expanded and aria-controls. The panel opens to its measured height and is removed while
 * closed.
 */
function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn("overflow-hidden data-open:animate-expand data-closed:animate-collapse", className)}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
