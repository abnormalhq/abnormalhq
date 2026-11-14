import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status label: a dot + one word, always together: the dot's color carries the status, and the word confirms it.
 * The default is `badge`: a light-background pill in the status color, used in tables, lists and cards;
 * `dot` is only the dot and the word with no background, used where the layout already has its own typography, such as navigation, dropdown options and large result titles.
 */
const statusLabelVariants = cva("inline-flex items-center gap-1.5 whitespace-nowrap", {
  variants: {
    variant: {
      badge: "h-6 w-fit rounded-chip px-2 text-xs leading-none font-medium",
      dot: "text-sm text-muted-foreground",
    },
    tone: {
      /** "To be created" / in progress: amber badge-ink. */
      pending: "",
      /** "Enabled" / connected. */
      success: "",
      /** "Disabled" / neutral. */
      muted: "",
      destructive: "",
    },
  },
  compoundVariants: [
    { variant: "badge", tone: "pending", className: "bg-badge-ink/12 text-badge-ink" },
    { variant: "badge", tone: "success", className: "bg-success/12 text-success" },
    { variant: "badge", tone: "muted", className: "bg-muted text-muted-foreground" },
    { variant: "badge", tone: "destructive", className: "bg-destructive/12 text-destructive" },
  ],
  defaultVariants: {
    variant: "badge",
    tone: "muted",
  },
});

const statusDotVariants = cva("size-[6px] shrink-0 rounded-full", {
  variants: {
    tone: {
      pending: "bg-badge-ink",
      success: "bg-success",
      muted: "bg-muted-foreground",
      destructive: "bg-destructive",
    },
  },
  defaultVariants: {
    tone: "muted",
  },
});

type StatusLabelProps = React.ComponentProps<"span"> & VariantProps<typeof statusLabelVariants>;

function StatusLabel({ className, tone, variant, children, ...props }: StatusLabelProps) {
  return (
    <span
      data-slot="status-label"
      data-tone={tone}
      data-variant={variant ?? "badge"}
      className={cn(statusLabelVariants({ variant, tone }), className)}
      {...props}
    >
      <span aria-hidden="true" className={statusDotVariants({ tone })} />
      {children}
    </span>
  );
}

export { StatusLabel, statusDotVariants, type StatusLabelProps };
