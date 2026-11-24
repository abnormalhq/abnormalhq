import { createCn } from "cn/config";

/**
 * The custom radius, shadow, animation, letter spacing and display type names in the theme. cn only knows Tailwind's
 * built-in scale: unregistered, `cn("rounded-panel", "rounded-none")` keeps both and the panel radius wins in the CSS,
 * and `cn("text-display", "text-foreground")` takes the size for a color and drops it.
 * Add new --radius-*, --shadow-*, --animate-*, --tracking-* and --text-display* tokens here too, and new --z-index-*
 * layers to CN_LAYERS (tests/registry.test.ts checks them against the theme).
 */
export const CN_THEME = {
  text: ["display-sm", "display", "display-lg"],
  radius: ["chip", "control", "mark", "dialog", "panel"],
  shadow: ["panel", "popover"],
  tracking: ["title", "heading", "display", "caps"],
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
    "expand",
    "collapse",
  ],
};

/** The stacking layers: z-index is a class group rather than a theme scale, so `cn("z-overlay", "z-40")` keeps the last. */
export const CN_LAYERS = ["raised", "sticky", "header", "chrome", "overlay", "floating", "skip-link"];

export const cn = createCn({ extend: { theme: CN_THEME, classGroups: { z: [{ z: CN_LAYERS }] } } });
