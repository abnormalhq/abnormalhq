import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A button that stays pressed: bold in an editor, a filter that is on. Off, it looks like a ghost button; on, it
 * takes the soft highlight, the surface of a selected row, so the pressed state reads as a selection.
 * `outline` gives it the input border, for a toggle standing alone in a toolbar of outline buttons.
 */
const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border border-transparent font-medium whitespace-nowrap text-muted-foreground transition-[background-color,border-color,color] duration-150 select-none hover:bg-control hover:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive data-[state=on]:bg-highlight-muted data-[state=on]:text-foreground data-[state=on]:hover:bg-highlight-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "",
        outline: "border-input bg-control",
      },
      size: {
        default: "h-8 min-w-8 px-2.5 text-base",
        sm: "h-7 min-w-7 px-2 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 min-w-10 px-3.5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      data-variant={variant}
      data-size={size}
      className={cn(toggleVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
