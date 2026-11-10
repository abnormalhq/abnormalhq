import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  helpArticle,
  helpArticles,
  helpCategoryIds,
  helpContent,
  helpPath,
  helpSlugOf,
  helpSlugs,
  type DocBlock,
  type DocSection,
} from "../src/content/help/index.ts";
import { linksFor, site } from "../src/data/site.ts";
import { copies, langs, localePath } from "../src/i18n/index.ts";
import { blockTexts, linkTargets, plainText, sectionId, withAbsoluteLinks } from "../src/lib/docs.ts";
import { matchesQuery, normalizeQuery, queryWords } from "../src/lib/help-search.ts";
import { helpArticleMarkdown, helpIndexMarkdown, homeMarkdown, llmsTxt } from "../src/lib/markdown.ts";
import { pageUrls, pages } from "../src/lib/pages.ts";
import { helpArticleStructuredData, helpIndexStructuredData } from "../src/lib/structured-data.ts";
import { storeMarkdown } from "../src/storefront/lib/markdown.ts";

const cjk = /[㐀-鿿]/;
const texts = (sections: readonly DocSection[]) =>
  sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => blockTexts(block))]);
const kind = (block: DocBlock) =>
  "p" in block ? "p" : "ol" in block ? `ol${block.ol.length}` : `ul${block.ul.length}`;

test("help: every article exists once in each language, in the order of the slug list, in a known topic", () => {
  for (const lang of langs) {
    const { articles, categories } = helpContent[lang];
    assert.deepEqual(
      articles.map((article) => article.slug),
      [...helpSlugs],
      lang,
    );
    assert.deepEqual(Object.keys(categories), [...helpCategoryIds], lang);
    for (const category of helpCategoryIds) {
      assert.ok(
        articles.some((article) => article.category === category),
        `${lang}: no article under ${category}`,
      );
    }
    assert.equal(helpArticles(lang).length, helpSlugs.length);
  }
  assert.equal(helpSlugOf("/help/apple-mail/"), "apple-mail");
  assert.equal(helpSlugOf("/help/"), undefined);
  assert.equal(helpSlugOf("/help/nope/"), undefined);
});

test("help: the two languages have the same articles block for block, with the same links and the same procedures", () => {
  for (const slug of helpSlugs) {
    const [en, zh] = [helpArticle("en", slug), helpArticle("zh", slug)];
    assert.equal(en.category, zh.category, slug);
    assert.deepEqual(
      en.sections.map((section) => [section.blocks.map(kind), section.howTo ?? false]),
      zh.sections.map((section) => [section.blocks.map(kind), section.howTo ?? false]),
      `${slug}: sections, blocks and list lengths`,
    );
    // The same link targets in the same blocks: a link dropped or retargeted in one language shows here.
    const targets = (sections: readonly DocSection[]) =>
      sections.map((section) =>
        section.blocks.map((block) => blockTexts(block).map((text) => linkTargets(text).sort())),
      );
    assert.deepEqual(targets(en.sections), targets(zh.sections), `${slug}: link targets`);
    assert.doesNotMatch([en.title, en.summary, ...texts(en.sections)].join("\n"), cjk, `${slug}: English`);
    for (const text of [zh.title, zh.summary, ...zh.sections.map((section) => section.title)])
      assert.match(text, cjk, `${slug}: Chinese: ${text}`);
  }
});

test("help: every article is written to be found and read", () => {
  for (const lang of langs) {
    for (const article of helpArticles(lang)) {
      const where = `${lang}/${article.slug}`;
      assert.ok(article.title.length > 1 && article.summary.length > (lang === "zh" ? 10 : 20), where);
      // The summary is the meta description too.
      assert.ok(article.summary.length <= 200, `${where}: summary of ${article.summary.length} characters`);
      assert.ok(article.keywords.length >= 3, where);
      assert.equal(new Set(article.keywords).size, article.keywords.length, `${where}: repeated keyword`);
      for (const keyword of article.keywords)
        assert.equal(
          keyword,
          normalizeQuery(keyword),
          `${where}: keyword "${keyword}" is not as a search would type it`,
        );
      assert.ok(article.sections.length >= 2, where);
      // Section titles are the table of contents and the anchors' labels: unique on the page.
      const titles = article.sections.map((section) => section.title);
      assert.equal(new Set(titles).size, titles.length, where);
      for (const section of article.sections) {
        assert.ok(section.blocks.length > 0, `${where}: ${section.title}`);
        // A procedure is a numbered list of at least two steps.
        if (section.howTo)
          assert.ok(
            section.blocks.some((block) => "ol" in block && block.ol.length >= 2),
            `${where}: ${section.title} is marked howTo without steps`,
          );
      }
    }
  }
});

