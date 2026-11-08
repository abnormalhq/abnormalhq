/**
 * Languages and paths: English is the default language at the root (/, /privacy/); Chinese is under /zh/ (/zh/, /zh/privacy/), matching the two route groups under src/app.
 * Kept in its own file so client components can import it without pulling both languages' copy into the browser bundle.
 */
import type { Lang } from "../data/site.ts";

/** The default language: served at the root, and also the hreflang x-default. */
export const defaultLang: Lang = "en";

/** All languages, default first: the sitemap, llms.txt and the Markdown versions list them in this order. */
export const langs: readonly Lang[] = ["en", "zh"];

/** Unknown values (undefined included) are treated as the default language. */
export function toLang(locale: string | undefined): Lang {
  return langs.find((lang) => lang === locale) ?? defaultLang;
}

/** Prefixes a site path with the language: localePath("zh", "/privacy/") -> "/zh/privacy/"; the default language gets no prefix. */
export function localePath(lang: Lang, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return lang === defaultLang ? clean : `/${lang}${clean}`;
}

const prefixed = new RegExp(`^/(?:${langs.filter((lang) => lang !== defaultLang).join("|")})(?=/|$)`);

/** The page path with the language prefix removed: /zh/privacy/ -> /privacy/, /zh -> /. */
export function stripLocale(pathname: string): string {
  const rest = pathname.replace(prefixed, "");
  return rest || "/";
}

/** The current page's address in the other language, for the language toggle and hreflang. */
export function switchPath(pathname: string, to: Lang): string {
  return localePath(to, stripLocale(pathname));
}

/** The query parameter the header language toggle carries: on ?lang=zh the Worker stores the choice in the cookie and redirects to the address without it (see src/lib/lang.ts). */
export const langParam = "lang";

/** The header language toggle link: the same page in the other language, with ?lang= so the switch is remembered. */
export function switchHref(pathname: string, to: Lang): string {
  return `${switchPath(pathname, to)}?${langParam}=${to}`;
}
