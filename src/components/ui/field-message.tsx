import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The line under a form field: a dot + one sentence, with the color following the tone.
 * It stays in the DOM while empty and takes no space, so an aria-live region is already there when a message arrives.
 */
const fieldMessageVariants = cva(
  "mt-[9px] flex items-start gap-[7px] text-xs/[1.65] wrap-anywhere text-muted-foreground before:mt-[7px] before:size-[5px] before:shrink-0 before:rounded-full before:bg-muted-foreground empty:m-0 empty:before:hidden",
  {
    variants: {
      tone: {
        default: "",
        busy: "before:bg-badge-ink",
        ok: "text-success before:bg-success",
        error: "text-destructive before:bg-destructive",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

function FieldMessage({
  className,
  tone,
  ...props
}: React.ComponentProps<"p"> & VariantProps<typeof fieldMessageVariants>) {
  return (
    <p
      data-slot="field-message"
      aria-live="polite"
      className={cn(fieldMessageVariants({ tone }), className)}
      {...props}
    />
  );
}

export { FieldMessage, fieldMessageVariants };
