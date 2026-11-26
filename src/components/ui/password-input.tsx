"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { useFormReset } from "@/components/ui/use-form-reset";
import { LabelTooltip } from "@/components/ui/tooltip";

/**
 * A password field with a button that shows and hides what was typed, inside the same border (InputGroup). The
 * button is named by what it will do, `showLabel` or `hideLabel`, so a screen reader hears "Show password" and then
 * "Hide password"; `toggle="text"` writes that name on the button instead of the eye icon. Showing changes the
 * input's type only: the value, the caret and the password manager's view of the field stay.
 * `visible` and `onVisibleChange` let the page hold the state, such as one button that shows two fields, or a
 * "Generate" action that shows what it wrote. `actions` adds buttons after the toggle (InputGroupButton: generate,
 * copy), and the last of the row reads as the main one. A form reset hides the password again, unless the page
 * holds `visible`.
 * `className` sizes the group; the other props, `ref` included, go to the input. Pick `autoComplete` for the field:
 * "current-password" to sign in, "new-password" to set one.
 */
function PasswordInput({
  showLabel,
  hideLabel,
  visible: visibleProp,
  defaultVisible = false,
  onVisibleChange,
  toggle = "icon",
  actions,
  size = "default",
  className,
  inputClassName,
  disabled,
  ref,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "size"> & {
  /** The toggle's name while the password is hidden, such as "Show password". */
  showLabel: string;
  /** The toggle's name while it shows, such as "Hide password". */
  hideLabel: string;
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  /** An eye icon (named by the labels) or the labels written out. */
  toggle?: "icon" | "text";
  /** More buttons after the toggle, such as InputGroupButton "Generate". */
  actions?: React.ReactNode;
  size?: React.ComponentProps<typeof InputGroup>["size"];
  /** Classes for the input itself; `className` goes to the group around it. */
  inputClassName?: string;
}) {
  const [innerVisible, setInnerVisible] = React.useState(defaultVisible);
  const visible = visibleProp ?? innerVisible;
  const input = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => input.current as HTMLInputElement, []);
  useFormReset(input, () => {
    if (visibleProp === undefined) setInnerVisible(defaultVisible);
  });
  const label = visible ? hideLabel : showLabel;

  return (
    <InputGroup size={size} className={className}>
      <InputGroupInput
        ref={input}
        type={visible ? "text" : "password"}
        disabled={disabled}
        // A shown password is still not words: no spelling marks, no capital at the start.
        spellCheck={false}
        autoCapitalize="none"
        className={inputClassName}
        {...props}
      />
      <LabelTooltip label={toggle === "icon" ? label : undefined}>
        <InputGroupButton
          data-slot="password-input-toggle"
          aria-label={toggle === "icon" ? label : undefined}
          aria-controls={props.id}
          disabled={disabled}
          onClick={() => {
            if (visibleProp === undefined) setInnerVisible(!visible);
            onVisibleChange?.(!visible);
          }}
          className={cn(toggle === "icon" && "px-1.5 [&_svg]:size-4")}
        >
          {toggle === "icon" ? visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" /> : label}
        </InputGroupButton>
      </LabelTooltip>
      {actions}
    </InputGroup>
  );
}

export { PasswordInput };
