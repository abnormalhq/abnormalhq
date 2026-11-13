import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DocBlock, DocSection } from "../src/content/help/index.ts";
import { securityContent } from "../src/content/security/index.ts";
import { linksFor, site } from "../src/data/site.ts";
import { copies, langs, localePath } from "../src/i18n/index.ts";
import { blockTexts, linkTargets, withAbsoluteLinks } from "../src/lib/docs.ts";
import { homeMarkdown, llmsTxt, securityMarkdown } from "../src/lib/markdown.ts";
import { pageUrls, pages } from "../src/lib/pages.ts";
import { securityStructuredData } from "../src/lib/structured-data.ts";

const texts = (sections: readonly DocSection[]) =>
  sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => blockTexts(block))]);
const whole = (lang: "en" | "zh") =>
  [securityContent[lang].title, securityContent[lang].summary, ...texts(securityContent[lang].sections)].join("\n");
const kind = (block: DocBlock) =>
  "code" in block ? "code" : "p" in block ? "p" : "ol" in block ? `ol${block.ol.length}` : `ul${block.ul.length}`;

test("security page: both languages say the same things, block for block, with the same links", () => {
  const { en, zh } = securityContent;
  assert.deepEqual(
    en.sections.map((section) => section.blocks.map(kind)),
    zh.sections.map((section) => section.blocks.map(kind)),
  );
  // A mailto link's subject is wording in each language ("Security", 安全); where it goes is the address.
  const destination = (target: string) => target.replace(/^(mailto:[^?]+)\?.*$/, "$1");
  const targets = (sections: readonly DocSection[]) =>
    sections.map((section) =>
      section.blocks.map((block) => blockTexts(block).map((text) => linkTargets(text).map(destination).sort())),
    );
  assert.deepEqual(targets(en.sections), targets(zh.sections));
  assert.equal(en.reviewed, zh.reviewed);
  assert.match(en.reviewed, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(`${en.reviewed}T00:00:00Z`).toISOString().slice(0, 10), en.reviewed);
  assert.doesNotMatch(whole("en"), /[㐀-鿿]/);
  for (const section of zh.sections) assert.match(section.title, /[㐀-鿿]/);
  // It is a list of facts, not a procedure: no section is marked as a HowTo.
  for (const lang of langs) assert.ok(securityContent[lang].sections.every((section) => !section.howTo));
});

test("security page: it says plainly what is not offered", () => {
  assert.match(whole("en"), /No end-to-end encryption\./);
  assert.match(whole("en"), /No zero-access encryption\./);
  assert.match(whole("en"), /can technically show mailbox contents/);
  assert.match(whole("zh"), /不提供端到端加密。/);
  assert.match(whole("zh"), /不提供零访问加密。/);
  assert.match(whole("zh"), /在技术上可以查看邮箱内容/);
  // The admin-access sentence is the privacy policy's own, so the two cannot drift apart unnoticed.
  const policy = {
    en: readFileSync("src/content/legal/en/privacy.mdx", "utf8"),
    zh: readFileSync("src/content/legal/zh/privacy.mdx", "utf8"),
  };
  assert.ok(
    policy.en.includes(
      "We access a mailbox only to troubleshoot problems with it or with the system, to handle a request you made yourself, to deal with abuse reports or security incidents, or to cooperate with competent authorities as the law requires.",
    ) && whole("en").includes("to cooperate with competent authorities as the law requires"),
  );
  assert.ok(
    policy.zh.includes("排查你的邮箱或系统故障、处理你本人提出的求助、处理滥用举报或安全事件、依法配合有权机关") &&
      whole("zh").includes("排查你的邮箱或系统故障、处理你本人提出的求助、处理滥用举报或安全事件、依法配合有权机关"),
  );
  // What the page says about providers and transfers is what the policy says.
  for (const name of ["Cloudflare", "PlanetScale", "Stripe", "Linux DO Credit", "DeepSeek"]) {
    for (const lang of langs) {
      assert.ok(whole(lang).includes(name) && policy[lang].includes(name), `${lang}: ${name}`);
    }
  }
  assert.ok(
    policy.en.includes("may be located outside mainland China") && whole("en").includes("outside mainland China"),
  );
  assert.ok(policy.zh.includes("可能位于中国大陆以外的地区") && whole("zh").includes("可能位于中国大陆以外的地区"));
});

