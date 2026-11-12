import { test } from "node:test";
import assert from "node:assert/strict";
import { isCurrentSection, langParam, switchHref } from "../src/i18n/paths.ts";
import { langCookie, langCookieFrom, langSetCookie, languageRedirect, negotiateLang } from "../src/lib/lang.ts";

const origin = "https://abnormalhq.com";

function get(path: string, headers: Record<string, string> = {}, method = "GET") {
  return new Request(`${origin}${path}`, { method, headers });
}

function location(response: Response | undefined) {
  assert.ok(response, "expected a redirect");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Cookie, Accept-Language");
  return response.headers.get("location");
}

test("Accept-Language picks the supported language with the highest q, or none", () => {
  assert.equal(negotiateLang("zh-CN,zh;q=0.9,en;q=0.8"), "zh");
  assert.equal(negotiateLang("zh-Hant-HK,en;q=0.5"), "zh");
  assert.equal(negotiateLang("en-GB,zh-CN;q=0.8"), "en");
  assert.equal(negotiateLang("en;q=0.5,zh-CN;q=0.9"), "zh");
  assert.equal(negotiateLang("ja,en;q=0.7,zh;q=0.3"), "en");
  assert.equal(negotiateLang(" ZH-cn ; Q=0.9 , en ; q=0.8"), "zh");
  // No supported language means no opinion: the page stays where it is.
  assert.equal(negotiateLang("ja-JP,fr;q=0.8"), null);
  assert.equal(negotiateLang("zh;q=0,ja"), null);
  assert.equal(negotiateLang("*"), null);
  assert.equal(negotiateLang(""), null);
  assert.equal(negotiateLang(null), null);
});

test("the language cookie is read from the Cookie header and written for the shared domain", () => {
  assert.equal(langCookie, "abnormal_lang");
  assert.equal(langCookieFrom(`a=1; ${langCookie}=zh; b=2`), "zh");
  assert.equal(langCookieFrom(`${langCookie}=fr`), undefined);
  assert.equal(langCookieFrom("a=1"), undefined);
  assert.equal(langCookieFrom(null), undefined);
  assert.equal(
    langSetCookie("zh", new URL("https://abnormalhq.com/zh/")),
    "abnormal_lang=zh; Path=/; Max-Age=31536000; SameSite=Lax; Domain=abnormalhq.com; Secure",
  );
  assert.equal(
    langSetCookie("en", new URL("https://onboard.abnormalhq.com/en/")),
    "abnormal_lang=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=abnormalhq.com; Secure",
  );
  // Previews and local development keep the cookie to themselves, and plain HTTP gets no Secure.
  assert.equal(
    langSetCookie("zh", new URL("http://localhost:4320/")),
    "abnormal_lang=zh; Path=/; Max-Age=31536000; SameSite=Lax",
  );
  assert.equal(
    langSetCookie("zh", new URL("https://abnormalhq.example.workers.dev/")),
    "abnormal_lang=zh; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
  );
});

test("the header toggle links to the other language with ?lang=", () => {
  assert.equal(langParam, "lang");
  assert.equal(switchHref("/", "zh"), "/zh/?lang=zh");
  assert.equal(switchHref("/zh/privacy/", "en"), "/privacy/?lang=en");
});

test("the toggle on the storefront's session pages carries their own parameters, well-formed and single only", () => {
  const login = "A".repeat(43);
  const token = "eyJzIjoiYWJjZGVmZ2hpamtsbW5vIiwiZXhwIjoxfQ.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
  assert.equal(switchHref("/shop/", "zh", "?id=abcdefghijklmno"), "/zh/shop/?lang=zh");
  // The shop keeps the plan a pricing card pointed out and the address picked in the address check.
  assert.equal(
    switchHref("/shop/", "zh", "?plan=abcdefghijklmno&address=ada.lovelace%40abnormalhq.com"),
    "/zh/shop/?plan=abcdefghijklmno&address=ada.lovelace%40abnormalhq.com&lang=zh",
  );
  assert.equal(switchHref("/zh/shop/", "en", "?plan=../x&address=<script>@x"), "/shop/?lang=en");
  // The pricing page has nothing to carry.
  assert.equal(switchHref("/pricing/", "zh", "?plan=abcdefghijklmno"), "/zh/pricing/?lang=zh");
  assert.equal(
    switchHref("/zh/shop/orders/", "en", "?id=abcdefghijklmno&error=payment&x=1"),
    "/shop/orders/?id=abcdefghijklmno&error=payment&lang=en",
  );
  assert.equal(switchHref("/zh/shop/orders/", "en", "?id=BAD&error=other"), "/shop/orders/?lang=en");
  assert.equal(switchHref("/shop/renew/", "zh", `?t=${token}`), `/zh/shop/renew/?t=${token}&lang=zh`);
  for (const query of ["?t=<script>", "?t=a&t=b", `?t=${"a".repeat(300)}`, "?t="])
    assert.equal(switchHref("/shop/renew/", "zh", query), "/zh/shop/renew/?lang=zh");
  assert.equal(switchHref("/shop/account/", "zh", `?login=${login}`), `/zh/shop/account/?login=${login}&lang=zh`);
  assert.equal(switchHref("/zh/shop/account/", "en", `?reset=${login}`), `/shop/account/?reset=${login}&lang=en`);
  assert.equal(switchHref("/shop/account/", "zh", "?login=short&reset=../x"), "/zh/shop/account/?lang=zh");
  // The sign-up form stays the sign-up form; no other mode is carried.
  assert.equal(switchHref("/shop/account/", "zh", "?mode=register"), "/zh/shop/account/?mode=register&lang=zh");
  assert.equal(switchHref("/shop/account/", "zh", "?mode=admin"), "/zh/shop/account/?lang=zh");
  assert.equal(switchHref("/redeem/", "zh", `?login=${login}`), "/zh/redeem/?lang=zh");
});

