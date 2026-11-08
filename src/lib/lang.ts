/**
 * Language preference: the cookie decides the language and the URL follows.
 *
 * Each language keeps its own addresses (/ and /zh/); hreflang, the sitemap and the Markdown versions are unchanged, and crawlers still see both sets.
 * What changes is where a visitor lands: before OpenNext, the Worker sends whole-page requests to the address of the preferred language:
 * 1. after the header language toggle (?lang=zh): store the choice in the cookie and redirect to the address without the parameter;
 * 2. with a cookie: an address whose language differs from the cookie redirects to the same page in the other language, so shared links open in the reader's own language;
 * 3. without a cookie: only the unprefixed default-language addresses follow Accept-Language; a prefixed address such as /zh/ is the link author's explicit choice and stays;
 *    requests without Accept-Language (crawlers) are never redirected.
 * The cookie's Domain is abnormalhq.com, so the website, onboard and webmail (mail) share one choice.
 * Redirect responses enter no cache: the same address answers differently to different visitors.
 */
import { site, type Lang } from "../data/site.ts";
import { defaultLang, langParam, langs, localePath } from "../i18n/paths.ts";
import { pages } from "./pages.ts";

/** The manually chosen language; without this cookie the browser's Accept-Language decides. Shared by the three sites, the same name as mail's LOCALE_COOKIE. */
export const langCookie = "abnormal_lang";
export const langCookieMaxAge = 365 * 24 * 60 * 60;
/** The domain the cookie is shared on: Domain is written only on this domain and its subdomains; local development and preview hosts keep it to themselves. */
export const langCookieDomain = "abnormalhq.com";

const pageByUrl = new Map(pages.map((page) => [page.url, page]));

function isLang(value: string | undefined): value is Lang {
  return langs.some((lang) => lang === value);
}

/**
 * Choose the language from Accept-Language (such as en-US,en;q=0.9,zh-CN;q=0.8): the supported language with the highest q, by order of appearance on equal q;
 * null when none is supported (or the header is empty), meaning the browser has no opinion.
 */
export function negotiateLang(acceptLanguage: string | null | undefined): Lang | null {
  if (!acceptLanguage) return null;
  let best: { lang: Lang; q: number } | null = null;
  for (const part of acceptLanguage.split(",")) {
    const [tag = "", ...params] = part.trim().split(";");
    const primary = tag.trim().toLowerCase().split("-")[0];
    if (!isLang(primary)) continue;
    let q = 1;
    for (const param of params) {
      const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param);
      if (match) q = Number(match[1]);
    }
    if (!Number.isFinite(q) || q <= 0) continue;
    if (!best || q > best.q) best = { lang: primary, q };
  }
  return best?.lang ?? null;
}

/** The manually chosen language from the Cookie request header; absent or unknown values count as no choice. */
export function langCookieFrom(cookieHeader: string | null | undefined): Lang | undefined {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === langCookie) {
      const lang = value.join("=");
      return isLang(lang) ? lang : undefined;
    }
  }
  return undefined;
}

/** The Set-Cookie value for the language cookie: one year, site-wide, not a secret so no HttpOnly; shared with the other sites on abnormalhq.com and its subdomains. */
export function langSetCookie(lang: Lang, url: URL): string {
  const attributes = [`${langCookie}=${lang}`, "Path=/", `Max-Age=${langCookieMaxAge}`, "SameSite=Lax"];
  if (url.hostname === langCookieDomain || url.hostname.endsWith(`.${langCookieDomain}`)) {
    attributes.push(`Domain=${langCookieDomain}`);
  }
  if (url.protocol === "https:") attributes.push("Secure");
  return attributes.join("; ");
}

function redirect(location: URL, setCookie?: string): Response {
  const headers = new Headers({
    Location: `${location.pathname}${location.search}`,
    // The same address answers differently to different visitors: never in a shared cache, and not remembered by the browser either.
    "Cache-Control": "private, no-store",
    Vary: "Cookie, Accept-Language",
  });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

/** The language address this request should be redirected to; undefined when it stays. Whole-page GET / HEAD page requests only. */
export function languageRedirect(request: Request): Response | undefined {
  const url = new URL(request.url);
  // www is first 301-redirected to the main domain by the redirects in next.config.ts; the language is decided there.
  if (url.hostname === site.wwwHost) return undefined;
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  // Client-side routing requests for RSC data are not whole-page loads; their address is already the current page's language.
  if (request.headers.has("rsc")) return undefined;
  const page = pageByUrl.get(url.pathname);
  if (!page) return undefined;

  const chosen = url.searchParams.get(langParam);
  if (chosen !== null) {
    url.searchParams.delete(langParam);
    if (!isLang(chosen)) return redirect(url);
    url.pathname = localePath(chosen, page.path);
    return redirect(url, langSetCookie(chosen, url));
  }

  const remembered = langCookieFrom(request.headers.get("cookie"));
  if (remembered) {
    if (remembered === page.lang) return undefined;
    url.pathname = localePath(remembered, page.path);
    return redirect(url);
  }

  if (page.lang !== defaultLang) return undefined;
  const preferred = negotiateLang(request.headers.get("accept-language"));
  if (!preferred || preferred === page.lang) return undefined;
  url.pathname = localePath(preferred, page.path);
  return redirect(url);
}
