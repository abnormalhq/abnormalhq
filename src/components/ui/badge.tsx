import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * Chip: a small label on a surface background with soft rounded corners, marking side notes such as counts, domains and roles.
 * To express status use StatusLabel (dot + word), not a chip.
 * `sm` is the 20px chip for a dense row, such as a count in a navigation item.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-chip border border-transparent leading-none font-medium whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline: "border-border text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        success: "bg-success/10 text-success",
        brand: "bg-highlight text-highlight-foreground",
      },
      size: {
        default: "h-6 px-2 text-xs",
        sm: "h-5 px-1.5 text-2xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/**
 * A number in a round chip, such as the unread messages of a folder: at least as wide as it is tall, and capped, so
 * 1,204 shows as `max` and a plus ("99+") and never widens the row. Nothing renders for zero unless `showZero`.
 * `format` writes the number for the page's locale. The chip shows the number only: give the item it belongs to
 * a name that says it ("Inbox, 3 unread"), or give the chip an `aria-label`, and otherwise leave it aria-hidden.
 */
function BadgeCount({
  count,
  max,
  showZero = false,
  format = String,
  className,
  size = "sm",
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "children" | "asChild"> & {
  count: number;
  /** The highest number written out; above it the chip shows this number and a plus. */
  max?: number;
  showZero?: boolean;
  format?: (value: number) => string;
}) {
  if (count <= 0 && !showZero) return null;
  const capped = max !== undefined && count > max;
  return (
    <Badge
      data-slot="badge-count"
      size={size}
      className={cn("min-w-5 justify-center rounded-full tabular-nums data-[size=default]:min-w-6", className)}
      {...props}
    >
      {capped ? `${format(max)}+` : format(count)}
    </Badge>
  );
}

const badgeDotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
  variants: {
    variant: {
      /** Something new: highlighter yellow, ringed in ink so it shows on yellow and on paper alike. */
      brand: "bg-highlight ring-2 ring-highlight-foreground",
      destructive: "bg-destructive",
      muted: "bg-muted-foreground",
    },
  },
  defaultVariants: { variant: "brand" },
});

/**
 * A dot that says there is something to see without saying how much, such as on a menu button while a folder has
 * unread mail. Place it with `className` (`absolute top-1 right-1` on a `relative` button). It is decoration unless
 * given `label`, in the page's words, when it is the only sign of what it marks.
 */
function BadgeDot({
  className,
  variant,
  label,
  ...props
}: Omit<React.ComponentProps<"span">, "children" | "role" | "aria-label" | "aria-hidden"> &
  VariantProps<typeof badgeDotVariants> & {
    /** What the dot means, read by a screen reader: "New replies". */
    label?: string;
  }) {
  return (
    <span
      data-slot="badge-dot"
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={cn(badgeDotVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, BadgeCount, BadgeDot, badgeVariants, badgeDotVariants };
