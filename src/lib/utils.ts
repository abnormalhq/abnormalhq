import { createCn } from "cn/config";

/**
 * The custom radius, shadow, animation and display type names in the theme. cn only knows Tailwind's built-in scale:
 * unregistered, `cn("rounded-panel", "rounded-none")` keeps both and the panel radius wins in the CSS, and
 * `cn("text-display", "text-foreground")` takes the size for a color and drops it.
 * Add new --radius-*, --shadow-*, --animate-* and --text-display* tokens here too (tests/registry.test.ts checks them
 * against the theme).
 */
export const CN_THEME = {
  text: ["display-sm", "display", "display-lg"],
  radius: ["chip", "control", "mark", "dialog", "panel"],
  shadow: ["panel", "popover"],
  animate: [
    "arrive",
    "leave",
    "fade-in",
    "fade-out",
    "slide-in-right",
    "slide-out-right",
    "slide-in-left",
    "slide-out-left",
    "slide-in-bottom",
    "slide-out-bottom",
    "flash",
    "pop",
    "progress-sweep",
  ],
};

export const cn = createCn({ extend: { theme: CN_THEME } });
