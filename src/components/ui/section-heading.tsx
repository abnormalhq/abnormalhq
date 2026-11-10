import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/** Section spacing that grows with the viewport. */
const sectionSpaceClassName = "py-16 md:py-20 lg:py-24";

/** A small uppercase label, led by a signal-colored dot. */
function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="eyebrow"
      className={cn(
        "flex items-center gap-2.5 text-xs/[1.4] font-medium tracking-[0.06em] text-muted-foreground uppercase before:size-1.5 before:shrink-0 before:rounded-full before:bg-signal",
        className,
      )}
      {...props}
    />
  );
}

/** The section title scale: 28px on phones, then the display scale: 34px on tablets, 40px on desktops. */
function SectionTitle({ className, asChild = false, ...props }: React.ComponentProps<"h2"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "h2";
  return (
    <Comp
      data-slot="section-title"
      className={cn(
        "mt-5 font-heading text-3xl/[1.3] font-semibold tracking-[-0.02em] md:text-display-sm lg:text-display",
        className,
      )}
      {...props}
    />
  );
}

/** The punctuation that ends a headline, in the signal color. */
function HeadingMark({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="heading-mark" className={cn("text-signal", className)} {...props} />;
}

export { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName };
