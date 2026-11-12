import type { Lang } from "../data/site.ts";

/**
 * The WebMail screenshots on the home page (src/components/Screens.tsx). Each is taken in both languages from the real WebMail with
 * sample mail, and saved as WebP at its display width and twice that, as public/screens/{lang}-{key}-{width}.webp; see the README's
 * "Screenshots" section for taking them again.
 */
export const screens = [
  { key: "inbox", width: 1440, height: 900 },
  { key: "calendar", width: 1440, height: 900 },
  { key: "phone", width: 390, height: 844 },
] as const;

export type Screen = (typeof screens)[number];
export type ScreenKey = Screen["key"];

/** The widths each screenshot is saved at: the viewport it was taken in, and the same at twice the pixel density. */
export const screenWidths = (screen: Screen) => [screen.width, screen.width * 2] as const;

export const screenSrc = (lang: Lang, key: ScreenKey, width: number) => `/screens/${lang}-${key}-${width}.webp`;

/** srcset for an <img>: every saved width, so the browser picks by layout width and pixel density. */
export const screenSrcSet = (lang: Lang, screen: Screen) =>
  screenWidths(screen)
    .map((width) => `${screenSrc(lang, screen.key, width)} ${width}w`)
    .join(", ");
