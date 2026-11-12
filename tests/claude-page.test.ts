import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claudeCodeAdd, claudeCodeRemove, claudeContent, connectorUrl } from "../src/content/claude/index.ts";
import type { DocBlock, DocSection } from "../src/content/help/index.ts";
import { linksFor, site } from "../src/data/site.ts";
import { copies, langs, localePath } from "../src/i18n/index.ts";
import { blockTexts, linkTargets, withAbsoluteLinks } from "../src/lib/docs.ts";
import { claudeMarkdown, homeMarkdown, llmsTxt } from "../src/lib/markdown.ts";
import { pageUrls, pages } from "../src/lib/pages.ts";
import { claudeStructuredData } from "../src/lib/structured-data.ts";

const texts = (sections: readonly DocSection[]) =>
  sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => blockTexts(block))]);
const whole = (lang: "en" | "zh") =>
  [claudeContent[lang].title, claudeContent[lang].summary, ...texts(claudeContent[lang].sections)].join("\n");
const kind = (block: DocBlock) =>
  "code" in block
    ? `code:${block.code}`
    : "p" in block
      ? "p"
      : "ol" in block
        ? `ol${block.ol.length}`
        : `ul${block.ul.length}`;
const commands = (lang: "en" | "zh") =>
  claudeContent[lang].sections.flatMap((section) =>
    section.blocks.flatMap((block) => ("code" in block ? [block.code] : [])),
  );
const policy = {
  en: readFileSync("src/content/legal/en/privacy.mdx", "utf8"),
  zh: readFileSync("src/content/legal/zh/privacy.mdx", "utf8"),
};

test("claude page: both languages say the same things, block for block, with the same links and commands", () => {
  const { en, zh } = claudeContent;
  assert.deepEqual(
    en.sections.map((section) => section.blocks.map(kind)),
    zh.sections.map((section) => section.blocks.map(kind)),
  );
  const targets = (sections: readonly DocSection[]) =>
    sections.map((section) => section.blocks.map((block) => blockTexts(block).map((text) => linkTargets(text).sort())));
  assert.deepEqual(targets(en.sections), targets(zh.sections));
  assert.equal(en.reviewed, zh.reviewed);
  assert.match(en.reviewed, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(`${en.reviewed}T00:00:00Z`).toISOString().slice(0, 10), en.reviewed);
  assert.doesNotMatch(whole("en"), /[㐀-鿿]/);
  for (const section of zh.sections) assert.match(section.title, /[㐀-鿿]/);
  for (const lang of langs) assert.ok(claudeContent[lang].sections.every((section) => !section.howTo));
});

test("claude page: the connector URL and the Claude Code commands are mail's", () => {
  assert.equal(connectorUrl, "https://console.abnormalhq.com/api/mcp");
  assert.equal(claudeCodeAdd, `claude mcp add --transport http mailhq ${connectorUrl}`);
  for (const lang of langs) {
    assert.deepEqual(commands(lang), [claudeCodeAdd, claudeCodeRemove], lang);
    assert.ok(whole(lang).includes(connectorUrl), lang);
    assert.ok(whole(lang).includes("/mcp"), lang);
  }
});

test("claude page: it states the limits of the design and what Claude cannot see", () => {
  const facts: Record<"en" | "zh", readonly (string | RegExp)[]> = {
    en: [
      "within the last 10 minutes",
      "300 requests a minute",
      "lasts one hour",
      "30 days",
      "SHA-256",
      "Operators and viewers can't authorize",
      "Message trace stays off unless you choose it",
      "there is no tool that reads, searches or deletes the mail in a mailbox",
      // Follow-up tasks are the one place mail content is reachable (mail's docs/api.md): the page must say so.
      "Except what follow-up tasks hold",
      "marked as destructive",
      "Approving a follow-up email sends it at once",
      "never your conversation",
    ],
    zh: [
      "最近 10 分钟内",
      "每分钟最多 300 个请求",
      "有效 1 小时",
      "30 天",
      "SHA-256",
      "操作员和只读成员不能授权",
      "邮件追踪默认关闭",
      "没有任何工具可以读取、搜索或删除邮箱里的邮件",
      "跟进任务里的内容除外",
      "标记为破坏性操作",
      "批准一封跟进邮件会立即发出",
      "从来不包括你的对话",
    ],
  };
  for (const lang of langs) {
    for (const fact of facts[lang]) {
      assert.ok(typeof fact === "string" ? whole(lang).includes(fact) : fact.test(whole(lang)), `${lang}: ${fact}`);
    }
  }
});

