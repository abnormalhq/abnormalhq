/**
 * 语言与路径：英文是默认语言，在根路径（/、/privacy/）；中文在 /zh/ 下（/zh/、/zh/privacy/），与 src/app 下的两个路由组一致。
 * 单独成文件，客户端组件引用它时不会把两种语言的文案都打进浏览器脚本。
 */
import type { Lang } from "../data/site.ts";

/** 默认语言：放在根路径，也是 hreflang 的 x-default。 */
export const defaultLang: Lang = "en";

/** 全部语言，默认语言在前：站点地图、llms.txt 与 Markdown 版本都按这个顺序列出。 */
export const langs: readonly Lang[] = ["en", "zh"];

/** 不认识的值（含 undefined）都当作默认语言。 */
export function toLang(locale: string | undefined): Lang {
  return langs.find((lang) => lang === locale) ?? defaultLang;
}

/** 站内路径加上语言前缀：localePath("zh", "/privacy/") → "/zh/privacy/"，默认语言不加前缀。 */
export function localePath(lang: Lang, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return lang === defaultLang ? clean : `/${lang}${clean}`;
}

const prefixed = new RegExp(`^/(?:${langs.filter((lang) => lang !== defaultLang).join("|")})(?=/|$)`);

/** 去掉语言前缀后的页面路径：/zh/privacy/ → /privacy/，/zh → /。 */
export function stripLocale(pathname: string): string {
  const rest = pathname.replace(prefixed, "");
  return rest || "/";
}

/** 当前页面在另一种语言下的地址，供语言切换与 hreflang 使用。 */
export function switchPath(pathname: string, to: Lang): string {
  return localePath(to, stripLocale(pathname));
}

/** 页头语言切换带的查询参数：Worker 看到 ?lang=zh 就把这个选择写进 cookie，再跳到去掉参数的地址（见 src/lib/lang.ts）。 */
export const langParam = "lang";

/** 页头语言切换的链接：另一种语言下的同一页面，带上 ?lang=，这样切换才会被记住。 */
export function switchHref(pathname: string, to: Lang): string {
  return `${switchPath(pathname, to)}?${langParam}=${to}`;
}
