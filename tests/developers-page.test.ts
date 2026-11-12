import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DevDocBlock, DevDocSection } from "../src/content/help/types.ts";
import { apiReference, developersContent } from "../src/content/developers/index.ts";
import { developerApi, linksFor, site } from "../src/data/site.ts";
import { copies, langs, localePath } from "../src/i18n/index.ts";
import { apiOperations, buildApiReference, groupId } from "../src/lib/api-reference.ts";
import { blockTexts, linkTargets, withAbsoluteLinks } from "../src/lib/docs.ts";
import { developersMarkdown, homeMarkdown, llmsTxt } from "../src/lib/markdown.ts";
import { pageUrls, pages } from "../src/lib/pages.ts";
import { developersStructuredData } from "../src/lib/structured-data.ts";

const spec = readFileSync("public/developers/openapi.json", "utf8");
const texts = (sections: readonly DevDocSection[]) =>
  sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => blockTexts(block))]);
const whole = (lang: "en" | "zh") =>
  [developersContent[lang].title, developersContent[lang].summary, ...texts(developersContent[lang].sections)].join(
    "\n",
  );
const kind = (block: DevDocBlock) =>
  "code" in block
    ? `code:${block.language}`
    : "p" in block
      ? "p"
      : "ol" in block
        ? `ol${block.ol.length}`
        : `ul${block.ul.length}`;
const codeBlocks = (lang: "en" | "zh") =>
  developersContent[lang].sections.flatMap((section) => section.blocks.filter((block) => "code" in block));

test("developers page: the reference is exactly what the copy of mail's OpenAPI document says (run `pnpm api-reference`)", () => {
  assert.deepEqual(apiReference, buildApiReference(JSON.parse(spec)));
  const document = JSON.parse(spec) as { openapi: string; servers: { url: string }[] };
  assert.equal(document.openapi, "3.1.0");
  assert.deepEqual(
    document.servers.map((server) => server.url),
    ["/api/v1"],
  );
  assert.ok(developerApi.base.endsWith("/api/v1"));
  // mail writes the file with JSON.stringify(document, null, 2) and a final newline; prettier must not touch the copy.
  assert.equal(spec, `${JSON.stringify(JSON.parse(spec), null, 2)}\n`);
  assert.match(readFileSync(".prettierignore", "utf8"), /^public\/developers\/openapi\.json$/m);
});

test("developers page: every operation is listed once, with a scope or as open to any key, and anchors are unique", () => {
  const operations = apiOperations(apiReference);
  assert.ok(operations.length >= 80, `${operations.length} operations`);
  const ids = operations.map((operation) => operation.operationId);
  assert.equal(new Set(ids).size, ids.length);
  const keys = operations.map((operation) => `${operation.method} ${operation.path}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const operation of operations) {
    for (const scope of operation.scopes) assert.match(scope, /^[a-z_]+:(read|write)$/, operation.operationId);
  }
  const anchors = apiReference.groups.map((group) => groupId(group.tag));
  assert.equal(new Set(anchors).size, anchors.length);
  // The scope families the text names are the ones the document uses, so a renamed scope shows here.
  const families = new Set(operations.flatMap((operation) => operation.scopes.map((scope) => scope.split(":")[0])));
  for (const family of [
    "domains",
    "mailboxes",
    "forwarders",
    "aliases",
    "lists",
    "holds",
    "webhooks",
    "suppressions",
    "trace",
    "agent_tasks",
  ]) {
    assert.ok(families.has(family), family);
    for (const lang of langs) assert.ok(whole(lang).includes(`\`${family}:`), `${lang}: ${family}`);
  }
});

test("developers page: both languages say the same things, block for block, with the same links and the same code", () => {
  const { en, zh } = developersContent;
  assert.deepEqual(
    en.sections.map((section) => section.blocks.map(kind)),
    zh.sections.map((section) => section.blocks.map(kind)),
  );
  const targets = (sections: readonly DevDocSection[]) =>
    sections.map((section) => section.blocks.map((block) => blockTexts(block).map((text) => linkTargets(text).sort())));
  assert.deepEqual(targets(en.sections), targets(zh.sections));
  assert.deepEqual(codeBlocks("zh"), codeBlocks("en"));
  // The same inline code in the same blocks: a path, header or scope dropped in one language shows here.
  const inline = (sections: readonly DevDocSection[]) =>
    sections.map((section) =>
      section.blocks.map((block) => blockTexts(block).map((text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]))),
    );
  assert.deepEqual(inline(en.sections), inline(zh.sections));
  assert.equal(en.reviewed, zh.reviewed);
  assert.equal(new Date(`${en.reviewed}T00:00:00Z`).toISOString().slice(0, 10), en.reviewed);
  assert.doesNotMatch(whole("en"), /[㐀-鿿]/);
  for (const section of zh.sections) assert.match(section.title, /[㐀-鿿]|^Webhook$/);
});

