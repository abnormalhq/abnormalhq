/**
 * 语言偏好：cookie 决定语言，URL 跟着变。
 *
 * 每种语言仍有自己的地址（/ 与 /zh/），hreflang、站点地图与 Markdown 版本都不变，爬虫看到的还是两套地址。
 * 变的是进站时的去向：Worker 在 OpenNext 之前按访客的偏好把整页请求送到对应语言的地址——
 * 1. 点过页头的语言切换（?lang=zh）：把选择写进 cookie，再跳到去掉参数的地址；
 * 2. 有 cookie：地址的语言与 cookie 不一致就跳到另一种语言的同一页，分享来的链接因此总以自己的语言打开；
 * 3. 没有 cookie：只在不带前缀的默认语言地址上按 Accept-Language 判断，/zh/ 这类带前缀的地址是链接作者的明确选择，不跳；
 *    没有 Accept-Language 的请求（爬虫）自然不跳。
 * cookie 的 Domain 是 abnormalhq.com，官网、onboard 与网页邮箱（mail）共用同一份选择。
 * 跳转响应不进任何缓存：同一地址对不同访客的回答不同。
 */
import { site, type Lang } from "../data/site.ts";
import { defaultLang, langParam, langs, localePath } from "../i18n/paths.ts";
import { pages } from "./pages.ts";

/** 手动选过的语言；没有这个 cookie 时按浏览器的 Accept-Language。三个站点共用，名字与 mail 的 LOCALE_COOKIE 相同。 */
export const langCookie = "abnormal_lang";
export const langCookieMaxAge = 365 * 24 * 60 * 60;
/** 共用 cookie 的域：在这个域及其子域名上才写 Domain，本地开发与预览地址只给自己。 */
export const langCookieDomain = "abnormalhq.com";

const pageByUrl = new Map(pages.map((page) => [page.url, page]));

function isLang(value: string | undefined): value is Lang {
  return langs.some((lang) => lang === value);
}

/**
 * 按 Accept-Language（如 en-US,en;q=0.9,zh-CN;q=0.8）选语言：取受支持的语言里 q 值最高的，q 相同按出现顺序；
 * 一个都不支持（或为空）时返回 null，表示浏览器没有表态。
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

/** 从 Cookie 请求头里取手动选过的语言；没有或不认识的值当作没选。 */
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

/** 写语言 cookie 的 Set-Cookie 值：一年，整站，不是秘密所以不设 HttpOnly；在 abnormalhq.com 及其子域名上与其他站点共用。 */
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
    // 同一地址对不同访客的回答不同，不能进共享缓存，也不让浏览器记住。
    "Cache-Control": "private, no-store",
    Vary: "Cookie, Accept-Language",
  });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

/** 这个请求应该跳去的语言地址；留在原地时返回 undefined。只看整页加载的 GET / HEAD 页面请求。 */
export function languageRedirect(request: Request): Response | undefined {
  const url = new URL(request.url);
  // www 先由 next.config.ts 的 redirects 301 到主域名，到主域名再决定语言。
  if (url.hostname === site.wwwHost) return undefined;
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  // 客户端路由取 RSC 数据的请求不是整页加载，地址已经是当前页面的语言。
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
