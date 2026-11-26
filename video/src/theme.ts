import type { CSSProperties } from "react";

/** The film is rendered once per site theme (Root.tsx), so the site can show the one that matches the page. */
export type Theme = "light" | "dark";

/**
 * The colors of the site's light and dark themes (the registry's @abnormal/theme). Text on the highlight yellow stays ink in both, as on
 * the site, and the button's text is the color of the button's own foreground (--brand-foreground). The marker under the step numbers is
 * a thick band in light; in dark the numbers are light, so it is the site's thin underline, which leaves them on the page.
 */
const palettes = {
  light: {
    paper: "#f7f7f4",
    ink: "#141412",
    muted: "#5c5c55",
    border: "#e3e3dc",
    surface: "#ecece6",
    highlight: "#ffe14d",
    highlightMuted: "#fff4bf",
    onHighlight: "#141412",
    onInk: "#ffffff",
    markerFrom: "56%",
    markerTo: "90%",
  },
  dark: {
    paper: "#141412",
    ink: "#f0f0ea",
    muted: "#a6a69c",
    border: "#2e2e29",
    surface: "#252520",
    highlight: "#ffe14d",
    highlightMuted: "#34311b",
    onHighlight: "#141412",
    onInk: "#141412",
    markerFrom: "84%",
    markerTo: "96%",
  },
} as const satisfies Record<Theme, Record<string, string>>;

type ColorName = keyof (typeof palettes)["light"];

/**
 * The colors as CSS variables, so the scenes stay plain style objects: Promo writes the theme's values on its root (themeStyle) and
 * every color below reads them.
 */
export const color = Object.fromEntries(
  Object.keys(palettes.light).map((name) => [name, `var(--video-${name})`]),
) as Record<ColorName, string>;

export const themeStyle = (theme: Theme) =>
  Object.fromEntries(
    Object.entries(palettes[theme]).map(([name, value]) => [`--video-${name}`, value]),
  ) as CSSProperties;

/** The brand mark is the same picture in both themes, as on the site. */
export const brand = { highlight: "#ffe14d", ink: "#141412", paper: "#f7f7f4" } as const;

export const radius = { chip: 4, control: 6, mark: 8, panel: 12 } as const;

/** Chinese glyphs fall back to Noto Sans SC (see fonts.ts), the same as the site's social images. */
export const font = {
  body: "Inter, 'Noto Sans SC', sans-serif",
  heading: "'Bricolage Grotesque', 'Noto Sans SC', sans-serif",
  mono: "'JetBrains Mono', 'Noto Sans SC', monospace",
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
