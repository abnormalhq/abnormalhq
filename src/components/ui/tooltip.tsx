"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Slot, Tooltip as TooltipPrimitive } from "radix-ui";

/** Set by TooltipProvider, so a Tooltip can tell whether one is above it. */
const TooltipProviderContext = React.createContext(false);

/** Set inside a TooltipTrigger, so an IconButton or LabelTooltip within one does not add a second tooltip. */
const TooltipTriggerContext = React.createContext(false);

/** Whether the Tooltip around is open, so TooltipContent renders again as it opens and finds the top layer then. */
const TooltipOpenContext = React.createContext(false);

/**
 * Tooltip: shares the popover style with menus, with a soft shadow and hairline border; fades in from 4px below like menus.
 * TooltipProvider is optional. Wrap an area in one to share the open delay, and the skip-delay window that lets the next tooltip open at once.
 */
function TooltipProvider({ delayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipProviderContext.Provider value={true}>
      <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
    </TooltipProviderContext.Provider>
  );
}

/**
 * Radix throws without a provider, so a Tooltip with none above it brings its own. It looks for this file's
 * TooltipProvider only: under Radix's own Tooltip.Provider it would still bring one and lose the shared delay, so wrap
 * areas in TooltipProvider from here.
 */
function Tooltip({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const root = (
    <TooltipOpenContext.Provider value={open}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={open}
        onOpenChange={(next) => {
          setUncontrolled(next);
          onOpenChange?.(next);
        }}
        {...props}
      />
    </TooltipOpenContext.Provider>
  );
  return React.useContext(TooltipProviderContext) ? root : <TooltipProvider>{root}</TooltipProvider>;
}

/*
 * The key behind the latest focus change: Tab and the arrow keys move focus themselves, so a tooltip may open for it.
 * Enter, Space and Escape do things (open a dialog, close a menu) whose script then moves focus, and a pointer press
 * moves it by hand, so neither counts. Read in the capture phase, before any handler moves focus.
 */
let focusKey: string | null = null;
if (typeof document !== "undefined") {
  document.addEventListener("keydown", (event) => (focusKey = event.key), true);
  document.addEventListener("pointerdown", () => (focusKey = null), true);
}

/** Whether the person moved focus with the keyboard, rather than a script after a click or a key that did something. */
function keyboardFocus() {
  return focusKey !== null && !["Enter", " ", "Escape"].includes(focusKey);
}

/**
 * The tooltip opens on hover, and on focus only when the person moved focus with Tab or an arrow key. A dialog that
 * opens, or a menu that closes and hands focus back to its button, moves focus by script; without the check the
 * tooltip would pop up there, and the next Escape would close it instead of the dialog.
 */
function TooltipTrigger({ onFocus, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipTriggerContext.Provider value={true}>
      <TooltipPrimitive.Trigger
        data-slot="tooltip-trigger"
        onFocus={(event) => {
          onFocus?.(event);
          if (!keyboardFocus()) event.preventDefault();
        }}
        {...props}
      />
    </TooltipTriggerContext.Provider>
  );
}

/**
 * Where the tooltip's portal goes, read as it opens. A full-screen element, and a native <dialog> opened with
 * showModal(), sit in the browser's top layer, above anything at the end of the page, and the page behind a modal
 * dialog is inert; so while one is open the tooltip goes inside the topmost, the only part of the page in reach.
 */
function topLayer(): Element | undefined {
  if (typeof document === "undefined") return undefined;
  let modal: Element | undefined;
  try {
    modal = [...document.querySelectorAll("dialog:modal")].at(-1);
  } catch {
    // A browser without :modal has no modal dialogs of this kind either.
  }
  return modal ?? document.fullscreenElement ?? undefined;
}

/**
 * The content goes to a portal at the end of the page, so no scrolling box, sticky bar or sibling covers or clips it.
 * It opens on `side` (top by default) and moves out of the way by itself: to the opposite side when there is no room,
 * and along the edge so it stays `collisionPadding` (8px) inside the window. It hides while its trigger is scrolled
 * out of view inside a scrolling box. In full screen, or over a native modal <dialog>, it goes into that element.
 * React passes an event from a portal up the component tree, not the page, so a click on the tooltip would also reach
 * whatever its trigger sits in, such as a clickable row; it stops at the tooltip.
 */
function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  hideWhenDetached = true,
  onClick,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  // Read on every render, and opening renders it again, so a page that went full screen after it mounted still counts.
  React.useContext(TooltipOpenContext);
  return (
    <TooltipPrimitive.Portal container={topLayer()}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        hideWhenDetached={hideWhenDetached}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(event);
        }}
        className={cn(
          "z-overlay max-w-64 origin-(--radix-tooltip-content-transform-origin) rounded-control border border-border bg-popover px-2.5 py-1.5 text-xs font-medium shadow-popover text-popover-foreground data-open:animate-arrive data-closed:animate-leave",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/**
 * The slot between the tooltip's trigger and the child. Radix's trigger passes its own data-state (closed, delayed-open)
 * and data-slot, and a child that spreads its props after its own, as Radix's Toggle and menu triggers do, would take
 * them in place of its own: a pressed toggle would lose data-state="on", a menu button "open", a styled button its
 * data-slot. They stop here, so the child keeps its own. With `describe` false the open tooltip's aria-describedby
 * stops here too, for a label that only repeats the name; the merge would keep it whatever the child says. The tree is
 * the same either way, so a label that starts or stops repeating the name does not mount the child again.
 */
function TriggerSlot({
  describe,
  "data-state": state,
  "data-slot": slot,
  "aria-describedby": describedBy,
  ...props
}: React.ComponentProps<typeof Slot.Root> & { describe: boolean; "data-state"?: string; "data-slot"?: string }) {
  void state;
  void slot;
  return <Slot.Root {...props} aria-describedby={describe ? describedBy : undefined} />;
}

/**
 * The box a disabled child's tooltip listens on. The tooltip's description, which Radix gives this box as its trigger,
 * goes on to the child, the element a screen reader reaches. The child always sits in the same slot, so it is not
 * mounted again as the tooltip opens and closes.
 */
function DisabledTarget({
  children,
  "aria-describedby": describedBy,
  ...props
}: React.ComponentProps<"span"> & { children: React.ReactElement }) {
  return (
    <span {...props} data-slot="tooltip-disabled-trigger" className="inline-flex max-w-full">
      <Slot.Root aria-describedby={describedBy}>{children}</Slot.Root>
    </span>
  );
}

/**
 * The element itself when it comes as a lazy reference, as a server component's child of a client component does:
 * that reference has no props to read until it is unwrapped, the way Radix's Slot unwraps it.
 */
function useUnwrapped(child: React.ReactElement): React.ReactElement {
  const lazy = child as unknown as { $$typeof?: symbol; _payload?: PromiseLike<React.ReactElement> };
  if (lazy?.$$typeof !== Symbol.for("react.lazy") || typeof lazy._payload?.then !== "function") return child;
  return React.use(lazy._payload as Promise<React.ReactElement>);
}

/**
 * A tooltip around one element, in one line: `<LabelTooltip label="Archive (E)"><button …/></LabelTooltip>`. It is
 * what IconButton uses for its label, and the way to give a hint to any other element that would have used
 * the browser's title. With no label, or inside a TooltipTrigger that already gives one, it renders the child alone.
 * The tooltip describes the child (aria-describedby) unless its label is the child's aria-label word for word, so a
 * screen reader does not read the same words twice; `describe` decides it either way. A child with a ref callback
 * needs the same callback on every render (useCallback, or a ref object): the trigger keeps its element in state, so a
 * new callback each render detaches and attaches it again and renders without end. A child with `disabled` gets no
 * pointer events, so the tooltip then listens on an inline box around it, and still says, say, why it is disabled;
 * the description still goes on the child. Props it does not take itself, such as the handlers and ref a DialogTrigger or PopoverTrigger passes through
 * asChild, go on to the child, so it can sit inside a trigger like the child alone.
 */
function LabelTooltip({
  label,
  side,
  align,
  describe,
  children,
  ...forwarded
}: Omit<React.ComponentProps<typeof TooltipTrigger>, "children" | "asChild"> & {
  /** The hint. Nothing, an empty string or false leaves the child as it is. */
  label: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  align?: React.ComponentProps<typeof TooltipContent>["align"];
  /** Point the child's aria-describedby at the tooltip. By default only when the label is not the child's aria-label. */
  describe?: boolean;
  /** One element that takes a ref and pointer and focus handlers, such as a button, a link or a span. */
  children: React.ReactElement;
}) {
  const nested = React.useContext(TooltipTriggerContext);
  children = useUnwrapped(children);
  if (nested || label === null || label === undefined || label === false || label === "")
    return <Slot.Root {...forwarded}>{children}</Slot.Root>;
  const props = (children.props ?? {}) as { "aria-label"?: unknown; disabled?: unknown };
  const repeatsName = label === props["aria-label"];
  // Inside the slot that drops the tooltip's own description, so an aria-describedby passed in survives it.
  const own = <Slot.Root {...forwarded}>{children}</Slot.Root>;
  // A disabled button gets no pointer events, so the hint (often why it is disabled) listens on a box around it.
  const target = props.disabled === true ? <DisabledTarget>{own}</DisabledTarget> : own;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TriggerSlot describe={describe ?? !repeatsName}>{target}</TriggerSlot>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className="whitespace-pre-line">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, LabelTooltip };
