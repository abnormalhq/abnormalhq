import * as React from "react";
import { cn } from "@/lib/utils";

/** Plain classes rather than data-[size=…] variants, so a caller's className (pl-9 beside an icon, text-sm) still wins. */
const INPUT_SIZES = {
  sm: "h-7 px-2 text-sm file:h-6",
  default: "h-8 px-3 text-base file:h-7",
  lg: "h-10 px-3.5 text-base file:h-7",
};

/**
 * Input: translucent control background, very faint border, control radius; the border deepens on hover and focus.
 * `size` takes Button's heights, so a row of controls lines up without a height class: sm 28px, default 32px, lg 40px.
 * It replaces the browser's `size` attribute (a width in characters); set a width with a class instead.
 */
function Input({
  className,
  type,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & { size?: "sm" | "default" | "lg" }) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "w-full min-w-0 rounded-control border border-input bg-control text-foreground transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground hover:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] focus-visible:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        INPUT_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export { Input };
