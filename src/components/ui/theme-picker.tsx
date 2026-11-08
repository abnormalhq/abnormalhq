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

/**
 * The theme button of a header: an icon for the current preference that opens system, light and dark.
 * It keeps no state and no storage. The page passes what it saved (next-themes, a cookie, its own script) and
 * writes the choice back, so every project shows the same control whatever holds the preference.
 */
function ThemePicker({
  value,
  onValueChange,
  labels,
  label,
  align = "end",
  onOpenChange,
  variant = "ghost",
  size = "icon",
  ...props
}: ThemeOptionsProps & {
  /** The button's accessible name, such as "Theme" or "Theme: dark". */
  label: string;
  align?: "start" | "center" | "end";
  /** The menu opening or closing, for a header that closes its other menus when this one opens. */
  onOpenChange?: (open: boolean) => void;
} & Omit<React.ComponentProps<typeof Button>, "value" | "onChange" | "children" | "aria-label" | "asChild">) {
  const Icon = icons[value ?? "system"];
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} {...props}>
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-36">
        <ThemeOptions value={value} onValueChange={onValueChange} labels={labels} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemePicker, ThemeOptions, type ThemePreference };
