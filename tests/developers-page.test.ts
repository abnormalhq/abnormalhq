import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DevDocBlock, DevDocSection } from "../src/content/help/types.ts";
import { apiReference, developersContent } from "../src/content/developers/index.ts";
import { developerApi, linksFor, site } from "../src/data/site.ts";
import { copies, langs, localePath } from "../src/i18n/index.ts";
import {
  apiOperations,
  buildApiReference,
  groupId,
  publicOpenApiDocument,
  serializeJson,
} from "../src/lib/api-reference.ts";
import { blockTexts, linkTargets, withAbsoluteLinks } from "../src/lib/docs.ts";
import { developersMarkdown, homeMarkdown, llmsTxt } from "../src/lib/markdown.ts";
import { pageUrls, pages } from "../src/lib/pages.ts";
import { developersStructuredData } from "../src/lib/structured-data.ts";

/** The byte-for-byte copy of mail's docs/openapi.json, and what this site publishes from it. */
const spec = readFileSync("docs/openapi.json", "utf8");
const published = readFileSync("public/developers/openapi.json", "utf8");
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

test("developers page: the reference and the published document are what the copy of mail's says (run `pnpm api-reference`)", () => {
  const document = JSON.parse(spec);
  assert.deepEqual(apiReference, buildApiReference(document));
  assert.equal(document.openapi, "3.1.0");
  // mail's document is instance-independent; the copy keeps that, byte for byte, as mail writes it.
  assert.deepEqual(
    document.servers.map((server: { url: string }) => server.url),
    ["/api/v1"],
  );
  assert.equal(spec, serializeJson(document));
  // The published one points tools at the real API: resolved against this site, "/api/v1" would be a 404 here.
  assert.equal(published, serializeJson(publicOpenApiDocument(document, developerApi.base)));
  const servers = (JSON.parse(published) as { servers: { url: string }[] }).servers;
  assert.deepEqual(
    servers.map((server) => server.url),
    [developerApi.base],
  );
  assert.match(developerApi.base, /^https:\/\/console\.abnormalhq\.com\/api\/v1$/);
  const ignored = readFileSync(".prettierignore", "utf8");
  assert.match(ignored, /^docs\/openapi\.json$/m);
  assert.match(ignored, /^public\/developers\/openapi\.json$/m);
});

test("developers page: an operation without a scope is never shown as open to any key", () => {
  const document = JSON.parse(spec);
  const withRule = (rule: Record<string, unknown>) => ({
    info: { version: "1.0.0" },
    "x-error-codes": [
      { code: "x", statuses: [400], area: "request", meaning: "X.", action: "Y.", retry: "no", reserved: false },
    ],
    tags: [{ name: "Batch" }],
    paths: { "/x": { get: { operationId: "x", summary: "X", tags: ["Batch"], "x-required-scopes": [], ...rule } } },
  });
  assert.throws(() => buildApiReference(withRule({})), /cannot say who may call it/);
  assert.equal(
    buildApiReference(withRule({ "x-required-key": "original" })).groups[0]!.operations[0]!.keyRule,
    "original-key",
  );
  const byId = new Map(apiOperations(apiReference).map((operation) => [operation.operationId, operation]));
  const batch = byId.get("executeBatch")!;
  assert.equal(batch.keyRule, "per-operation");
  assert.deepEqual(
    [...batch.scopes].sort(),
    [
      ...new Set(Object.values(document.paths["/batch"].post["x-operation-required-scopes"] as Record<string, string>)),
    ].sort(),
  );
  assert.equal(byId.get("getBatchStatus")!.keyRule, "original-key");
  assert.deepEqual(byId.get("getBatchStatus")!.scopes, []);
  for (const operation of byId.values()) {
    assert.equal(operation.scopes.length > 0, operation.keyRule !== "original-key", operation.operationId);
  }
  for (const lang of langs) {
    const markdown = developersMarkdown(lang);
    const r = copies[lang].developers.reference;
    assert.ok(markdown.includes(`\`GET /batch/{requestId}\`: Get batch execution status (${r.originalKey})`), lang);
    assert.ok(markdown.includes(`(${r.perOperation}${copies[lang].legal.colon}\``), lang);
  }
});

test("developers page: every operation is listed once, scopes are well formed, and anchors are unique", () => {
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
    // The prose ends with what the API does not do (and who to ask); then the error codes and the endpoint list, each
    // filled by its slot.
    const sections = developersContent[lang].sections;
    assert.equal(sections.length, developersContent.en.sections.length);
    assert.deepEqual(sections.map((section) => section.slot ?? null).slice(-3), [null, "errors", "reference"]);
    assert.ok(
      texts([sections.at(-3)!])
        .join("\n")
        .includes(`(mailto:${site.contact.email})`),
      lang,
    );
  }
  // Sending and inbound routing exist (mail's docs/api-email.md): explained, approval included, and no longer listed as missing.
  assert.doesNotMatch(whole("en"), /Sending mail through the API or SMTP/);
  assert.match(whole("en"), /Sending is off until we approve your workspace/);
  assert.ok(whole("en").includes("`message.received`"));
  // Test keys exist (mail's docs/api-test-mode.md): the page explains them and no longer lists them as missing.
  assert.match(whole("en"), /Its token starts with `mhq_test_`/);
  assert.doesNotMatch(whole("en"), /Test keys and a sandbox/);
  assert.ok(whole("en").includes("`403 test_mode_unsupported`"));
  assert.doesNotMatch(whole("zh"), /通过 API 或 SMTP 为你的应用发信/);
  assert.match(whole("zh"), /发信功能默认关闭/);
  assert.match(whole("zh"), /令牌以 `mhq_test_` 开头/);
  assert.doesNotMatch(whole("zh"), /测试密钥和沙箱/);
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

test("developers page: every error code of the document is in the table, named in both languages", () => {
  const document = JSON.parse(spec) as { "x-error-codes": { code: string; area: string; retry: string }[] };
  assert.deepEqual(
    apiReference.errors.map((entry) => entry.code),
    document["x-error-codes"].map((entry) => entry.code),
  );
  assert.ok(apiReference.errors.length >= 80, `${apiReference.errors.length} codes`);
  for (const code of [
    "unauthorized",
    "rate_limited",
    "provisioning_uncertain",
    "test_mode_unsupported",
    "sandbox_domain_zone",
  ])
    assert.ok(
      apiReference.errors.some((entry) => entry.code === code),
      code,
    );
  // Every area and retry answer the document uses has a name in each language.
  for (const lang of langs) {
    const copy = copies[lang].developers.errors;
    for (const entry of apiReference.errors) {
      assert.ok(copy.areas[entry.area], `${lang}: area ${entry.area}`);
      assert.ok(copy.retryValues[entry.retry as keyof typeof copy.retryValues], `${lang}: retry ${entry.retry}`);
    }
    const markdown = developersMarkdown(lang);
    for (const entry of apiReference.errors)
      assert.ok(markdown.includes(`\`${entry.code}\` (`), `${lang}: ${entry.code}`);
    // The error codes follow their own section, before the endpoint list.
    const errorsTitle = developersContent[lang].sections.find((section) => section.slot === "errors")!.title;
    const referenceTitle = developersContent[lang].sections.find((section) => section.slot === "reference")!.title;
    const at = (text: string) => markdown.indexOf(text);
    assert.ok(
      at(`## ${errorsTitle}`) < at("`unauthorized` (") && at("`unauthorized` (") < at(`## ${referenceTitle}`),
      lang,
    );
  }
});
