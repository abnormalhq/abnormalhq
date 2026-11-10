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

/**
 * The query parameters each storefront page carries across a language switch, and each one's shape: the chosen plan and address on the shop page, the order number and payment error on the order page,
 * the renewal token on the renewal page, the unconfirmed login token, unused password reset token and the sign-up form (mode=register) on the account page. Parameters not in the table are
 * never carried, nor are malformed or repeated ones, so unrelated or forged values are not moved into the new address.
 */
const carriedParams: Readonly<Record<string, Readonly<Record<string, RegExp>>>> = {
  // The plan a pricing card pointed out and the address picked in the address check (src/storefront/lib/address.ts).
  "/shop/": { plan: /^[a-z0-9]{15}$/, address: /^[a-z0-9._-]{1,64}@[a-z0-9.-]{1,253}$/ },
  "/shop/orders/": { id: /^[a-z0-9]{15}$/, error: /^payment$/ },
  "/shop/renew/": { t: /^[A-Za-z0-9._-]{1,256}$/ },
  "/shop/account/": { login: /^[A-Za-z0-9_-]{43}$/, reset: /^[A-Za-z0-9_-]{43}$/, mode: /^register$/ },
};

/**
 * The header language toggle link: the same page in the other language, with the parameters that page needs (search, the current query string) and
 * ?lang= last, so the switch is remembered.
 */
export function switchHref(pathname: string, to: Lang, search = ""): string {
  const page = stripLocale(pathname);
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const [name, shape] of Object.entries(carriedParams[page] ?? {})) {
    const values = params.getAll(name);
    if (values.length === 1 && shape.test(values[0]!)) kept.set(name, values[0]!);
  }
  kept.set(langParam, to);
  return `${localePath(to, page)}?${kept.toString()}`;
}
