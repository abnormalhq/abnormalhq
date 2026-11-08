import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";
import { Spinner } from "@/components/ui/spinner";

/**
 * A uniform 32px height and control radius. The primary action is solid ink (weight 600);
 * secondary actions (outline) are a translucent gray background + a very faint border + gray text that brightens on hover; destructive actions are light red with red text.
 * `loading` is the waiting state: the button is disabled and marked busy, a spinner leads, and a leading icon gives
 * way to it so an icon button keeps its size. The label stays, so the button still says what it is doing.
 * A loading button cannot be activated whatever it renders: a native button is disabled, and under asChild a link
 * or any other child is marked aria-disabled and its clicks, Enter included, are stopped before they reach it.
 * That stop is a handler, so a loading asChild Button is for Client Components; a plain loading Button renders
 * anywhere. The child's own props win over the Button's, so a child that sets `disabled` itself must include the
 * loading state.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-control border border-transparent font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-busy:[&>svg]:hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-brand font-semibold text-brand-foreground hover:bg-brand/85 aria-expanded:bg-brand/85",
        outline:
          "border-input bg-control text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        secondary: "bg-control text-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-control hover:text-foreground aria-expanded:bg-control aria-expanded:text-foreground",
        destructive:
          "bg-destructive/15 font-semibold text-destructive hover:bg-destructive/25 aria-expanded:bg-destructive/25",
        link: "h-auto rounded-none border-0 p-0 font-normal text-foreground underline decoration-border underline-offset-4 hover:decoration-current",
      },
      size: {
        default: "h-8 gap-1.5 px-3 text-base",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-2.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 text-base",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function stopActivation(event: React.MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  onClickCapture,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Waiting for the action it started: disabled, aria-busy, and a spinner in place of the leading icon. */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={disabled || loading}
      // Captured at the root, before the child's own handler and the browser's default, so neither runs. A native
      // button is disabled instead, and gets no handler, so a Server Component can render it loading.
      onClickCapture={asChild && loading ? stopActivation : onClickCapture}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Spinner />}
      {/* Slottable keeps asChild working: the spinner goes inside the child element, before its own children. */}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}

export { Button, buttonVariants };
