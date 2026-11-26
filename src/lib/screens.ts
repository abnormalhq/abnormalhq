import type { Lang } from "../data/site.ts";

/**
 * The WebMail screenshots of the home page (the hero's inbox) and the help center. Each is taken in both languages and both themes from
 * the real WebMail with sample mail, and saved as WebP at its display width and twice that, as public/screens/{lang}-{key}-{width}.webp
 * (light) and public/screens/{lang}-{key}-dark-{width}.webp (dark). The page shows the one of its own theme (ThemedScreen). The mail
 * repository retakes them after every WebMail deployment and proposes them here (the README's "Screenshots" section); its
 * apps/webmail/e2e/site-screens.ts must write exactly these keys, themes and widths.
 */
export const screens = [
  { key: "inbox", width: 1440, height: 900 },
  { key: "calendar", width: 1440, height: 900 },
  { key: "phone", width: 390, height: 844 },
] as const;

export type Screen = (typeof screens)[number];
export type ScreenKey = Screen["key"];

/** The site's two themes; each screenshot is taken in both. */
export const screenThemes = ["light", "dark"] as const;
export type ScreenTheme = (typeof screenThemes)[number];

/** The widths each screenshot is saved at: the viewport it was taken in, and the same at twice the pixel density. */
export const screenWidths = (screen: Screen) => [screen.width, screen.width * 2] as const;

export const screenSrc = (lang: Lang, key: ScreenKey, width: number, theme: ScreenTheme = "light") =>
  `/screens/${lang}-${key}${theme === "dark" ? "-dark" : ""}-${width}.webp`;

/** srcset for an <img>: every saved width, so the browser picks by layout width and pixel density. */
export const screenSrcSet = (lang: Lang, screen: Screen, theme: ScreenTheme = "light") =>
  screenWidths(screen)
    .map((width) => `${screenSrc(lang, screen.key, width, theme)} ${width}w`)
    .join(", ");
