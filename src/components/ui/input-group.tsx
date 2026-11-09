import * as React from "react";
import { cn } from "@/lib/utils";

/** Plain classes, as in Input, so a caller's className still wins. The heights are Input's: sm 28px, default 32px, lg 40px. */
const INPUT_GROUP_SIZES = { sm: "min-h-7", default: "min-h-8", lg: "min-h-10" };

/**
 * An input sharing one border with what belongs to it: a fixed suffix such as a domain, or quiet text buttons.
 * The group draws the border and the focus ring, so the input inside is bare. The ring follows the input only: a
 * button inside draws its own, so the two never show together.
 */
function InputGroup({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & {
  /** The group's height, matching Input: sm 28px, default 32px, lg 40px. */
  size?: "sm" | "default" | "lg";
}) {
  return (
    <div
      data-slot="input-group"
      data-size={size}
      className={cn(
        "flex items-center rounded-control border border-input bg-control transition-[border-color] duration-150 hover:border-[color-mix(in_oklab,var(--input),var(--text)_15%)] focus-within:border-[color-mix(in_oklab,var(--input),var(--text)_30%)] has-[[data-slot=input]:focus-visible]:outline-2 has-[[data-slot=input]:focus-visible]:-outline-offset-1 has-[[data-slot=input]:focus-visible]:outline-ring has-[[data-slot=input]:focus-visible]:outline-solid has-aria-invalid:border-destructive",
        "[&>[data-slot=input-group-button]+[data-slot=input-group-button]]:relative [&>[data-slot=input-group-button]+[data-slot=input-group-button]]:before:absolute [&>[data-slot=input-group-button]+[data-slot=input-group-button]]:before:inset-y-2 [&>[data-slot=input-group-button]+[data-slot=input-group-button]]:before:-left-px [&>[data-slot=input-group-button]+[data-slot=input-group-button]]:before:w-px [&>[data-slot=input-group-button]+[data-slot=input-group-button]]:before:bg-border",
        INPUT_GROUP_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/**
 * The bare input. It keeps the input slot, so the 16px phone rule in the theme still applies. It has no vertical
 * padding and stretches to the group, so the group's size alone sets the height.
 */
function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "block w-full min-w-0 flex-auto self-stretch rounded-control bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** Fixed text at the end of the input, such as the domain of an address. */
function InputGroupSuffix({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="input-group-suffix"
      className={cn(
        "mr-2 inline-flex shrink-0 items-center rounded-chip bg-surface px-2 py-0.5 text-sm/body whitespace-nowrap text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A quiet text button. In a group, neighbors are split by a hairline and the last one reads as the main action.
 * It also works outside a group, beside a value it acts on.
 */
function InputGroupButton({ className, type = "button", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type={type}
      data-slot="input-group-button"
      className={cn(
        "inline-flex min-h-[30px] shrink-0 in-data-[size=sm]:min-h-6 items-center justify-center gap-[5px] rounded-chip px-2 text-sm/body font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color] duration-150 hover:bg-control hover:text-foreground focus-visible:outline-offset-0 disabled:pointer-events-none disabled:opacity-50 in-data-[slot=input-group]:last:mr-1 in-data-[slot=input-group]:last:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupInput, InputGroupSuffix, InputGroupButton };
