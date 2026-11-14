import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * What a list, a search or a page shows when it has nothing to show: an icon in a tile, a title, a sentence and the
 * next step (create the first one, clear the filters, go back home).
 * `default` is the large block that stands in for a whole list or page: centered, with a thin border and room around
 * it. `compact` is the dashed box that stands in for one panel or section among others (no logs yet, no domain to
 * choose), left-aligned and in the text's own size, usually with a sentence and nothing else.
 * Every word comes in as children. The title is a paragraph unless `asChild` on EmptyStateTitle makes it the heading
 * the outline needs, such as the h1 of a not-found page.
 */
const emptyStateVariants = cva("group/empty-state flex min-w-0 flex-col text-muted-foreground", {
  variants: {
    variant: {
      default: "items-center gap-3 rounded-panel border border-border px-6 py-16 text-center",
      compact: "items-start gap-2 rounded-control border border-dashed border-border p-5 text-sm",
    },
  },
  defaultVariants: { variant: "default" },
});

function EmptyState({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyStateVariants>) {
  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      className={cn(emptyStateVariants({ variant }), className)}
      {...props}
    />
  );
}

/** The icon above the title, in a tile that fades into the page. The icon is decoration: the title says what is empty. */
function EmptyStateIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="empty-state-icon"
      aria-hidden="true"
      className={cn(
        "mb-1 grid size-12 shrink-0 place-items-center rounded-mark border border-border bg-linear-to-b from-surface to-background text-foreground [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      {...props}
    />
  );
}

/** One short line: "No mailboxes yet". Pass asChild with a heading when the empty state is the page's main content. */
function EmptyStateTitle({ className, asChild = false, ...props }: React.ComponentProps<"p"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "p";
  return (
    <Comp
      data-slot="empty-state-title"
      className={cn(
        "text-lg font-semibold text-pretty text-foreground group-data-[variant=compact]/empty-state:text-sm group-data-[variant=compact]/empty-state:font-medium",
        className,
      )}
      {...props}
    />
  );
}

/** What to do about it, in a sentence. */
function EmptyStateDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn("max-w-sm text-sm leading-relaxed text-pretty", className)}
      {...props}
    />
  );
}

/** The next steps, usually one Button, and a quieter second one. */
function EmptyStateActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-actions"
      className={cn(
        "mt-2 flex flex-wrap items-center gap-2 group-data-[variant=default]/empty-state:justify-center group-data-[variant=compact]/empty-state:mt-1",
        className,
      )}
      {...props}
    />
  );
}

export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription, EmptyStateActions, emptyStateVariants };