test("security page: no compliance, certification or marketing claims, and no deployment details", () => {
  for (const lang of langs) {
    const body = `${whole(lang)}\n${copies[lang].security.metaDescription}`;
    assert.doesNotMatch(body, /GDPR|CCPA|HIPAA|SOC ?[123]|ISO[ /-]?\d|PCI|certif|compliant|compliance|audited/i, lang);
    assert.doesNotMatch(body, /合规|认证|等保|审计/, lang);
    assert.doesNotMatch(body, /military|bank-grade|unbreakable|100%|guarantee|军用|银行级|绝对安全|万无一失/i, lang);
    // Server names, ports and key material are operations detail (mail's docs), not for a public page.
    assert.doesNotMatch(body, /\bmail\.abnormal|\b(?:993|465|587|995)\b|TLSA \d|[0-9a-f]{32}/, lang);
    // Encryption at rest is claimed only for what the policy says is stored encrypted, never for mail itself.
    assert.doesNotMatch(body, /mail is (?:stored )?encrypted|encrypted at rest|邮件加密保存|静态加密/i, lang);
  }
});

test("security page: vulnerabilities are reported to the support address, the only public contact the site has", () => {
  for (const lang of langs) {
    const last = securityContent[lang].sections.at(-1)!;
    // The report link fills in the subject the paragraph asks for ("Security", 安全).
    assert.ok(texts([last]).join("\n").includes(`(mailto:${site.contact.email}?subject=`), lang);
    assert.doesNotMatch(whole(lang), /security@|bounty|reward|奖金|赏金/i, lang);
  }
});

test("security page: its links are pages that exist, and it is a page of both languages", () => {
  const known = new Set(pageUrls.map((page) => page.url));
  for (const lang of langs) {
    for (const text of texts(securityContent[lang].sections)) {
      for (const target of linkTargets(text)) {
        if (/^(https:|mailto:)/.test(target)) continue;
        assert.ok(known.has(`${localePath(lang, "/")}${target}`), `${lang}: ${target}`);
      }
    }
    const page = pages.find((candidate) => candidate.lang === lang && candidate.path === "/security/");
    assert.equal(page?.markdown, `/md${localePath(lang, "/security/")}`);
    assert.equal(linksFor(lang).security, localePath(lang, "/security/"));
    assert.ok(copies[lang].footer.supportLinks.some((item) => item.link === "security"));
  }
});

for (const lang of langs) {
  test(`${lang} security Markdown and structured data carry the page and nothing more`, () => {
    const content = securityContent[lang];
    const s = copies[lang].security;
    const markdown = securityMarkdown(lang);
    assert.ok(markdown.startsWith(`# ${content.title}\n\n${content.summary}\n`));
    assert.ok(markdown.includes(content.reviewed));
    for (const section of content.sections) assert.ok(markdown.includes(`\n## ${section.title}\n`));
    for (const text of texts(content.sections)) assert.ok(markdown.includes(withAbsoluteLinks(text, lang)), text);
    assert.doesNotMatch(markdown, /\]\((?!https:\/\/|mailto:)/);
    assert.ok(markdown.includes(`[${s.policyLink}](${site.url}/md${localePath(lang, "/privacy/")})`));
    assert.ok(llmsTxt().includes(`[${s.navLabel}](${site.url}/md${localePath(lang, "/security/")})`));
    assert.ok(homeMarkdown(lang).includes(`[${s.navLabel}](${site.url}${linksFor(lang).security})`));

    const graph = securityStructuredData(lang)["@graph"];
    const page = graph.find((node) => node["@type"] === "WebPage")!;
    assert.equal(page.url, `${site.url}${localePath(lang, "/security/")}`);
    assert.equal(page.dateModified, content.reviewed);
    const crumbs = (page.breadcrumb as { itemListElement: { name: string }[] }).itemListElement;
    assert.deepEqual(
      crumbs.map((crumb) => crumb.name),
      [site.name, s.navLabel],
    );
    assert.doesNotMatch(JSON.stringify(graph), /HowTo|FAQPage|Certification|award|rating/i);
  });
}
