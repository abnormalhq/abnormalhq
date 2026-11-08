/** The same colors (the registry's @abnormal/theme), radii and font stacks as the site's light theme. */
export const color = {
  paper: "#f7f7f4",
  ink: "#141412",
  muted: "#5c5c55",
  border: "#e3e3dc",
  surface: "#ecece6",
  highlight: "#ffe14d",
  highlightMuted: "#fff4bf",
  white: "#ffffff",
} as const;

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
