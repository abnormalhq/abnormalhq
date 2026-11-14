"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon, MinusIcon } from "lucide-react";

/** A 16px square with 4px radius; when checked it fills with text and a check in the bg color: quiet, no brand color. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Project addition: the indeterminate state also needs a fill color, and shows a "minus" instead of a check.
        "group/checkbox data-[state=indeterminate]:border-foreground data-[state=indeterminate]:bg-foreground data-[state=indeterminate]:text-background",
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-muted-foreground/70 bg-control transition-[background-color,border-color] duration-150 after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-checked:border-foreground data-checked:bg-foreground data-checked:text-background",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3"
      >
        <CheckIcon strokeWidth={2.5} className="group-data-[state=indeterminate]/checkbox:hidden" />
        <MinusIcon strokeWidth={2.5} className="hidden group-data-[state=indeterminate]/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
