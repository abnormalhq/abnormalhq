import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A quiet link with an optional trailing icon: gray text that brightens on hover.
 * `inline` is the link inside a sentence ("Remembered it? Sign in"): it keeps the size and weight of the text around
 * it, takes the foreground color, which stands out of muted text, and is underlined faintly, the line deepening on
 * hover, so it reads as a link without a link color.
 */
const textLinkVariants = cva("cursor-pointer transition-colors duration-100", {
  variants: {
    variant: {
      default: "inline-flex items-center gap-2 text-base/[1.6] font-medium text-muted-foreground hover:text-foreground",
      inline:
        "text-foreground underline decoration-current/40 underline-offset-4 hover:decoration-current [&_svg]:inline [&_svg]:align-[-0.125em]",
    },
  },
  defaultVariants: { variant: "default" },
});

function TextLink({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & VariantProps<typeof textLinkVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="text-link"
      data-variant={variant}
      className={cn(textLinkVariants({ variant }), className)}
      {...props}
    />
  );
}

export { TextLink, textLinkVariants };
