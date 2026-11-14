import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Names and their values, such as a server's connection details or a build's version: a `dl` whose names take the
 * width of the longest one and whose values take the rest, so every value starts on the same line.
 * `default` is the bare list, for a card or a dialog that already frames it; `panel` frames it in a tinted box, for a
 * summary set into a form; `spread` puts each value at the far end of its row, on a line between rows, for a short
 * receipt such as an order's number and total. `lined` keeps the values in their column with a hairline between rows,
 * for credentials or settings read row by row, and on a phone puts each value under its name. `stacked` always puts
 * the value under its name, for pairs whose values are long or whose names are, such as an address, an amount with
 * its breakdown, or a document's dates side by side in a grid of the page's.
 * Each row is a `div` around a `dt` and a `dd` (DescriptionItem), which HTML allows in a `dl`, so a row can carry a
 * key and props without breaking the list.
 */
const descriptionListVariants = cva("min-w-0 text-sm", {
  variants: {
    variant: {
      default: "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5",
      panel:
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-control border border-border bg-muted/40 p-4",
      spread: "grid divide-y divide-border",
      // Each row is a subgrid of the list's two columns, so a line can run under it and the values still line up.
      lined: "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 max-sm:grid-cols-1",
      stacked: "grid gap-y-3",
    },
  },
  defaultVariants: { variant: "default" },
});

function DescriptionList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"dl"> & VariantProps<typeof descriptionListVariants>) {
  return (
    <dl
      data-slot="description-list"
      data-variant={variant}
      className={cn("group/description-list", descriptionListVariants({ variant }), className)}
      {...props}
    />
  );
}

/** One row: a DescriptionTerm and a DescriptionDetails, or `label` and children for the two at once. */
function DescriptionItem({
  className,
  label,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** The name, when the row is written in one go: `<DescriptionItem label="Host">mail.example.com</DescriptionItem>`. */
  label?: React.ReactNode;
}) {
  return (
    <div
      data-slot="description-item"
      className={cn(
        "contents group-data-[variant=lined]/description-list:col-span-full group-data-[variant=lined]/description-list:grid group-data-[variant=lined]/description-list:grid-cols-subgrid group-data-[variant=lined]/description-list:items-baseline group-data-[variant=lined]/description-list:gap-y-0.5 group-data-[variant=lined]/description-list:border-t group-data-[variant=lined]/description-list:border-border group-data-[variant=lined]/description-list:py-2.5 group-data-[variant=lined]/description-list:first:border-t-0 group-data-[variant=stacked]/description-list:flex group-data-[variant=stacked]/description-list:flex-col group-data-[variant=stacked]/description-list:gap-0.5 group-data-[variant=spread]/description-list:flex group-data-[variant=spread]/description-list:flex-wrap group-data-[variant=spread]/description-list:justify-between group-data-[variant=spread]/description-list:gap-x-5 group-data-[variant=spread]/description-list:gap-y-1 group-data-[variant=spread]/description-list:py-2",
        className,
      )}
      {...props}
    >
      {label === undefined ? (
        children
      ) : (
        <>
          <DescriptionTerm>{label}</DescriptionTerm>
          <DescriptionDetails>{children}</DescriptionDetails>
        </>
      )}
    </div>
  );
}

function DescriptionTerm({ className, ...props }: React.ComponentProps<"dt">) {
  return <dt data-slot="description-term" className={cn("shrink-0 text-muted-foreground", className)} {...props} />;
}

/**
 * The value. Long text such as an address or a key wraps anywhere instead of widening the list. `action` sits right
 * after the value on the same line, such as a CopyButton for it.
 */
function DescriptionDetails({
  className,
  action,
  children,
  ...props
}: React.ComponentProps<"dd"> & {
  /** A control for this value, such as a CopyButton. */
  action?: React.ReactNode;
}) {
  return (
    <dd
      data-slot="description-details"
      className={cn(
        "min-w-0 wrap-anywhere text-foreground",
        action !== undefined && "flex items-start gap-1.5",
        className,
      )}
      {...props}
    >
      {action === undefined ? (
        children
      ) : (
        <>
          <span className="min-w-0">{children}</span>
          <span data-slot="description-action" className="-my-0.5 flex shrink-0 items-center">
            {action}
          </span>
        </>
      )}
    </dd>
  );
}

export { DescriptionList, DescriptionItem, DescriptionTerm, DescriptionDetails, descriptionListVariants };
