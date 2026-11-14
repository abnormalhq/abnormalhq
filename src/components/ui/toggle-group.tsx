"use client";

import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

/** The variant and size set on the group, so every item matches without repeating them. */
const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({});

/**
 * Toggles joined into one control: one pressed at a time (type="single", such as a view switcher) or several
 * (type="multiple", such as text styles). `outline` draws one border around the group, and the items inside
 * share it, so the row reads as a single segmented control.
 */
function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "flex w-fit items-center rounded-control data-[variant=outline]:border data-[variant=outline]:border-input data-[variant=outline]:bg-control",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const group = React.useContext(ToggleGroupContext);
  const resolved = { variant: group.variant ?? variant, size: group.size ?? size };
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={resolved.variant}
      data-size={resolved.size}
      className={cn(
        toggleVariants(resolved),
        // The group draws the outline border; the items keep only their pressed surface, squared where they meet.
        "min-w-0 flex-1 rounded-none first:rounded-l-control last:rounded-r-control focus-visible:z-10 data-[variant=outline]:border-0 data-[variant=outline]:bg-transparent data-[variant=outline]:data-[state=on]:bg-highlight-muted",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
