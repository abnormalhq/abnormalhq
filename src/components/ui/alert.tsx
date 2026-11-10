import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Notice block: surface background, 1px border, the shared control radius, and a 14px outlined icon on the left.
 * "Quiet urgency": errors and success only change the text color, without tinting the whole block red or green.
 * Only `destructive` is role="alert", which interrupts a screen reader; the others are role="status" and wait their
 * turn. Pass `role` to choose otherwise, such as a default notice that must interrupt.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-control border border-border bg-muted px-4 py-3.5 text-left text-base has-data-[slot=alert-action]:pr-12 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:mt-[3px] *:[svg]:text-current *:[svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "text-foreground",
        destructive: "text-destructive",
        success: "text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "text-pretty group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:decoration-current/40 [&_a]:underline-offset-4 [&_a]:hover:decoration-current",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-pretty text-muted-foreground group-data-[variant=destructive]/alert:text-destructive/85 group-data-[variant=success]/alert:text-success/85 [&_a]:underline [&_a]:decoration-current/40 [&_a]:underline-offset-4 [&_a]:hover:decoration-current [&_p:not(:last-child)]:mb-2",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cn("absolute top-1.5 right-1.5", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