test("developers page: it names the real addresses, says what is not offered, and holds no secret", () => {
  for (const lang of langs) {
    const body = whole(lang);
    const code = codeBlocks(lang)
      .map((block) => block.code)
      .join("\n");
    assert.ok(body.includes(developerApi.base) && code.includes(developerApi.base), lang);
    assert.ok(body.includes(developerApi.mcp) && code.includes(developerApi.mcp), lang);
    assert.ok(body.includes(`(${developerApi.signup})`), lang);
    assert.ok(body.includes(`(${developerApi.openapi})`), lang);
    // A key is read from hidden input or the environment, never written into an example.
    assert.doesNotMatch(`${body}\n${code}`, /Bearer [A-Za-z0-9_-]{12,}|whsec_[A-Za-z0-9]{8,}|sk_(live|test)_/, lang);
    // The last prose section before the reference says what the API does not do; the reference is last.
    const sections = developersContent[lang].sections;
    assert.equal(sections.length, developersContent.en.sections.length);
    assert.ok(
      texts([sections.at(-2)!])
        .join("\n")
        .includes(`(mailto:${site.contact.email})`),
      lang,
    );
  }
  assert.match(whole("en"), /Sending mail through the API or SMTP/);
  assert.match(whole("en"), /Test keys and a sandbox/);
  assert.match(whole("zh"), /通过 API 或 SMTP 为你的应用发信/);
  assert.match(whole("zh"), /测试密钥和沙箱/);
});

test("developers page: its links resolve, and it is a page of both languages with a footer entry", () => {
  const known = new Set(pageUrls.map((page) => page.url));
  for (const lang of langs) {
    for (const text of texts(developersContent[lang].sections)) {
      for (const target of linkTargets(text)) {
        if (/^(https:|mailto:)/.test(target)) continue;
        assert.ok(known.has(`${localePath(lang, "/")}${target}`), `${lang}: ${target}`);
      }
    }
    const page = pages.find((candidate) => candidate.lang === lang && candidate.path === "/developers/");
    assert.equal(page?.markdown, `/md${localePath(lang, "/developers/")}`);
    assert.equal(linksFor(lang).developers, localePath(lang, "/developers/"));
    assert.ok(copies[lang].footer.productLinks.some((item) => item.link === "developers"));
  }
  assert.equal(developerApi.openapi, `${site.url}/developers/openapi.json`);
});

for (const lang of langs) {
  test(`${lang} developers Markdown and structured data carry the page and the whole reference`, () => {
    const content = developersContent[lang];
    const d = copies[lang].developers;
    const markdown = developersMarkdown(lang);
    assert.ok(markdown.startsWith(`# ${content.title}\n\n${content.summary}\n`));
    assert.ok(markdown.includes(content.reviewed) && markdown.includes(apiReference.version));
    for (const section of content.sections) assert.ok(markdown.includes(`\n## ${section.title}\n`));
    for (const text of texts(content.sections)) assert.ok(markdown.includes(withAbsoluteLinks(text, lang)), text);
    for (const block of codeBlocks(lang))
      assert.ok(markdown.includes(`\`\`\`${block.language}\n${block.code}\n\`\`\``));
    for (const operation of apiOperations(apiReference)) {
      assert.ok(markdown.includes(`\`${operation.method.toUpperCase()} ${operation.path}\`: ${operation.summary}`));
    }
    assert.doesNotMatch(markdown, /\]\((?!https:\/\/|mailto:)/);
    assert.ok(llmsTxt().includes(`[${d.navLabel}](${site.url}/md${localePath(lang, "/developers/")})`));
    assert.ok(homeMarkdown(lang).includes(`(${site.url}${linksFor(lang).developers})`));

    const graph = developersStructuredData(lang)["@graph"];
    const page = graph.find((node) => node["@type"] === "WebPage")!;
    assert.equal(page.url, `${site.url}${localePath(lang, "/developers/")}`);
    assert.equal(page.dateModified, content.reviewed);
    const crumbs = (page.breadcrumb as { itemListElement: { name: string }[] }).itemListElement;
    assert.deepEqual(
      crumbs.map((crumb) => crumb.name),
      [site.name, d.navLabel],
    );
  });
}
