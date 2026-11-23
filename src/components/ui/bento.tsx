import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A wall of feature tiles on a landing page: one column on phones, two from `sm` and three from `lg`. Tiles are panels
 * with a faint fill over the page, so the wall reads as one surface in either theme, with no shadows. Tiles read in
 * source order; a `wide` tile takes two columns from `sm` up, so place it where the tiles after it can fill its row.
 * Pass `asChild` with a `ul role="list"` and give each tile `asChild` with an `li` when the tiles are a list: the wall
 * takes the list markers away, and Safari then stops announcing a list unless the role says so.
 */
function Bento({ className, asChild = false, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="bento"
      className={cn("grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3", className)}
      {...props}
    />
  );
}

/**
 * One tile: a title, a sentence and a visual. The text leads and the visual sits at the foot, so the titles of a row
 * start on one line whatever the height of the pictures under them.
 */
function BentoTile({
  className,
  wide = false,
  asChild = false,
  ...props
}: React.ComponentProps<"article"> & {
  /** Spans two columns from `sm` up. */
  wide?: boolean;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "article";
  return (
    <Comp
      data-slot="bento-tile"
      data-wide={wide || undefined}
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-panel border border-border bg-control p-6 lg:p-7",
        wide && "sm:col-span-2",
        className,
      )}
      {...props}
    />
  );
}

/** The tile's title, an h3 unless `asChild` gives it the level the page needs. */
function BentoTitle({ className, asChild = false, ...props }: React.ComponentProps<"h3"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "h3";
  return (
    <Comp
      data-slot="bento-title"
      className={cn("text-lg/[1.4] font-semibold tracking-[-0.01em] text-foreground", className)}
      {...props}
    />
  );
}

function BentoDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="bento-description"
      className={cn("mt-1.5 text-base/prose text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * The picture at the foot of a tile: a small piece of the product drawn in markup, a screenshot, a number. It is
 * pushed to the bottom of the tile. When it only illustrates what the text already says, mark it `aria-hidden`.
 */
function BentoVisual({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="bento-visual" className={cn("mt-auto min-w-0", className)} {...props} />;
}

export { Bento, BentoTile, BentoTitle, BentoDescription, BentoVisual };
