import * as React from "react";
import { cn } from "@/lib/utils";

/** Plain classes, as in Input, so a caller's className still wins. */
const NATIVE_SELECT_SIZES = {
  sm: "h-7 bg-position-[right_0.5rem_center] pr-7 pl-2 text-sm",
  default: "h-8 bg-position-[right_0.75rem_center] pr-8 pl-3 text-base",
  lg: "h-10 bg-position-[right_0.875rem_center] pr-9 pl-3.5 text-base",
};

/**
 * The browser's own select, styled like Input: use it where the system picker is the better control, such as on phones.
 * `size` takes Input's heights (sm 28px, default 32px, lg 40px) and replaces the browser's `size` attribute.
 */
function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" | "lg" }) {
  return (
    <select
      data-slot="native-select"
      data-size={size}
      className={cn(
        "w-full min-w-0 appearance-none rounded-control border border-input bg-control bg-(image:--select-chevron) bg-size-[0.875rem] bg-no-repeat text-foreground transition-[border-color,background-color] duration-150 hover:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] focus-visible:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive [&_option]:bg-popover [&_option]:text-foreground",
        NATIVE_SELECT_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
