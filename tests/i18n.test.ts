import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { linksFor } from "../src/data/site.ts";
import { en } from "../src/i18n/en.ts";
import { defaultLang, langs, localePath, stripLocale, switchPath, toLang } from "../src/i18n/index.ts";
import type { Copy } from "../src/i18n/types.ts";
import { zh } from "../src/i18n/zh.ts";
import { describeContact, formatInquiry } from "../src/lib/inquiry.ts";
import { pages, sessionPagePaths } from "../src/lib/pages.ts";
import { fillTemplate, type TemplateSlot } from "../src/lib/template.ts";

test("English is the default at the root and Chinese lives under /zh/", () => {
  assert.equal(defaultLang, "en");
  assert.equal(langs[0], defaultLang);
  assert.equal(localePath("en", "/privacy/"), "/privacy/");
  assert.equal(localePath("zh", "/privacy/"), "/zh/privacy/");
  assert.equal(localePath("zh", "/#faq"), "/zh/#faq");
  assert.equal(toLang("zh"), "zh");
  assert.equal(toLang("en"), "en");
  assert.equal(toLang(undefined), "en");
  assert.equal(toLang("fr"), "en");
});

test("switching language keeps the same page", () => {
  assert.equal(switchPath("/", "zh"), "/zh/");
  assert.equal(switchPath("/terms/", "zh"), "/zh/terms/");
  assert.equal(switchPath("/zh/", "en"), "/");
  assert.equal(switchPath("/zh/privacy/", "en"), "/privacy/");
  assert.equal(switchPath("/zh", "en"), "/");
  // An English page whose path merely starts with "zh" is not Chinese.
  assert.equal(stripLocale("/zhuanti/"), "/zhuanti/");
});

test("storefront links are this site's pages in the page language; webmail and status do not follow it", () => {
  assert.equal(linksFor("en").shop, "/shop/");
  assert.equal(linksFor("zh").shop, "/zh/shop/");
  assert.equal(linksFor("en").redeem, "/redeem/");
  assert.equal(linksFor("zh").account, "/zh/shop/account/");
  assert.equal(linksFor("zh").guide, "/zh/guide/");
  assert.equal(linksFor("en").webmail, linksFor("zh").webmail);
  assert.equal(linksFor("en").status, linksFor("zh").status);
});

/** Values that are the same in both languages: where an entry links, which icon it shows, whether it is featured. */
const languageIndependent = new Set(["link", "icon", "anchor", "featured", "primary", "path", "wide"]);

/** Keeps the structure of the copy, with each text replaced by its type, down to every field of every list item. */
const shape = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(shape)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]))
      : typeof value;

/** Keeps only the language-independent values, where they sit. */
const fixed = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(fixed)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key, item]) => languageIndependent.has(key) || (item !== null && typeof item === "object"))
            .map(([key, item]) => [key, languageIndependent.has(key) ? item : fixed(item)]),
        )
      : undefined;

test("both languages have the same shape of content, down to each list item", () => {
  assert.deepEqual(shape(en), shape(zh));
});

test("links, icons, anchors and flags are the same in both languages", () => {
  assert.deepEqual(fixed(en), fixed(zh));
});

test("the parity checks see a change inside a list item", () => {
  const product = zh.services.products[0]!;
  const withoutLink = { ...zh, services: { ...zh.services, products: [{ ...product, link: undefined }] } };
  const otherIcon = { ...zh, start: { ...zh.start, entries: zh.start.entries.toReversed() } };
  assert.notDeepEqual(shape({ ...zh, services: { ...zh.services, products: [product] } }), shape(withoutLink));
  assert.notDeepEqual(fixed(zh), fixed(otherIcon));
});

test("the English inquiry message is written in English", () => {
  const inquiry = {
    product: "Domain mailbox",
    duration: "3 months",
    notes: "",
  };
  assert.equal(
    formatInquiry(inquiry, "en"),
    "Hi, I'd like to ask about your email service.\nService: Domain mailbox\nTerm: 3 months\nPlease let me know the plan, total cost, setup time and what support is included.",
  );
  assert.match(describeContact({ wechat: "", email: "", telegram: "" }, "en"), /coming soon/);
});

test("each service card names its own icon instead of relying on its position", () => {
  for (const copy of [zh, en]) {
    const icons = copy.services.products.map(({ icon }) => icon);
    assert.equal(new Set(icons).size, icons.length, copy.htmlLang);
  }
});

const cjk = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;

test('decorative labels are English in both languages, as their lang="en" says', () => {
  for (const copy of [zh, en]) {
    const labels = [
      copy.hero.eyebrow,
      copy.video.eyebrow,
      copy.screens.eyebrow,
      copy.demo.eyebrow,
      copy.features.eyebrow,
      copy.start.eyebrow,
      copy.pricing.eyebrow,
      copy.services.eyebrow,
      copy.process.eyebrow,
      copy.faq.eyebrow,
      copy.closing.eyebrow,
      copy.footer.tagline,
      copy.inquiry.kicker,
      copy.legal.tocKicker,
      copy.download.eyebrow,
      copy.help.eyebrow,
      copy.help.articleEyebrow,
      copy.security.eyebrow,
    ];
    for (const label of labels) assert.doesNotMatch(label, cjk, `${copy.htmlLang}: ${label}`);
  }
});

