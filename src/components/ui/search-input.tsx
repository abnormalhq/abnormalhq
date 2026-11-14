"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useFormReset } from "@/components/ui/use-form-reset";

/** Per size: the input's padding around the icon and the clear button, the icon's place, and the clear button's box. */
const SEARCH_INPUT_SIZES = {
  sm: { input: "pr-7 pl-7", icon: "left-2 size-3.5", clear: "size-5 [&_svg]:size-3.5" },
  default: { input: "pr-8 pl-9", icon: "left-3 size-4", clear: "size-6 [&_svg]:size-4" },
  lg: { input: "pr-10 pl-10", icon: "left-3.5 size-4", clear: "size-8 [&_svg]:size-4" },
};

/**
 * A search box: Input with the search icon at its start and a clear button at its end while it holds text.
 * The clear button is the interface's own, so it is the same in every browser, has a name and takes the keyboard;
 * the one some browsers draw inside `type="search"` is hidden. Clearing empties the box as typing would: `onChange`
 * fires with an empty value, controlled or not, then `onClear`, and the focus goes back to the box.
 * `hint` fills the same corner while the box is empty, such as a `<kbd>` naming the shortcut that focuses it.
 * `className` sizes the box as a whole; the other props, `ref` included, go to the input.
 */
function SearchInput({
  className,
  inputClassName,
  size = "default",
  clearLabel,
  onClear,
  hint,
  ref,
  value,
  defaultValue,
  onChange,
  disabled,
  readOnly,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** The clear button's accessible name and title, such as "Clear". */
  clearLabel: string;
  /** Called after the clear button emptied the box, for a page that does more than follow `onChange`. */
  onClear?: () => void;
  /** Shown at the end while the box is empty, such as a keyboard shortcut. It takes no pointer events. */
  hint?: React.ReactNode;
  /** Classes for the input itself; `className` goes to the box around it. */
  inputClassName?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  // An uncontrolled box keeps its text in the DOM, so whether it holds any is followed here.
  const [typed, setTyped] = React.useState(() => String(defaultValue ?? "") !== "");
  useFormReset(input, () => setTyped(input.current?.value !== ""));
  // One callback for as long as the caller's ref is the same one, so React does not detach and attach it on every keystroke.
  const attach = React.useCallback(
    (element: HTMLInputElement | null) => {
      input.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );
  const filled = value === undefined ? typed : String(value) !== "";
  const sizes = SEARCH_INPUT_SIZES[size];

  const clear = () => {
    const element = input.current;
    if (!element) return;
    // React only reports a change it did not write itself: the value goes through the element's own setter.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    onClear?.();
    element.focus();
  };

  return (
    <div data-slot="search-input" data-size={size} className={cn("relative w-full min-w-0", className)}>
      <SearchIcon
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground", sizes.icon)}
      />
      <Input
        ref={attach}
        type="search"
        size={size}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => {
          setTyped(event.currentTarget.value !== "");
          onChange?.(event);
        }}
        className={cn(
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          sizes.input,
          inputClassName,
        )}
        {...props}
      />
      {filled && !disabled && !readOnly ? (
        <button
          type="button"
          data-slot="search-input-clear"
          aria-label={clearLabel}
          title={clearLabel}
          onClick={clear}
          className={cn(
            "absolute top-1/2 right-1 grid -translate-y-1/2 place-items-center rounded-chip text-muted-foreground transition-[color,background-color] duration-150 hover:bg-control hover:text-foreground focus-visible:outline-offset-0",
            sizes.clear,
          )}
        >
          <XIcon aria-hidden="true" />
        </button>
      ) : (
        !filled &&
        hint !== undefined &&
        hint !== null &&
        hint !== false && (
          <span
            data-slot="search-input-hint"
            className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center"
          >
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export { SearchInput };
