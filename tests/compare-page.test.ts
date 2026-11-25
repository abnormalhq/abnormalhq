import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareContent,
  compareRows,
  markedRows,
  ourMarks,
  rivalMarks,
  rivals,
  rivalSources,
} from "../src/content/compare/index.ts";
import { linksFor, site } from "../src/data/site.ts";
import { copies, langs, localePath } from "../src/i18n/index.ts";
import { catalogStorage, compareView } from "../src/lib/compare.ts";
import { compareMarkdown, homeMarkdown, llmsTxt } from "../src/lib/markdown.ts";
import { pages } from "../src/lib/pages.ts";
import { compareStructuredData } from "../src/lib/structured-data.ts";
import { catalog, seatCatalog } from "./support/catalog.ts";

/** Each service's cells may only cite that provider's own pages. */
const providerHosts: Record<(typeof rivals)[number], readonly string[]> = {
  gmail: ["support.google.com", "workspace.google.com", "developers.google.com"],
  outlook: ["support.microsoft.com"],
  icloud: ["www.apple.com", "support.apple.com"],
  proton: ["proton.me"],
  fastmail: ["www.fastmail.com", "www.fastmail.help"],
};

test("compare page: both languages have every row, every service and one link text per source", () => {
  for (const lang of langs) {
    const content = compareContent[lang];
    assert.equal(content.reviewed, compareContent.en.reviewed);
    for (const row of compareRows) assert.ok(content.rows[row], `${lang} ${row}`);
    for (const rival of rivals) {
      const copy = content.rivals[rival];
      for (const row of compareRows) assert.ok(copy.cells[row].trim(), `${lang} ${rival} ${row}`);
      assert.equal(copy.sources.length, rivalSources[rival].length, `${lang} ${rival} sources`);
    }
  }
  assert.match(compareContent.en.reviewed, /^\d{4}-\d{2}-\d{2}$/);
  const english = JSON.stringify(compareContent.en);
  assert.doesNotMatch(english, /[㐀-鿿]/);
  for (const rival of rivals) assert.match(compareContent.zh.rivals[rival].cells.storage, /GB|MB/);
});

test("compare page: every other service's cell is backed by its provider's own page, or says it is not there", () => {
  for (const rival of rivals) {
    const sources = rivalSources[rival];
    for (const source of sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, "https:");
      assert.ok(providerHosts[rival].includes(url.host), `${rival}: ${source.url}`);
    }
    const backed = new Set(sources.flatMap((source) => source.rows));
    for (const row of compareRows) {
      const mark = markedRows.some((marked) => marked === row)
        ? rivalMarks[rival][row as (typeof markedRows)[number]]
        : undefined;
      // A "no" may rest on a provider listing no such feature; everything else needs a page that says it.
      if (mark !== "no") assert.ok(backed.has(row), `${rival} ${row} has no source`);
    }
  }
});

test("compare page: Abnormal Mail's column admits what it lacks", () => {
  // The phone apps are not in the stores (mail's ios/README.md and android/README.md), and webmail sends 3 MB per message
  // (docs/large-attachments.md): the column must not drift into claiming otherwise.
  assert.equal(ourMarks.phone, "partial");
  for (const lang of langs) {
    assert.match(compareContent[lang].ours.cells.attachments, /3 MB/);
    assert.equal(compareContent[lang].notFit.items.length, 2);
  }
});

test("compare page: storage, the trial and own domains come from the catalog", () => {
  assert.equal(catalogStorage(catalog), "1 GB–2.5 GB");
  assert.equal(catalogStorage(null), null);
  assert.equal(catalogStorage({ ...catalog, available: false }), null);

  const withTrial = { ...seatCatalog, trial: { days: 7, quotaMb: 1024 } };
  const en = compareView("en", withTrial);
  const ours = en.columns[0];
  assert.equal(ours?.id, "ours");
  assert.equal(ours?.cells.storage.text, "1 GB–2.5 GB per mailbox");
  assert.equal(ours?.cells.free.text, "No; a 7-day free trial");
  assert.deepEqual(ours?.cells.ownDomain, { text: compareContent.en.ours.ownDomainYes, mark: "partial" });
  assert.equal(en.notFit[0], "A lot of storage: our plans give 1 GB–2.5 GB per mailbox.");
  assert.equal(en.notFit.at(-1), "A free plan: we offer a 7-day free trial instead.");

  // A catalog without own-domain plans says so; an unreadable one keeps the conditional wording and states no size.
  const plain = compareView("zh", catalog).columns[0];
  assert.deepEqual(plain?.cells.ownDomain, { text: compareContent.zh.ours.ownDomainNo, mark: "no" });
  const unknown = compareView("zh", null);
  assert.equal(unknown.columns[0]?.cells.storage.text, compareContent.zh.ours.storageUnknown);
  assert.equal(unknown.columns[0]?.cells.free.text, compareContent.zh.ours.freeNone);
  assert.equal(unknown.notFit.length, 3);
  assert.equal(unknown.columns.length, 1 + rivals.length);
});

test("compare page: listed, linked and described for agents and search engines", () => {
  for (const lang of langs) {
    const t = copies[lang];
    const page = pages.find((candidate) => candidate.lang === lang && candidate.path === "/compare/");
    assert.equal(page?.markdown, `/md${localePath(lang, "/compare/")}`);
    assert.equal(linksFor(lang).compare, localePath(lang, "/compare/"));
    assert.ok(t.footer.productLinks.some((entry) => entry.link === "compare"));
    assert.ok(llmsTxt().includes(`[${t.compare.metaTitle}](${site.url}/md${localePath(lang, "/compare/")})`));
    assert.ok(homeMarkdown(lang).includes(`[${t.features.compareLink}](${site.url}${localePath(lang, "/compare/")})`));

    const markdown = compareMarkdown(lang, catalog);
    const content = compareContent[lang];
    assert.ok(markdown.startsWith(`# ${content.title}\n`));
    for (const rival of rivals) {
      for (const source of rivalSources[rival]) assert.ok(markdown.includes(`(${source.url})`), source.url);
      assert.ok(markdown.includes(content.rivals[rival].cells.attachments));
    }
    for (const row of compareRows) assert.ok(markdown.includes(`| ${content.rows[row]} |`), row);
    assert.ok(markdown.includes(`${content.marks.partial}${t.legal.colon}${content.rivals.icloud.cells.masked}`));
    assert.ok(markdown.includes(site.contact.email));
    assert.ok(!markdown.includes("undefined"));

    const graph = compareStructuredData(lang)["@graph"];
    const webPage = graph.find((node) => node["@type"] === "WebPage");
    assert.equal(webPage?.dateModified, content.reviewed);
    assert.equal(webPage?.url, `${site.url}${localePath(lang, "/compare/")}`);
  }
});