test("?lang= remembers the choice and redirects to the clean address in that language", () => {
  const response = languageRedirect(get("/zh/?lang=zh"));
  assert.equal(location(response), "/zh/");
  assert.equal(
    response?.headers.get("set-cookie"),
    "abnormal_lang=zh; Path=/; Max-Age=31536000; SameSite=Lax; Domain=abnormalhq.com; Secure",
  );
  // The parameter wins over the address and over an older cookie; other parameters stay.
  assert.equal(
    location(languageRedirect(get("/privacy/?lang=zh&x=1", { cookie: "abnormal_lang=en" }))),
    "/zh/privacy/?x=1",
  );
  assert.equal(
    languageRedirect(get("/privacy/?lang=zh"))?.headers.get("set-cookie")?.startsWith("abnormal_lang=zh;"),
    true,
  );
  // An unknown value is dropped without a cookie.
  const unknown = languageRedirect(get("/terms/?lang=fr"));
  assert.equal(location(unknown), "/terms/");
  assert.equal(unknown?.headers.get("set-cookie"), null);
});

test("a remembered language wins over the address, in both directions", () => {
  assert.equal(location(languageRedirect(get("/", { cookie: "abnormal_lang=zh" }))), "/zh/");
  assert.equal(location(languageRedirect(get("/download/?v=1", { cookie: "abnormal_lang=zh" }))), "/zh/download/?v=1");
  assert.equal(location(languageRedirect(get("/zh/privacy/", { cookie: "x=1; abnormal_lang=en" }))), "/privacy/");
  assert.equal(languageRedirect(get("/zh/", { cookie: "abnormal_lang=zh" })), undefined);
  assert.equal(languageRedirect(get("/terms/", { cookie: "abnormal_lang=en", "accept-language": "zh-CN" })), undefined);
  // A remembered language ignores Accept-Language entirely.
  assert.equal(
    location(languageRedirect(get("/", { cookie: "abnormal_lang=zh", "accept-language": "en-US" }))),
    "/zh/",
  );
});

test("without a cookie, only the default-language address follows Accept-Language", () => {
  assert.equal(location(languageRedirect(get("/", { "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" }))), "/zh/");
  assert.equal(location(languageRedirect(get("/privacy/?a=1", { "accept-language": "zh-TW" }))), "/zh/privacy/?a=1");
  assert.equal(languageRedirect(get("/", { "accept-language": "en-US,en;q=0.9" })), undefined);
  assert.equal(languageRedirect(get("/", { "accept-language": "ja-JP" })), undefined);
  assert.equal(languageRedirect(get("/")), undefined);
  // A prefixed address is the link author's explicit choice.
  assert.equal(languageRedirect(get("/zh/", { "accept-language": "en-US" })), undefined);
  assert.equal(languageRedirect(get("/zh/terms/", { "accept-language": "en-US" })), undefined);
});

test("only whole-page GET and HEAD requests for known pages are redirected", () => {
  assert.equal(languageRedirect(get("/", { cookie: "abnormal_lang=zh" }, "POST")), undefined);
  assert.equal(location(languageRedirect(get("/", { cookie: "abnormal_lang=zh" }, "HEAD"))), "/zh/");
  assert.equal(languageRedirect(get("/", { cookie: "abnormal_lang=zh", rsc: "1" })), undefined);
  assert.equal(languageRedirect(get("/md/", { cookie: "abnormal_lang=zh" })), undefined);
  assert.equal(languageRedirect(get("/llms.txt", { cookie: "abnormal_lang=zh" })), undefined);
  assert.equal(languageRedirect(get("/privacy", { cookie: "abnormal_lang=zh" })), undefined);
  assert.equal(languageRedirect(get("/nope/", { cookie: "abnormal_lang=zh" })), undefined);
  // www is redirected to the main domain first.
  assert.equal(
    languageRedirect(new Request("https://www.abnormalhq.com/", { headers: { cookie: "abnormal_lang=zh" } })),
    undefined,
  );
});

test("the header marks a page entry as current on that page and the pages under it", () => {
  assert.equal(isCurrentSection("/pricing/", "/pricing/"), true);
  assert.equal(isCurrentSection("/pricing", "/pricing/"), true);
  assert.equal(isCurrentSection("/zh/help/own-domain/", "/zh/help/"), true);
  assert.equal(isCurrentSection("/help/", "/zh/help/"), false);
  assert.equal(isCurrentSection("/pricing-old/", "/pricing/"), false);
  assert.equal(isCurrentSection("/shop/", "/pricing/"), false);
  // The home page is never current by prefix: every page sits under it.
  assert.equal(isCurrentSection("/pricing/", "/"), false);
  assert.equal(isCurrentSection("/zh/pricing/", "/zh/"), false);
  assert.equal(isCurrentSection("/zh/", "/zh/"), true);
});
