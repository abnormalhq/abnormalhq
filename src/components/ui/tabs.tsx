"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tabs as TabsPrimitive } from "radix-ui";

/**
 * Views of one subject that swap in place: the sections of a settings page, the folders of a mailbox. The row is a
 * hairline with the tab names on it, and the current one is marked by a 2px bar in the signal color (ink in light,
 * yellow in dark and in the ink shell), so the mark stays visible on any surface.
 * Arrow keys move between tabs and Home and End jump to the ends; a tab opens as it takes focus. Pass
 * activationMode="manual" when showing a panel costs a request, so it opens on Enter or Space instead.
 * Name the list with aria-label or aria-labelledby. For pages with their own URLs use links (NavTabs), not tabs.
 * `variant="pill"` on the list draws the tabs as pills with the current one in ink, without the hairline:
 * the sections of a settings panel, or tabs inside a card, where a line under them would be one line too many.
 * `variant="chip"` draws small 24px outlined chips with the current one filled gray: the quick filters above a list
 * (All, Unread, Starred), where the tabs narrow the same list rather than swap a section.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex min-w-0 flex-col gap-4 data-[orientation=vertical]:flex-row", className)}
      {...props}
    />
  );
}

type TabsVariant = "underline" | "pill" | "chip";

/** What the list sets for its triggers: the look, so every trigger matches without repeating it, and whether arrows wrap. */
const TabsListContext = React.createContext<{ variant: TabsVariant; loop: boolean }>({
  variant: "underline",
  loop: true,
});

const TABS_LIST_VARIANTS = {
  underline:
    "data-[orientation=horizontal]:items-end data-[orientation=horizontal]:gap-1 data-[orientation=horizontal]:border-b data-[orientation=horizontal]:border-border data-[orientation=vertical]:gap-0.5 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-border",
  pill: "gap-2 data-[orientation=horizontal]:items-center data-[orientation=horizontal]:py-0.5 data-[orientation=vertical]:gap-0.5",
  chip: "gap-1 data-[orientation=horizontal]:items-center data-[orientation=vertical]:gap-0.5",
};

const TABS_TRIGGER_VARIANTS = {
  // The bar is the trigger's own edge laid over the list's hairline, so nothing moves when the tab changes.
  underline:
    "h-9 px-2.5 font-medium after:absolute after:bg-signal after:opacity-0 after:transition-opacity after:duration-100 data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:bottom-0 data-[orientation=horizontal]:after:h-0.5 data-[orientation=vertical]:px-3.5 data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:w-0.5 data-[state=active]:after:opacity-100",
  // The keyboard outline sits inside the tab, so on the active pill it takes the pill's own text color: indigo on the
  // dark theme's paper pill would be 2:1.
  pill: "h-8 rounded-control px-3 font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:text-primary-foreground data-[state=active]:focus-visible:outline-primary-foreground",
  chip: "h-6 min-h-[24px] rounded-chip border border-input px-2 text-xs font-medium data-[state=active]:border-transparent data-[state=active]:bg-secondary data-[state=active]:text-foreground",
};

/** The row scrolls sideways when the tabs do not fit, without a scrollbar of its own: arrow keys bring a tab into view. */
function TabsList({
  className,
  variant = "underline",
  loop = true,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  /** `underline` (a hairline with the signal bar), `pill` (highlighted pills) or `chip` (small outlined filters). */
  variant?: TabsVariant;
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        "flex min-w-0 shrink-0 [scrollbar-width:none] data-[orientation=horizontal]:overflow-x-auto data-[orientation=vertical]:flex-col",
        TABS_LIST_VARIANTS[variant],
        className,
      )}
      loop={loop}
      {...props}
    >
      <TabsListContext.Provider value={{ variant, loop }}>{children}</TabsListContext.Provider>
    </TabsPrimitive.List>
  );
}

const KEY_TO_INTENT: Record<string, "prev" | "next" | "first" | "last"> = {
  ArrowLeft: "prev",
  ArrowRight: "next",
  Home: "first",
  PageUp: "first",
  End: "last",
  PageDown: "last",
};

