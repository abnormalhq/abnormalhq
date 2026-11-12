import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { site } from "../src/data/site.ts";
import { indexNowKey, indexNowRequest } from "../src/lib/indexnow.ts";
import { pages, sessionPagePaths } from "../src/lib/pages.ts";

test("the IndexNow key is served from the site root as plain text, and is the only key file", () => {
  assert.match(indexNowKey, /^[0-9a-f]{32}$/);
  assert.equal(readFileSync(`public/${indexNowKey}.txt`, "utf8"), indexNowKey);
  const keyFiles = readdirSync("public").filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  assert.deepEqual(keyFiles, [`${indexNowKey}.txt`]);
});

test("IndexNow is sent every page of the sitemap on the site's own host, and no session page", () => {
  const body = indexNowRequest();
  assert.equal(body.host, "abnormalhq.com");
  assert.equal(body.keyLocation, `${site.url}/${indexNowKey}.txt`);
  assert.deepEqual(
    body.urlList,
    pages.map((page) => `${site.url}${page.url}`),
  );
  for (const path of sessionPagePaths) assert.ok(!body.urlList.some((url) => url.includes(path)), path);
});