test("every eyebrow on the site is marked English and takes its words from the copy", () => {
  // The Chinese pages are <html lang="zh-CN">: an unmarked English eyebrow is read with the Chinese voice.
  for (const file of readdirSync("src/components").filter((name) => name.endsWith(".tsx"))) {
    const source = readFileSync(`src/components/${file}`, "utf8");
    for (const [, tag, inner] of source.matchAll(/<Eyebrow\b([^>]*)>([\s\S]*?)<\/Eyebrow>/g)) {
      assert.match(tag!, /lang="en"/, `${file}: <Eyebrow${tag}>`);
      const text = inner!.replace(/\{[^}]*\}/g, "").replace(/<[^>]*>/g, "");
      assert.doesNotMatch(text, /[A-Za-z]/, `${file}: hard-coded words in an eyebrow: ${text.trim()}`);
    }
  }
});

type Plan = Copy["pricing"]["plan"];

/**
 * Every copy template and the slots its Template type declares. `satisfies` keeps each list equal to the type, and the
 * type keeps it equal to what the component passes, so a slot renamed on one side fails the type check.
 */
const templateSlots = {
  "theme.ariaTemplate": { label: true } satisfies Record<TemplateSlot<Copy["theme"]["ariaTemplate"]>, true>,
  "theme.titleTemplate": { label: true } satisfies Record<TemplateSlot<Copy["theme"]["titleTemplate"]>, true>,
  // The service status renders in the browser, once its request is answered.
  "serviceStatus.uptime": { percent: true, days: true } satisfies Record<
    TemplateSlot<Copy["serviceStatus"]["uptime"]>,
    true
  >,
  "footer.copyright": { year: true } satisfies Record<TemplateSlot<Copy["footer"]["copyright"]>, true>,
  "inquiry.legal": { terms: true, privacy: true } satisfies Record<TemplateSlot<Copy["inquiry"]["legal"]>, true>,
  "video.seekTemplate": { current: true, duration: true } satisfies Record<
    TemplateSlot<Copy["video"]["seekTemplate"]>,
    true
  >,
  // The pricing section and the address check render in the browser, like the inquiry dialog.
  "pricing.plan.days": { days: true } satisfies Record<TemplateSlot<Plan["days"]>, true>,
  "pricing.plan.unitPeriod": { period: true } satisfies Record<TemplateSlot<Plan["unitPeriod"]>, true>,
  "pricing.plan.cardUnitPeriod": { period: true } satisfies Record<TemplateSlot<Plan["cardUnitPeriod"]>, true>,
  "pricing.plan.discount": { percent: true } satisfies Record<TemplateSlot<Plan["discount"]>, true>,
  "pricing.plan.cardOnce": { price: true } satisfies Record<TemplateSlot<Plan["cardOnce"]>, true>,
  "pricing.plan.cardPeriod": { price: true, period: true } satisfies Record<TemplateSlot<Plan["cardPeriod"]>, true>,
  "pricing.plan.cardRowPeriod": { price: true, period: true } satisfies Record<
    TemplateSlot<Plan["cardRowPeriod"]>,
    true
  >,
  "pricing.plan.mailboxes": { count: true } satisfies Record<TemplateSlot<Plan["mailboxes"]>, true>,
  "pricing.plan.storage": { size: true } satisfies Record<TemplateSlot<Plan["storage"]>, true>,
  "pricing.plan.billingPeriod": { period: true } satisfies Record<TemplateSlot<Plan["billingPeriod"]>, true>,
  "pricing.plan.renewAt": { price: true, period: true } satisfies Record<TemplateSlot<Plan["renewAt"]>, true>,
  "pricing.plan.codeDays": { days: true } satisfies Record<TemplateSlot<Plan["codeDays"]>, true>,
  "pricing.plan.chooseAria": { name: true } satisfies Record<TemplateSlot<Plan["chooseAria"]>, true>,
  "pricing.plan.seatUnitPeriod": { period: true } satisfies Record<TemplateSlot<Plan["seatUnitPeriod"]>, true>,
  "pricing.plan.cardSeatUnitPeriod": { period: true } satisfies Record<TemplateSlot<Plan["cardSeatUnitPeriod"]>, true>,
  "pricing.plan.seatCardOnce": { price: true } satisfies Record<TemplateSlot<Plan["seatCardOnce"]>, true>,
  "pricing.plan.seatCardPeriod": { price: true, period: true } satisfies Record<
    TemplateSlot<Plan["seatCardPeriod"]>,
    true
  >,
  "pricing.plan.seatCardRowOnce": { price: true } satisfies Record<TemplateSlot<Plan["seatCardRowOnce"]>, true>,
  "pricing.plan.seatCardRowPeriod": { price: true, period: true } satisfies Record<
    TemplateSlot<Plan["seatCardRowPeriod"]>,
    true
  >,
  "pricing.plan.seatRenewAt": { price: true, period: true } satisfies Record<TemplateSlot<Plan["seatRenewAt"]>, true>,
  "pricing.plan.seatMailboxes": { min: true, max: true } satisfies Record<TemplateSlot<Plan["seatMailboxes"]>, true>,
  "pricing.plan.seatDiscountNote": { percent: true } satisfies Record<TemplateSlot<Plan["seatDiscountNote"]>, true>,
  "pricing.plan.ownDomains": { count: true } satisfies Record<TemplateSlot<Plan["ownDomains"]>, true>,
  "pricing.check.available": { email: true } satisfies Record<
    TemplateSlot<Copy["pricing"]["check"]["available"]>,
    true
  >,
  "pricing.check.taken": { email: true } satisfies Record<TemplateSlot<Copy["pricing"]["check"]["taken"]>, true>,
  // The help center's search renders in the browser too.
  "help.search.results": { count: true } satisfies Record<TemplateSlot<Copy["help"]["search"]["results"]>, true>,
};

