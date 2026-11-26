"use client";

import { ThemePicker as BaseThemePicker } from "@/components/ui/theme-picker";
import { useThemePreference } from "@/components/ui/use-theme-preference";
import type { Copy } from "@/i18n/types";
import { fillTemplate } from "@/lib/template";

/** The theme button in the header: the registry's ThemePicker over the preference the registry's ThemeScript keeps in the head. */
export function ThemePicker({ copy, onOpen }: { copy: Copy["theme"]; onOpen?: () => void }) {
  const [preference, setPreference] = useThemePreference();
  const current = copy.options[preference ?? "system"];

  return (
    <BaseThemePicker
      value={preference}
      onValueChange={setPreference}
      labels={copy.options}
      label={fillTemplate(copy.ariaTemplate, { label: current }).join("")}
      tooltip={fillTemplate(copy.titleTemplate, { label: current }).join("")}
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
    />
  );
}
