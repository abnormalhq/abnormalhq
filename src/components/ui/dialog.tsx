"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

/** Dialog is a raised surface: panel radius, 1px hairline, soft shadow, fading in from 4px below. */
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 backdrop-blur-[2px] data-open:animate-fade-in data-closed:animate-fade-out dark:bg-black/70",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The close buttons have no built-in copy: closeLabel is required whenever the button can show, so a forgotten
 * translation fails the type check instead of shipping an English name. DialogContent shows its button by default.
 */
type ContentCloseProps =
  | {
      showCloseButton?: true;
      /** Accessible name of the close button; pass the translated word. */
      closeLabel: string;
    }
  | { showCloseButton: false; closeLabel?: string };

/** DialogFooter shows its button only when asked. It comes before the children, so the main action ends the row. */
type FooterCloseProps =
  | { showCloseButton?: false; closeLabel?: string }
  | {
      showCloseButton: true;
      /** Text of the close button; pass the translated word. */
      closeLabel: string;
    };

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & ContentCloseProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full overflow-y-auto max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-dialog border border-border bg-popover p-6 text-base shadow-popover text-popover-foreground outline-none data-open:animate-arrive data-closed:animate-leave sm:max-w-md",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute top-3 right-3" size="icon-sm">
              <XIcon />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2 pr-8", className)} {...props} />;
}

function DialogFooter({
  className,
  showCloseButton = false,
  closeLabel,
  children,
  ...props
}: React.ComponentProps<"div"> & FooterCloseProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // Stacked on phones the main action comes first, so the column is reversed; in a row the close button leads.
        "-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-dialog border-t border-border bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{closeLabel}</Button>
        </DialogPrimitive.Close>
      )}
      {children}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-xl font-semibold", className)} {...props} />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-base text-pretty text-muted-foreground *:[a]:underline *:[a]:decoration-border *:[a]:underline-offset-4 *:[a]:hover:decoration-current",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
