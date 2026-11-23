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

/**
 * The title at the top of an inner page (pricing, help, a document): its h1, a step above the section title, from 36px on
 * phones to 56px on wide screens. A landing page's hero sets its own, larger headline.
 */
function PageTitle({ className, asChild = false, ...props }: React.ComponentProps<"h1"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "h1";
  return (
    <Comp
      data-slot="page-title"
      className={cn(
        "mt-5 font-heading text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-balance",
        className,
      )}
      {...props}
    />
  );
}

/** The sentence or two under a page title that says what the page is for. */
function PageLead({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-lead"
      className={cn("mt-5 max-w-[40rem] text-md/prose text-pretty text-muted-foreground md:text-lg/prose", className)}
      {...props}
    />
  );
}

/** The punctuation that ends a headline, in the signal color. */
function HeadingMark({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="heading-mark" className={cn("text-signal", className)} {...props} />;
}

export { Eyebrow, HeadingMark, PageLead, PageTitle, SectionTitle, sectionSpaceClassName };
