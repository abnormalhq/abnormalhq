import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Where a page sits: a navigation landmark holding an ordered list of links, ending in the page itself.
 * `label` names the landmark ("Breadcrumb"), in the page's language. The last entry is BreadcrumbPage: text, not a
 * link, marked aria-current="page". The chevrons between entries are decoration and hidden from assistive
 * technology, which already has the list order.
 */
function Breadcrumb({ label, ...props }: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: string }) {
  return <nav data-slot="breadcrumb" aria-label={label} {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li data-slot="breadcrumb-item" className={cn("inline-flex min-w-0 items-center gap-1.5", className)} {...props} />
  );
}

/** A link to an ancestor page. Pass asChild with the router's link. */
function BreadcrumbLink({ className, asChild = false, ...props }: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        "truncate rounded-chip underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("truncate font-medium text-foreground", className)}
      {...props}
    />
  );
}

/** The mark between two entries: a chevron that follows the reading direction, or the children given. */
function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("inline-flex items-center text-muted-foreground/70 [&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="rtl:rotate-180"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </li>
  );
}

/**
 * Stands for the levels left out of a long trail; `label` says so to a screen reader ("More levels"). It is not a
 * control: to let people reach those levels, put a ghost icon Button that opens a DropdownMenu in the item instead.
 */
function BreadcrumbEllipsis({ label, className, ...props }: React.ComponentProps<"span"> & { label: string }) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      className={cn("inline-flex size-6 items-center justify-center", className)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-3.5"
      >
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
