"use client";

import * as React from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LabelTooltip } from "@/components/ui/tooltip";

type ThemePreference = "system" | "light" | "dark";

const preferences: ThemePreference[] = ["system", "light", "dark"];
const icons = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };
const isPreference = (value: string): value is ThemePreference => (preferences as string[]).includes(value);

type ThemeOptionsProps = {
  /** The saved preference. Pass undefined while it is unknown, such as before hydration: it then reads as system. */
  value: ThemePreference | undefined;
  onValueChange: (value: ThemePreference) => void;
  /** The three option names, in the page's language. */
  labels: Record<ThemePreference, string>;
};

/**
 * The three options as menu radio items, for a menu the page already has, such as the "Theme" submenu of an
 * account menu. ThemePicker wraps them in a button of their own.
 */
function ThemeOptions({ value, onValueChange, labels }: ThemeOptionsProps) {
  return (
    <DropdownMenuRadioGroup
      value={value ?? "system"}
      onValueChange={(next) => {
        if (isPreference(next)) onValueChange(next);
      }}
    >
      {preferences.map((preference) => {
        const Icon = icons[preference];
        return (
          <DropdownMenuRadioItem key={preference} value={preference}>
            <Icon aria-hidden="true" />
            {labels[preference]}
          </DropdownMenuRadioItem>
        );
      })}
    </DropdownMenuRadioGroup>
  );
}

type Side = "top" | "right" | "bottom" | "left";

/**
 * The theme button of a header: an icon for the current preference that opens system, light and dark.
 * It keeps no state and no storage. The page passes what it saved (theme-script's useThemePreference, next-themes, a cookie) and
 * writes the choice back, so every project shows the same control whatever holds the preference.
 * Before the preference is known, such as before hydration with a preference kept in the browser, pass undefined:
 * the button then shows the sun or the moon for the theme the page is painted in, by the same rule as the tokens, so
 * no wrong icon flashes, and the icon of the preference takes over once it is known.
 * `side` and `align` place the menu (above a sidebar's footer, beside its rail). The button shows only an icon, so it
 * shows `label` in the theme's tooltip on `tooltipSide`; `tooltip` gives other words, and false none.
 */
function ThemePicker({
  value,
  onValueChange,
  labels,
  label,
  side,
  align = "end",
  tooltip = label,
  tooltipSide,
  onOpenChange,
  variant = "ghost",
  size = "icon",
  ...props
}: ThemeOptionsProps & {
  /** The button's accessible name, such as "Theme" or "Theme: dark". */
  label: string;
  /** Where the menu opens; below the button unless given. */
  side?: Side;
  align?: "start" | "center" | "end";
  /** The tooltip, when it is not `label`; false for none. */
  tooltip?: React.ReactNode;
  tooltipSide?: Side;
  /** The menu opening or closing, for a header that closes its other menus when this one opens. */
  onOpenChange?: (open: boolean) => void;
} & Omit<React.ComponentProps<typeof Button>, "value" | "onChange" | "children" | "aria-label" | "asChild">) {
  const Icon = value ? icons[value] : null;
  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button variant={variant} size={size} aria-label={label} {...props}>
        {Icon ? (
          <Icon />
        ) : (
          <>
            <SunIcon data-slot="theme-picker-light" className="dark:hidden" />
            <MoonIcon data-slot="theme-picker-dark" className="hidden dark:block" />
          </>
        )}
      </Button>
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      {/* The name sits on the button inside the menu trigger, so the default hint, the name itself, is no description. */}
      <LabelTooltip label={tooltip} side={tooltipSide} describe={tooltip !== label}>
        {trigger}
      </LabelTooltip>
      <DropdownMenuContent side={side} align={align} className="w-36">
        <ThemeOptions value={value} onValueChange={onValueChange} labels={labels} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemePicker, ThemeOptions, type ThemePreference };
