import * as React from "react";
import { cn } from "@/lib/utils";

/** A list of questions and answers on native <details>: it works before hydration and needs no client JavaScript. */
function DisclosureList({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="disclosure-list" className={cn("border-t border-border", className)} {...props} />;
}

function Disclosure({ className, ...props }: React.ComponentProps<"details">) {
  return (
    <details data-slot="disclosure" className={cn("group/disclosure border-b border-border", className)} {...props} />
  );
}

/**
 * The row itself, with a plus that turns into a close mark while open.
 * `indicator` replaces that mark; style it with `group-open/disclosure:` to follow the open state.
 */
function DisclosureTrigger({
  className,
  children,
  indicator,
  ...props
}: React.ComponentProps<"summary"> & { indicator?: React.ReactNode }) {
  return (
    <summary
      data-slot="disclosure-trigger"
      className={cn(
        "group/trigger flex min-h-[4.75rem] cursor-pointer list-none items-center gap-[1.1rem] py-[1.2rem] leading-[1.7] max-[23.4375rem]:gap-[0.65rem] [&::-webkit-details-marker]:hidden",
        className,
      )}
      {...props}
    >
      {children}
      {indicator ?? (
        <span className="grid size-8 shrink-0 place-items-center rounded-control text-muted-foreground transition-[transform,background-color,color] duration-100 group-open/disclosure:rotate-45 group-open/disclosure:bg-control group-open/disclosure:text-foreground group-hover/trigger:bg-control group-hover/trigger:text-foreground">
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
            className="size-4"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </span>
      )}
    </summary>
  );
}

function DisclosureContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="disclosure-content"
      className={cn("-mt-[0.3rem] mb-[1.4rem] text-base/[1.85] text-muted-foreground", className)}
      {...props}
    />
  );
}

export { DisclosureList, Disclosure, DisclosureTrigger, DisclosureContent };
