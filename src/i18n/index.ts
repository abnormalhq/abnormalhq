/**
 * Copy entry point: server components call useCopy(lang) for the current language's copy, linked-site addresses and localized path helpers.
 * Client components receive only the copy they use, through props.
 */
import { linksFor, type Lang } from "../data/site.ts";
import { en } from "./en.ts";
import { localePath, toLang } from "./paths.ts";
import type { Copy } from "./types.ts";
import { zh } from "./zh.ts";

export { defaultLang, langs, localePath, stripLocale, switchPath, toLang } from "./paths.ts";
export type { Lang };
export const copies: Record<Lang, Copy> = { zh, en };

export function useCopy(locale: string | undefined) {
  const lang = toLang(locale);
  return {
    lang,
    t: copies[lang],
    links: linksFor(lang),
    path: (path: string) => localePath(lang, path),
  };
}
