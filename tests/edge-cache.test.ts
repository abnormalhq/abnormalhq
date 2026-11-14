import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cacheableLivePage,
  isLivePageRequest,
  livePageCacheControl,
  serveLivePage,
  type EdgeCache,
} from "../src/lib/edge-cache.ts";

const page = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  new Request(`https://abnormalhq.com${path}`, { method, headers });

const html = (init: ResponseInit = {}) =>
  new Response("<html>prices</html>", {
    status: 200,
    ...init,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      Vary: "RSC, Accept",
      ...(init.headers as Record<string, string>),
    },
  });

/** caches.default as far as it is used: what was stored, keyed by address. */
function memoryCache() {
  const entries = new Map<string, Response>();
  const cache: EdgeCache = {
    async match(request) {
      return entries.get(request.url)?.clone();
    },
    async put(request, response) {
      entries.set(request.url, response);
    },
  };
  return { cache, entries };
}

test("only whole-page loads of the pages rendered on every request are cached", () => {
  for (const path of ["/pricing/", "/zh/pricing/", "/download/", "/zh/download/", "/pricing/?plan=a"]) {
    assert.equal(isLivePageRequest(page(path)), true, path);
  }
  for (const request of [
    page("/"),
    page("/shop/"),
    page("/md/pricing/"),
    page("/pricing/", {}, "HEAD"),
    page("/pricing/", { RSC: "1" }),
    page("/pricing/", { "Next-Router-Prefetch": "1" }),
    page("/pricing/?_rsc=abc"),
  ]) {
    assert.equal(isLivePageRequest(request), false, `${request.method} ${request.url} ${[...request.headers.keys()]}`);
  }
});

test("a cached page is public for a minute and varies on what decides the language", () => {
  const response = cacheableLivePage(html())!;
  assert.equal(response.headers.get("cache-control"), livePageCacheControl);
  assert.equal(response.headers.get("vary"), "RSC, Accept, Cookie, Accept-Language");
  // Anything visitor-specific, failed or not HTML is never stored.
  assert.equal(cacheableLivePage(html({ headers: { "Set-Cookie": "a=b" } })), null);
  assert.equal(cacheableLivePage(html({ status: 500 })), null);
  assert.equal(cacheableLivePage(new Response("{}", { headers: { "Content-Type": "application/json" } })), null);
});

test("the edge copy is served until it expires, and never across deployments", async () => {
  const { cache, entries } = memoryCache();
  let renders = 0;
  const render = async () => {
    renders += 1;
    return html();
  };
  const waited: Promise<unknown>[] = [];
  const options = { cache, version: "v1", waitUntil: (promise: Promise<unknown>) => void waited.push(promise) };

  const first = await serveLivePage(page("/pricing/"), render, options);
  await Promise.all(waited);
  assert.equal(await first.text(), "<html>prices</html>");
  const second = await serveLivePage(page("/pricing/"), render, options);
  assert.equal(await second.text(), "<html>prices</html>");
  assert.equal(second.headers.get("cache-control"), livePageCacheControl);
  assert.equal(renders, 1);
  assert.equal(entries.size, 1);
  assert.match([...entries.keys()][0]!, /__deployment=v1/);

  // A new deployment renders afresh: the old HTML names files it no longer has.
  await serveLivePage(page("/pricing/"), render, { ...options, version: "v2" });
  assert.equal(renders, 2);

  // Without the version binding nothing is stored, but browsers still get the short rule.
  const uncached = await serveLivePage(page("/pricing/"), render, { cache });
  assert.equal(renders, 3);
  assert.equal(uncached.headers.get("cache-control"), livePageCacheControl);

  // A failed render passes as it is and is not stored.
  const failed = await serveLivePage(page("/download/"), async () => new Response("down", { status: 502 }), options);
  assert.equal(failed.status, 502);
  assert.equal(entries.size, 2);
});

test("the Worker caches live pages only after the language redirect", () => {
  const worker = readFileSync("worker.ts", "utf8");
  assert.ok(worker.indexOf("languageRedirect(request)") < worker.indexOf("isLivePageRequest(request)"));
  assert.match(readFileSync("wrangler.jsonc", "utf8"), /"version_metadata": \{\s*"binding": "CF_VERSION_METADATA"/);
});