/**
 * Shows the whole tab after a focus with preventScroll: the nearest row that scrolls sideways (the list itself, or a scroll
 * area around it) moves just far enough, and the page only when the tab is outside the window. A tab in a stuck row is
 * always inside it, so there the page stays put; a row scrolled off the screen is brought back the least distance.
 */
function revealInRow(tab: HTMLElement) {
  const { ownerDocument } = tab;
  const page = ownerDocument.scrollingElement;
  for (let row = tab.parentElement; row && row !== page && row !== ownerDocument.body; row = row.parentElement) {
    if (row.scrollWidth <= row.clientWidth) continue;
    const overflow = getComputedStyle(row).overflowX;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const tabBox = tab.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (tabBox.left < rowBox.left) row.scrollLeft -= rowBox.left - tabBox.left;
    else if (tabBox.right > rowBox.right) row.scrollLeft += tabBox.right - rowBox.right;
    break;
  }
  const { top, bottom } = tab.getBoundingClientRect();
  const windowHeight = ownerDocument.defaultView?.innerHeight ?? 0;
  if (top < 0 || bottom > windowHeight) tab.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

function TabsTrigger({
  className,
  onMouseDown,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { variant, loop } = React.useContext(TabsListContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      onMouseDown={(event) => {
        onMouseDown?.(event);
        // Radix opens a tab on mousedown with a plain focus(), and a browser that focuses an element in a sticky row scrolls
        // the page back to the row's resting place: in a long settings page scrolled down, the row jumped down on every
        // click. Focusing it first without scrolling turns that call into a no-op; touch is unaffected.
        if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !props.disabled) {
          event.currentTarget.focus({ preventScroll: true });
          revealInRow(event.currentTarget);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // Radix moves between tabs with a plain focus() too, which scrolled the page the same way. A row of tabs is moved
        // through here instead, with the same keys and rules (disabled tabs skipped, wrapping unless the list says
        // loop={false}, arrows swapped right to left); preventDefault tells Radix it is handled. Its focus handler still
        // opens the tab and moves the tab stop. A vertical list is left to Radix.
        const tab = event.currentTarget;
        const intent = KEY_TO_INTENT[event.key];
        if (event.defaultPrevented || !intent || event.target !== tab) return;
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        if (tab.getAttribute("data-orientation") !== "horizontal") return;
        const list = tab.closest<HTMLElement>('[role="tablist"]');
        if (!list) return;
        const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(
          (item) => item.closest('[role="tablist"]') === list && !item.disabled,
        );
        // The list's direction, not a tab's own: a tab whose label is set dir="ltr" must not turn the arrows round.
        const rtl = list.closest("[dir]")?.getAttribute("dir") === "rtl";
        const forward = intent === "first" || (intent === "next" && !rtl) || (intent === "prev" && rtl);
        const ordered = forward ? tabs : tabs.slice().reverse();
        let candidates = ordered;
        if (intent === "prev" || intent === "next") {
          const after = ordered.indexOf(tab) + 1;
          candidates = loop ? [...ordered.slice(after), ...ordered.slice(0, after)] : ordered.slice(after);
        }
        event.preventDefault();
        // Like Radix, the first candidate that takes the focus wins, so a tab that is hidden is passed over.
        for (const candidate of candidates) {
          candidate.focus({ preventScroll: true });
          // Asked of the tab's own root: inside a shadow root the document reports the host instead.
          if ((candidate.getRootNode() as Document | ShadowRoot).activeElement === candidate) {
            revealInRow(candidate);
            return;
          }
        }
      }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-1.5 text-base whitespace-nowrap text-muted-foreground transition-colors duration-100 select-none hover:text-foreground focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[orientation=vertical]:justify-start data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        TABS_TRIGGER_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/** A panel is a tab stop itself, so a keyboard user reaches text that has no control in it. */
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("min-w-0 flex-1", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
