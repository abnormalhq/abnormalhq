import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where someone is in a fixed sequence: checkout, onboarding, a setup wizard. It is an ordered list, so the count
 * and the position come from the markup, and the current step carries aria-current="step".
 * Each step has a `status`. A complete step shows a check in a filled disc, the current one its number in the signal
 * color (ink in light, yellow in dark and in the ink shell), an upcoming one a quiet outline; the line after a
 * complete step is filled. The check is a picture, so `statusLabel` says the same in words to a screen reader
 * ("Completed"), in the page's language.
 * It shows progress and holds no state. To let people go back, put a link or a button in StepperTitle.
 * `orientation` is horizontal, for the top of a flow, or vertical, for a side column or a narrow screen. Name the
 * list with aria-label or aria-labelledby.
 */
function Stepper({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"ol"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <ol
      data-slot="stepper"
      data-orientation={orientation}
      className={cn(
        "group/stepper flex min-w-0 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:items-start data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

/**
 * One step: a StepperIndicator, then StepperContent with its title. The line to the next step is drawn by the item,
 * and the last item has none.
 */
function StepperItem({
  className,
  status,
  statusLabel,
  children,
  ...props
}: React.ComponentProps<"li"> & {
  status: "complete" | "current" | "upcoming";
  /** The status in words for a screen reader, such as "Completed"; the current step is already announced as current. */
  statusLabel?: string;
}) {
  return (
    <li
      data-slot="stepper-item"
      data-status={status}
      aria-current={status === "current" ? "step" : undefined}
      className={cn(
        // The line: from this step's indicator to the next one's, along the row or down the column.
        "group/step relative flex min-w-0 gap-3 after:absolute after:bg-border data-[status=complete]:after:bg-signal last:after:hidden",
        "group-data-[orientation=horizontal]/stepper:flex-1 group-data-[orientation=horizontal]/stepper:flex-col group-data-[orientation=horizontal]/stepper:pr-3 group-data-[orientation=horizontal]/stepper:after:top-[13px] group-data-[orientation=horizontal]/stepper:after:right-2 group-data-[orientation=horizontal]/stepper:after:left-9 group-data-[orientation=horizontal]/stepper:after:h-0.5 group-data-[orientation=horizontal]/stepper:last:flex-none group-data-[orientation=horizontal]/stepper:last:pr-0",
        "group-data-[orientation=vertical]/stepper:pb-6 group-data-[orientation=vertical]/stepper:after:top-9 group-data-[orientation=vertical]/stepper:after:bottom-2 group-data-[orientation=vertical]/stepper:after:left-[13px] group-data-[orientation=vertical]/stepper:after:w-0.5 group-data-[orientation=vertical]/stepper:last:pb-0",
        className,
      )}
      {...props}
    >
      {children}
      {statusLabel !== undefined && <span className="sr-only">{statusLabel}</span>}
    </li>
  );
}

/**
 * The numbered disc. Its children are the step's number, in the page's digits; a complete step shows a check
 * instead. It is hidden from assistive technology: the list already numbers the steps.
 */
function StepperIndicator({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-indicator"
      aria-hidden="true"
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-border text-xs font-semibold text-muted-foreground group-data-[status=complete]/step:border-foreground group-data-[status=complete]/step:bg-foreground group-data-[status=complete]/step:text-background group-data-[status=current]/step:border-signal group-data-[status=current]/step:text-foreground",
        className,
      )}
      {...props}
    >
      <span className="group-data-[status=complete]/step:hidden">{children}</span>
      <CheckIcon strokeWidth={2.5} className="hidden size-3.5 group-data-[status=complete]/step:block" />
    </span>
  );
}

function StepperContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stepper-content"
      className={cn("grid min-w-0 gap-0.5 group-data-[orientation=vertical]/stepper:pt-1", className)}
      {...props}
    />
  );
}

function StepperTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-title"
      className={cn(
        "text-base font-medium text-muted-foreground group-data-[status=complete]/step:text-foreground group-data-[status=current]/step:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function StepperDescription({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="stepper-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Stepper, StepperItem, StepperIndicator, StepperContent, StepperTitle, StepperDescription };
