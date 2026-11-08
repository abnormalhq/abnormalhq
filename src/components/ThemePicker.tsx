"use client";

import { useSyncExternalStore } from "react";
import { ThemePicker as BaseThemePicker } from "@/components/ui/theme-picker";
import type { Copy } from "@/i18n/types";
import { fillTemplate } from "@/lib/template";

type Preference = "system" | "light" | "dark";

// window.abnormalTheme is set by theme-init.js in the head before hydration; static HTML always renders the "System" option.
function subscribe(onChange: () => void) {
  window.addEventListener("abnormal:themechange", onChange);
  return () => window.removeEventListener("abnormal:themechange", onChange);
}
const getPreference = () => window.abnormalTheme.getPreference();
const getServerPreference = (): Preference => "system";

/** The theme button in the header: the registry's ThemePicker, reading and writing the preference through the storage theme-init.js hangs on window.abnormalTheme. */
export function ThemePicker({ copy, onOpen }: { copy: Copy["theme"]; onOpen?: () => void }) {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference);
  const current = copy.options[preference];

  return (
    <BaseThemePicker
      value={preference}
      onValueChange={(next) => window.abnormalTheme.setPreference(next)}
      labels={copy.options}
      label={fillTemplate(copy.ariaTemplate, { label: current }).join("")}
      title={fillTemplate(copy.titleTemplate, { label: current }).join("")}
      className="size-9"
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
    />
  );
}