test("claude page and privacy policy: the policy covers the connector, and each points at the other", () => {
  for (const lang of langs) {
    const text = policy[lang];
    assert.ok(text.includes(`](${localePath(lang, "/claude/")})`), `${lang}: the policy links the page`);
    assert.ok(text.includes("console.abnormalhq.com/api/mcp"), lang);
    assert.ok(text.includes("SHA-256") && text.includes("`oauth:`"), lang);
    // The Markdown link itself, target and all: Anthropic's policy governs what happens to conversations.
    assert.match(text, /\]\(https:\/\/www\.anthropic\.com\/legal\/privacy\)/, lang);
    assert.ok(
      claudeContent[lang].sections.some((section) =>
        section.blocks.some((block) => blockTexts(block).some((t) => linkTargets(t).includes("privacy/"))),
      ),
      `${lang}: the page links the policy`,
    );
  }
  assert.ok(policy.en.includes("## Claude and other connected apps"));
  assert.ok(policy.zh.includes("## Claude 及其他已连接的应用"));
});

test("claude page: its links are pages that exist, and it is a page of both languages", () => {
  const known = new Set(pageUrls.map((page) => page.url));
  for (const lang of langs) {
    for (const text of texts(claudeContent[lang].sections)) {
      for (const target of linkTargets(text)) {
        if (/^(https:|mailto:)/.test(target)) continue;
        assert.ok(known.has(`${localePath(lang, "/")}${target}`), `${lang}: ${target}`);
      }
    }
    assert.ok(whole(lang).includes(`(mailto:${site.contact.email})`), `${lang}: support address`);
    const page = pages.find((candidate) => candidate.lang === lang && candidate.path === "/claude/");
    assert.equal(page?.markdown, `/md${localePath(lang, "/claude/")}`);
    assert.equal(linksFor(lang).claude, localePath(lang, "/claude/"));
    assert.ok(copies[lang].footer.supportLinks.some((item) => item.link === "claude"));
  }
});

for (const lang of langs) {
  test(`${lang} claude Markdown and structured data carry the page and nothing more`, () => {
    const content = claudeContent[lang];
    const c = copies[lang].claude;
    const markdown = claudeMarkdown(lang);
    assert.ok(markdown.startsWith(`# ${content.title}\n\n${content.summary}\n`));
    assert.ok(markdown.includes(content.reviewed));
    for (const section of content.sections) assert.ok(markdown.includes(`\n## ${section.title}\n`));
    for (const text of texts(content.sections)) assert.ok(markdown.includes(withAbsoluteLinks(text, lang)), text);
    for (const command of commands(lang)) assert.ok(markdown.includes(`\`\`\`sh\n${command}\n\`\`\``), command);
    assert.doesNotMatch(markdown, /\]\((?!https:\/\/|mailto:)/);
    assert.ok(markdown.includes(`[${c.policyLink}](${site.url}/md${localePath(lang, "/privacy/")})`));
    assert.ok(llmsTxt().includes(`[${c.navLabel}](${site.url}/md${localePath(lang, "/claude/")})`));
    assert.ok(homeMarkdown(lang).includes(`[${c.navLabel}](${site.url}${linksFor(lang).claude})`));

    const graph = claudeStructuredData(lang)["@graph"];
    const page = graph.find((node) => node["@type"] === "WebPage")!;
    assert.equal(page.url, `${site.url}${localePath(lang, "/claude/")}`);
    assert.equal(page.dateModified, content.reviewed);
    const crumbs = (page.breadcrumb as { itemListElement: { name: string }[] }).itemListElement;
    assert.deepEqual(
      crumbs.map((crumb) => crumb.name),
      [site.name, c.navLabel],
    );
  });
}
