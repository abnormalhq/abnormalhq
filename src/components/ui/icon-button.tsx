"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LabelTooltip } from "@/components/ui/tooltip";

/**
 * A button that shows only an icon, with the name it needs: `label` is its accessible name and the tooltip it shows on
 * hover and keyboard focus, so what a screen reader hears is also what a sighted person can read. The tooltip is the
 * theme's (never the browser's title): it opens on `tooltipSide` (top by default) and moves to the other side or along
 * the edge when there is no room, in a portal no scrolling box or neighbor can cover.
 * `tooltip` shows other words than the name, such as the name with its shortcut ("Archive (E)"), and is then also the
 * button's description; `tooltip={false}` shows none, for a button whose icon is the whole story in its context.
 * It is a Button in every other way (variants, loading, asChild; size `icon` unless given), so it also works as the child
 * of a DropdownMenuTrigger or PopoverTrigger. Inside a TooltipTrigger it leaves the tooltip to that trigger.
 * Server-safe items cannot use it (it is a client component); there a Button with an aria-label stays without a hint.
 */
function IconButton({
  label,
  tooltip,
  tooltipSide,
  size = "icon",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "aria-label"> & {
  /** The button's name, such as "Archive": its aria-label and, unless `tooltip` says otherwise, its tooltip. */
  label: string;
  /** Other words for the tooltip than the name, or false for none. */
  tooltip?: React.ReactNode;
  /** The side the tooltip prefers. */
  tooltipSide?: React.ComponentProps<typeof LabelTooltip>["side"];
}) {
  return (
    <LabelTooltip label={tooltip === undefined ? label : tooltip} side={tooltipSide}>
      <Button size={size} aria-label={label} {...props} />
    </LabelTooltip>
  );
}

export { IconButton };
