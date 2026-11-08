import * as React from "react";
import { cn } from "@/lib/utils";

/** Multi-line input: the same border, radius and hover / invalid states as Input, resizable vertically by default. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 rounded-control border border-input bg-control px-3 py-2 text-base leading-relaxed text-foreground transition-[border-color] duration-150 placeholder:text-muted-foreground hover:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] focus-visible:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
