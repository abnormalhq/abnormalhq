import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A card has a thin border and no background fill; table content can extend to the panel edge via p-0.
 * `interactive` deepens the border on hover, for cards that are links; `featured` keeps it deepened, for the one that leads.
 */
const cardVariants = cva("flex min-w-0 flex-col rounded-panel border border-border bg-card", {
  variants: {
    variant: {
      default: "",
      interactive: "transition-[border-color] duration-150 hover:border-border-strong",
      featured: "border-[color-mix(in_oklab,var(--brand)_55%,var(--border))]",
    },
  },
  defaultVariants: { variant: "default" },
});

function Card({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof cardVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "section";
  return <Comp data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min items-center gap-x-4 gap-y-1 px-4 pt-4 pb-2 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * An h2 by default. The right level depends on where the card sits, so pass asChild with the element that fits the
 * outline, such as `<CardTitle asChild><h3>…</h3></CardTitle>` under a section's h2, or a div for no heading at all.
 */
function CardTitle({ className, asChild = false, ...props }: React.ComponentProps<"h2"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "h2";
  return (
    <Comp data-slot="card-title" className={cn("flex items-center gap-2 text-lg font-bold", className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="card-description" className={cn("text-sm text-pretty text-muted-foreground", className)} {...props} />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("min-w-0 p-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex flex-wrap items-center gap-3 rounded-b-panel border-t border-border p-3", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent, cardVariants };