/** Each string in the copy that has {name} slots, by its path, with the names it uses. */
const slotsIn = (value: unknown, path = ""): [string, string[]][] =>
  typeof value === "string"
    ? /\{\w+\}/.test(value)
      ? [[path, [...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name!).sort()]]
      : []
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, item]) => slotsIn(item, path ? `${path}.${key}` : key))
      : [];

test("each copy template uses exactly the slots its type declares, in both languages", () => {
  // The inquiry's legal sentence renders only once the client dialog opens: a slot misspelled in one language would
  // throw in the browser, after the prerender has passed.
  const byPath = (entries: [string, string[]][]) => Object.fromEntries(entries);
  const expected = byPath(Object.entries(templateSlots).map(([path, slots]) => [path, Object.keys(slots).sort()]));
  for (const copy of [zh, en]) assert.deepEqual(byPath(slotsIn(copy)), expected, copy.htmlLang);
  const misspelled = { ...zh, inquiry: { ...zh.inquiry, legal: "咨询与服务适用{terms}与{privcy}。" } };
  assert.notDeepEqual(slotsIn(misspelled), slotsIn(zh));
});

test("the inquiry's legal sentence keeps each language's own spacing around its links", () => {
  const links = { terms: "<terms>", privacy: "<privacy>" };
  assert.equal(fillTemplate(zh.inquiry.legal, links).join(""), "咨询与服务适用<terms>与<privacy>。");
  assert.equal(
    fillTemplate(en.inquiry.legal, links).join(""),
    "Requests and services are covered by the <terms> and <privacy>.",
  );
  assert.throws(() => fillTemplate("适用{terms}与{privcy}。", links), /privcy/);
});

test("the header's entries are home page sections or pages, and the widest bar is kept for where they all fit", () => {
  for (const copy of [zh, en]) {
    for (const entry of copy.header.nav) {
      assert.equal(Boolean(entry.anchor) !== Boolean(entry.path), true, `${copy.htmlLang}: ${entry.label}`);
      if (entry.path)
        assert.ok(
          pages.some((page) => page.path === entry.path),
          entry.path,
        );
    }
    // Six links only fit the English bar from 1200px: below that at most five show, below 1100px four. The help center
    // took the place of the home page's FAQ section there, which the footer still links to.
    assert.ok(copy.header.nav.length <= 6, copy.htmlLang);
    assert.ok(copy.header.nav.some((entry) => entry.path === "/help/"));
    const shown = (hidden: string[]) => copy.header.nav.filter(({ wide }) => !hidden.includes(wide ?? "")).length;
    assert.ok(shown(["bar"]) <= 5 && shown(["bar", "card"]) <= 4, copy.htmlLang);
  }
});

test("the copyright line takes the year through a template slot", () => {
  assert.equal(fillTemplate(zh.footer.copyright, { year: 2027 }).join(""), "© 2027 Abnormal. 让沟通更简单。");
  assert.equal(fillTemplate(en.footer.copyright, { year: 2027 }).join(""), "© 2027 Abnormal. Mail made simple.");
});

test("the old English addresses under /en/ redirect permanently to the root", async () => {
  const { default: config } = await import("../next.config.ts");
  const redirects = await config("phase-production-build").redirects!();
  const moved = (source: string) => redirects.find((rule) => rule.source === source && !rule.has);
  for (const page of pages.filter(({ lang }) => lang === "en")) {
    for (const [legacy, current] of [
      [`/en${page.url}`, page.url],
      [`/md/en${page.url}`, page.markdown],
    ]) {
      const rule = moved(legacy!);
      assert.ok(rule, `${legacy} has no redirect`);
      assert.deepEqual([rule.destination, "statusCode" in rule && rule.statusCode], [current, 301], legacy);
    }
  } // The storefront's session pages had their English version under /en/ on the old onboard site.
  for (const path of sessionPagePaths) {
    const rule = moved(`/en${path}`);
    assert.ok(rule, `/en${path} has no redirect`);
    assert.deepEqual([rule.destination, "statusCode" in rule && rule.statusCode], [path, 301], path);
  }
});
