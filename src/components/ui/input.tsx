import * as React from "react";
import { cn } from "@/lib/utils";

/** 32px input: translucent control background, very faint border, control radius; the border deepens on hover and focus. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-control border border-input bg-control px-3 text-base text-foreground transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground hover:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] focus-visible:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
