import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.ts";
import { developersSite, linksFor } from "../src/data/site.ts";
import { copies, langs } from "../src/i18n/index.ts";
import { llmsTxt } from "../src/lib/markdown.ts";
import { pages } from "../src/lib/pages.ts";

test("the developer documentation lives on its own site: every old address redirects there, permanently", async () => {
  const redirects = await config("phase-production-build").redirects!();
  const target = (source: string) => redirects.find((redirect) => redirect.source === source);
  for (const [source, destination] of [
    ["/developers/", "/"],
    ["/zh/developers/", "/zh/"],
    ["/md/developers/", "/md/"],
    ["/md/zh/developers/", "/md/zh/"],
    ["/developers/openapi.json", "/openapi.json"],
  ]) {
    const redirect = target(source!);
    assert.equal(redirect?.destination, `${developersSite}${destination}`, source);
    assert.equal((redirect as { statusCode?: number }).statusCode, 301, source);
  }
  assert.equal(developersSite, "https://developers.abnormalhq.com");
  // No page of this site is the documentation any more; the footer and llms.txt link to the other site.
  assert.ok(!pages.some((page) => page.url.includes("/developers/")));
  for (const lang of langs) {
    assert.equal(linksFor(lang).developers, lang === "en" ? `${developersSite}/` : `${developersSite}/zh/`);
    assert.ok(copies[lang].footer.productLinks.some((item) => item.link === "developers"));
    assert.ok(llmsTxt().includes(`(${developersSite}/md/${lang === "en" ? "" : "zh/"})`), lang);
  }
});
