import * as React from "react";
import { Slot } from "radix-ui";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/utils";

/**
 * The page a product shows for an address it does not have: the brand mark, the status code, a title that says so, a
 * sentence and the way back, in one narrow column centred in the window. Every Abnormal site uses it, so a lost visitor
 * meets the same page on the website, in WebMail, the console, the developer site and the status page.
 * Every word comes in as children. NotFoundAside, under a rule, holds where else to go or the same words in the site's
 * other language, so a bilingual 404 (one page for both languages) is still one column. `mark={false}` leaves the mark
 * out where the page's own header already shows it; `asChild` puts it on the page's own element when a layout already has
 * the `main`.
 */
function NotFound({
  className,
  mark = true,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"main"> & { mark?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "main";
  return (
    <Comp
      data-slot="not-found"
      className={cn("mx-auto flex min-h-[70svh] w-full max-w-xl flex-col justify-center px-4 py-16", className)}
      {...props}
    >
      {mark && <BrandMark className="mb-8 size-10" />}
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
    </Comp>
  );
}

/** The status code ("404", "404 · Page not found") in the mono label, led by a signal-colored dot. */
function NotFoundCode({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="not-found-code"
      className={cn(
        "flex items-center gap-2.5 font-mono text-xs/[1.4] tracking-[0.06em] text-muted-foreground uppercase before:size-1.5 before:shrink-0 before:rounded-full before:bg-signal",
        className,
      )}
      {...props}
    />
  );
}

/** The page's h1: one short line that says the page is not here. */
function NotFoundTitle({ className, asChild = false, ...props }: React.ComponentProps<"h1"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "h1";
  return (
    <Comp
      data-slot="not-found-title"
      className={cn(
        "mt-4 font-heading text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] font-semibold tracking-[-0.02em] text-balance",
        className,
      )}
      {...props}
    />
  );
}

/** A sentence or two on why the page may be missing and what to try. */
function NotFoundDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="not-found-description"
      className={cn("mt-3 max-w-[34rem] text-md/prose text-pretty text-muted-foreground", className)}
      {...props}
    />
  );
}

/** The way back and any other next step, as buttons. */
function NotFoundActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="not-found-actions" className={cn("mt-6 flex flex-wrap gap-3", className)} {...props} />;
}

/** Under a rule: links to the pages a lost visitor most likely meant, or the same words in the other language. */
function NotFoundAside({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="not-found-aside"
      className={cn("mt-10 border-t border-border pt-6 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { NotFound, NotFoundActions, NotFoundAside, NotFoundCode, NotFoundDescription, NotFoundTitle };