test("help: site links in the articles point at pages that exist, in the article's own language", () => {
  const known = new Set(pageUrls.map((page) => page.url));
  for (const lang of langs) {
    for (const article of helpArticles(lang)) {
      for (const text of texts(article.sections)) {
        for (const target of linkTargets(text)) {
          if (/^(https:|mailto:)/.test(target)) continue;
          assert.doesNotMatch(target, /^(\/|http:|#)/, `${lang}/${article.slug}: ${target}`);
          const [pathname] = `${localePath(lang, "/")}${target}`.split("?");
          assert.ok(known.has(pathname!), `${lang}/${article.slug}: ${target} is not a page`);
          // An article does not link to itself.
          assert.notEqual(pathname, localePath(lang, helpPath(article.slug)), `${lang}/${article.slug}`);
        }
      }
    }
  }
  assert.equal(
    withAbsoluteLinks("See [My account](shop/account/?mode=register) or [mail](mailto:a@b.co).", "zh"),
    "See [My account](https://abnormalhq.com/zh/shop/account/?mode=register) or [mail](mailto:a@b.co).",
  );
  assert.equal(
    plainText("Open **Settings** in [webmail](https://webmail.abnormalhq.com/)."),
    "Open Settings in webmail.",
  );
});

test("help: values that differ per deployment are never written down", () => {
  // IMAP / SMTP / CalDAV / CardDAV host names and ports come from the mailbox's own domain binding in mail: an article
  // says where the reader sees theirs.
  // The mailbox domains (in example addresses) and the site's own public hosts.
  const allowedHosts = new Set(["abnormalhq.com", "abnormal.bid", "webmail.abnormalhq.com", "console.abnormalhq.com"]);
  for (const lang of langs) {
    for (const article of helpArticles(lang)) {
      const body = [article.title, article.summary, ...texts(article.sections)].join("\n");
      for (const [host] of body.matchAll(/\b(?:[a-z0-9-]+\.)+(?:com|bid|net|org|cc|dev)\b/g)) {
        const name = host.replace(/^.*@/, "");
        assert.ok(allowedHosts.has(name), `${lang}/${article.slug}: names the host ${host}`);
      }
      assert.doesNotMatch(body, /\bmail\.abnormal/, `${lang}/${article.slug}`);
      assert.doesNotMatch(body, /\b(?:993|465|587|995|143)\b/, `${lang}/${article.slug}: names a port`);
    }
  }
});

test("help: the numbers the articles state are the ones the rest of the site and mail's rules state", () => {
  const body = (lang: "en" | "zh", slug: (typeof helpSlugs)[number]) =>
    texts(helpArticle(lang, slug).sections).join("\n");
  const contract = JSON.parse(readFileSync("docs/onboard-contract.json", "utf8"));
  for (const lang of langs) {
    // Grace period and retention (mail's subscription-rules.ts; also in the pricing copy and the legal pages).
    assert.match(body(lang, "renewals"), /7/);
    assert.match(body(lang, "renewals"), /30/);
    assert.match(copies[lang].pricing.included.items.map((item) => item.description).join(" "), /7.*30/s);
    // The username, password and batch rules of docs/onboard-contract.json.
    const start = body(lang, "getting-started");
    assert.ok(start.includes(String(contract.redeem.username.maxLength)));
    assert.ok(start.includes(String(contract.redeem.password.minLength)));
    assert.ok(start.includes(String(contract.redeem.password.maxLength)));
    assert.ok(start.includes(String(contract.redeem.maxMailboxes)));
    assert.ok(body(lang, "renewals").includes(String(contract.shop.renewMaxPeriods)));
    // Sign-in links work for 15 minutes (docs/storefront-api.md).
    assert.match(start, /15/);
  }
});

for (const lang of langs) {
  test(`${lang} help Markdown: the index lists every article by topic, an article carries its text with full addresses`, () => {
    const h = copies[lang].help;
    const index = helpIndexMarkdown(lang);
    assert.ok(index.startsWith(`# ${h.title}\n`));
    for (const category of helpCategoryIds) assert.ok(index.includes(`## ${helpContent[lang].categories[category]}`));
    for (const article of helpArticles(lang)) {
      const url = `${site.url}/md${localePath(lang, helpPath(article.slug))}`;
      assert.ok(index.includes(`[${article.title}](${url}): ${article.summary}`), article.slug);

      const markdown = helpArticleMarkdown(lang, article.slug);
      assert.ok(markdown.startsWith(`# ${article.title}\n\n${article.summary}\n`), article.slug);
      for (const section of article.sections) assert.ok(markdown.includes(`\n## ${section.title}\n`), section.title);
      // Site links are relative to the language root in the content and absolute in Markdown.
      assert.doesNotMatch(markdown, /\]\((?!https:\/\/|mailto:)/, `${article.slug}: a relative link`);
      for (const text of texts(article.sections)) assert.ok(markdown.includes(withAbsoluteLinks(text, lang)), text);
      // The way back to the index and on to support, as at the foot of the page.
      assert.ok(markdown.includes(`[${h.wrong.index}](${site.url}/md${localePath(lang, "/help/")})`));
      assert.ok(markdown.includes(`(mailto:${site.contact.email})`));
      assert.ok(!markdown.includes("undefined"));
    }
    assert.ok(index.includes(`(mailto:${site.contact.email})`));
  });

  test(`${lang} help: llms.txt, the home page's FAQ and the guide all lead to the help center`, () => {
    const llms = llmsTxt();
    assert.ok(llms.includes(`[${copies[lang].help.navLabel}](${site.url}/md${localePath(lang, "/help/")})`));
    for (const article of helpArticles(lang))
      assert.ok(llms.includes(`[${article.title}](${site.url}/md${localePath(lang, helpPath(article.slug))})`));
    assert.equal(linksFor(lang).help, localePath(lang, "/help/"));
    assert.ok(homeMarkdown(lang).includes(`[${copies[lang].faq.help}](${site.url}${linksFor(lang).help})`));
    assert.ok(copies[lang].footer.supportLinks.some((item) => item.link === "help"));
    assert.ok(storeMarkdown(lang, "/guide/").includes(`(${site.url}${linksFor(lang).help})`));
  });

  test(`${lang} help structured data: breadcrumbs everywhere, a HowTo only for the procedures on the page`, () => {
    const index = helpIndexStructuredData(lang)["@graph"].find((node) => node["@type"] === "CollectionPage")!;
    assert.equal((index.hasPart as unknown[]).length, helpSlugs.length);
    for (const article of helpArticles(lang)) {
      const graph = helpArticleStructuredData(lang, article)["@graph"];
      const page = graph.find((node) => node["@type"] === "WebPage")!;
      const url = `${site.url}${localePath(lang, helpPath(article.slug))}`;
      assert.equal(page.url, url);
      assert.equal(page.name, article.title);
      assert.equal(page.description, article.summary);
      const crumbs = (page.breadcrumb as { itemListElement: { name: string; item: string; position: number }[] })
        .itemListElement;
      assert.deepEqual(
        crumbs.map((crumb) => [crumb.position, crumb.name, crumb.item]),
        [
          [1, site.name, `${site.url}${localePath(lang, "/")}`],
          [2, copies[lang].help.navLabel, `${site.url}${localePath(lang, "/help/")}`],
          [3, article.title, url],
        ],
      );
      // No article is questions and answers, so none claims to be an FAQ.
      assert.ok(!JSON.stringify(graph).includes("FAQPage"), article.slug);

      const howTos = graph.filter((node) => node["@type"] === "HowTo");
      const procedures = article.sections
        .map((section, position) => ({ section, position }))
        .filter(({ section }) => section.howTo);
      assert.equal(howTos.length, procedures.length, article.slug);
      procedures.forEach(({ section, position }, index) => {
        const howTo = howTos[index]!;
        // The HowTo is the section the page shows, at its anchor, with exactly its steps as plain text.
        assert.equal(howTo["@id"], `${url}#${sectionId(position)}`);
        assert.equal(howTo.name, section.title);
        const steps = section.blocks.flatMap((block) => ("ol" in block ? block.ol : []));
        assert.deepEqual(
          (howTo.step as { position: number; text: string }[]).map((step) => [step.position, step.text]),
          steps.map((step, stepIndex) => [stepIndex + 1, plainText(step)]),
        );
        assert.doesNotMatch(JSON.stringify(howTo.step), /\*\*|\]\(/, "markup in a step");
      });
      assert.deepEqual(
        page.mainEntity,
        howTos.length > 0 ? howTos.map((howTo) => ({ "@id": howTo["@id"] })) : undefined,
      );
    }
  });
}

test("help pages: the index and every article are pages of both languages, with a Markdown version", () => {
  for (const lang of langs) {
    for (const path of ["/help/", ...helpSlugs.map(helpPath)]) {
      const page = pages.find((candidate) => candidate.lang === lang && candidate.path === path);
      assert.ok(page, `${lang}${path}`);
      assert.equal(page.markdown, `/md${localePath(lang, path)}`);
    }
  }
  // The routes prerender exactly the slugs of the content and 404 on anything else.
  for (const file of ["src/app/(en)/help/[slug]/page.tsx", "src/app/(zh)/zh/help/[slug]/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /export const dynamicParams = false;/, file);
    assert.match(source, /return helpSlugs\.map\(\(slug\) => \(\{ slug \}\)\);/, file);
  }
});

test("help search: every word of the query must occur in the title, summary or keywords", () => {
  const entry = {
    href: "/help/outlook/",
    title: "Set up Outlook",
    summary: "Add the mailbox to Outlook as an IMAP account.",
    keywords: ["microsoft", "365"],
  };
  assert.equal(matchesQuery(entry, ""), true);
  assert.equal(matchesQuery(entry, "   "), true);
  assert.equal(matchesQuery(entry, "OUTLOOK"), true);
  assert.equal(matchesQuery(entry, "outlook imap"), true);
  assert.equal(matchesQuery(entry, "microsoft"), true);
  assert.equal(matchesQuery(entry, "outlook thunderbird"), false);
  assert.equal(matchesQuery(entry, "gmail"), false);
  // Full-width letters and digits, as a Chinese input method types them, and runs of spaces.
  assert.deepEqual(queryWords("  Ｏｕｔｌｏｏｋ　３６５ "), ["outlook", "365"]);
  assert.equal(matchesQuery(entry, "ｏｕｔｌｏｏｋ"), true);
});

test("help search: the words people would type find the article, in both languages", () => {
  const find = (lang: "en" | "zh", query: string) =>
    helpArticles(lang)
      .filter((article) => matchesQuery({ href: "", ...article }, query))
      .map((article) => article.slug);
  const expectations: [("en" | "zh")[], string, (typeof helpSlugs)[number]][] = [
    [["en", "zh"], "outlook", "outlook"],
    [["en", "zh"], "iphone", "apple-mail"],
    [["en", "zh"], "thunderbird", "thunderbird"],
    [["en", "zh"], "android", "gmail-android"],
    [["en", "zh"], "2fa", "two-step-verification"],
    [["en", "zh"], "qq", "import-and-export"],
    [["en", "zh"], "163", "import-and-export"],
    [["en", "zh"], "mbox", "import-and-export"],
    [["en", "zh"], "caldav", "calendar"],
    [["en", "zh"], "coupon", "discount-codes"],
    [["en", "zh"], "deepseek", "ai-features"],
    [["en"], "vacation", "labels-filters-forwarding"],
    [["en"], "grace", "renewals"],
    [["en"], "app password", "two-step-verification"],
    [["en"], "delete", "delete-mailbox"],
    [["zh"], "苹果", "apple-mail"],
    [["zh"], "两步验证", "two-step-verification"],
    [["zh"], "搬家", "import-and-export"],
    [["zh"], "续费", "renewals"],
    [["zh"], "优惠码", "discount-codes"],
    [["zh"], "转发", "labels-filters-forwarding"],
    [["zh"], "注销", "delete-mailbox"],
  ];
  for (const [queryLangs, query, slug] of expectations) {
    for (const lang of queryLangs)
      assert.ok(find(lang, query).includes(slug), `${lang}: "${query}" should find ${slug}`);
  }
  for (const lang of langs) assert.deepEqual(find(lang, "zzzz-no-such-thing"), []);
});

test("help search: runs in the browser on what the page hands it, and the page works without it", () => {
  const search = readFileSync("src/components/HelpSearch.tsx", "utf8");
  assert.ok(search.startsWith('"use client"'));
  // The client component must not pull the articles of both languages (or the copy) into the browser bundle.
  assert.doesNotMatch(search, /from "@\/content\//);
  assert.doesNotMatch(search, /from "@\/i18n"/);
  assert.doesNotMatch(search, /fetch\(|localStorage|sessionStorage/);
  // The number of matches is announced, and the field is labelled and tied to the list it filters.
  assert.match(search, /role="status"/);
  assert.match(search, /<label className="sr-only" htmlFor=/);
  assert.match(search, /aria-controls=/);
  // The index hands it only this language's entries.
  const index = readFileSync("src/components/HelpCenter.tsx", "utf8");
  assert.ok(!index.startsWith('"use client"'));
  assert.match(index, /<HelpSearch copy=\{h\.search\} groups=\{groups\} \/>/);
});

test("help article page: a breadcrumb back to the index, and the way to the index and to support at its foot", () => {
  const article = readFileSync("src/components/HelpArticle.tsx", "utf8");
  assert.match(article, /trail=\{\[\{ label: h\.navLabel, path: "\/help\/" \}\]\}/);
  assert.match(article, /<Link href=\{path\("\/help\/"\)\}>/);
  assert.match(article, /href=\{`mailto:\$\{email\}`\}/);
  const doc = readFileSync("src/components/DocArticle.tsx", "utf8");
  assert.match(doc, /<Breadcrumb label=\{h\.breadcrumbLabel\}>/);
  assert.match(doc, /<BreadcrumbPage>\{title\}<\/BreadcrumbPage>/);
});
