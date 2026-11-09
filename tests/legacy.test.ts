import { test } from "node:test";
import assert from "node:assert/strict";
import { languageRedirect } from "../src/lib/lang.ts";
import { legacyPath, legacyRedirect } from "../src/storefront/worker/legacy.ts";

test("old onboard paths map to the same page here: Chinese from the root to /zh/, English from /en/ to the root, the redeem page to redeem/", () => {
  for (const [old, current] of [
    ["/", "/zh/redeem/"],
    ["/en/", "/redeem/"],
    ["/en", "/redeem/"],
    ["/guide/", "/zh/guide/"],
    ["/en/guide/", "/guide/"],
    ["/shop/", "/zh/shop/"],
    ["/shop/orders/", "/zh/shop/orders/"],
    ["/shop/orders", "/zh/shop/orders/"],
    ["/en/shop/renew/", "/shop/renew/"],
    ["/en/shop/account/", "/shop/account/"],
    // Links mail builds in the new layout while its sales settings still name the old host.
    ["/zh/shop/account/", "/zh/shop/account/"],
    ["/md/index.md", "/md/zh/redeem/"],
    ["/md/en/guide.md", "/md/guide/"],
    ["/md/shop.md", "/md/zh/shop/"],
    ["/llms.txt", "/llms.txt"],
    ["/sitemap.xml", "/sitemap.xml"],
  ]) {
    assert.equal(legacyPath(old!), current, old);
  }
});

test("requests to the old host are 301-redirected to the main site with the query string; other hosts are left alone", () => {
  const response = legacyRedirect(
    new Request("https://onboard.abnormalhq.com/shop/orders/?id=abcdefghijklmno&error=payment"),
  );
  assert.equal(response?.status, 301);
  assert.equal(
    response?.headers.get("location"),
    "https://abnormalhq.com/zh/shop/orders/?id=abcdefghijklmno&error=payment",
  );
  const login = "A".repeat(43);
  assert.equal(
    legacyRedirect(new Request(`https://onboard.abnormalhq.com/en/shop/account/?login=${login}`))?.headers.get(
      "location",
    ),
    `https://abnormalhq.com/shop/account/?login=${login}`,
  );
  // A form posted to the old host keeps its method and body.
  assert.equal(legacyRedirect(new Request("https://onboard.abnormalhq.com/shop/", { method: "POST" }))?.status, 308);
  assert.equal(legacyRedirect(new Request("https://abnormalhq.com/shop/")), undefined);
  assert.equal(legacyRedirect(new Request("https://www.abnormalhq.com/")), undefined);
});

test("the storefront's session pages switch language by preference too, keeping their query string", () => {
  const request = (path: string, headers: HeadersInit) => new Request(`https://abnormalhq.com${path}`, { headers });
  const zhCookie = { cookie: "abnormal_lang=zh" };
  assert.equal(
    languageRedirect(request("/shop/orders/?id=abcdefghijklmno", zhCookie))?.headers.get("location"),
    "/zh/shop/orders/?id=abcdefghijklmno",
  );
  assert.equal(
    languageRedirect(request("/shop/renew/?t=x", { "accept-language": "zh-CN,zh;q=0.9" }))?.headers.get("location"),
    "/zh/shop/renew/?t=x",
  );
  assert.equal(languageRedirect(request("/zh/redeem/", { "accept-language": "en" })), undefined);
  assert.equal(languageRedirect(request("/redeem/", zhCookie))?.headers.get("location"), "/zh/redeem/");
});
