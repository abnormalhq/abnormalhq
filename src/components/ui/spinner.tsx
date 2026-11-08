import * as React from "react";
import { cn } from "@/lib/utils";

/** A small ring that spins in the current text color, for buttons and rows that are waiting. */
function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="spinner"
      aria-hidden="true"
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current/30 border-t-current [animation-duration:0.8s]",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
