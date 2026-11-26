"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip as TooltipPrimitive } from "radix-ui";

/** Set by TooltipProvider, so a Tooltip can tell whether one is above it. */
const TooltipProviderContext = React.createContext(false);

/**
 * Tooltip: a small ink label in both themes (the .ink values, so its text and any Kbd inside read light on dark), with
 * a soft shadow; it fades in from just below like menus.
 * TooltipProvider is optional. Wrap an area in one to share the open delay, and the skip-delay window that lets the next tooltip open at once.
 */
function TooltipProvider({ delayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipProviderContext.Provider value={true}>
      <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
    </TooltipProviderContext.Provider>
  );
}

/**
 * Radix throws without a provider, so a Tooltip with none above it brings its own. It looks for this file's
 * TooltipProvider only: under Radix's own Tooltip.Provider it would still bring one and lose the shared delay, so wrap
 * areas in TooltipProvider from here.
 */
function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
  return React.useContext(TooltipProviderContext) ? root : <TooltipProvider>{root}</TooltipProvider>;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-overlay max-w-64 origin-(--radix-tooltip-content-transform-origin) ink rounded-control px-2 py-1 text-xs font-medium shadow-popover data-open:animate-arrive data-closed:animate-leave",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
